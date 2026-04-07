const encoder = new TextEncoder();

function normalizeSecret(secret: string): Uint8Array {
  const raw = encoder.encode(secret);
  const keyBytes = new Uint8Array(32);
  keyBytes.set(raw.slice(0, 32));
  return keyBytes;
}

async function importKey(secret: string) {
  return crypto.subtle.importKey('raw', normalizeSecret(secret), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encryptApiKey(plainText: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importKey(secret);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plainText),
  );

  return {
    cipherText: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptApiKey(cipherText: string, iv: string, secret: string) {
  const key = await importKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    key,
    base64ToBytes(cipherText),
  );

  return new TextDecoder().decode(decrypted);
}
