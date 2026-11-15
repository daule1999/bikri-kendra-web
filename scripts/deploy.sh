#!/usr/bin/env bash
# Build and deploy one environment, labelled with the git tag / commit it came from.
#
#   scripts/deploy.sh qa                  # current branch → QA
#   scripts/deploy.sh production          # requires HEAD to be on a v* tag
#   scripts/deploy.sh production v1.2.0   # checks out nothing; asserts HEAD == v1.2.0
#
# Env (optional): ALLOW_DIRTY=1 to deploy with uncommitted changes (QA only).
#                 DRY_RUN=1     to build and validate without deploying.
set -euo pipefail

# Deploys run ONLY from GitHub Actions (.github/workflows/deploy.yml). Local dry runs are allowed.
if [[ -z "${GITHUB_ACTIONS:-}" && -z "${DRY_RUN:-}" ]]; then
  echo "✖ Deploys run only from GitHub Actions: Actions → Deploy → Run workflow (see docs/COMMANDS.md)." >&2
  exit 1
fi

ENVIRONMENT="${1:-}"
EXPECTED_TAG="${2:-}"
case "$ENVIRONMENT" in qa|production) ;; *) echo "usage: $0 <qa|production> [tag]" >&2; exit 2 ;; esac

cd "$(dirname "$0")/.."

SHA="$(git rev-parse HEAD)"
SHORT_SHA="$(git rev-parse --short=8 HEAD)"
BRANCH="${GITHUB_REF_NAME:-$(git rev-parse --abbrev-ref HEAD)}"
TAG="$(git describe --tags --exact-match HEAD 2>/dev/null || true)"

if [[ -n "$EXPECTED_TAG" && "$TAG" != "$EXPECTED_TAG" ]]; then
  echo "✖ HEAD is not at tag '$EXPECTED_TAG' (HEAD tag: '${TAG:-none}'). Run: git checkout $EXPECTED_TAG" >&2
  exit 1
fi

if [[ "$ENVIRONMENT" == "production" ]]; then
  if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "✖ Production deploys only from a release tag like v1.2.0 (HEAD tag: '${TAG:-none}')." >&2
    exit 1
  fi
  if [[ -n "$(git status --porcelain)" ]]; then echo "✖ Working tree not clean." >&2; exit 1; fi
elif [[ -n "$(git status --porcelain)" && "${ALLOW_DIRTY:-0}" != "1" ]]; then
  echo "✖ Uncommitted changes. Commit them, or set ALLOW_DIRTY=1 for a throwaway QA deploy." >&2
  exit 1
fi

# Custom domain (kept out of git): DEPLOY_DOMAIN env var (CI secret), or
# DEPLOY_DOMAIN_PRODUCTION / DEPLOY_DOMAIN_QA in the gitignored .deploy.env file.
[[ -f .deploy.env ]] && set -a && source .deploy.env && set +a
if [[ "$ENVIRONMENT" == "production" ]]; then DOMAIN="${DEPLOY_DOMAIN:-${DEPLOY_DOMAIN_PRODUCTION:-}}"; else DOMAIN="${DEPLOY_DOMAIN:-${DEPLOY_DOMAIN_QA:-}}"; fi
[[ -n "$DOMAIN" ]] || { echo "✖ No domain. Set DEPLOY_DOMAIN_$(echo "$ENVIRONMENT" | tr a-z A-Z) in .deploy.env (see .deploy.env.example)." >&2; exit 1; }

# Version label: the tag if HEAD is tagged, otherwise <branch>@<sha>.
VERSION="${TAG:-${BRANCH//\//-}@${SHORT_SHA}}"
[[ -n "$(git status --porcelain)" ]] && VERSION="${VERSION}-dirty"

echo "▶ Deploying $VERSION to $ENVIRONMENT"

# Runtime flags (ENCRYPT_API, ENABLE_LOGS) are NOT baked into the build: they go to the Worker as
# vars and the Worker injects them into every page. In CI they come from the GitHub Environment;
# for a local dry run they come from .env.<environment>.
if [[ -f ".env.$ENVIRONMENT" && -z "${GITHUB_ACTIONS:-}" ]]; then set -a; source ".env.$ENVIRONMENT"; set +a; fi

# BUILD ONCE: the static site contains no environment-specific values, so the same out/ is
# deployed to QA and production. CI restores out/ from a cache keyed by commit SHA; we only
# build when it is absent (or on a dry run, which always validates a fresh build).
if [[ -n "${DRY_RUN:-}" || ! -f out/index.html ]]; then
  echo "▶ Building"
  npm run build
else
  echo "▶ Reusing existing build in out/ (built once for $SHORT_SHA)"
fi

npx wrangler deploy ${DRY_RUN:+--dry-run} \
  --env "$ENVIRONMENT" \
  --domain "$DOMAIN" \
  --tag "$VERSION" \
  --message "$VERSION ($SHORT_SHA) from ${BRANCH}" \
  --var "APP_VERSION:$VERSION" \
  --var "GIT_SHA:$SHA" \
  --var "ENCRYPT_API:${ENCRYPT_API:-false}" \
  --var "ENABLE_LOGS:${ENABLE_LOGS:-true}"

if [[ -n "${DRY_RUN:-}" ]]; then echo "✓ dry run OK for $ENVIRONMENT ($VERSION)"; else echo "✓ $ENVIRONMENT is now running $VERSION"; fi
