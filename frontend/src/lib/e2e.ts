export interface E2EKeyPair {
  publicKey: string;
  privateKey: JsonWebKey;
}

export interface E2ESession {
  chatId: string;
  sessionKey: CryptoKey;
  createdAt: number;
  keyFingerprint: string;
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
}

const E2E_KEY_PREFIX = 'nexo_e2e_identity_';
const E2E_SESSION_PREFIX = 'nexo_e2e_session_';
const E2E_DEVICE_ID_KEY = 'nexo_e2e_device_id';
const E2E_SIGNED_PREKEY_PREFIX = 'nexo_e2e_signed_prekey_';

export interface SignedPreKey {
  pair: E2EKeyPair;
  sig: string;
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buf));
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  return base64ToBytes(base64).buffer as ArrayBuffer;
}

function concatBuffers(a: ArrayBuffer, b: ArrayBuffer): ArrayBuffer {
  const result = new Uint8Array(a.byteLength + b.byteLength);
  result.set(new Uint8Array(a), 0);
  result.set(new Uint8Array(b), a.byteLength);
  return result.buffer as ArrayBuffer;
}

function generateDeviceId(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(E2E_DEVICE_ID_KEY);
    if (!id) {
      id = generateDeviceId();
      localStorage.setItem(E2E_DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return generateDeviceId();
  }
}

export async function generateKeyPair(): Promise<E2EKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const publicKeySpki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  return {
    publicKey: arrayBufferToBase64(publicKeySpki),
    privateKey: privateKeyJwk,
  };
}

export async function importPublicKey(spkiBase64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    base64ToArrayBuffer(spkiBase64),
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

export async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey', 'deriveBits']
  );
}

export async function computeSharedSecret(
  myPrivateKeyJwk: JsonWebKey,
  theirPublicKeySpki: string
): Promise<ArrayBuffer> {
  const privateKey = await importPrivateKey(myPrivateKeyJwk);
  const publicKey = await importPublicKey(theirPublicKeySpki);
  return crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  );
}

export async function deriveSessionKeyStatic(
  sharedSecret: ArrayBuffer,
  salt?: Uint8Array
): Promise<{ key: CryptoKey; salt: string }> {
  const s = new Uint8Array(salt || crypto.getRandomValues(new Uint8Array(16)));
  const info = new TextEncoder().encode('nexo-e2e-v1');
  const baseKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    'HKDF',
    false,
    ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: s, info },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  return { key, salt: bytesToBase64(s) };
}

export async function encryptMessage(key: CryptoKey, plaintext: string): Promise<EncryptedPayload> {
  const iv = new Uint8Array(crypto.getRandomValues(new Uint8Array(12)));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  return {
    ciphertext: arrayBufferToBase64(encrypted),
    iv: bytesToBase64(iv),
  };
}

export async function decryptMessage(key: CryptoKey, payload: EncryptedPayload): Promise<string> {
  const iv = new Uint8Array(base64ToBytes(payload.iv));
  const ciphertext = base64ToArrayBuffer(payload.ciphertext);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

export async function encryptMedia(key: CryptoKey, blob: Blob): Promise<Blob> {
  const ivRaw = crypto.getRandomValues(new Uint8Array(12));
  const iv = new Uint8Array(ivRaw);
  const data = await blob.arrayBuffer();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  const ivBytes = iv.buffer as ArrayBuffer;
  const combined = concatBuffers(ivBytes, encrypted);
  return new Blob([combined], { type: 'application/octet-stream' });
}

export async function decryptMedia(key: CryptoKey, encryptedBlob: Blob, originalMimeType: string): Promise<Blob> {
  const data = await encryptedBlob.arrayBuffer();
  const iv = new Uint8Array(data, 0, 12);
  const ciphertext = data.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new Blob([decrypted], { type: originalMimeType });
}

export async function getKeyFingerprint(publicKeySpki: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', base64ToArrayBuffer(publicKeySpki));
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function saveIdentityKeyPair(userId: string, keyPair: E2EKeyPair): void {
  try {
    localStorage.setItem(E2E_KEY_PREFIX + userId, JSON.stringify(keyPair));
  } catch {}
}

export function loadIdentityKeyPair(userId: string): E2EKeyPair | null {
  const raw = localStorage.getItem(E2E_KEY_PREFIX + userId);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function saveSignedPreKey(userId: string, data: SignedPreKey): void {
  try {
    localStorage.setItem(E2E_SIGNED_PREKEY_PREFIX + userId, JSON.stringify(data));
  } catch {}
}

export function loadSignedPreKey(userId: string): SignedPreKey | null {
  const raw = localStorage.getItem(E2E_SIGNED_PREKEY_PREFIX + userId);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function saveSession(chatId: string, session: E2ESession): void {
  const exportable = {
    chatId: session.chatId,
    createdAt: session.createdAt,
    keyFingerprint: session.keyFingerprint,
  };
  try {
    localStorage.setItem(E2E_SESSION_PREFIX + chatId, JSON.stringify(exportable));
  } catch {}
}

export function getSessionInfo(chatId: string): { createdAt: number; keyFingerprint: string } | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(E2E_SESSION_PREFIX + chatId);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return { createdAt: data.createdAt, keyFingerprint: data.keyFingerprint };
  } catch { return null; }
}

export async function signData(privateKeyJwk: JsonWebKey, data: string): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const encoded = new TextEncoder().encode(data);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoded
  );
  return arrayBufferToBase64(signature);
}

