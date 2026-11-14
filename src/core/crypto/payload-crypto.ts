/**
 * AES-256-GCM helpers shared by the browser and the Worker (Web Crypto only —
 * no DOM, no Node). Wire format: base64( iv(12 bytes) || ciphertext+tag ).
 * Key = SHA-256(passphrase), so any string works as the configured key.
 *
 * NOTE: the browser must hold the key to encrypt, so this hides payloads from
 * DevTools/proxies/casual inspection; it is NOT a substitute for HTTPS or for
 * server-side authorization.
 */
const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const keyCache = new Map<string, Promise<CryptoKey>>();
function importKey(passphrase: string): Promise<CryptoKey> {
  let k = keyCache.get(passphrase);
  if (!k) {
    k = crypto.subtle
      .digest('SHA-256', enc.encode(passphrase))
      .then((hash) => crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']));
    keyCache.set(passphrase, k);
  }
  return k;
}

export async function encryptText(plain: string, passphrase: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await importKey(passphrase), enc.encode(plain)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv); out.set(ct, iv.length);
  return toB64(out);
}

export async function decryptText(payload: string, passphrase: string): Promise<string> {
  const bytes = fromB64(payload);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await importKey(passphrase), bytes.slice(12));
  return dec.decode(plain);
}

/** Header that marks a request/response body as encrypted. */
export const ENCRYPTED_HEADER = 'x-encrypted';
