#!/bin/sh
set -eu

cd /app

echo "=== Frontend Development Startup ==="

CURRENT_HASH="$(
  sha256sum package.json pnpm-lock.yaml | sha256sum | cut -d ' ' -f 1
)"

HASH_FILE="node_modules/.dependencies-lock-hash"

if [ ! -d node_modules ] \
  || [ ! -f "$HASH_FILE" ] \
  || [ "$(cat "$HASH_FILE")" != "$CURRENT_HASH" ] \
  || [ ! -e node_modules/.bin/vite ]; then

  echo "Dependencies changed or not verified."
  echo "Synchronizing node_modules..."

  CI=true pnpm install \
    --frozen-lockfile \
    --prefer-offline

  mkdir -p node_modules
  printf '%s\n' "$CURRENT_HASH" > "$HASH_FILE"

  echo "Dependencies synchronized."
else
  echo "Dependencies unchanged. Skipping installation."
fi

echo "Starting Vite..."
exec pnpm dev --host 0.0.0.0
