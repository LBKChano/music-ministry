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
    # Use a Python one-liner to avoid bash quoting hell
    python3 - "$PODSPEC" <<'PYEOF'
import sys, re
path = sys.argv[1]
with open(path, 'r') as f:
    s = f.read()
# Add pod_target_xcconfig with C++20 to the top-level spec (before s.dependency "React-Core")
if 'CLANG_CXX_LANGUAGE_STANDARD' not in s:
    insert = '\n  s.pod_target_xcconfig = {\n    \'CLANG_CXX_LANGUAGE_STANDARD\' => \'c++20\',\n    \'CLANG_CXX_LIBRARY\' => \'libc++\'\n  }\n'
    s = s.replace('  s.dependency "React-Core"', insert + '  s.dependency "React-Core"', 1)
    with open(path, 'w') as f:
        f.write(s)
    print('[eas-build-post-install] Patched safe-area-context podspec with C++20.')
else:
    print('[eas-build-post-install] Already patched.')
PYEOF
  fi
else
  echo "[eas-build-post-install] safe-area-context podspec not found, skipping."
fi

echo "[eas-build-post-install] Done."
