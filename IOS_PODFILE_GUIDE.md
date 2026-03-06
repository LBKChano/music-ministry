
# iOS Podfile & CocoaPods Troubleshooting

## Overview

Expo SDK 54 manages the iOS Podfile automatically. You should NOT manually edit the Podfile unless absolutely necessary.

## Common Issues & Solutions

### 1. Pod Install Failures

**Problem**: CocoaPods fails to install dependencies

**Solution**:
- EAS Build handles pod installation automatically
- For local development, Expo manages pods through `npx expo prebuild`
- Never run `pod install` manually in an Expo managed project

### 2. Native Module Compatibility

**Current Native Modules**:
- ✅ expo-notifications (v55.0.10) - Compatible
- ✅ expo-image-picker (v17.0.7) - Compatible
- ✅ @react-native-async-storage/async-storage (v2.0.0) - Compatible
- ✅ @react-native-community/datetimepicker (v8.3.0) - Compatible
- ✅ react-native-calendars (v1.1314.0) - Compatible
- ✅ react-native-reanimated (v4.1.0) - Compatible
- ✅ react-native-gesture-handler (v2.24.0) - Compatible

All dependencies are verified compatible with Expo SDK 54 and iOS.

### 3. Build Configuration

**iOS Deployment Target**: Managed by Expo (iOS 15.1+)
**Swift Version**: Managed by Expo (Swift 5.0+)
**Xcode Version**: Requires Xcode 15.0 or later

### 4. Common Build Errors

#### "No such module" Error
- **Cause**: Pod not properly linked
- **Solution**: EAS Build handles this automatically
- **Local Fix**: Delete `ios` folder and run `npx expo prebuild -p ios`

#### "Undefined symbols" Error
- **Cause**: Missing native implementation
- **Solution**: Verify all dependencies are in package.json
- **Check**: Run `npx expo-doctor` to verify setup

#### "Code Signing" Error
- **Cause**: Missing or invalid certificates
- **Solution**: See IOS_BUILD_GUIDE.md for signing setup
- **Reference**: https://docs.fastlane.tools/codesigning/getting-started/

## EAS Build Process

EAS Build automatically:
1. Installs npm dependencies
2. Runs `npx expo prebuild` to generate native projects
3. Installs CocoaPods dependencies
4. Configures code signing
5. Builds and archives the app

You don't need to manage any of these steps manually.

## Verification Commands

### Check Expo Configuration
```bash
npx expo-doctor
```

### Verify Dependencies
```bash
npm ls
```

### Check EAS Configuration
```bash
eas build:configure
```

## Important Notes

- ⚠️ Never commit the `ios/` folder to git (it's in .gitignore)
- ⚠️ Never manually edit Podfile in an Expo managed project
- ⚠️ Always use EAS Build for production builds
- ✅ All native dependencies are managed through package.json
- ✅ Expo handles all native configuration automatically

## If You Need Local iOS Development

1. Generate native projects:
   ```bash
   npx expo prebuild -p ios
   ```

2. Open in Xcode:
   ```bash
   open ios/musicministry.xcworkspace
   ```

3. Build from Xcode or use:
   ```bash
   npx expo run:ios
   ```

Note: Local builds are for development only. Use EAS Build for distribution.

## Support

- Expo Documentation: https://docs.expo.dev/
- EAS Build: https://docs.expo.dev/build/introduction/
- Troubleshooting: https://docs.expo.dev/build-reference/troubleshooting/
