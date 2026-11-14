# Bikri Kendra — Command Runbook

All commands run from the repo root: `cd bikri-kendra-cloudflare`.
UAT = the `qa` environment → https://<qa-domain>
PROD = the `production` environment → https://<prod-domain>

Domains are not committed. Create `.deploy.env` once (gitignored; copy `.deploy.env.example`)
with `DEPLOY_DOMAIN_PRODUCTION` and `DEPLOY_DOMAIN_QA`; `scripts/deploy.sh` passes them as
`wrangler deploy --domain`. In GitHub, add a `DEPLOY_DOMAIN` secret to each environment
(`qa`, `production`) alongside `CLOUDFLARE_API_TOKEN`.

---

## 0. Run locally (and on your local network)

Runs the built site plus the real Worker (`/api/*` proxy) on your Mac.

```bash
cp .dev.vars.example .dev.vars     # first time only; set BACKEND_URL inside
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

Local runs read it from `.dev.vars` (gitignored).

### First-time move from the old committed var → secret (do in this order)

Cloudflare refuses to create a secret while a plain var with the same name still
exists, so deploy first (the new config no longer defines the var), then set the secret.
Between the two steps `/api/*` returns 503 — run them back to back.

```bash
npm run deploy:prod          # a deploy that no longer defines the var (needs a v* tag, as before)
scripts/set-backend-url.sh production http://localhost:8080
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

## 3. Deploy a tag (or branch) to UAT or PROD

### Option A — from GitHub Actions (recommended)

```bash
# Tag → UAT
gh workflow run deploy.yml -f environment=qa -f ref=v1.2.0

# Tag → PROD
gh workflow run deploy.yml -f environment=production -f ref=v1.2.0

# Any branch → UAT
gh workflow run deploy.yml -f environment=qa -f ref=feature/billing

# Watch it
gh run watch
```

Or in the browser: GitHub → **Actions → Deploy → Run workflow** → pick environment + ref.

### Option B — from your laptop

```bash
# Tag → UAT
git fetch --tags && git checkout v1.2.0
npm ci
npm run deploy:qa

# Tag → PROD
git fetch --tags && git checkout v1.2.0
npm ci
scripts/deploy.sh production v1.2.0     # refuses if HEAD isn't exactly v1.2.0

# Current branch → UAT
npm run deploy:qa

# Go back to your branch afterwards
git checkout develop
```

First time on a laptop: `npx wrangler login`.

### Try it without deploying

```bash
DRY_RUN=1 scripts/deploy.sh qa
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
