#!/usr/bin/env bash
set -eo pipefail

echo "[eas-build-pre-install] Removing stale lockfile and node_modules..."
rm -f pnpm-lock.yaml
rm -rf node_modules
echo "[eas-build-pre-install] Done."
