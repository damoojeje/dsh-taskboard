#!/usr/bin/env bash
# Build the browser bundle for the plugin. React stays external and is resolved
# by the DeepSeek Harness page at runtime, so only esbuild is needed here.
set -euo pipefail
cd "$(dirname "$0")"

ESBUILD="${ESBUILD:-node_modules/.bin/esbuild}"
if [ ! -x "$ESBUILD" ]; then
  echo "esbuild not found at $ESBUILD. Run: npm install" >&2
  exit 1
fi

tmp="$(mktemp -t dsh-taskboard.XXXXXX.cjs.js)"
trap 'rm -f "$tmp"' EXIT

"$ESBUILD" src/client.jsx \
  --bundle \
  --format=cjs \
  --platform=browser \
  --jsx=transform \
  --external:react \
  --external:react-dom \
  --external:react-dom/client \
  --log-level=warning \
  --outfile="$tmp"

node scripts/wrap.cjs "$tmp" lib/client.js
echo "built lib/client.js ($(wc -c < lib/client.js) bytes)"
