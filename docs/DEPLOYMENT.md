# Deployment — QA and Production

Two independent Workers built from the same code and one `wrangler.jsonc`:

| | QA | Production |
|---|---|---|
| Worker | `bikri-kendra-qa` | `bikri-kendra` |
| URL | https://<qa-domain> | https://<prod-domain> |
| Backend | secret `BACKEND_URL` (--env qa) | secret `BACKEND_URL` (--env production) |
| What can go there | any branch, any tag | only release tags `vMAJOR.MINOR.PATCH` |
| Automatic trigger | push to `develop` | push of a `v*.*.*` tag |
| UI marker | orange **QA · <version>** badge | none (version in login footer) |

## Version labels ("tags on each instance")

Every deploy is labelled with what it was built from:

- tagged commit → `v1.2.0`
- otherwise → `<branch>@<short-sha>` (e.g. `feature-login@3f2a9c1e`)

The label is recorded in three places:
1. **Cloudflare** — `wrangler deploy --tag <label> --message …`, visible under
   Workers & Pages → *worker* → Deployments, and in `npx wrangler deployments list --env qa`.
2. **Runtime** — `GET /api/health` → `{ environment, version, commit, backendConfigured }`.
3. **UI** — QA badge in the top bar and login card; version in the production login footer.

## Release flow

```bash
# QA: deploy whatever you're testing
git push origin develop                    # CI deploys develop → QA
npm run deploy:qa                          # or from your laptop, current branch → QA

# Production: cut a release tag
git tag v1.2.0 && git push origin v1.2.0   # CI deploys v1.2.0 → Production
git checkout v1.2.0 && npm run deploy:prod # or from your laptop

# Same tag on QA first (recommended)
# GitHub → Actions → Deploy → Run workflow → environment: qa, ref: v1.2.0
```

Any branch or tag can be sent to QA from **Actions → Deploy → Run workflow**.
Production through that button only accepts a `v*` tag (the script refuses anything else).

## Rollback

- Fastest: `npx wrangler rollback --env production` (previous version), or pick a version
  in the Cloudflare dashboard → Deployments.
- Or redeploy an older tag: Run workflow → production, ref `v1.1.0`.

## Environment variables

| Name | Where set | Notes |
|---|---|---|
| `BACKEND_URL` | Cloudflare secret (`scripts/set-backend-url.sh`) — not in git | Public HTTPS origin of that environment's gateway |
| `APP_ENV` | `wrangler.jsonc` → `env.<name>.vars` | `qa` / `production` |
| `APP_VERSION`, `GIT_SHA` | injected by `scripts/deploy.sh` (`--var`) | don't set manually |
| `NEXT_PUBLIC_APP_ENV/VERSION/GIT_SHA` | exported by `scripts/deploy.sh` at build | baked into static JS — never secrets |
| secrets (future) | `npx wrangler secret put NAME --env qa` | separate per environment |

Keep each variable in **one** place (file *or* dashboard): `wrangler deploy` treats
the config file as the source of truth and overwrites dashboard-edited vars
(unless `--keep-vars`). Secrets are never removed by a deploy.

Local preview: `cp .dev.vars.example .dev.vars`, edit, `npm run preview`.

## One-time setup

1. **Cloudflare API token** — dashboard → My Profile → API Tokens → template
   *Edit Cloudflare Workers*. Note your Account ID.
2. **GitHub repo secrets** — `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
3. **GitHub environments** — create `qa` and `production`
   (Settings → Environments). On `production`, add *Required reviewers* so a
   pushed tag waits for approval before going live.
4. **Branches** — create `develop`; protect `main`.
5. Set both `BACKEND_URL` secrets with `scripts/set-backend-url.sh`.
6. First QA deploy creates `<qa-domain>` (DNS + certificate) automatically.
