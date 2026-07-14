# Store Launch Checklist

This checklist is specific to the current Expo/EAS project.

## Build Configuration

- App name: Music Ministry
- Version: 1.1.0
- iOS bundle identifier: com.lbkchano.musicministry
- iOS build number: managed remotely by EAS because `appVersionSource` is `remote`
- Android package: com.lbkchano.musicministry
- Android version code: managed remotely by EAS because `appVersionSource` is `remote`
- Android production build type: app-bundle
- OneSignal app ID is present in `app.json`
- iOS notification service extension/app group credentials must remain valid in Apple Developer

## Required Before Store Submission

- Create or confirm App Store Connect app record.
- Create or confirm Google Play Console app record.
- Add privacy policy URL.
- Add support URL.
- Create a demo reviewer account and include it in App Review notes.
- Verify Supabase Auth redirect URLs include the app deep link for password reset, such as `musicministry://reset-password` or an approved wildcard.
- Verify Supabase functions and secrets are live:
  - `send-service-reminders`
  - `send-fill-in-notifications`
  - `send-fill-in-accepted-notification`
  - `send-service-comment-notifications`
  - `delete-account`
  - OneSignal REST API key
- Verify Supabase cron is active for service reminders.
- Verify OneSignal has production iOS and Android push configuration.
- Verify account deletion works from Profile and removes user data as expected.
- Verify sign out returns to onboarding.
- Verify forgot password opens reset password and returns to onboarding after success.
- Verify notifications on physical iOS and Android devices:
  - service reminder
  - fill-in request
  - fill-in accepted
  - song/comment notification

## App Store Connect Fields

- Name: Music Ministry
- Subtitle: Schedule worship teams
- Description: use `release/store-listing.md`
- Keywords: use `release/store-listing.md`
- Promotional text: use `release/store-listing.md`
- Category: Productivity
- Content rights: you own or have rights to all app content and screenshots.
- Age rating: likely 4+, if no public user-generated objectionable content.
- Encryption: set to no non-exempt encryption if standard HTTPS/TLS only.
- App Privacy: declare account/contact info, identifiers, app content, and diagnostics/notification-related data as applicable.
- Review notes: include demo account and the notes from `release/store-listing.md`.

## Google Play Console Fields

- App name: Music Ministry
- Short description: use `release/store-listing.md`
- Full description: use `release/store-listing.md`
- App category: Productivity
- Privacy policy URL: required
- Data Safety: use the draft in `release/store-listing.md` as a starting point
- Content rating questionnaire: answer based on church scheduling utility with no mature content
- Target audience: likely adults/general church team members, not primarily children
- Ads: no, unless added later
- App access: login required; provide demo credentials

## Screenshot Assets

- iOS: provide 1 to 10 screenshots. Recommended: 6 screenshots at a modern iPhone portrait size such as 1290 x 2796.
- Android phone: provide 4 to 8 screenshots at 1080 x 1920 portrait for best Play Store eligibility.
- Google feature graphic: create one 1024 x 500 image.
- App icon: already configured at `assets/icon.png`; confirm it is 1024 x 1024 for Apple and a high quality 512 x 512 export for Google Play listing.

## Build Commands

Run these from the project root:

```sh
pnpm typecheck
pnpm typecheck:functions
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest build -p android --profile production
```

To submit after successful builds:

```sh
npx eas-cli@latest submit -p ios --latest
npx eas-cli@latest submit -p android --latest
```

If you want build and submit in one step:

```sh
npx eas-cli@latest build -p ios --profile production --submit
npx eas-cli@latest build -p android --profile production --submit
```

## Final Manual QA

- Fresh install on iOS.
- Fresh install on Android.
- Create account.
- Confirm onboarding lands on Schedules.
- Grant notification permission when prompted.
- Admin creates a church, roles, members, services, and song types.
- Member marks unavailable dates.
- Admin auto-assigns members.
- Member requests fill-in.
- Another member accepts fill-in.
- Add, edit, and delete a song entry.
- Open notification bell and mark notifications as read.
- Reset password from email.
- Sign out.
- Delete account.
