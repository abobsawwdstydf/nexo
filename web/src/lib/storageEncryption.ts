// Simple encryption for localStorage data
const STORAGE_KEY = 'nexo_storage_key_v1';

// Get or generate encryption key
function getStorageKey(): string {
  let key = localStorage.getItem(STORAGE_KEY);
  if (!key) {
    key = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    localStorage.setItem(STORAGE_KEY, key);
  }
  return key;
}

// Convert string to Uint8Array
function strToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Convert Uint8Array to base64 string
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 string to Uint8Array
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Simple XOR encryption with key (not cryptographically secure, but obfuscates data)
function xorEncrypt(data: string, key: string): string {
  const keyBytes = strToBytes(key);
  const dataBytes = strToBytes(data);
  const encrypted = new Uint8Array(dataBytes.length);
  for (let i = 0; i < dataBytes.length; i++) {
    encrypted[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return bytesToBase64(encrypted);
}

function xorDecrypt(encrypted: string, key: string): string {
  const keyBytes = strToBytes(key);
  const encryptedBytes = base64ToBytes(encrypted);
  const decrypted = new Uint8Array(encryptedBytes.length);
  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(decrypted);
}

// Encrypt and save to localStorage
export function saveEncrypted(key: string, data: any): void {
  try {
    const storageKey = getStorageKey();
    const jsonString = JSON.stringify(data);
    const encrypted = xorEncrypt(jsonString, storageKey);
    localStorage.setItem(key, encrypted);
  } catch (error) {
    console.error('Failed to encrypt and save:', key, error);
    // Fallback: save unencrypted
    localStorage.setItem(key, JSON.stringify(data));
  }
}

// Load and decrypt from localStorage
export function loadDecrypted(key: string): any | null {
  try {
    const storageKey = getStorageKey();
    const encrypted = localStorage.getItem(key);
    if (!encrypted) return null;
    
    const decrypted = xorDecrypt(encrypted, storageKey);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Failed to decrypt and load:', key, error);
    // Try to load as unencrypted (fallback)
    const fallback = localStorage.getItem(key);
    if (fallback) {
      try {
        return JSON.parse(fallback);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Save timestamp (unencrypted, needed for cache validation)
export function saveTimestamp(key: string, timestamp: number): void {
  localStorage.setItem(key, timestamp.toString());
}

// Load timestamp
export function loadTimestamp(key: string): number | null {
  const value = localStorage.getItem(key);
  return value ? parseInt(value, 10) : null;
}

// Clear all encrypted data
export function clearEncryptedData(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('nexo_') && !key.endsWith('_timestamp'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}
