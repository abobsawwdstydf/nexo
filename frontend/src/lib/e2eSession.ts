import { api } from './api';
import {
  generateKeyPair, getDeviceId, saveIdentityKeyPair, loadIdentityKeyPair,
  computeSharedSecret, deriveSessionKeyStatic,
  encryptMessage, decryptMessage,
  encryptMedia, decryptMedia,
  getKeyFingerprint,
  saveSession,
  signData, getActiveSessionKey, setActiveSessionKey,
  saveSignedPreKey, loadSignedPreKey,
} from './e2e';

interface E2EInitOptions {
  userId: string;
  chatId: string;
  otherUserId: string;
}

const ONE_TIME_KEY_COUNT = 20;

export class E2ESessionManager {
  private initialized = false;

  async initialize(userId: string): Promise<void> {
    if (this.initialized) return;

    let keyPair = loadIdentityKeyPair(userId);
    if (!keyPair) {
      keyPair = await generateKeyPair();
      saveIdentityKeyPair(userId, keyPair);
    }

    const deviceId = getDeviceId();

    // Persist the signed prekey: without persistence its private half is lost
    // on every page reload, so handshakes that already fetched its public half
    // can never be completed by this device.
    let signedPreKey = loadSignedPreKey(userId);
    if (!signedPreKey) {
      const spk = await generateKeyPair();
      const sig = await signData(keyPair.privateKey, spk.publicKey);
      signedPreKey = { pair: spk, sig };
      saveSignedPreKey(userId, signedPreKey);
    }

    // Fetch our own current bundle and only top up what has been consumed,
    // instead of overwriting the whole bundle on every load. Overwriting
    // churns the one-time prekeys that peers may already have fetched but not
    // yet consumed, silently breaking in-flight handshakes.
    try {
      const mine = await api.fetchKeyBundle(userId);
      const existing = mine.bundles?.find(b => b.deviceId === deviceId);
      if (
        existing &&
        existing.identityKey === keyPair.publicKey &&
        existing.signedPreKey === signedPreKey.pair.publicKey
      ) {
        const remaining = Array.isArray(existing.oneTimePreKeys) ? existing.oneTimePreKeys : [];
        if (remaining.length < ONE_TIME_KEY_COUNT) {
          const topUp = await Promise.all(
            Array.from({ length: ONE_TIME_KEY_COUNT - remaining.length }, () => generateKeyPair())
          );
          await api.uploadKeyBundle({
            identityKey: keyPair.publicKey,
            signedPreKey: signedPreKey.pair.publicKey,
            signedKeySig: signedPreKey.sig,
            oneTimePreKeys: [...remaining, ...topUp.map(k => k.publicKey)],
            deviceId,
          });
        }
        this.initialized = true;
        return;
      }
    } catch {
      // No bundle uploaded yet or lookup failed — fall through to a fresh upload.
    }

    const oneTimeKeys = await Promise.all(
      Array.from({ length: ONE_TIME_KEY_COUNT }, () => generateKeyPair())
    );

    await api.uploadKeyBundle({
      identityKey: keyPair.publicKey,
      signedPreKey: signedPreKey.pair.publicKey,
      signedKeySig: signedPreKey.sig,
      oneTimePreKeys: oneTimeKeys.map(k => k.publicKey),
      deviceId,
    });

    this.initialized = true;
  }

  async establishSession({ userId, chatId, otherUserId }: E2EInitOptions): Promise<boolean> {
    try {
      const myKeyPair = loadIdentityKeyPair(userId);
      if (!myKeyPair) throw new Error('Identity key pair not found');

      const resp = await api.fetchKeyBundle(otherUserId);
      if (!resp.bundles || resp.bundles.length === 0) return false;

      const theirBundle = resp.bundles[0];
      const consumeResp = await api.consumeOneTimePreKey(otherUserId);
      if (!consumeResp.oneTimePreKey) return false;

      const dh1 = await computeSharedSecret(myKeyPair.privateKey, theirBundle.identityKey);
      const dh2 = await computeSharedSecret(myKeyPair.privateKey, theirBundle.signedPreKey);
      const dh3 = await computeSharedSecret(myKeyPair.privateKey, consumeResp.oneTimePreKey);

      const combined = new Uint8Array(dh1.byteLength + dh2.byteLength + dh3.byteLength);
      combined.set(new Uint8Array(dh1), 0);
      combined.set(new Uint8Array(dh2), dh1.byteLength);
      combined.set(new Uint8Array(dh3), dh1.byteLength + dh2.byteLength);

      const { key, salt } = await deriveSessionKeyStatic(combined.buffer as ArrayBuffer);
      setActiveSessionKey(chatId, key);

      const fingerprint = await getKeyFingerprint(theirBundle.identityKey);
      saveSession(chatId, { chatId, sessionKey: key, createdAt: Date.now(), keyFingerprint: fingerprint });

      const testMessage = await encryptMessage(key, 'e2e_session_init');
      await api.initE2ESession({
        chatId,
        encryptedKey: testMessage.ciphertext + '.' + testMessage.iv + '.' + salt,
      });

      return true;
    } catch (err) {
      console.error('[E2E] Failed to establish session:', err);
      return false;
    }
  }

  async encryptChatMessage(chatId: string, content: string): Promise<{ encryptedContent: string; iv: string } | null> {
    const key = getActiveSessionKey(chatId);
    if (!key) return null;
    const result = await encryptMessage(key, content);
    return { encryptedContent: result.ciphertext, iv: result.iv };
  }

  async decryptChatMessage(chatId: string, encryptedContent: string, iv: string): Promise<string | null> {
    const key = getActiveSessionKey(chatId);
    if (!key) return null;
    try {
      return await decryptMessage(key, { ciphertext: encryptedContent, iv });
    } catch {
      return null;
    }
  }

  async encryptChatMedia(chatId: string, blob: Blob): Promise<Blob | null> {
    const key = getActiveSessionKey(chatId);
    if (!key) return null;
    return encryptMedia(key, blob);
  }

  async decryptChatMedia(chatId: string, encryptedBlob: Blob, mimeType: string): Promise<Blob | null> {
    const key = getActiveSessionKey(chatId);
    if (!key) return null;
    try {
      return await decryptMedia(key, encryptedBlob, mimeType);
    } catch {
      return null;
    }
  }
}

export const e2eManager = new E2ESessionManager();
