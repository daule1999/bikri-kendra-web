# Bikri Kendra — Command Runbook

All commands run from the repo root: `cd bikri-kendra-cloudflare`.
UAT = the `qa` environment → https://<qa-domain>
PROD = the `production` environment → https://<prod-domain>

Domains are not committed: in CI the `DEPLOY_DOMAIN` environment secret is passed as
`wrangler deploy --domain` (local dry runs read `.deploy.env`). See section 3 for the GitHub setup.

---

## 0. Run locally (and on your local network)

Runs the built site plus the real Worker (`/api/*` proxy) on your Mac.

```bash
cp .dev.vars.example .dev.vars     # first time only; set BACKEND_URL and SESSION_SECRET inside
                                   #   http://localhost:8091         (local Traefik — check `podman ps`)

npm install
npm run build
npx wrangler dev --ip 0.0.0.0 --port 8787
```

- On the Mac: http://localhost:8787
- From a phone/laptop on the same Wi-Fi: `http://<mac-ip>:8787`
  (get the IP with `ipconfig getifaddr en0`; allow incoming connections if macOS asks)
- Port 8787 avoids the old EventManagement UI on :3000.
- Over plain `http://<ip>` browsers disable secure-context features (clipboard, camera, service workers).
- Localhost-only shortcut: `npm run preview` (build + `wrangler dev`).
- Fast UI iteration without the Worker: `npm run dev` (port 3000; `/api/*` won't work).

---

## 0b. Runtime config: encryption, console logging, sessions

The site is **built once** and contains no environment-specific values. The Worker injects the
settings below into every page (`window.__APP_CONFIG__`) from its own vars/secrets, so the very same
build runs on QA and production and a flag change needs only a redeploy of config, not a rebuild.

| Setting | prod | qa | Where | Effect |
|---|---|---|---|---|
| `ENCRYPT_API` | `true` | `false` | GitHub variable → Worker var | `true`: every /api body is AES-256-GCM encrypted (DevTools shows `{"enc":"…"}`); Worker rejects plain requests |
| `API_ENCRYPTION_KEY` | long random | — | GitHub secret → Worker secret | Key for the above; served to the page at runtime when encryption is on |
| `ENABLE_LOGS` | `false` | `true` | GitHub variable → Worker var | `false`: `console.log/debug/info/trace` silenced in the browser (warn/error stay) |
| `SESSION_SECRET` | long random | long random | GitHub secret → Worker secret | Seals the login session cookies (required) |

```bash
openssl rand -base64 32      # generate a value for API_ENCRYPTION_KEY / SESSION_SECRET
```

**Sessions:** login happens at the Worker, which stores the tokens in sealed **HttpOnly** cookies
(`bk_s0…`). The browser (and any XSS) never sees an access/refresh token; the Worker adds the
`Authorization` header to backend calls and refreshes expiring tokens itself. Non-GET calls must carry
`X-Requested-With: bikri` (added automatically) as a CSRF guard. Changing `SESSION_SECRET` signs everyone out.

Notes: payload encryption hides bodies from DevTools/proxies/casual inspection (the page must hold the
key to encrypt); it does not replace HTTPS or backend auth. URLs/query strings, file uploads and
non-JSON downloads are not encrypted. Detail pages use `?id=` URLs (`/shops/detail?id=12`); old
`/shops/12` links redirect automatically.

---|---|---|---|
| `NEXT_PUBLIC_ENCRYPT_API` | `true` | `false` | `true`: every /api request/response body is AES-256-GCM encrypted (DevTools shows `{"enc":"…"}`); Worker rejects plain requests. `false`: readable. |
| `NEXT_PUBLIC_API_ENCRYPTION_KEY` | long random string | — | Must equal the Worker secret `API_ENCRYPTION_KEY` |
| `NEXT_PUBLIC_ENABLE_LOGS` | `false` | `true` | `false`: `console.log/debug/info/trace` are silenced in the browser (warn/error stay) |

```bash
openssl rand -base64 32                 # generate a key → put in .env.production
scripts/set-api-key.sh production       # upload it to the Worker as a secret (then redeploy)
```

Notes: the key ships inside the browser bundle, so this hides payloads from DevTools/proxies/casual
inspection — it does not replace HTTPS or backend auth. URLs and query strings are not encrypted
(put sensitive data in bodies), and file uploads/downloads are left as-is.

---

## 1. Set / change the backend URL (kept out of git)

`BACKEND_URL` is a Cloudflare **secret** per environment — it is not in
`wrangler.jsonc`, the repo, or the GitHub workflow.

```bash
scripts/set-backend-url.sh production https://<prod-backend>
scripts/set-backend-url.sh qa         https://<qa-backend>
# or omit the URL to be prompted; equivalent to:
#   npx wrangler secret put BACKEND_URL --env production

# Verify (no redeploy needed — secrets survive deploys and apply immediately)
curl -s https://<prod-domain>/api/health      # PROD
curl -s https://<qa-domain>/api/health   # UAT
# expect "backendConfigured": true
```

Normally you don't run these by hand: the Deploy workflow sets `BACKEND_URL` from the GitHub
environment secret on every run (edit the secret → re-run). The scripts are for emergencies.
Local runs read it from `.dev.vars` (gitignored).

### First-time move from the old committed var → secret (do in this order)

The workflow already deploys first (the new config no longer defines the var) and then sets
the secret. For the very first run, `/api/*` returns 503 for a few seconds between the two steps.

```bash
gh workflow run deploy.yml -f environment=production -f ref=vX.Y.Z
curl -s https://<prod-domain>/api/health   # expect backendConfigured: true
```

---

## 2. Create a release tag from a branch

Tags must look like `vMAJOR.MINOR.PATCH` (e.g. `v1.2.0`). PROD only accepts these.

```bash
# 1. Get the latest code of the branch you want to release
git fetch --all --tags
git checkout develop            # or any branch, e.g. feature/billing
git pull

# 2. See existing tags, pick the next number
git tag --list 'v*' --sort=-v:refname | head -5

# 3. Create an annotated tag on the branch's latest commit
git tag -a v1.2.0 -m "Release v1.2.0"

# 4. Push the tag
git push origin v1.2.0
#    ⚠ pushing a v* tag auto-deploys it to PROD via GitHub Actions
#      (waits for approval if the 'production' environment has reviewers)
```

Useful extras:

```bash
git tag -a v1.2.0 <commit-sha> -m "Release v1.2.0"   # tag a specific commit
git show v1.2.0 --stat                               # what's in a tag
git log v1.1.0..v1.2.0 --oneline                     # changes between releases
git tag -d v1.2.0 && git push origin :refs/tags/v1.2.0   # delete a wrong tag (local + remote)
```

---

## 3. Deploy a branch or tag (GitHub Actions only)

Deploys run **only** from the `Deploy` workflow; `scripts/deploy.sh` refuses to run elsewhere
(except `DRY_RUN=1`). Rules: **UAT = any branch or tag; PROD = a `vX.Y.Z` tag only.**

```bash
gh workflow run deploy.yml -f environment=qa         -f ref=feature/billing   # any branch → UAT
gh workflow run deploy.yml -f environment=qa         -f ref=v1.2.0            # any tag    → UAT
gh workflow run deploy.yml -f environment=production -f ref=v1.2.0            # tag only   → PROD
gh run watch
```

Or in the browser: GitHub → **Actions → Deploy → Run workflow** → pick environment + ref.

### One-time GitHub setup (Settings → Environments → `qa` and `production`)

Everything the deploy needs is configured per environment — nothing lives in the repo.

| Type | Name | qa | production |
|---|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | token (Workers edit) | same or separate token |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | account id | account id |
| Secret | `DEPLOY_DOMAIN` | UAT hostname | prod hostname |
| Secret | `BACKEND_URL` | UAT backend origin | prod backend origin |
| Secret | `API_ENCRYPTION_KEY` | empty/unused | long random string |
| Secret | `SESSION_SECRET` | long random string | different long random string |
| Variable | `ENCRYPT_API` | `false` | `true` |
| Variable | `ENABLE_LOGS` | `true` | `false` |

Also: add **required reviewers** to the `production` environment so a prod deploy needs approval.
Each run sets the `BACKEND_URL` / `API_ENCRYPTION_KEY` Worker secrets itself, so changing one =
edit the GitHub secret and re-run the workflow.

### Try it without deploying

```bash
DRY_RUN=1 scripts/deploy.sh qa                 # needs .env.qa locally
DRY_RUN=1 scripts/deploy.sh production v1.2.0
```

---

## 4. Check what's running

```bash
curl -s https://<prod-domain>/api/health      # PROD → "version":"v1.2.0"
curl -s https://<qa-domain>/api/health   # UAT

npx wrangler deployments list --env production
npx wrangler deployments list --env qa
```

---

## 5. Roll back PROD

```bash
# Redeploy the previous good tag
gh workflow run deploy.yml -f environment=production -f ref=v1.1.0

# or roll back to the previous Cloudflare version instantly
npx wrangler rollback --env production
```

---

## Rules the scripts enforce

| Action | Allowed |
|---|---|
| Any branch / tag → UAT | ✅ |
| `v*.*.*` tag → PROD | ✅ |
| Branch or untagged commit → PROD | ❌ refused |
| Uncommitted changes → PROD | ❌ refused |
| Uncommitted changes → UAT | ❌ unless `ALLOW_DIRTY=1` |
