#!/bin/bash
set -eo pipefail
echo "Pre-install hook running"

# Downgrade react-native-screens from 4.5.0 to 4.4.0 (4.5.0 uses parentShadowView removed in RN 0.81)
sed -i 's/"react-native-screens": "4\.5\.0"/"react-native-screens": "4.4.0"/g' package.json
echo "Patched react-native-screens to 4.4.0"
