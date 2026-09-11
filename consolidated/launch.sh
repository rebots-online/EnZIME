#!/bin/sh
set -eu
ENZIME_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ENZIME_DIR"
if [ -x "$ENZIME_DIR/runtime/node" ]; then
  ENZIME_NODE="$ENZIME_DIR/runtime/node"
else
  ENZIME_NODE=$(command -v node || true)
  if [ -z "$ENZIME_NODE" ]; then
    printf '%s\n' 'EnZIME requires Node 24+. Use the Linux portable bundle or install Node and retry.' >&2
    exit 1
  fi
fi
"$ENZIME_NODE" -e 'if(Number(process.versions.node.split(".")[0])<24){console.error("EnZIME requires Node 24 or later.");process.exit(1)}'
if [ ! -f "$ENZIME_DIR/node_modules/linkedom/package.json" ] || [ ! -f "$ENZIME_DIR/public/vendor/pdfjs/build/pdf.mjs" ]; then
  printf '%s\n' 'Application dependencies or browser bundles are missing. From this directory run npm ci and npm run build.' >&2
  exit 1
fi
if [ "${MBA_ROBIN_PORTABLE:-0}" = 1 ] && [ -z "${MBA_ROBIN_HOME:-}" ]; then
  MBA_ROBIN_HOME="$ENZIME_DIR/data/mba.robin"
  export MBA_ROBIN_HOME
fi
if [ -z "${ENZIME_LLAMA_SERVER_BIN:-}" ] && [ -x "$ENZIME_DIR/runtime/llama/llama-server" ]; then
  ENZIME_LLAMA_SERVER_BIN="$ENZIME_DIR/runtime/llama/llama-server"
  export ENZIME_LLAMA_SERVER_BIN
fi
printf '%s\n' "Open http://127.0.0.1:${PORT:-4173} after the server starts. Press Ctrl+C to stop."
exec "$ENZIME_NODE" "$ENZIME_DIR/server.mjs"
