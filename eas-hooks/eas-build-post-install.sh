#!/usr/bin/env bash
set -eo pipefail

CPP_FILE="node_modules/react-native-safe-area-context/common/cpp/react/renderer/components/safeareacontext/RNCSafeAreaViewShadowNode.cpp"

if [ -f "$CPP_FILE" ]; then
  echo "[eas-build-post-install] Patching react-native-safe-area-context for RN 0.76 Yoga API..."
  sed -i '' 's/insets->top\.unit() != Unit::Undefined/insets->top.isDefined()/g' "$CPP_FILE"
  sed -i '' 's/insets->bottom\.unit() != Unit::Undefined/insets->bottom.isDefined()/g' "$CPP_FILE"
  sed -i '' 's/insets->left\.unit() != Unit::Undefined/insets->left.isDefined()/g' "$CPP_FILE"
  sed -i '' 's/insets->right\.unit() != Unit::Undefined/insets->right.isDefined()/g' "$CPP_FILE"
  echo "[eas-build-post-install] Patch applied successfully."
else
  echo "[eas-build-post-install] CPP file not found, skipping patch."
fi

echo "[eas-build-post-install] Done."