const activeSessions = new Map<string, CryptoKey>();

export function setActiveSessionKey(chatId: string, key: CryptoKey): void {
  activeSessions.set(chatId, key);
}

export function getActiveSessionKey(chatId: string): CryptoKey | undefined {
  return activeSessions.get(chatId);
}

export function hasActiveSession(chatId: string): boolean {
  return activeSessions.has(chatId);
}

// ─── E2E Group Sessions ─────────────────────────────────────────────────
// Групповой E2E: один общий ключ K (32 байта) на чат. Каждый участник
// получает wrapped-версию K, зашифрованную AES-GCM на ECDH-секрете со своей
// identity-пары. Сервер хранит только обёртки и не знает приватных ключей.

const E2E_GROUP_INFO_PREFIX = 'nexo_e2e_group_info_';
const E2E_STORY_KEY_PREFIX = 'nexo_e2e_story_key_';

// Общие ключи групп в памяти: chatId → AES-GCM CryptoKey
export const groupKeys: Record<string, CryptoKey> = {};

export function setActiveGroupKey(chatId: string, key: CryptoKey): void {
  groupKeys[chatId] = key;
}

export function getActiveGroupKey(chatId: string): CryptoKey | undefined {
  return groupKeys[chatId];
}

export function hasActiveGroup(chatId: string): boolean {
  return Object.prototype.hasOwnProperty.call(groupKeys, chatId);
}

export function clearActiveGroupKey(chatId: string): void {
  delete groupKeys[chatId];
  try {
    localStorage.removeItem(E2E_GROUP_INFO_PREFIX + chatId);
  } catch {}
}

export function saveGroupSessionInfo(chatId: string, keyFingerprint: string): void {
  try {
    localStorage.setItem(
      E2E_GROUP_INFO_PREFIX + chatId,
      JSON.stringify({ createdAt: Date.now(), keyFingerprint })
    );
  } catch {}
}

export function getGroupSessionInfo(chatId: string): { createdAt: number; keyFingerprint: string } | null {
  try {
    const raw = localStorage.getItem(E2E_GROUP_INFO_PREFIX + chatId);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return { createdAt: data.createdAt, keyFingerprint: data.keyFingerprint };
  } catch { return null; }
}

// Генерирует общий групповой ключ K (32 байта, base64)
export function generateGroupSymmetricKey(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
}

// HKDF для обёрток группового ключа (отдельный info-домен от личных сессий)
export async function deriveGroupWrapKey(
  sharedSecret: ArrayBuffer,
  salt?: Uint8Array
): Promise<{ key: CryptoKey; salt: string }> {
  const s = new Uint8Array(salt || crypto.getRandomValues(new Uint8Array(16)));
  const info = new TextEncoder().encode('nexo-e2e-group-v1');
  const baseKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: s, info },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  return { key, salt: bytesToBase64(s) };
}

export async function importGroupKey(rawB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    base64ToArrayBuffer(rawB64),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

// Обёртка ключа K для конкретного участника: "cipher.iv.salt"
export async function wrapGroupKeyFor(sharedSecret: ArrayBuffer, groupKeyB64: string): Promise<string> {
  const { key, salt } = await deriveGroupWrapKey(sharedSecret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    base64ToArrayBuffer(groupKeyB64)
  );
  return `${arrayBufferToBase64(encrypted)}.${bytesToBase64(iv)}.${salt}`;
}

// Разворачивание wrapped-ключа группы
export async function unwrapGroupKeyFor(sharedSecret: ArrayBuffer, wrappedKey: string): Promise<string> {
  const parts = wrappedKey.split('.');
  if (parts.length !== 3) throw new Error('Invalid wrapped key format');
  const cipher = parts[0];
  const ivB64 = parts[1];
  const saltB64 = parts[2];
  const { key } = await deriveGroupWrapKey(sharedSecret, base64ToBytes(saltB64));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(ivB64) },
    key,
    base64ToArrayBuffer(cipher)
  );
  return arrayBufferToBase64(decrypted);
}

export async function groupKeyFingerprint(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  const hash = await crypto.subtle.digest('SHA-256', raw);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

// ─── Secret stories: локальное хранение ключа K ─────────────────────────
// Ключ секретной истории (K) хранится локально, чтобы владелец мог
// пересмотреть свою историю; зрители разворачивают myWrappedKey через ECDH.

const storyKeysCache: Record<string, string> = {};

export function saveStoryKey(storyId: string, keyB64: string): void {
  storyKeysCache[storyId] = keyB64;
  try {
    localStorage.setItem(E2E_STORY_KEY_PREFIX + storyId, keyB64);
  } catch {}
}

export function getStoryKey(storyId: string): string | null {
  if (storyKeysCache[storyId]) return storyKeysCache[storyId];
  try {
    const raw = localStorage.getItem(E2E_STORY_KEY_PREFIX + storyId);
    if (!raw) return null;
    storyKeysCache[storyId] = raw;
    return raw;
  } catch { return null; }
}
