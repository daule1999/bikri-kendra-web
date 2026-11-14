# Bikri Kendra (Cloudflare) — Architecture

Static Next.js export (`./out`) served by a Cloudflare Worker. The Worker serves
pages from static assets and is the **single shared proxy** for `/api/*`.

```
bikri-kendra-cloudflare/
├── worker/                      # Cloudflare Worker — the ONLY backend-facing code
│   ├── index.ts                 #   /api/* → proxy, everything else → static assets
│   ├── proxy.ts                 #   header allowlist, URL rewrite, error shaping
│   ├── proxy-rules.ts           #   public prefix → backend service table (allowlist)
│   ├── handlers/index.ts        #   rare non-pass-through (BFF) routes, keyed by path
│   └── types.ts
├── scripts/check-tokens.mjs     # build fails on raw hex/rgb or inline style={{}} outside core/theme
└── src/
    ├── app/                     # Next routes ONLY — each page.tsx is a one-line re-export
    │   ├── layout.tsx           #   <AuthProvider>
    │   ├── page.tsx             #   → features/auth  LoginPage
    │   ├── dashboard/page.tsx   #   → features/dashboard DashboardPage
    │   ├── not-found.tsx        #   "Coming soon" for unmigrated modules
    │   └── globals.css          #   imports tailwind + core/theme/*
    ├── core/                    # app-wide infrastructure (no feature imports)
    │   ├── config/              #   APP constants, ROUTES, STORAGE_KEYS, timings
    │   ├── theme/               #   tokens.css (CSS vars) · theme.css (Tailwind bridge) · base.css
    │   ├── api/                 #   http client, ApiError, core endpoints
    │   ├── auth/                #   session store, auth service, AuthProvider, RBAC
    │   ├── tenant/              #   active event (X-Event-Id)
    │   └── features/            #   FeatureDefinition type + useVisibleFeatures
    ├── shared/                  # dumb, reusable building blocks (no business logic)
    │   ├── ui/                  #   Button, Card, Input, Alert, Badge, Icon, IconBadge, EmptyState…
    │   ├── hooks/  lib/
    ├── layouts/app-shell/       # AppShell = auth guard + Sidebar + Topbar + BottomNav
    └── features/                # one folder per domain module
        ├── index.ts             #   FEATURE REGISTRY (sidebar + dashboard read this)
        ├── upcoming.ts          #   modules not migrated yet (status 'coming-soon')
        ├── auth/                #   components/ hooks/ pages/
        └── dashboard/           #   feature.ts api/ hooks/ components/ pages/
```

## Dependency rules

`app → features → layouts → core → shared`. A feature never imports another
feature's internals (only its `index.ts`). `shared/ui` knows nothing about auth,
API or features.

## Theming

- Every value lives in `core/theme/tokens.css` as a `--theme-*` variable.
- `core/theme/theme.css` exposes them as Tailwind utilities: `bg-surface`,
  `text-fg-muted`, `border-line`, `rounded-card`, `shadow-card`,
  `bg-gradient-hero`, `w-sidebar` …
- **Tones**: add `tone-emerald` (etc.) to an element, then use `text-tone`,
  `bg-tone-soft`, `border-tone-line` inside it. Components take a `tone` prop.
- `npm run check:tokens` (part of `build`) rejects hardcoded colours and inline
  style objects anywhere outside `core/theme`.

## API

```ts
import { http } from '@/core/api';
const shops = await http.get<Shop[]>('/shops', { query: { eventId } });
await http.post('/shops/register', body);
```

The client adds `Authorization`, `X-Event-Id` and `X-Request-Id`, parses the body,
throws `ApiError` on non-2xx, and on 401 refreshes the token once and retries.

The Worker maps `/api/<prefix>/…` → `${BACKEND_URL}/api/<service>/…` using
`worker/proxy-rules.ts`. New endpoints under an existing prefix need **no** code.
A new service is one line. Unknown paths return 404.

## Auth & RBAC

Components check **permissions**, never role names. The role → permission table
is `core/auth/permissions.ts` (mirrors EventManagement `lib/auth.ts`).

```tsx
// page level
<AppShell permission={PERMISSIONS.inventoryAccess}>…</AppShell>
export default withPermission(ReportsPage, PERMISSIONS.reportsView);

// element level
<Can perform={PERMISSIONS.usersManage}><Button>Add user</Button></Can>
<Can perform={PERMISSIONS.stockHistoryModify} mode="disable"><Button>Rollback</Button></Can>
<Can perform={{ anyOf: [PERMISSIONS.shopsAccess, PERMISSIONS.eventsManage] }}>{(ok) => …}</Can>

// in logic
const { can } = usePermissions();
if (can(PERMISSIONS.stockHistoryModify)) { … }
```

The frontend gate is UX only — the backend remains the authority.

## Migrating a page (playbook)

1. Create `src/features/<name>/` with `feature.ts`, `api/<name>.api.ts`,
   `hooks/`, `components/`, `pages/<Name>Page.tsx`, `index.ts`.
2. Move that module's entry from `features/upcoming.ts` into `feature.ts`,
   set `status: 'available'`, and add it to `features/index.ts`.
3. Add `src/app/<route>/page.tsx`: `export { <Name>Page as default } from '@/features/<name>';`
4. Replace inline `fetch('/api/…')` with `http` calls in `api/`. Check the path
   resolves in `worker/proxy-rules.ts` (see gaps below).
5. Replace inline markup/styles with `shared/ui` components and token classes;
   replace `canAccessX()` checks with `<Can>` / `usePermissions`.
6. `npm run build` (runs token check + both type-checks).

## Proxy gaps to resolve while migrating

These EventManagement routes are NOT a plain prefix rewrite. Fix each one when its page is migrated:

| Old route | Why it differs | Suggested fix |
|---|---|---|
| `POST /api/shops` | went to `…/shops/register` | call `/shops/register` from the client |
| `POST /api/shops-staff/unassign` | became `DELETE …/shops-staff/user/{id}` | call `DELETE /shops-staff/user/{id}` |
| `PUT /api/billing/invoices` | id taken from body | call `PUT /billing/invoices/{id}` |
| `POST /api/billing/invoices/enriched` | merges 3 backend calls | backend endpoint, or a `worker/handlers` entry |
| `GET/POST /api/inventory/sales(/bulk)` | enriches with product/shop lookups | same as above |
| `/api/retail/sales/*` | used a separate `NEXT_PUBLIC_BACKEND_URL` | confirm target, add a rule |
| `/api/logs`, `/api/print`, `/api/printers`, `/api/qz-cert`, `/api/download-agent` | not backend proxies (Loki, local print agent) | decide per feature (printing migration) |

## Migration status

| Page | Status |
|---|---|
| Login (`/`) | ✅ migrated |
| Dashboard (`/dashboard/`) | ✅ migrated (print-preferences card deferred to printing feature) |
| Select event, Change password | ⏭ next — login/ProtectedRoute already route to them |
| Inventory, Sales, Shops, Shifts, Events, Reports, Users, Billing | ⏳ |
