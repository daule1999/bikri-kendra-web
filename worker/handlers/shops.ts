import type { RouteHandler } from '../types';
import { json, passThrough, readJson } from './http';

/** POST /api/shops — creating a shop is the backend's /shops/register. */
export const registerShop: RouteHandler = async ({ request, backend }) =>
  passThrough(await backend('/api/sales-svc/shops/register', { method: 'POST', body: await readJson(request) }));

/** POST /api/shops-staff/unassign {userId} → DELETE /shops-staff/user/{userId}. */
export const unassignStaff: RouteHandler = async ({ request, backend }) => {
  const body = await readJson<{ userId?: string | number }>(request);
  if (!body?.userId) return json(400, { error: 'userId is required in request body' });
  const res = await backend(`/api/sales-svc/shops-staff/user/${encodeURIComponent(String(body.userId))}`, { method: 'DELETE' });
  return new Response(null, { status: res.ok ? 200 : res.status });
};
