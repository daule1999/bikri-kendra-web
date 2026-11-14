import { RUNTIME_FLAGS } from '@/core/config/runtime-flags';
import { ENCRYPTED_HEADER, decryptText, encryptText } from '@/core/crypto/payload-crypto';

/**
 * fetch() for /api calls. When NEXT_PUBLIC_ENCRYPT_API=true the JSON body is
 * sent as {"enc": "<ciphertext>"} and encrypted responses are decrypted back
 * into a normal Response, so callers never see the difference.
 * Every API call in the app (core http client + legacy apiClient) goes through here.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { encryptApi, encryptionKey } = RUNTIME_FLAGS;
  if (!encryptApi) return fetch(input, init);
  if (!encryptionKey) throw new Error('NEXT_PUBLIC_API_ENCRYPTION_KEY is not set but API encryption is enabled');

  const headers = new Headers(init.headers);
  headers.set(ENCRYPTED_HEADER, '1');
  let body = init.body;
  if (typeof body === 'string') {
    body = JSON.stringify({ enc: await encryptText(body, encryptionKey) });
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(input, { ...init, headers, body });
  if (res.headers.get(ENCRYPTED_HEADER) !== '1') return res;

  const text = await res.text();
  let plain = '';
  try { plain = await decryptText((JSON.parse(text) as { enc: string }).enc, encryptionKey); }
  catch { return new Response(text, { status: res.status, statusText: res.statusText, headers: res.headers }); }
  const out = new Headers(res.headers);
  out.delete(ENCRYPTED_HEADER); out.delete('content-length');
  return new Response(res.status === 204 ? null : plain, { status: res.status, statusText: res.statusText, headers: out });
}
