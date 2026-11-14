#!/usr/bin/env bash
# Push the payload-encryption key from .env.<env> to the Worker as the API_ENCRYPTION_KEY secret.
#   scripts/set-api-key.sh <qa|production>
# Run it whenever NEXT_PUBLIC_API_ENCRYPTION_KEY changes, and redeploy so the browser bundle matches.
set -euo pipefail
ENV="${1:-}"; case "$ENV" in qa|production) ;; *) echo "usage: $0 <qa|production>" >&2; exit 2 ;; esac
cd "$(dirname "$0")/.."
KEY="$(grep -E '^NEXT_PUBLIC_API_ENCRYPTION_KEY=' ".env.$ENV" | cut -d= -f2-)"
[[ -n "$KEY" ]] || { echo "✖ NEXT_PUBLIC_API_ENCRYPTION_KEY is empty in .env.$ENV" >&2; exit 1; }
printf '%s' "$KEY" | npx wrangler secret put API_ENCRYPTION_KEY --env "$ENV"
echo "✓ API_ENCRYPTION_KEY set for $ENV"
