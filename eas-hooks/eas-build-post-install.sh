#!/usr/bin/env bash
# EAS Build post-install hook
# Runs after pnpm install on the EAS build worker.

set -eo pipefail

echo "[eas-build-post-install] Starting post-install hook..."

# --- Patch react-native-safe-area-context podspec with C++20 ---
PODSPEC="node_modules/react-native-safe-area-context/react-native-safe-area-context.podspec"
if [ -f "$PODSPEC" ]; then
  if grep -q "CLANG_CXX_LANGUAGE_STANDARD" "$PODSPEC"; then
    echo "[eas-build-post-install] safe-area-context podspec already patched, skipping."
  else
    echo "[eas-build-post-install] Patching safe-area-context podspec with C++20..."
    node -e "const fs=require('fs');let s=fs.readFileSync('$PODSPEC','utf8');s=s.replace('ss.pod_target_xcconfig  = { \"HEADER_SEARCH_PATHS\" => \"\\\\\"\\$(PODS_TARGET_SRCROOT)/common/cpp\\\\\"\" }','ss.pod_target_xcconfig  = { \"HEADER_SEARCH_PATHS\" => \"\\\\\"\\$(PODS_TARGET_SRCROOT)/common/cpp\\\\\"\", \"CLANG_CXX_LANGUAGE_STANDARD\" => \"c++20\", \"CLANG_CXX_LIBRARY\" => \"libc++\" }');fs.writeFileSync('$PODSPEC',s);console.log('[eas-build-post-install] Patched.');"
    echo "[eas-build-post-install] safe-area-context podspec patched."
  fi
else
  echo "[eas-build-post-install] safe-area-context podspec not found, skipping."
fi

echo "[eas-build-post-install] Done."
