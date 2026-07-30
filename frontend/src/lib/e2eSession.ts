import { api } from './api';
import {
  generateKeyPair, getDeviceId, saveIdentityKeyPair, loadIdentityKeyPair,
  computeSharedSecret, deriveSessionKeyStatic,
  encryptMessage, decryptMessage,
  encryptMedia, decryptMedia,
  getKeyFingerprint,
  saveSession, getSessionInfo, removeSession,
  signData, getActiveSessionKey, setActiveSessionKey, clearActiveSessionKey,
  hasActiveSession,
  type E2EKeyPair, type EncryptedPayload,
} from './e2e';
import { getSocket } from './socket';

interface E2EInitOptions {
  userId: string;
  chatId: string;
  otherUserId: string;
}

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
    const signedPreKeyPair = await generateKeyPair();
    const signedPreKeySig = await signData(keyPair.privateKey, signedPreKeyPair.publicKey);
    const oneTimeKeys = await Promise.all(
      Array.from({ length: 20 }, () => generateKeyPair())
    );

    await api.uploadKeyBundle({
      identityKey: keyPair.publicKey,
      signedPreKey: signedPreKeyPair.publicKey,
      signedKeySig: signedPreKeySig,
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

  async verifyExistingSession(chatId: string, userId: string, otherUserId: string): Promise<boolean> {
    try {
      const existingInfo = getSessionInfo(chatId);
      if (!existingInfo) return false;

      const activeKey = getActiveSessionKey(chatId);
      if (activeKey) return true;

      const resp = await api.getE2ESession(chatId);
      if (!resp.isActive) return false;

      const myKeyPair = loadIdentityKeyPair(userId);
      if (!myKeyPair) return false;

      const otherResp = await api.fetchKeyBundle(otherUserId);
      if (!otherResp.bundles || otherResp.bundles.length === 0) return false;

      const sharedSecret = await computeSharedSecret(myKeyPair.privateKey, otherResp.bundles[0].identityKey);
      const { key } = await deriveSessionKeyStatic(sharedSecret);
      setActiveSessionKey(chatId, key);

      return true;
    } catch {
      return false;
    }
  }

  async getSessionKey(chatId: string): Promise<CryptoKey | undefined> {
    return getActiveSessionKey(chatId);
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

  closeSession(chatId: string): void {
    clearActiveSessionKey(chatId);
    removeSession(chatId);
  }
}

export const e2eManager = new E2ESessionManager();
