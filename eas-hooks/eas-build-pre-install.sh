#!/usr/bin/env bash
# EAS Build pre-install hook
# Runs before `npm install` / `pnpm install` on the EAS build worker.
# Purpose: remove any packages with broken codegenConfig before they can
# poison the React Native codegen script (generate-codegen-artifacts.js).

set -euo pipefail

# Force clean install to ensure lockfile-pinned versions are used
echo "[eas-build-pre-install] Clearing node_modules for clean install..."
rm -rf node_modules || true
# Clear pnpm store to prevent cached package versions
pnpm store prune || true

# ─── expo-glass-effect (broken podspec) ──────────────────────────────────────
# This package has an unstable podspec that causes pod install to fail.
# It is not used in any app code. Remove it from package.json before pnpm
# install runs so it is never installed and CocoaPods never sees it.
echo "[eas-build-pre-install] Removing expo-glass-effect from package.json..."
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (pkg.dependencies && pkg.dependencies['expo-glass-effect']) {
    delete pkg.dependencies['expo-glass-effect'];
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    console.log('[eas-build-pre-install] expo-glass-effect removed from package.json');
  } else {
    console.log('[eas-build-pre-install] expo-glass-effect not found in dependencies, skipping');
  }
" || true

# ─── Inject postinstall script for patch-package ─────────────────────────────
# patch-package needs to run after install to apply patches/*.patch files.
# We inject the postinstall script here before pnpm install runs so that
# pnpm's postinstall lifecycle fires patch-package automatically.
echo "[eas-build-pre-install] Ensuring postinstall script is set to patch-package..."
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!pkg.scripts) pkg.scripts = {};
  if (pkg.scripts.postinstall !== 'patch-package') {
    pkg.scripts.postinstall = 'patch-package';
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    console.log('[eas-build-pre-install] postinstall script set to patch-package');
  } else {
    console.log('[eas-build-pre-install] postinstall already set, skipping');
  }
" || true

echo "[eas-build-pre-install] Starting codegen safety cleanup..."

# ─── react-native-onesignal 5.4.x ────────────────────────────────────────────
# Versions 5.4.0–5.4.2 introduced a codegenConfig that points to jsSrcsDir:"src"
# with an ios.modulesProvider field that crashes generate-codegen-artifacts.js
# on RN 0.81 / Expo SDK 54.  We pin to 5.3.4 in package.json, but remove any
# stale 5.4.x copy that might be cached in node_modules just in case.
ONESIGNAL_DIR="node_modules/react-native-onesignal"
if [ -d "$ONESIGNAL_DIR" ]; then
  ONESIGNAL_VERSION=$(node -e "try{process.stdout.write(require('./$ONESIGNAL_DIR/package.json').version)}catch(e){}" 2>/dev/null || echo "unknown")
  echo "[eas-build-pre-install] Found react-native-onesignal@$ONESIGNAL_VERSION"
  # Remove if it is a 5.4.x build (codegenConfig is broken in those releases)
  case "$ONESIGNAL_VERSION" in
    5.4.*)
      echo "[eas-build-pre-install] REMOVING react-native-onesignal@$ONESIGNAL_VERSION (broken codegenConfig — will be replaced by 5.3.4 during install)"
      rm -rf "$ONESIGNAL_DIR"
      ;;
    *)
      echo "[eas-build-pre-install] react-native-onesignal@$ONESIGNAL_VERSION is OK, keeping."
      ;;
  esac
fi

# ─── react-native-worklets (ghost package) ───────────────────────────────────
# Sometimes left behind in node_modules after being removed from package.json.
# Its codegenConfig references a spec file that no longer exists.
for WORKLETS_DIR in node_modules/react-native-worklets node_modules/react-native-worklets-core; do
  if [ -d "$WORKLETS_DIR" ]; then
    echo "[eas-build-pre-install] REMOVING ghost package $WORKLETS_DIR"
    rm -rf "$WORKLETS_DIR"
  fi
done

# ─── Direct podspec rewrite — belt-and-suspenders fallback for C++20 ─────────
# The Expo plugin (withCxxStandard.js) patches Podfile.properties.json, but as
# a fallback we also rewrite the podspec directly so the flag is baked in even
# if the plugin doesn't fire.  Only runs when the podspec exists and hasn't
# already been patched (idempotent).
PODSPEC="node_modules/react-native-safe-area-context/react-native-safe-area-context.podspec"
if [ -f "$PODSPEC" ] && ! grep -q "CLANG_CXX_LANGUAGE_STANDARD" "$PODSPEC"; then
  node -e "
    const fs = require('fs');
    let s = fs.readFileSync('$PODSPEC', 'utf8');
    // Anchor: insert pod_target_xcconfig right after the top-level
    // s.dependency \"React-Core\" line (last top-level field before the
    // fabric conditional block).
    s = s.replace(
      /(  s\.dependency \"React-Core\")/,
      '\$1\n\n  s.pod_target_xcconfig = {\n    \"CLANG_CXX_LANGUAGE_STANDARD\" => \"c++20\",\n    \"CLANG_CXX_LIBRARY\" => \"libc++\"\n  }'
    );
    fs.writeFileSync('$PODSPEC', s);
    console.log('[eas-build-pre-install] Patched safe-area-context podspec with C++20');
  " || true
fi

echo "[eas-build-pre-install] Done."
