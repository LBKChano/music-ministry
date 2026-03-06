
# iOS Build Checklist - Music Ministry App

Use this checklist before submitting an iOS build to ensure everything is configured correctly.

## ✅ Pre-Build Checklist

### 1. Configuration Files
- [x] `app.json` has valid `ios.bundleIdentifier`: `com.musicministry.app`
- [x] `app.json` has valid `ios.buildNumber`: `1.0.0` (semantic versioning)
- [x] `app.json` has all required privacy descriptions
- [x] `eas.json` has iOS build profiles configured
- [x] `package.json` has all dependencies at compatible versions

### 2. Privacy Permissions
- [x] NSCameraUsageDescription - Camera access for profile photos
- [x] NSPhotoLibraryUsageDescription - Photo library read access
- [x] NSPhotoLibraryAddUsageDescription - Photo library write access
- [x] NSMicrophoneUsageDescription - Microphone access
- [x] NSUserTrackingUsageDescription - Tracking disclosure
- [x] UIBackgroundModes - Remote notifications

### 3. Dependencies
- [x] All dependencies compatible with Expo SDK 54
- [x] No conflicting native modules
- [x] `@react-native-async-storage/async-storage` at v2.0.0 (Android fix)
- [x] React Native Reanimated properly configured in babel.config.js

### 4. Code Quality
- [x] No TypeScript errors: Run `npx tsc --noEmit`
- [x] No ESLint errors: Run `npm run lint`
- [x] All imports resolve correctly
- [x] No circular dependencies

### 5. Build Configuration
- [x] EAS project ID configured: `a500e23e-d75d-44a5-bf0c-6baaf4d67839`
- [x] Resource class set to `m-medium` for optimal build speed
- [x] Auto-increment enabled for build numbers
- [x] Build configuration set to "Release" for production

## 🚀 Build Commands

### Development Build (Simulator)
```bash
eas build --profile development --platform ios
```
- Includes development client
- Can run on iOS Simulator
- Internal distribution

### Preview Build (Device Testing)
```bash
eas build --profile preview --platform ios
```
- Release configuration
- Can install on physical devices via TestFlight or direct download
- Internal distribution

### Production Build (App Store)
```bash
eas build --profile production --platform ios
```
- Release configuration
- Ready for App Store submission
- Requires App Store Connect configuration

## 🔍 Verification Steps

### After Build Completes:

1. **Download the Build**
   - Get the IPA file from EAS dashboard
   - Or install directly via QR code (preview builds)

2. **Test on Device**
   - Install via TestFlight (production) or direct download (preview)
   - Test all major features:
     - [ ] User authentication
     - [ ] Church creation/joining
     - [ ] Service scheduling
     - [ ] Member management
     - [ ] Push notifications
     - [ ] Image picker (camera & library)
     - [ ] Calendar functionality

3. **Check Permissions**
   - [ ] Camera permission prompt appears with correct message
   - [ ] Photo library permission prompt appears with correct message
   - [ ] Notification permission prompt appears

4. **Performance**
   - [ ] App launches without crashes
   - [ ] Navigation is smooth
   - [ ] No memory leaks
   - [ ] Animations are smooth (60fps)

## 🐛 Common Build Failures

### "fastlane gym exited with non-zero code: 1"

**Possible Causes**:
1. Code signing issues
2. Missing or invalid provisioning profile
3. Bundle identifier mismatch
4. Invalid build configuration

**Solutions**:
1. Check EAS build logs for specific error
2. Verify bundle identifier matches Apple Developer account
3. Ensure certificates are valid (EAS manages this automatically)
4. Review IOS_BUILD_GUIDE.md for detailed troubleshooting

### "No signing certificate found"

**Solution**:
- EAS Build manages certificates automatically
- Ensure you're logged into correct Apple Developer account
- Check that bundle identifier is registered in Apple Developer portal

### "Provisioning profile doesn't include signing certificate"

**Solution**:
- Run `eas build:configure` to reconfigure
- Let EAS manage certificates (recommended)
- Or manually configure in Apple Developer portal

### "Build failed with an exception"

**Solution**:
1. Check full build logs in EAS dashboard
2. Look for specific error messages
3. Verify all dependencies are compatible
4. Check for TypeScript/ESLint errors locally first

## 📋 Post-Build Steps

### For TestFlight Distribution:

1. **Submit to App Store Connect**
   ```bash
   eas submit --platform ios
   ```

2. **Configure TestFlight**
   - Add test information
   - Add beta testers
   - Submit for beta review

3. **Distribute to Testers**
   - Send TestFlight invitations
   - Collect feedback
   - Iterate on issues

### For App Store Release:

1. **Prepare App Store Listing**
   - Screenshots (required sizes)
   - App description
   - Keywords
   - Privacy policy URL
   - Support URL

2. **Submit for Review**
   - Complete all required fields
   - Submit for App Store review
   - Monitor review status

3. **Release**
   - Choose manual or automatic release
   - Monitor crash reports
   - Respond to user reviews

## 🔗 Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [iOS Build Troubleshooting](https://docs.expo.dev/build-reference/troubleshooting/)
- [Fastlane Codesigning](https://docs.fastlane.tools/codesigning/getting-started/)
- [App Store Connect](https://appstoreconnect.apple.com/)
- [TestFlight](https://developer.apple.com/testflight/)

## ✨ Current Status

**Last Updated**: 2024
**Expo SDK**: 54.0.1
**React Native**: 0.81.4
**Build Status**: ✅ Configured and ready for build

All configuration files have been updated to resolve iOS build/archive errors.
The app is now compatible with Xcode and ready for EAS Build.
