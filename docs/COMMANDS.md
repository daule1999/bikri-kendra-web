# Bikri Kendra — Command Runbook

All commands run from the repo root: `cd bikri-kendra-cloudflare`.
UAT = the `qa` environment → https://qa-pos.bikri-kendra.org
PROD = the `production` environment → https://pos.bikri-kendra.org

---

## 1. Change the backend URL

```bash
# 1. Set it (qa or production)
scripts/set-backend-url.sh production https://api.bikri-kendra.org
scripts/set-backend-url.sh qa         https://api-qa.bikri-kendra.org

# 2. Check what changed
git diff wrangler.jsonc

# 3. Commit and push
git add wrangler.jsonc
git commit -m "chore: point <env> at <new url>"
git push

# 4. Redeploy that environment so the Worker picks it up (section 3)

# 5. Verify
curl -s https://pos.bikri-kendra.org/api/health      # PROD
curl -s https://qa-pos.bikri-kendra.org/api/health   # UAT
# expect "backendConfigured": true
```

> Change it only in `wrangler.jsonc`, not in the Cloudflare dashboard —
> the next deploy overwrites dashboard values.

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
curl -s https://pos.bikri-kendra.org/api/health      # PROD → "version":"v1.2.0"
curl -s https://qa-pos.bikri-kendra.org/api/health   # UAT

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
