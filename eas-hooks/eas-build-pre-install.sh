#!/usr/bin/env bash
set -eo pipefail

echo "[eas-build-pre-install] Removing stale lockfile to force fresh resolution..."
rm -f pnpm-lock.yaml
echo "[eas-build-pre-install] Done."
