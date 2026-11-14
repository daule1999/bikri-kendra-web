/** Small helpers shared by custom handlers. */
export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export async function readJson<T = any>(request: Request): Promise<T | null> {
  try { return (await request.json()) as T; } catch { return null; }
}

export async function bodyOf(res: Response): Promise<any> {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

/** Re-emits an upstream response (status + body), normalising the content type. */
export async function passThrough(res: Response): Promise<Response> {
  if (res.status === 204) return new Response(null, { status: 204 });
  const text = await res.text();
  return new Response(text, { status: res.status, headers: { 'content-type': res.headers.get('content-type') || 'application/json' } });
}

/** Backend list payloads come as [], {content:[]}, or {data:[]}. */
export function extractRows(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw?.content !== undefined) return raw.content ?? [];
  return raw?.data ?? [];
}

export const unwrap = (raw: any) => raw?.data ?? raw;
