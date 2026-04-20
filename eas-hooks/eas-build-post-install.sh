#!/usr/bin/env bash
set -eo pipefail
echo "[eas-build-post-install] Patching for C++20..."

# Patch the safe-area-context podspec subspec xcconfig
PODSPEC="node_modules/react-native-safe-area-context/react-native-safe-area-context.podspec"
if [ -f "$PODSPEC" ] && ! grep -q "CLANG_CXX_LANGUAGE_STANDARD" "$PODSPEC"; then
  python3 - "$PODSPEC" <<'PYEOF'
import sys, re
path = sys.argv[1]
s = open(path).read()
s = re.sub(
    r'(ss\.pod_target_xcconfig\s*=\s*\{)([^}]+)(\})',
    r'\1\2, "CLANG_CXX_LANGUAGE_STANDARD" => "c++20", "CLANG_CXX_LIBRARY" => "libc++"\3',
    s
)
open(path, 'w').write(s)
print('Podspec patched.')
PYEOF
fi

echo "[eas-build-post-install] Done."
