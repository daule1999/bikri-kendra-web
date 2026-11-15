#!/usr/bin/env bash
# Push API_ENCRYPTION_KEY from .env.<env> to the Worker as a secret (emergency/manual path; CI does this on every deploy).
#   scripts/set-api-key.sh <qa|production>
set -euo pipefail
ENV="${1:-}"; case "$ENV" in qa|production) ;; *) echo "usage: $0 <qa|production>" >&2; exit 2 ;; esac
cd "$(dirname "$0")/.."
KEY="$(grep -E '^API_ENCRYPTION_KEY=' ".env.$ENV" | cut -d= -f2-)"
[[ -n "$KEY" ]] || { echo "✖ API_ENCRYPTION_KEY is empty in .env.$ENV" >&2; exit 1; }
printf '%s' "$KEY" | npx wrangler secret put API_ENCRYPTION_KEY --env "$ENV"
echo "✓ API_ENCRYPTION_KEY set for $ENV (takes effect immediately; no rebuild needed)"
