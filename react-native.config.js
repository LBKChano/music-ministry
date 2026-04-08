/**
 * react-native.config.js
 *
 * Excludes react-native-worklets@0.5.1 from native autolinking.
 *
 * WHY: react-native-reanimated v4 ships its own worklets runtime internally.
 * The standalone react-native-worklets@0.5.1 package is a DIFFERENT, older
 * package that registers a conflicting native module ("RNWorklets"). When both
 * are present in node_modules, the autolinking system compiles BOTH into the
 * native binary, and the duplicate module registration crashes the app on
 * startup with a "Module RNWorklets already registered" error.
 *
 * We cannot remove react-native-worklets from package.json, so we exclude it
 * from native autolinking here. The Metro JS resolver intercept in
 * metro.config.js handles the JS side (redirects any JS import to a no-op stub).
 *
 * Together these two fixes fully neutralize react-native-worklets@0.5.1
 * without removing it from package.json.
 */
module.exports = {
  dependencies: {
    'react-native-worklets': {
      platforms: {
        android: null, // null = skip autolinking on Android
        ios: null,     // null = skip autolinking on iOS
      },
    },
  },
};
