#!/usr/bin/env bash
set -eo pipefail

echo "[eas-build-pre-install] Fixing package versions for Expo SDK 54 / React Native 0.81..."

# Fix react-native version
sed -i '' 's/"react-native": "0.76.7"/"react-native": "0.81.1"/g' package.json
sed -i '' 's/"react": "18.3.1"/"react": "19.1.0"/g' package.json
sed -i '' 's/"react-dom": "18.3.1"/"react-dom": "19.1.0"/g' package.json
sed -i '' 's/"react-native-safe-area-context": "4.14.1"/"react-native-safe-area-context": "~5.4.0"/g' package.json

# Remove stale lockfile so pnpm resolves fresh with corrected versions
rm -f pnpm-lock.yaml

echo "[eas-build-pre-install] package.json patched. Versions:"
grep -E '"react"|"react-native"|"react-native-safe-area-context"' package.json

echo "[eas-build-pre-install] Done."
