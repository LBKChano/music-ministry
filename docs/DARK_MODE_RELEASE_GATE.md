# Dark Mode Release Gate

This document separates checks that can be proven from the repository from the
checks that require signed builds on physical devices. It does not change any
database, notification, scheduling, or widget data contract.

## Automated Gate

- [x] App appearance is `automatic` in Expo configuration.
- [x] System, Light, and Dark remain available from Profile > Appearance.
- [x] React Navigation, root backgrounds, status-bar icons, Android navigation
  icons, native controls, and the floating dock resolve from the active theme.
- [x] The branded navy splash remains identical in both appearances.
- [x] The iOS widget retains snapshot schema version 1 and its existing app-group
  storage key while supporting tinted accent rendering.
- [x] The semantic-color audit permits literals only in these documented files:
  `lib/ui/app-theme.ts`, `lib/ui/splash-screen.ts`,
  `components/CustomSplashScreen.tsx`, and `components/ErrorBoundary.tsx`.
- [x] `verify:package42` covers TypeScript, ESLint, repository tests, Edge
  Function checks, and the semantic-color audit. Config generation and clean
  web/Android/iOS exports are also required before each store build.

## Physical Device Gate

Complete this matrix with fresh signed builds before submitting to either store.
An unchecked item is a release check, not a known product defect.

- [ ] iPhone with Dynamic Island: System, Light, and Dark; app cold start and
  background resume; Schedule, Church, Profile, every focused subpage, and the
  representative long-form and keyboard-open modals.
- [ ] Older iPhone without Dynamic Island and an iPad: safe areas, rotation,
  Larger Text, VoiceOver order, Reduce Motion, modal scrolling, and touch targets.
- [ ] Android small phone, large phone, and tablet: status/navigation icons,
  opaque dock fallback, keyboard appearance, date/time controls, display scaling,
  TalkBack order, and no startup or route-transition flashes.
- [ ] Toggle appearance while a modal, filter, expanded service, typed draft,
  offline cache, and background refresh are active; confirm state is retained.
- [ ] Exercise owner, scheduling-admin, and member accounts across multiple
  churches, including account/church switching, sign-out, recovery, and deletion.
- [ ] Repeat service, song, manual assignment, auto-assignment, fill-in,
  notification, Realtime, onboarding, and account smoke tests in both appearances.
- [ ] Add both widget modes in small and medium sizes; verify normal, tinted,
  Smart Stack, stale, empty, signed-out, and snapshot-refresh states.
- [ ] Confirm the next-church-service widget shows the next service and assigned
  team without changing the existing snapshot payload.

## Branded Exceptions

The splash and widget intentionally use the Music Ministry navy presentation in
both appearances. The error boundary remains a provider-independent emergency
surface so it can render even when theme initialization itself fails. App icons
and splash artwork opt out of automatic accessibility inversion.
