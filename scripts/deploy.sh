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

# Version label: the tag if HEAD is tagged, otherwise <branch>@<sha>.
VERSION="${TAG:-${BRANCH//\//-}@${SHORT_SHA}}"
[[ -n "$(git status --porcelain)" ]] && VERSION="${VERSION}-dirty"

echo "▶ Deploying $VERSION to $ENVIRONMENT"

export NEXT_PUBLIC_APP_ENV="$ENVIRONMENT"
export NEXT_PUBLIC_APP_VERSION="$VERSION"
export NEXT_PUBLIC_GIT_SHA="$SHA"
npm run build

npx wrangler deploy ${DRY_RUN:+--dry-run} \
  --env "$ENVIRONMENT" \
  --tag "$VERSION" \
  --message "$VERSION ($SHORT_SHA) from ${BRANCH}" \
  --var "APP_VERSION:$VERSION" \
  --var "GIT_SHA:$SHA"

if [[ -n "${DRY_RUN:-}" ]]; then echo "✓ dry run OK for $ENVIRONMENT ($VERSION)"; else echo "✓ $ENVIRONMENT is now running $VERSION"; fi
