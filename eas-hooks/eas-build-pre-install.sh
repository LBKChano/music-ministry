#!/bin/bash
set -eo pipefail
echo "Pre-install hook: installing dependencies"
pnpm install --no-frozen-lockfile
