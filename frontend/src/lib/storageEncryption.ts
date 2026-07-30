const KEY_STORAGE = 'nexo_crypto_key';
const SALT_SIZE = 12; // AES-GCM IV is 12 bytes

async function getOrCreateKey(): Promise<CryptoKey> {
    const stored = localStorage.getItem(KEY_STORAGE);
    if (stored) {
        const keyData = base64ToBytes(stored).buffer as ArrayBuffer;
        return await crypto.subtle.importKey(
            'raw', keyData, { name: 'AES-GCM' },
            false, ['encrypt', 'decrypt']
        );
    }
    const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true, ['encrypt', 'decrypt']
    );
    const exported = await crypto.subtle.exportKey('raw', key);
    localStorage.setItem(KEY_STORAGE, bytesToBase64(new Uint8Array(exported)));
    return key;
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

export async function saveEncrypted(key: string, data: unknown): Promise<void> {
    try {
        const jsonString = JSON.stringify(data);
        const dataBytes = new TextEncoder().encode(jsonString);
        const cryptoKey = await getOrCreateKey();
        const iv = crypto.getRandomValues(new Uint8Array(SALT_SIZE));
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv }, cryptoKey, dataBytes.buffer as ArrayBuffer
        );
        const combined = new Uint8Array(SALT_SIZE + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), SALT_SIZE);
        localStorage.setItem(key, bytesToBase64(combined));
    } catch (error) {
        console.error('Failed to encrypt and save:', key, error);
    }
}

export async function loadDecrypted(key: string): Promise<unknown | null> {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const combined = base64ToBytes(raw);
        if (combined.length < SALT_SIZE) return null;
        const iv = combined.slice(0, SALT_SIZE);
        const ciphertext = combined.slice(SALT_SIZE);
        const cryptoKey = await getOrCreateKey();
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv }, cryptoKey, ciphertext
        );
        const jsonString = new TextDecoder().decode(decrypted);
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('Failed to decrypt and load:', key, error);
        return null;
    }
}

export function saveTimestamp(key: string, timestamp: number): void {
    localStorage.setItem(key, timestamp.toString());
}

export function loadTimestamp(key: string): number | null {
    const value = localStorage.getItem(key);
    return value ? parseInt(value, 10) : null;
}

export function clearEncryptedData(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('nexo_') && !k.endsWith('_timestamp')) {
            keysToRemove.push(k);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
}
