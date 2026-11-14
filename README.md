# Bikri Kendra — Cloudflare edition

Enterprise rebuild of `EventManagement`, migrated page by page. Static Next.js
export served by a Cloudflare Worker that also acts as the single `/api` proxy.
See **docs/ARCHITECTURE.md** for structure, theming, RBAC, the API layer and
the page-migration playbook.

Before login works, set `BACKEND_URL` for each environment (`env.qa`, `env.production`)
in `wrangler.jsonc` to the public HTTPS
URL of your backend gateway.

## Run locally
    npm install
    npm run dev            # UI only (no /api proxy)
    npm run preview        # build + full Worker incl. /api proxy, via wrangler dev

## Deploy

Two instances — QA (`qa-pos.bikri-kendra.org`) and Production (`pos.bikri-kendra.org`).
See **docs/DEPLOYMENT.md**.

    npm run deploy:qa      # current branch → QA
    npm run deploy:prod    # only from a v* release tag
