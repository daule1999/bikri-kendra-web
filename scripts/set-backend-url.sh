#!/usr/bin/env bash
# Set BACKEND_URL for one environment as a Cloudflare SECRET (never written to git).
#   scripts/set-backend-url.sh <qa|production> [https://url]   (prompts if url omitted)
# Secrets survive `wrangler deploy`, so no redeploy of code is needed; the change is live in seconds.
set -euo pipefail
ENV="${1:-}"; URL="${2:-}"
case "$ENV" in qa|production) ;; *) echo "usage: $0 <qa|production> [https://url]" >&2; exit 2 ;; esac
if [[ -z "$URL" ]]; then read -r -p "Backend URL for $ENV (https://host): " URL; fi
[[ "$URL" =~ ^https://[^/]+$ ]] || { echo "✖ URL must be https://host with no path or trailing slash" >&2; exit 2; }
cd "$(dirname "$0")/.."
printf '%s' "$URL" | npx wrangler secret put BACKEND_URL --env "$ENV"
echo "✓ $ENV BACKEND_URL updated (secret). Verify: curl -s <site>/api/health  → backendConfigured: true"
