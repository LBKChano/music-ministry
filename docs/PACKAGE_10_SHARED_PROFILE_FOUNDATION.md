# Package 10: Shared Profile Foundation

Package 10 replaces the duplicated Android and iOS Profile implementations
with one shared settings-style screen. The platform route files remain as thin
Expo Router wrappers so platform resolution is unchanged.

## Shared Structure

The Profile overview now uses one virtualized `SectionList` in this order:

1. Church and Roles
2. My Scheduling
3. Notifications
4. Account
5. Danger Zone

`ProfileSection`, `ProfileRow`, `ProfileStatus`, and `ProfileDangerRow` provide
the shared visual and accessibility contract. Rows have stable icon and
trailing lanes, 64-point minimum height, button labels and hints, accessibility
values and states, semantic colors, and text scaling limits.

The existing calendar and scheduling-preference controls remain available
inside My Scheduling. Packages 12 and 13 will move them into their dedicated
editors without changing their current data contracts.

## Preserved Behavior

- Package 4 multi-church switching and Join Another Church
- Package 6 nonblocking refresh and retained populated content
- Packages 7 and 8 member/church typography and word-safe church names
- Unavailable-date loading, local draft toggles, save, and refresh
- Scheduling-preference optimistic saves and retry behavior
- Real device notification permission and settings actions
- Sign-out and account-deletion confirmation and onboarding redirects

The screen rejects stale unavailable-date responses after a membership switch,
keeps partial refresh errors inline, and exposes explicit loading,
no-membership, and recoverable session-error states.

## Compatibility

Package 10 is client-only. It adds no table, column, policy, RPC, Edge Function,
or migration. Existing routes and all backend contracts remain unchanged.

## Verification

- TypeScript passed
- Full ESLint passed
- All 186 automated tests passed
- Android production Metro export passed
- iOS production Metro export passed

Before release, compare the Profile overview on a small Android phone, current
iPhone, large phone, tablet, landscape, Larger Text, and display scaling.
Exercise TalkBack/VoiceOver focus order, pull-to-refresh, church switching,
notification permission, sign-out, and deletion confirmations.
