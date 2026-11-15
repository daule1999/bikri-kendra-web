import { getRuntimeConfig } from '@/core/config/runtime-flags';
import { ENCRYPTED_HEADER, decryptText, encryptText } from '@/core/crypto/payload-crypto';

/** Marks a request as coming from our own pages (checked by the Worker as a CSRF guard). */
const CSRF_HEADER = 'X-Requested-With';
const CSRF_VALUE = 'bikri';

/**
 * fetch() for /api calls. EVERY API call in the app goes through here (core http client,
 * legacy apiClient, RTK Query). It
 *  - adds the CSRF header,
 *  - when the Worker reports encryptApi=true, sends the JSON body as {"enc": "<ciphertext>"}
 *    and decrypts encrypted responses back into a normal Response.
 * Session cookies are sent automatically (same-origin); no token is ever handled here.
 */
export async function apiFetch(input: string | Request, init: RequestInit = {}): Promise<Response> {
  // RTK Query's fetchBaseQuery hands over a Request object: flatten it to url + init.
  if (typeof input !== 'string') {
    const req = input;
    const hasBody = !['GET', 'HEAD'].includes(req.method.toUpperCase());
    return apiFetch(req.url, { method: req.method, headers: req.headers, signal: req.signal, body: hasBody ? await req.text() : undefined, credentials: req.credentials });
  }

  const headers = new Headers(init.headers);
  headers.set(CSRF_HEADER, CSRF_VALUE);

  const { encryptApi, encryptionKey } = getRuntimeConfig();
  if (!encryptApi) return fetch(input, { ...init, headers });
  if (!encryptionKey) throw new Error('API encryption is enabled but no key was provided by the Worker');

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
