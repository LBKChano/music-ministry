#!/usr/bin/env bash
set -eo pipefail
echo "[eas-build-pre-install] Running pre-install hook..."

# Update package.json: fix safe-area-context version, remove bad packages
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.dependencies['react-native-safe-area-context']='5.4.0';['expo-glass-effect','onesignal-expo-plugin','react-native-onesignal'].forEach(k=>{if(p.dependencies&&p.dependencies[k])delete p.dependencies[k];});fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');console.log('package.json updated');"

# Delete lockfile so pnpm resolves the updated versions fresh (no checksum mismatch)
rm -f pnpm-lock.yaml
echo "pnpm-lock.yaml deleted for fresh resolution"

echo "[eas-build-pre-install] Done."
