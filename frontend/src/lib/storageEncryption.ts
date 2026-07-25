// Local storage encryption — synchronous API with per-value random salt
// Uses derived key + salted XOR: identical plaintexts produce different ciphertexts
//
// Security model: prevents casual localStorage inspection / XSS data exfil.
// NOT equivalent to server-side encryption — key lives in the browser.

const OLD_XOR_KEY = 'nexo_storage_key_v1';
const KEY_MATERIAL = 'nexo_storage_key_v2';
const SALT_SIZE = 16;

// --- Helpers ---

function strToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// --- Deterministic key derivation (synchronous) ---

// Iterate mixing rounds over passphrase to derive a 32-byte key
function deriveKey(passphrase: string): Uint8Array {
  let hash = strToBytes(passphrase);
  for (let round = 0; round < 1000; round++) {
    const next = new Uint8Array(hash.length);
    for (let i = 0; i < hash.length; i++) {
      next[i] = hash[i] ^ (hash[(i + 1) % hash.length] + round);
    }
    hash = next;
  }
  return hash;
}

function getKeyMaterial(): string {
  let key = localStorage.getItem(KEY_MATERIAL);
  if (!key) {
    key = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
    localStorage.setItem(KEY_MATERIAL, key);
  }
  return key;
}

const _derivedKey = deriveKey(getKeyMaterial());

// --- Per-value salted XOR ---

function encryptData(plaintext: string): string {
  const dataBytes = strToBytes(plaintext);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_SIZE));
  const encrypted = new Uint8Array(SALT_SIZE + dataBytes.length);
  encrypted.set(salt, 0);
  for (let i = 0; i < dataBytes.length; i++) {
    encrypted[SALT_SIZE + i] = dataBytes[i] ^ _derivedKey[(i + salt[i % SALT_SIZE]) % _derivedKey.length];
  }
  return bytesToBase64(encrypted);
}

function decryptData(encryptedBase64: string): string | null {
  try {
    const combined = base64ToBytes(encryptedBase64);
    if (combined.length < SALT_SIZE) return null;
    const salt = combined.slice(0, SALT_SIZE);
    const ciphertext = combined.slice(SALT_SIZE);
    const decrypted = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i++) {
      decrypted[i] = ciphertext[i] ^ _derivedKey[(i + salt[i % SALT_SIZE]) % _derivedKey.length];
    }
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

// --- Old XOR decrypt (for migration) ---

function xorDecryptOld(encrypted: string, key: string): string {
  const keyBytes = strToBytes(key);
  const encryptedBytes = base64ToBytes(encrypted);
  const decrypted = new Uint8Array(encryptedBytes.length);
  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(decrypted);
}

// --- Public API (synchronous) ---

// Encrypt and save to localStorage
export function saveEncrypted(key: string, data: any): void {
  try {
    const jsonString = JSON.stringify(data);
    const encrypted = encryptData(jsonString);
    localStorage.setItem(key, encrypted);
  } catch (error) {
    console.error('Failed to encrypt and save:', key, error);
  }
}

// Load and decrypt from localStorage
export function loadDecrypted(key: string): any | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    // Try new encryption first
    const decrypted = decryptData(raw);
    if (decrypted !== null) {
      try {
        return JSON.parse(decrypted);
      } catch {
        // Not JSON — might be old format
      }
    }

    // Try old XOR-encrypted data and migrate
    const oldKey = localStorage.getItem(OLD_XOR_KEY);
    if (oldKey) {
      try {
        const plaintext = xorDecryptOld(raw, oldKey);
        const parsed = JSON.parse(plaintext);
        // Migrate to new encryption
        saveEncrypted(key, parsed);
        return parsed;
      } catch {
        // Truly corrupted
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to decrypt and load:', key, error);
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
    if (key && key.startsWith('nexo_') && !key.endsWith('_timestamp')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}
