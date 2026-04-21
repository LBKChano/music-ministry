#!/bin/bash
set -eo pipefail
echo "Pre-install hook: installing dependencies with pnpm"
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install --no-frozen-lockfile
