/** Normalised error thrown by the HTTP client for any non-2xx response or network failure. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown = null,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthorized() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isNetworkError() { return this.status === 0; }
}

/** Pulls the most useful human message out of a backend error body. */
export function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    for (const key of ['message', 'error', 'detail']) {
      if (typeof b[key] === 'string' && b[key]) return b[key] as string;
    }
  }
  if (typeof body === 'string' && body.trim()) return body;
  return fallback;
}
