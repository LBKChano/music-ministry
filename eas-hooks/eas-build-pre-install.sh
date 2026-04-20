#!/usr/bin/env bash
# EAS Build pre-install hook
# Runs before pnpm install on the EAS build worker.

set -eo pipefail

echo "[eas-build-pre-install] Starting pre-install hook..."

# --- Remove expo-glass-effect (broken podspec) ---
echo "[eas-build-pre-install] Removing expo-glass-effect from package.json..."
node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));if(pkg.dependencies&&pkg.dependencies['expo-glass-effect']){delete pkg.dependencies['expo-glass-effect'];fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');console.log('[eas-build-pre-install] expo-glass-effect removed');}else{console.log('[eas-build-pre-install] expo-glass-effect not found, skipping');}"

# --- Inject postinstall script for patch-package ---
echo "[eas-build-pre-install] Ensuring postinstall script is set to patch-package..."
node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));if(!pkg.scripts)pkg.scripts={};if(pkg.scripts.postinstall!=='patch-package'){pkg.scripts.postinstall='patch-package';fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');console.log('[eas-build-pre-install] postinstall set to patch-package');}else{console.log('[eas-build-pre-install] postinstall already set');}"

echo "[eas-build-pre-install] Done."
