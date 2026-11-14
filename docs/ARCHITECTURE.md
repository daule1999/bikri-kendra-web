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

`app → features → layouts → core → shared`. (Ported legacy code under src/components, hooks, lib, store and src/app/<module> is exempt until phase 2.) A feature never imports another
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

## Custom proxy handlers

EventManagement routes that did more than rewrite a URL now live in
`worker/handlers/` (keyed by `METHOD /path`; other methods use the generic rule):

| Route | What it does |
|---|---|
| `POST /api/billing/invoices/enriched` | invoice search + retail/payment lookups, merged (net of returns) |
| `PUT /api/billing/invoices` | id from body → `PUT …/invoices/{id}` |
| `POST /api/inventory/sales` | product/shop category check, then issue |
| `POST /api/inventory/sales/bulk` | single-shop + category check, then bulk issue |
| `POST /api/shops` | → `…/shops/register` |
| `POST /api/shops-staff/unassign` | `{userId}` → `DELETE …/shops-staff/user/{id}` |

Not ported (no Cloudflare equivalent): `/api/print`, `/api/printers`, `/api/qz-cert`,
`/api/download-agent` (printing — deferred) and `/api/logs` (Loki shipping — off).

## Dynamic routes on a static export

`[id]` pages are built once as `<base>/_/` (`generateStaticParams`), and
`worker/dynamic-routes.ts` serves that build for any real id (HTML and route
payloads). The page reads the id from the URL via `useLegacyParams()`
(`src/lib/routeParams.tsx`). New `[param]` pages: add the pattern there and to
`assets.run_worker_first` in `wrangler.jsonc`.

## Phase 1 compatibility layer (remove as modules are refactored)

The ported pages run unchanged on top of the new core through these adapters:

| File | Role |
|---|---|
| `src/lib/api.ts` | legacy `apiClient` → shared token/event, refresh-on-401, logout |
| `src/store/services/baseQuery.ts` | RTK Query → same token/event source + refresh |
| `src/store/slices/authSlice.ts` | notifies the core session store after its localStorage writes |
| `src/core/auth/session-store.ts`, `src/core/tenant/active-event-store.ts` | use EventManagement's localStorage keys |
| `src/components/layout/AppLayout.tsx` | legacy wrapper → `AppShell` + feature permission + "event must be selected" |
| `src/components/layout/AuthOnlyLayout.tsx` | guard for chrome-less pages (select-event, security, full-screen reports) |
| `src/lib/centralPrint.ts` | printing disabled — rejects with a clear message |
| `src/lib/logger.ts` | console only (no `/api/logs`) |

Rules relaxed for ported code only: `tsconfig.json` is non-strict (ported pages),
`tsconfig.strict.json` keeps `core/ shared/ layouts/ features/` strict, and
`scripts/check-tokens.mjs` skips the folders in its `LEGACY_DIRS` list.

## Migration status

Phase 1 (port onto new core): **all 37 pages done.**
Phase 2 (refactor onto shared/ui + tokens + features/): one module at a time —
move it to `features/<name>/`, delete its entry from `LEGACY_DIRS`, then from `features/upcoming.ts`.

| Module | Phase 1 | Phase 2 |
|---|---|---|
| Login, Dashboard | ✅ | ✅ |
| Select event, Users (list/profile/preferences/security) | ✅ | ⏳ |
| Events, Shops, Shifts | ✅ | ⏳ |
| Inventory (13 pages), Retail Sales | ✅ | ⏳ |
| Reports (7 pages), Billing (4 pages) | ✅ | ⏳ |
| Printing | ⛔ deferred | — |
