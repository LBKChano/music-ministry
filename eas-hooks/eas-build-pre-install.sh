#!/usr/bin/env bash
# EAS Build pre-install hook
# Runs before pnpm install on the EAS build worker.

set -eo pipefail

echo "[eas-build-pre-install] Starting pre-install hook..."

# --- Remove expo-glass-effect (broken podspec) ---
echo "[eas-build-pre-install] Removing expo-glass-effect from package.json..."
node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));if(pkg.dependencies&&pkg.dependencies['expo-glass-effect']){delete pkg.dependencies['expo-glass-effect'];fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');console.log('[eas-build-pre-install] expo-glass-effect removed');}else{console.log('[eas-build-pre-install] expo-glass-effect not found, skipping');}"

# --- Register eas-build-post-install lifecycle hook ---
echo "[eas-build-pre-install] Ensuring eas-build-post-install script is registered..."
node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));if(!pkg.scripts)pkg.scripts={};if(pkg.scripts['eas-build-post-install']!=='bash eas-hooks/eas-build-post-install.sh'){pkg.scripts['eas-build-post-install']='bash eas-hooks/eas-build-post-install.sh';fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');console.log('[eas-build-pre-install] eas-build-post-install script registered');}else{console.log('[eas-build-pre-install] eas-build-post-install already registered');}"

echo "[eas-build-pre-install] Done."
