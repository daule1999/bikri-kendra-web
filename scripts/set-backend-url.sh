#!/usr/bin/env bash
# Change BACKEND_URL for one environment in wrangler.jsonc.
#   scripts/set-backend-url.sh <qa|production> <https://url>
set -euo pipefail
ENV="${1:-}"; URL="${2:-}"
case "$ENV" in qa|production) ;; *) echo "usage: $0 <qa|production> <https://url>" >&2; exit 2 ;; esac
[[ "$URL" =~ ^https://[^/]+$ ]] || { echo "✖ URL must be https://host with no path or trailing slash" >&2; exit 2; }
cd "$(dirname "$0")/.."
python3 - "$ENV" "$URL" <<'PY'
import re, sys
env, url = sys.argv[1], sys.argv[2]
s = open('wrangler.jsonc').read()
block = re.search(r'"%s"\s*:\s*\{.*?"BACKEND_URL"\s*:\s*"[^"]*"' % env, s, re.S)
if not block: sys.exit(f'✖ BACKEND_URL for "{env}" not found in wrangler.jsonc')
new = re.sub(r'("BACKEND_URL"\s*:\s*")[^"]*(")', r'\g<1>%s\g<2>' % url, block.group(0))
open('wrangler.jsonc', 'w').write(s[:block.start()] + new + s[block.end():])
PY
echo "✓ $ENV BACKEND_URL = $URL  (commit it, then redeploy $ENV)"
