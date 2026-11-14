# Bikri Kendra — Cloudflare edition

Enterprise rebuild of `EventManagement`, migrated page by page. Static Next.js
export served by a Cloudflare Worker that also acts as the single `/api` proxy.
See **docs/ARCHITECTURE.md** for structure, theming, RBAC, the API layer and
the page-migration playbook.

Before login works, set the `BACKEND_URL` secret for each environment (`scripts/set-backend-url.sh`)
in `wrangler.jsonc` to the public HTTPS
URL of your backend gateway.

## Run locally
    npm install
    npm run dev            # UI only (no /api proxy)
    npm run preview        # build + full Worker incl. /api proxy, via wrangler dev

To serve on your local network (phones/other laptops), see **docs/COMMANDS.md → section 0**:

    npm install
    npm run build
    npx wrangler dev --ip 0.0.0.0 --port 8787

## Deploy


See **docs/DEPLOYMENT.md**. Copy-paste commands: **docs/COMMANDS.md**.

    npm run deploy:qa      # current branch → QA
    npm run deploy:prod    # only from a v* release tag
