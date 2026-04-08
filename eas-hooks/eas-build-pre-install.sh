#!/usr/bin/env bash
# EAS Build pre-install hook
# Runs before `npm install` / `pnpm install` on the EAS build worker.
# Purpose: remove any packages with broken codegenConfig before they can
# poison the React Native codegen script (generate-codegen-artifacts.js).

set -euo pipefail

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

echo "[eas-build-pre-install] Done."
