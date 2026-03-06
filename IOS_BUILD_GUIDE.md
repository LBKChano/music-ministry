
# iOS Build & Archive Troubleshooting Guide

This guide helps resolve common iOS build and signing issues for the Music Ministry app.

## Prerequisites

1. **Apple Developer Account**: Required for building and distributing iOS apps
2. **Xcode**: Latest stable version installed on macOS
3. **EAS CLI**: Install with `npm install -g eas-cli`

## Common Build Issues & Solutions

### 1. Code Signing Issues

**Problem**: "No signing certificate found" or "Provisioning profile doesn't match"

**Solution**:
- EAS Build handles code signing automatically
- For local builds, ensure you have valid certificates in Xcode
- Reference: https://docs.fastlane.tools/codesigning/getting-started/

### 2. Build Number Format

**Fixed**: Changed `buildNumber` from `"1"` (string) to `"1.0.0"` (proper version format)
- iOS requires semantic versioning for buildNumber
- Format: MAJOR.MINOR.PATCH (e.g., "1.0.0")

### 3. Missing Privacy Descriptions

**Fixed**: Added all required privacy descriptions to `app.json`:
- NSCameraUsageDescription
- NSPhotoLibraryUsageDescription
- NSPhotoLibraryAddUsageDescription
- NSMicrophoneUsageDescription
- NSUserTrackingUsageDescription

### 4. Bundle Identifier

**Configured**: `com.musicministry.app`
- Must be unique across App Store
- Must match your Apple Developer account provisioning profiles

## Build Commands

### Development Build (Simulator)
```bash
eas build --profile development --platform ios
```

### Preview Build (Device Testing)
```bash
eas build --profile preview --platform ios
```

### Production Build (App Store)
```bash
eas build --profile production --platform ios
```

## EAS Build Configuration

The `eas.json` file is configured with:
- **Resource Class**: `m-medium` for faster builds
- **Auto Increment**: Automatically increments build numbers
- **Build Configuration**: Release mode for preview/production

## Troubleshooting Steps

### If Build Fails:

1. **Check EAS Build Logs**:
   - View detailed logs in Expo dashboard
   - Look for specific error messages

2. **Verify Bundle Identifier**:
   - Must match Apple Developer account
   - Check in `app.json` under `ios.bundleIdentifier`

3. **Check Certificates**:
   - EAS manages certificates automatically
   - For manual management, see Fastlane docs

4. **Clean Build**:
   - Delete `ios` folder if it exists locally
   - Run `eas build:configure` to reconfigure

5. **Verify Dependencies**:
   - All dependencies are compatible with Expo SDK 54
   - No conflicting native modules

### If Archive Fails (Xcode):

1. **Product > Clean Build Folder** in Xcode
2. **Delete Derived Data**: `~/Library/Developer/Xcode/DerivedData`
3. **Verify Signing**: Check "Signing & Capabilities" tab
4. **Check Scheme**: Ensure "Release" scheme is selected for archiving

## Key Configuration Files

- `app.json`: App metadata, bundle ID, permissions
- `eas.json`: Build profiles and configuration
- `package.json`: Dependencies and versions

## Support Resources

- Expo EAS Build: https://docs.expo.dev/build/introduction/
- Fastlane Codesigning: https://docs.fastlane.tools/codesigning/getting-started/
- Apple Developer: https://developer.apple.com/support/

## Current Configuration Status

✅ Bundle Identifier: `com.musicministry.app`
✅ Build Number: `1.0.0` (semantic versioning)
✅ Privacy Descriptions: All required descriptions added
✅ EAS Project ID: Configured
✅ Resource Class: m-medium (optimized for build speed)
✅ Auto Increment: Enabled for all profiles

## Next Steps

1. Ensure you're logged into EAS CLI: `eas login`
2. Configure project if needed: `eas build:configure`
3. Run build: `eas build --profile preview --platform ios`
4. Monitor build progress in Expo dashboard
5. Download and test the build on a physical device

## Notes

- The app uses Expo SDK 54 with the new architecture enabled
- Push notifications are configured for production mode
- Image picker requires camera and photo library permissions
- Supabase is used for backend services
