# TODO

## Product Roadmap

Implementation status: Packages 0 through 22 are implemented, with their
  backend-first additive migrations deployed where documented. Packages 23
  through 29 are planned visual-system, Schedule-comprehension, and reliability
  work. They must be implemented in order so the theme foundation and navigation
  contract exist before individual screens are restyled, followed by the final
  data-lifecycle/native reliability gate. The remaining release gates include
  the documented physical-device checks.

### Delivery Rules

- Keep every live database change backward-compatible with released app
  versions. Add tables, nullable columns, indexes, triggers, policies, or new
  RPCs; do not rename or remove existing tables, columns, RPC signatures, or
  response fields.
- Deploy additive Supabase migrations before publishing client code that uses
  them. After each deployment, smoke-test the currently released Android and iOS
  builds before continuing.
- Preserve the separate Android/default and iOS schedule implementations where
  they still exist, or move genuinely shared behavior into a shared component
  without changing either platform's established interactions.
- Run TypeScript, lint, relevant unit/regression tests, Deno checks when Edge
  Functions change, and Android/iOS production exports after each package.
- Test keyboard and layout changes on a small Android phone, a current iPhone,
  a large phone, landscape, and at least one tablet-size viewport. Include
  Larger Text and display-scaling checks.
- Full dark-mode delivery is deferred. New or extracted components must consume
  semantic color tokens instead of adding hard-coded light colors, but these
  packages must preserve the current visual appearance and must not introduce a
  dark-mode toggle, dark palette rollout, or dark-mode release gate.
- Do not deploy, commit, or push a package until its checks pass and the user
  explicitly requests that action.

### Clean Implementation Contract

- Inventory the existing schema, RPCs, Edge Functions, query keys, Realtime
  handlers, and tests before creating anything new. Extend a proven capability
  when it already exists; do not introduce a second table, hook, cache, or RPC
  that represents the same state.
- Keep one authoritative source for server state: Supabase through church- and
  account-scoped React Query keys. Context may expose stable derived state and
  actions, while screen-local state is limited to drafts and transient UI.
- Introduce one church-session transition action during Package 2. Startup,
  onboarding, manual switching, membership removal, and account switching must
  all use that action; no later screen may coordinate church changes with
  independent `setCurrentChurch` plus refetch sequences.
- Represent startup and long-running workflows with explicit discriminated
  states rather than several booleans. Every asynchronous result must verify
  the active account, church, membership, and request generation before
  updating visible state.
- Keep mutations in focused hooks/services, not route components. Every
  mutation must define validation, authorization, idempotency, cache update or
  invalidation, Realtime reconciliation, error mapping, retry behavior, and
  rollback before its UI is connected.
- Preserve one implementation of domain behavior across Android and iOS.
  Platform route files may adapt native presentation, but they must consume the
  same validation, mutation, cache, and normalization helpers.
- Add characterization tests before extracting a large component. Move one
  behavior at a time, verify parity, then remove the old branch. Do not combine
  data-model changes, context rewrites, navigation changes, and visual redesign
  in one unreviewable commit.
- Use additive, idempotent Supabase migrations. Privileged functions must derive
  identity from `(select auth.uid())`, validate every target row belongs to the
  target church, use a fixed `search_path`, revoke default `PUBLIC`/`anon`
  execution, and grant only the required role.
- Regenerate database types after each schema package and fail TypeScript if
  client RPC arguments or return shapes drift from the migration.
- Before deployment, run SQL behavior/RLS tests in a rollback transaction,
  database advisors, Edge Function checks when applicable, and a migration
  inventory proving the new object does not already exist under another name.
- Each package ends with a small, reviewable checkpoint: tests green, no dead
  compatibility code added without a retirement condition, no unrelated file
  churn, and a documented rollback that does not destroy user data.

### Recommended Execution Order

Items 12 and 23 are intentionally split across multiple packages. Multi-church
data, authenticated startup, onboarding, and push registration depend on each
other; completing them as two large isolated changes would create circular
dependencies and make rollback unsafe.

After the completed Packages 0 through 15, implement Packages 16 through 21 in
numeric order. Package 17 establishes the authoritative manual-assignment
eligibility contract that Package 18 reuses for role-scoped auto-assignment.
Package 19 is isolated because it changes live notification timing. Package 20
comes after the new scheduling screens exist so every popup is migrated once,
and Package 21 remains a separate native-build checkpoint with its own Apple
credentials and rollback path.

Compatibility audit for Packages 16 through 21 (2026-08-01):

- No package may remove, rename, narrow, or change the return shape of a table,
  column, RLS path, RPC, Edge Function endpoint, notification event, route, or
  persisted key used by a released build.
- Packages 16 and 20 are client-only and keep existing routes and mutation
  payloads. Released builds are unaffected because they do not download these
  UI components.
- Package 17 adds uniquely named candidate/apply RPCs while retaining released
  direct assignment writes. Package 18 adds a new role-scoped RPC name while
  retaining the current six-argument auto-assignment RPC and all-role behavior.
- Package 19 uses additive nullable/defaulted delivery state, keeps old fill-in
  inserts and accept/cancel contracts, and retains the existing
  `fill_in_request` navigation payload. Older builds can create and open the
  one-time reminder without understanding new database fields.
- Package 21 adds a separately identified WidgetKit extension and a second app
  group entitlement alongside the OneSignal app group. It changes no Supabase
  contract or Android artifact, and installed older iOS builds retain their
  existing signed entitlements and notification extension.
- Every backend-first package must pass the released Android/iOS smoke test
  after deployment and before its new client is published. If that test fails,
  stop the rollout; leave additive objects unused and keep the released client
  contract active.

#### Package 0: Compatibility Baseline for Items 12-23

Status:

- Automated baseline implemented locally on 2026-07-29.
- Added the source-build and live-Supabase contract manifest, synthetic
  compatibility fixtures, church-session characterization helpers/tests, and
  the repeatable released-build migration smoke-test runbook.
- TypeScript, lint for the changed files, all 54 behavior/contract tests, and
  Android/iOS production Metro exports passed for this local checkpoint.
- Remaining exit-gate work: record the actual App Store/TestFlight/Play
  Store/APK build numbers and run the smoke test on physical released Android
  and iOS builds. Package 1 must not be deployed until that external check is
  recorded.

Includes:

- Record the currently released Android/iOS build versions and their Supabase
  table, RPC, Edge Function, Auth, deep-link, and notification contracts.
- Add missing regression tests around Auth restoration, current-church
  selection, tab permissions, church switching, Profile data, Church
  operations, notification targeting, sign-out, and deletion.
- Capture representative database fixtures for owner, scheduling admin,
  regular member, multiple churches, unclaimed invitation, unavailable dates,
  preferences, multiple devices, and mixed ownership.
- Establish one repeatable released-build smoke test that runs after every live
  migration.

Exit gate:

- The current behavior is covered well enough to detect a compatibility
  regression before any migration or shared-context refactor is deployed.

#### Package 1: Item 12A - Additive Multi-Church Database Foundation

Status:

- Implemented and deployed to the live Supabase project on 2026-07-29 as one
  additive migration, a rollback-safe SQL behavior suite, generated-shape
  client types, delete-account cleanup, and static compatibility/security
  tests. Supabase recorded migration version `20260730005120`.
- Live aggregate preflight passed: no duplicate linked memberships, missing
  owner memberships, owner-admin mismatches, or duplicate OneSignal IDs.
- TypeScript, Deno, ESLint, all 64 behavior/contract tests, and Android/iOS
  production Metro exports pass.
- The complete migration and SQL behavior suite passed against the linked
  project inside an explicit rollback transaction. A final catalog query
  confirmed that no Package 1 object remained live. Supabase branch creation
  was unavailable on the Free plan, so no branch or hourly charge was created.
- The user explicitly approved live deployment. All five affected Edge
  Functions were deployed with their existing JWT settings; the reminder cron
  reached the new version with HTTP 200, diagnostics confirmed OneSignal
  configuration, and all 26 legacy subscriptions resolved without missing or
  duplicate recipient pairs.
- The post-deployment catalog, RLS, grants, and advisor checks passed. The
  remaining external gate is a smoke test using the currently released
  physical Android and iOS builds.
- Do not use `supabase db push` or repair migration history: production has
  historical versions absent from this repository. Follow
  `docs/PACKAGE_1_BACKEND_FOUNDATION.md`.

Includes:

- Run the duplicate/orphan preflight and resolve conflicts without deleting or
  overwriting live member data.
- Add the owner-membership backfill, non-null membership uniqueness protection,
  `create_church_with_owner_membership`, and
  `join_church_by_invitation`.
- Extend the deployed member-scoped multi-device subscription and event-key
  deduplication foundation with account/device registration and recipient
  resolution. Do not replace it or create a second competing member-device
  model.
- In the same backend package, update the existing delete-account cleanup and
  add a compatibility bridge so a legacy delete/reclaim of a physical
  `onesignal_subscriptions` row deactivates the matching account-device record.
  Never deploy a new device table first and postpone its cleanup.
- Add SQL/RLS tests for church-scoped permissions, idempotent create/join,
  invited-row claim, owner protection, and cross-church denial.
- Deploy the additive migration without changing the app UI.

Compatibility gate:

- Keep every current table, column, policy, RPC, Edge Function URL, and legacy
  subscription path. The released Android and iOS builds must pass the smoke
  test before Package 2 starts.

#### Package 2: Item 23A - Deterministic Auth and Church Bootstrap

Status:

- Implemented and verified locally on 2026-07-29. This package has no database
  migration or Edge Function deployment.
- Added explicit Auth/church startup states, per-account last-church
  persistence, one generation-guarded atomic church transition, centralized
  root routing, and a recoverable no-membership screen.
- Removed blind Auth and onboarding retry timeouts. Manual church selection,
  newly created church selection, onboarding completion, startup restoration,
  and retry now use the shared transition path.
- TypeScript, focused ESLint, all 79 behavior/compatibility tests, and Android
  and iOS production Metro exports pass.
- A new Android/iOS app build is required to ship these client changes.

Includes:

- Introduce one startup coordinator with explicit restoring, signed-out,
  membership-loading, church-selecting, ready, no-membership, and recoverable
  error states.
- Introduce the single `transitionChurchSession`/`switchChurch` action required
  by the Clean Implementation Contract. It must validate membership, cancel
  stale work, replace church-scoped state atomically, and expose a stable result
  for startup and later manual switching.
- Restore a valid last-selected church per authenticated account and prevent
  stale church data or permissions from appearing during switches.
- Remove blind Auth and onboarding timeouts that reinterpret unknown state or
  permit duplicate work.
- Add the no-membership recovery screen while preserving current routes,
  password-reset deep links, and released backend contracts.

Exit gate:

- Login, app restart, slow/offline restoration, removed membership, and account
  switching always reach either one fully initialized membership or one clear
  recoverable state. No onboarding visual redesign ships yet.

#### Package 3: Item 23B - Safe Create, Join, Login, and Verification

Status:

- Implemented locally on 2026-07-29 with account-level Sign In, Join a Church,
  and Create a Church entry paths. Legacy route mode aliases remain valid.
- New clients use Package 1's deployed atomic create/join RPCs. The released
  clients' direct create and self-join policies remain available.
- Confirmation-required signup pauses before database setup, stores a
  password-free pending intent, and resumes through the dedicated
  `musicministry://verify-email` callback.
- Existing accounts are guided to Sign In and resume the matching pending
  action. Required fields, persistent labels, inline errors, password-manager
  metadata, accessibility semantics, and duplicate-submit protection are in
  place.
- This package has no database migration or Edge Function deployment. A new
  Android/iOS build is required to ship it.
- TypeScript, focused ESLint, all 95 behavior/compatibility tests, and Android,
  iOS, and web production Metro exports pass.
- Live Supabase checks confirm the project is healthy, both Package 1 RPCs are
  authenticated-only with fixed search paths, and both released-client policies
  remain available. Live Auth currently has email auto-confirm enabled, so the
  verification route is dormant unless that setting changes.
- Remaining release check: confirm `musicministry://verify-email` is present in
  the hosted Auth redirect allowlist. The connected database API does not expose
  that dashboard-only setting.
- See `docs/PACKAGE_3_SAFE_ONBOARDING.md` for behavior and release checks.

Includes:

- Replace role-specific login choices with account-level Sign In, Join a
  Church, and Create a Church while keeping stale route targets valid.
- Use Package 1's atomic RPCs for all new-client church creation and joining.
- Stop database setup when signup requires email confirmation; add a resumable
  verification screen that stores no password.
- Guide an existing account to sign in and continue joining instead of trying
  to create a duplicate Auth user.
- Add required names, persistent field labels, inline errors, password-manager
  support, accessibility semantics, and duplicate-submit protection.

Compatibility gate:

- Keep the old direct create/join database paths and self-join policy available
  for released builds. Deploy no policy tightening in this package.

#### Package 4: Item 12B - Multi-Church Client and Multi-Device Push

Status:

- Implemented locally on 2026-07-29. Account-wide discovery now keeps every
  membership for the authenticated account, derives Admin/Member access per
  church, and switches through Package 2's generation-guarded transition.
- The shared Profile `ChurchSwitcher` lists every accessible church, marks the
  current church and exact role, and exposes Join Another Church on Android and
  iOS.
- New clients register each OneSignal subscription against the authenticated
  account and retain the released member-scoped claim as a compatibility
  bridge. Sign-out deactivates only the current subscription before clearing
  OneSignal identity.
- No Package 4 migration or Edge Function deployment is required. Live checks
  confirm the deployed Package 1 table, RPCs, grants, resolver, and legacy
  triggers are present; 26 current account-device rows have no blank or
  duplicate subscription IDs.
- TypeScript, ESLint, all 107 behavior/compatibility tests, and Android/iOS
  production Metro exports pass. The remaining external release check is the
  two-church/two-device physical matrix.
- See `docs/PACKAGE_4_MULTI_CHURCH_CLIENT.md`.

Includes:

- Extend the existing account-wide church discovery, use Package 2's church
  transition action, persist selection per account, and apply exact
  church-scoped tab permissions.
- Build one reusable `ChurchSwitcher` and render it in the existing Profile
  screen so every signed-in user can reach Your Churches and Join Another
  Church. Item 17 may move the same component without rewriting its behavior.
- Register the physical device against the authenticated account, merge
  account-device records with the existing member-scoped multi-device
  subscriptions, and deduplicate by OneSignal subscription ID.
- Make sign-out unregister only the current physical device while leaving other
  signed-in devices active.

Exit gate:

- One account can be Admin in church A and Member in church B, switching never
  leaks data or permissions, each eligible push reaches each signed-in device
  once, and released clients still receive notifications normally.

#### Package 5: Item 23C - Contextual Notification Permission

Status:

- Implemented locally on 2026-07-29 with one shared Android/iOS explainer that
  appears only after the first Schedule is visible and the exact selected
  membership is linked to OneSignal.
- Removed both automatic operating-system permission prompts. The OS prompt now
  follows an explicit Enable Notifications action; Not Now, enabled, and denied
  decisions persist per app installation rather than per account or church.
- Native permission state uses OneSignal's current asynchronous permission and
  can-request APIs, refreshes after returning from Settings, and never treats an
  SDK error as an OS denial. Denied devices use the same Open Settings action
  from the notification bell and preferences screen.
- OneSignal membership linking is centralized behind the Package 2 `ready`
  state. Package 4 account-device registration now waits for that exact linked
  church membership and remains deduplicated by physical subscription ID.
- Package 5 adds no migration, RPC, policy, table, or Edge Function and requires
  no Supabase deployment. Released builds and their notification contracts are
  unchanged.
- TypeScript, ESLint, all 118 behavior/compatibility tests, and Android/iOS
  production Metro exports pass. The remaining external release check is the
  physical permission/two-device matrix.
- See `docs/PACKAGE_5_NOTIFICATION_PERMISSION.md`.

Includes:

- After the first ready Schedule, show an explanation for reminders and
  fill-in requests before opening the native notification prompt.
- Persist Enable/Not Now state per physical device and provide Open Settings
  after operating-system denial.
- Link OneSignal identity only after Package 2 and Package 4 have confirmed the
  authenticated account, selected membership, and physical device.

Exit gate:

- First-run permission behavior works on Android/iOS, account switching cannot
  cross-link subscriptions, and two devices receive one copy each rather than
  duplicate pushes on either device.

#### Package 6: Item 14 - Separate Initial Loading from Refreshing

Status:

- Implemented locally on 2026-07-29 as a client-only state-management change.
- Added explicit initialization/background-refresh state, shared in-flight
  refresh coordination, partial-failure handling, and nonblocking refresh
  notices for Church and both Schedule implementations.
- Populated tabs now stay mounted during refresh, and failed background reads
  preserve the last successful member and notification settings.
- No Supabase migration, Edge Function, RPC, policy, query-key, or persisted
  data change is required. See `docs/PACKAGE_6_REFRESH_LOADING.md`.
- TypeScript, full ESLint, all 129 behavior/contract tests, and Android/iOS
  production Metro exports pass. Physical-device pull-to-refresh checks remain
  an external release gate.

Includes:

- Split Auth/church initialization, background refresh, and mutation progress
  into distinct state.
- Keep existing content, scroll position, modals, and drafts mounted during
  pull-to-refresh.
- Deduplicate refresh and Realtime invalidations without changing query keys or
  backend contracts.

Exit gate:

- Pull-to-refresh never replaces a populated tab with a full-screen loader, and
  Package 2's startup coordinator still blocks stale account data on true
  initialization.

#### Package 7: Item 15 - Deterministic Shared Header Typography

Status:

- Implemented locally on 2026-07-29 as a client-only shared UI change.
- Added `AdaptiveHeaderText`, explicit primary/profile/secondary variants,
  deterministic pure size selection, stable action-lane reservations, bounded
  Larger Text support, and opt-in development diagnostics.
- Schedule, Church, and both Profile implementations use the same typography
  contract without native name auto-fit or layout-measurement state loops.
- Existing header props remain supported and no Supabase migration, Edge
  Function, RPC, policy, query-key, or persisted-name change is required. See
  `docs/PACKAGE_7_HEADER_TYPOGRAPHY.md`.
- TypeScript, full ESLint, all 142 behavior/contract tests, and Android/iOS
  production Metro exports pass. Default/Larger Text screenshot comparison on
  physical devices remains an external release gate.

Includes:

- Establish shared primary-title, profile-name, and secondary-church-name
  variants with one sizing system, stable line heights, and reserved action
  lanes.
- Remove the current combination of JavaScript size tiers and native
  auto-shrink that makes short names unexpectedly tiny.

Exit gate:

- The same name and available width produce the same result across Android,
  iOS, refresh, tab changes, orientation, display scaling, and Larger Text.

#### Package 8: Item 16 - Word-Safe Church-Name Wrapping

Status:

- Implemented locally on 2026-07-29 as a client-only shared rendering change.
- Added a pure token-boundary layout and `WordSafeHeaderText` with explicit
  two-line breaks, disabled platform hyphenation, final-line ellipsis, and
  special handling for one overlong unbroken token.
- Schedule, Church, Profile's church subtitle, Profile's cross-church selector,
  and Church's selector rows now share the word-safe behavior.
- Original source values remain separate from normalized visual text and no
  Supabase migration, Edge Function, RPC, policy, validation, query-key, or
  persisted-name change is required. See `docs/PACKAGE_8_WORD_SAFE_NAMES.md`.
- TypeScript, full lint, all 157 automated tests, and Android/iOS production
  Metro exports pass. Default/Larger Text screenshot comparison on physical
  devices remains an external release gate.

Includes:

- Build on Package 7's typography contract to allow up to two intentional lines
  without breaking words in the middle.
- Preserve the exact underlying church name for selection, copying,
  accessibility, queries, and database writes.

Exit gate:

- The fixture matrix of short, long, spaced, hyphenated, and single-token church
  names renders predictably without changing stored values.

#### Package 9: Item 13 - Guided Church Admin Hub

Status:

- Implemented locally on 2026-07-29 with a derived setup-readiness model,
  guided Church Setup and Schedule Management overview, focused editor
  destinations, simplified Church header, Schedule setup bridge, concise
  Reminder Settings, member search/invitation, owner protection, role rename,
  and deletion-impact previews.
- Added migration `20260730035223_guided_church_admin_atomic_operations.sql`
  for atomic member/roles, weekly-service/roles, role rename references, role
  order, reminder upsert, and destructive impact preview operations. The
  migration is additive and keeps every released-client path.
- The exact migration compiles in isolated PostgreSQL and all six atomic
  operations, three authorization/rollback checks, and authenticated-only
  grants pass. TypeScript, full ESLint, all 172 automated tests, and Android/iOS
  production Metro exports also pass.
- Deployed live on 2026-07-29 as Supabase migration version
  `20260730035223`. Post-deployment catalog checks confirm 12 secured functions,
  unchanged table/column/policy counts, preserved legacy RPCs, and successful
  owner/member/role impact previews against live data.
- Do not publish a Package 9 app build until the currently released Android and
  iOS builds pass the documented physical smoke test. See
  `docs/PACKAGE_9_GUIDED_CHURCH_ADMIN_HUB.md`.

Includes:

- Add contract tests and additive atomic admin RPCs first; deploy and smoke-test
  released builds before using them.
- Extract the oversized Church route into focused shared components.
- Build Church Setup and Schedule Management, guided first setup, concise
  Reminder Settings, and focused editors for details, members, roles, weekly
  services, scheduling rules, song types, and schedule operations.
- Preserve bulk deletion, auto-assignment, quarter preparation, single-service
  creation, reports, previews, and existing RPC payloads.

Exit gate:

- Every old Church capability has one obvious new location, multi-part writes
  are atomic, reminders expose no cron internals, and item 12's selected-church
  permissions control the entire hub.

#### Package 10: Item 17 - Shared Profile Foundation

Status:

- Implemented locally on 2026-07-29 as one shared Android/iOS
  `ProfileScreen`, with thin platform route wrappers and a virtualized grouped
  settings overview.
- Added reusable `ProfileSection`, `ProfileRow`, `ProfileStatus`, and
  `ProfileDangerRow` primitives with semantic colors, stable touch targets,
  accessibility labels/hints/values/states, Larger Text bounds, and inline live
  status that does not cover the floating tab bar.
- Church switching, unavailable-date editing, scheduling preferences,
  notification permission, sign-out, deletion, loading, refresh, and recovery
  behavior remain connected. Stale availability results are ignored after a
  membership switch.
- Package 10 is client-only and requires no Supabase deployment. TypeScript,
  full ESLint, all 186 automated tests, and Android/iOS production Metro
  exports pass. Physical device and accessibility checks remain the release
  gate. See `docs/PACKAGE_10_SHARED_PROFILE_FOUNDATION.md`.

Includes:

- Create one Android/iOS Profile shell using Package 6 loading behavior and
  Packages 7-8 typography.
- Add the stable section and row primitives for Church and Roles, My
  Scheduling, Notifications, Account, and Danger Zone.
- Move existing behavior into the shell with feature parity before adding the
  specialized editors in Packages 11-15.

Exit gate:

- Android and iOS share one accessible, responsive Profile overview and no
  existing Profile capability has been lost.

#### Package 11: Item 18 - Church-Scoped Identity and Roles

Status:

- Implemented locally and deployed live on 2026-07-29 as Supabase migration
  version `20260730041938`.
- Added one authenticated, church-scoped display-name RPC that derives the
  account from `auth.uid()` and can update only `church_members.name`.
- Added a focused Profile editor showing selected church, exact
  Owner/Admin/Member access, assigned ministry roles, and global read-only Auth
  email. Package 4's church switcher and both existing admin member-update
  paths remain unchanged.
- Optimistic cache updates are isolated by account, church, and membership;
  conditional rollback cannot overwrite a newer Realtime value, and Realtime
  refresh cannot replace an active editor draft.
- Isolated PostgreSQL checks and a rolled-back live smoke transaction passed.
  TypeScript, full ESLint, all 198 automated tests, and Android/iOS production
  Metro exports also pass. See
  `docs/PACKAGE_11_CHURCH_SCOPED_IDENTITY.md`.

Includes:

- Move Package 4's reusable church switcher into the final Profile section
  without replacing its state or mutation logic.
- Add the authenticated `update_own_church_profile` RPC and church-scoped
  display-name editor.
- Show exact Owner/Admin/Member status, assigned ministry roles, selected
  church, and global read-only Auth email without creating a global role.

Compatibility gate:

- Deploy the additive RPC first, retain existing admin member-update paths, and
  verify that editing one membership cannot alter another church.

#### Package 12: Item 19 - Availability Summary and Editor

Status:

- Implemented locally on 2026-07-29 as a concise Profile summary and one
  shared Android/iOS full-screen calendar editor.
- Replaced UTC-derived boundaries with the shared local `YYYY-MM-DD` formatter
  and aligned the visible range with the existing 90-day scheduling horizon.
- The complete saved set initializes one account/church/member-keyed React
  Query source. Dates outside the visible range remain in the draft and are
  preserved during Save.
- Dirty drafts, zero-date clears, active saves, stale membership responses,
  failed refreshes with cached data, and simultaneous-device changes have
  explicit guarded states.
- Package 12 is client-only. Live Supabase checks confirm the unchanged
  date-only table, RLS policies, and exact auto-assignment date comparison.
  Two identical live dry-run previews also matched inside a rolled-back
  transaction.
- TypeScript, full ESLint, all 213 automated tests, and Android/iOS production
  Metro exports pass. See `docs/PACKAGE_12_AVAILABILITY_EDITOR.md`.

Includes:

- Implement the availability summary and focused local-date-safe editor without
  changing the existing date-only table or auto-assignment contract.
- Keep a local draft until Save, guard it during church switching, and reject
  stale responses from a previous account/member.
- Compare saved rows and auto-assignment previews before and after the UI
  change, including a draft that removes every unavailable date.

Exit gate:

- Drafts survive normal navigation safely, church switching cannot mix member
  data, and auto-assignment sees exactly the saved hard-block date set.

#### Package 13: Item 20 - Scheduling Preference Editor

Status:

- Implemented locally on 2026-07-29 as a concise Profile summary and one
  shared Android/iOS full-screen editor.
- The existing `useSchedulingPreferences` hook remains the only query,
  optimistic mutation, rollback, Retry, Realtime, and cleanup owner.
- Immediate saves are serialized and visibly report pending, success, restored
  failure, and retry states. Navigation waits for active saves.
- Account/church/member operation scopes prevent a late response from changing
  another membership's visible pending or error state. Focus ownership prevents
  duplicate Profile/editor Realtime channels.
- Package 13 is client-only. Live Supabase checks confirm the unchanged table,
  RLS policies, Realtime publication, cascade cleanup, recurring-service
  identity, and auto-assignment implementation.
- Two identical live 90-day dry-run previews matched inside a rolled-back
  transaction. A final rolled-back live fixture also confirmed that the RPC
  reads a valid soft preference without persisting test data. Deterministic
  fixtures cover role removal, recurring-service deletion, empty options, and
  optimistic rollback.
- TypeScript, full ESLint, all 229 automated tests, and Android/iOS production
  Metro exports pass. See
  `docs/PACKAGE_13_SCHEDULING_PREFERENCE_EDITOR.md`.

Includes:

- Move the existing deployed preference behavior into a focused editor without
  changing storage, RLS, recurring-service identity, or auto-assignment
  semantics.
- Reuse the current optimistic queue, rollback, Realtime, and cleanup behavior;
  do not create another preference hook or local source of truth.
- Compare auto-assignment previews before and after the UI change across
  unavailable dates, soft preferences, role removal, recurring-service
  deletion, and uneven history.

Exit gate:

- Every preference save is visible and recoverable, church switching cannot mix
  memberships, and assignment results are unchanged for the same stored input.

#### Package 14: Item 21 - Real Notification Settings

Status:

- Implemented locally and deployed to Supabase on 2026-08-01.
- Added additive, church-membership-scoped preference storage with secure
  authenticated RPCs. Missing rows resolve to all four categories enabled for
  released-client compatibility.
- Deployed delete-account cleanup before the table, then applied migrations
  `20260801223829_add_member_notification_preferences` and
  `20260801225216_index_member_notification_preference_membership`.
- All four active sender functions honor explicit push opt-outs while keeping
  notification-bell history, admin recipients, OneSignal event contracts,
  per-device targeting, and reminder cron deduplication.
- Replaced placeholder App Updates/Promotions tags with a shared focused editor
  for device permission and four real church delivery categories.
- TypeScript, Deno checks, full ESLint, all 243 automated tests, live rollback
  SQL, deployed-source inspection, and the OneSignal diagnostic pass. Android
  and iOS production export results are recorded in
  `docs/PACKAGE_14_REAL_NOTIFICATION_SETTINGS.md`.

Includes:

- Add church-membership-scoped preference storage and authenticated RPCs with
  missing rows meaning enabled for legacy compatibility.
- Update the existing delete-account function for the new preference rows in
  the same backend deployment, before any preference row can be created.
- Update every sending Edge Function to honor explicit opt-outs while
  preserving event idempotency, notification history, admin oversight, and
  Package 4's per-device deduplication.
- Replace the misleading generic notification UI only after all backend
  senders are deployed and verified.

Compatibility gate:

- Released clients and members without preference rows receive exactly the
  same notifications as before. Keep all legacy OneSignal fields, event names,
  function URLs, and cron contracts.

#### Package 15: Item 22 - Account Actions and Danger Zone

Status:

- Implemented locally and deployed on 2026-08-01.
- Added focused Account, Change Password, and Delete Account screens with
  password-manager metadata, secure reauthentication, recovery email, app
  version/build information, a live deletion preview, and typed confirmation.
- Sign-out deactivates only the current device and cleans OneSignal, Realtime,
  account cache, and persisted church selection after Auth succeeds. A failed
  Auth sign-out restores the current device registration.
- Account deletion preserves the released authenticated bodyless POST
  contract. The additive preview branch returns before any mutation. Live
  delete-account is version 4 with verify_jwt=true.
- The linked cleanup-constraint rollback audit, TypeScript, all Edge Function
  Deno checks, full ESLint, all 256 automated tests, and Android/iOS production
  exports pass.
- Remaining release gate: complete the physical-device and disposable-account
  matrix in docs/PACKAGE_15_ACCOUNT_ACTIONS.md.

Includes:

- Add account identity, version/build information, change password, neutral
  sign-out, and the isolated Danger Zone to the Profile shell.
- Re-audit the already-deployed cleanup for Package 1 device records and
  Package 14 preferences, then add the deletion preview and client cleanup for
  multi-church ownership, memberships, caches, Realtime channels, and the
  current-device OneSignal state.
- Keep the existing delete-account URL and POST contract idempotent for released
  clients.

Final exit gate:

- Password change/recovery, sign-out, and deletion work for member-only,
  admin-only, owner, mixed multi-church, and two-device accounts; deletion
  describes its real impact; and the released builds still complete their
  existing account actions.

#### Package 16: Cross-App UI Polish and Consistency

Status:

- Implemented locally on 2026-08-01; automated verification passes.
- Client-only as planned. No Supabase migration, RPC, Edge Function,
  notification contract, released route, or persisted key changed.
- Android and iOS now share one tab-layout contract; admin visibility still
  requires a fully ready admin membership, and a member arriving from an admin
  church is redirected away from the Church route.
- Profile church switching now has a focused route while the released
  `ChurchSwitcher` remains the single behavior owner. Profile and Church
  focused editors share the same header contract, and Church forms retain their
  existing state and backend payloads behind the improved shared modal.
- Onboarding, Profile, refresh failures, and no-membership recovery now use
  shared accessible feedback/state treatments that hide technical backend
  details.
- TypeScript, Edge Function Deno checks, full ESLint, all 267 automated tests,
  Package 16 contract tests, and Android/iOS production exports pass. The
  remaining physical-device/screenshot gate is recorded in
  `docs/PACKAGE_16_UI_POLISH.md`.
- Not deployed because this package has no backend changes. A new app build is
  required to publish the visual changes.
- Client-only. Do not add a Supabase migration, change an RPC or Edge Function,
  alter notification delivery, or remove any released route or persisted key.
- Package 9 through 15 remained the committed baseline, keeping this visual
  cleanup as a separate, reviewable checkpoint.
- The Schedule tab is explicitly out of scope. Its routes, cards, comments,
  songs, fill-in requests, notification bell, and assignment behavior must
  remain unchanged.

Goal:

- Make the rest of the app feel like one coherent product without redesigning
  working workflows. Improve navigation semantics, visual hierarchy,
  responsive behavior, feedback, and accessibility while preserving all
  Package 1 through 15 data and behavior contracts.

Checkpoint 16A: capture the UI compatibility baseline:

- Record Android and iOS screenshots for onboarding, no-membership recovery,
  the two- and three-item bottom navigation, Church overview and every focused
  editor, Profile overview and every Profile editor, notification permission,
  password change, sign-out, and account deletion.
- Characterize current route destinations, Android back behavior, tab history,
  active-tab selection, dynamic Church-tab visibility, modal close behavior,
  unsaved-draft guards, keyboard dismissal, scroll position, and focus return.
- Add Package 16 contract tests before extracting shared UI. Run Packages 0
  through 15 as a regression suite after every checkpoint.

Checkpoint 16B: refine the floating bottom navigation:

- Preserve the existing floating visual identity, tab order, route names, and
  admin-only Church tab. Replace stack-accumulating tab presses with proper tab
  switching so repeated Schedule, Church, or Profile taps do not build a back
  stack or produce duplicate screens.
- Increase the compact 10px labels to a readable responsive size without
  clipping at larger font/display scales. Keep icon and label lanes stable for
  both two-tab and three-tab accounts.
- Add explicit selected, disabled, label, and hint accessibility state; keep a
  minimum 44-point touch target; provide a reduced-motion path for the animated
  indicator; and keep the bar clear of content, keyboards, gesture navigation,
  and device safe areas.
- Verify that an account switching between admin and member churches updates
  the available tabs without moving to an unauthorized route or leaking the
  previous church's tab state.

Checkpoint 16C: make Profile navigation visually consistent:

- Move Identity, Availability, Scheduling Preferences, and Notification
  Preferences onto the existing shared `ProfileFocusedHeader` contract one
  screen at a time. Preserve their route names, queries, mutations, draft
  handling, save guards, and accessibility announcements.
- Keep the Profile overview's current section model and main responsive header.
  Do not turn it into a dashboard or add decorative cards.
- Replace the full inline list of every church with a compact current-church
  row and a focused church selector screen or sheet. The selector must show
  each membership's Owner/Admin/Member access, support switching and retry,
  retain `Join Another Church`, and remain available to regular members.
- Keep the existing inline switcher component until the focused selector has
  parity tests for one church, many churches, slow/offline switching, removed
  membership, admin-to-member switching, and Larger Text.

Checkpoint 16D: standardize Church administration editors:

- Keep the Package 9 Church Setup and Schedule Management overview, readiness
  summaries, `Next` recommendation, invitation-code action, and all existing
  admin capabilities.
- Split the large Church route into focused destination components without
  changing navigation or backend behavior. Use one shared editor header, body,
  keyboard-aware scroll container, inline status region, and action footer.
  Preserve the current in-tab back action until route-based editors have a
  separately tested reason to replace it.
- Migrate one destination at a time: Church Details, Roles, Weekly Services,
  Members, Scheduling Rules, Song Types, Reminder Settings, Prepare Services,
  and Assign Members. Run the full suite and compare screenshots after each
  extraction.
- Standardize add/edit forms on one responsive sheet/modal primitive with a
  reachable close action, Android back support, drag/tap keyboard dismissal,
  scrollable content, stable draft state, and visible save/cancel actions on
  small phones and tablets.
- Keep Reminder Settings concise: only Active/Paused state, selected reminder
  times, validation, and save result. Do not expose cron checks, polling,
  function versions, or implementation diagnostics.
- Preserve every current RPC payload, direct compatibility fallback, Realtime
  update, cache key, delete-impact preview, auto-assignment option, and released
  client backend contract.

Checkpoint 16E: improve onboarding hierarchy without changing its workflow:

- Keep `Sign In`, `Join a Church`, and `Create a Church`, but make Sign In the
  clear returning-user action and visually group Join/Create as new-account or
  new-membership actions. When already authenticated, make the active account
  context clear without exposing private identifiers.
- Preserve required name validation, password-manager metadata, pending-intent
  recovery, email verification, password reset, invitation handling, duplicate
  submission protection, and deterministic post-onboarding bootstrap.
- Reuse the existing form fields and validation. Do not combine this polish
  with Auth logic, redirect URL, database, or session-storage changes.

Checkpoint 16F: unify feedback and edge states:

- Define one shared inline status treatment for loading, success, recoverable
  error, offline, and retry states. Keep blocking alerts only for destructive
  confirmation or an action that genuinely cannot continue in place.
- Apply the same feedback hierarchy to Profile editors, Church editors,
  notification settings, onboarding, and no-membership recovery. A successful
  save should identify what changed without covering the next action.
- Bring no-membership, initialization error, and retry screens into the same
  semantic color, typography, icon, and button system as the main app while
  retaining their current recovery actions and route behavior.
- Never expose raw Supabase, OneSignal, RPC, account, membership, or invitation
  identifiers in user-facing errors.

Checkpoint 16G: accessibility and responsive release pass:

- Verify VoiceOver, TalkBack, Voice Control, Larger Text, display scaling,
  sufficient contrast, differentiation without color alone, Reduced Motion,
  keyboard navigation, and Android back behavior across every changed screen.
- Remove unnecessary font-scale caps where content can reflow safely. Where a
  compact control requires a cap, provide the complete accessible label/value
  and prove that adjacent controls remain readable and reachable.
- Keep minimum touch targets, stable layout dimensions, word-safe church/person
  names, visible focus/selected states, semantic headings, and announced busy,
  error, and success states.
- Test small and large Android phones, current and older supported iPhones,
  landscape, tablet-size layouts, software keyboards, password managers, and
  both two-tab and three-tab navigation.

Out of scope:

- Schedule-tab UI or behavior, dark mode, a new design system, marketing-style
  pages, new backend capabilities, schema/RLS cleanup, notification delivery
  changes, and removal of compatibility paths for released app versions.
- Large animation, illustration, or color-palette changes. Continue using the
  current semantic tokens and restrained navy/blue identity.

Verification and release gate:

- Add `test:package16` and `verify:package16` covering route preservation,
  bottom-tab semantics, admin-tab visibility, shared-header parity, church
  switching, modal/sheet contracts, feedback sanitization, accessibility state,
  and the explicit Schedule-tab exclusion.
- Run TypeScript, full ESLint, Packages 0 through 16, Android and iOS production
  Metro exports, and `git diff --check`. No Supabase deployment should appear in
  the Package 16 release log.
- Complete screenshot comparison and the physical-device matrix before
  publishing. Specifically verify sign in, create/join, church switching,
  admin/member tab changes, every Church/Profile editor, password reset,
  sign-out, deletion preview, and return navigation.
- Rollback is a previous client build only. It must not require a database
  rollback, migration-history repair, deletion of user data, or retirement of
  any Package 1 through 15 contract.

Done when:

- The non-Schedule experience uses consistent navigation, headers, forms,
  feedback, typography, and accessibility behavior; no tab or modal traps the
  user; all prior package tests remain green; released app versions continue
  working against the unchanged backend; and the before/after physical-device
  matrix shows no workflow or responsive-layout regression.

#### Package 17: Role-Aware and Availability-Safe Manual Assignment

Status:

- Implemented and deployed to Supabase production on August 2, 2026.
- The additive candidate and validated-assignment RPCs are live. Existing direct
  assignment updates, tables, RLS policies, and RPC signatures remain in place,
  so released app versions keep working without this client update.
- Automated client, contract, SQL, advisor, type, lint, export, and regression
  gates are complete. Physical Android and iOS release-device checks remain a
  publishing gate for the new build.

Goal:

- Make the manual member picker deterministic and role-specific, and make the
  database reject a manual assignment when the selected member is unavailable
  for that service date. The app must explain the reason without exposing raw
  database errors.

Checkpoint 17A: characterize the existing assignment contract:

- Cover both Schedule implementations, the shared service mutation layer,
  assignment Realtime reconciliation, fill-in synchronization, the church
  `allow one member in multiple roles` setting, and current assignment RLS.
- Add fixtures for matching and non-matching roles, an owner/admin who also has
  a ministry role, unavailable dates, duplicate names, blank names, same-service
  assignments, deleted members, and a service changed while the picker is open.
- Define hard blocks separately from soft scheduling preferences. A marked
  unavailable date is a hard block; a weekly-service role preference may be
  shown as context but must not prevent an intentional manual assignment.

Checkpoint 17B: add an authoritative candidate/validation API:

- Add a new, uniquely named RPC for manual-assignment candidates instead of
  changing an existing RPC signature. It accepts an assignment id, derives the
  church and service from that row, derives the caller from `(select
  auth.uid())`, and permits only that church's owner or scheduling admins.
- Return only active members who hold the assignment's church role, with stable
  display name, role id/name, eligibility, and a small reason code such as
  `unavailable_date` or `same_service_conflict`. Sort eligible names
  deterministically and never use table-return order as UI order.
- Add a second atomic assignment RPC, or a validated apply mode on the new RPC,
  that locks/reloads the assignment and rechecks church membership, role,
  service date, unavailable date, and the church's multiple-role setting at the
  moment of writing. Do not trust candidate data cached by the device.
- Give the privileged functions a fixed `search_path`, validate every joined
  row belongs to the same church, revoke `PUBLIC` and `anon`, and grant only
  `authenticated`. Keep existing direct writes available for released clients.

Checkpoint 17C: rebuild the manual picker on the shared contract:

- Replace the unfiltered `members.map` list in both Schedule routes with one
  shared role-aware picker model. Show the target role as the section heading,
  eligible members first in alphabetical order, and an `Unavailable` section
  only when it helps the admin understand why a known role member cannot be
  selected.
- Disable unavailable rows and show a concise date-specific explanation, for
  example, `Unavailable on Sunday, August 9`. If the server rejects a member
  after the modal opened, keep the modal usable, refresh candidates, and show
  the same friendly explanation inline.
- Preserve clearing/reassigning behavior, optimistic UI safeguards, Realtime
  reconciliation, fill-in cancellation/synchronization, and account/church
  generation checks. A failed write must restore the prior assignment.

Verification and release gate:

- Add SQL tests proving a matching-role member can be assigned and that a
  non-role member, unavailable member, cross-church member, unauthorized caller,
  stale service, and prohibited same-service duplicate are rejected atomically.
- Add shared client tests for deterministic role/name ordering, unavailable
  reasons, duplicate names, stale picker recovery, and parity between Android
  and iOS routes. Run TypeScript, lint, full regression tests, database advisors,
  production exports, and `git diff --check`.
- Deploy the additive migration first, run the released-build smoke test, then
  publish the client. Rollback is the previous app build; the new RPCs may stay
  live because no old contract was changed.

Done when:

- The picker displays only members who belong to the selected role in a stable,
  understandable order; unavailable dates cannot be bypassed by the new client
  or a direct new-client request; and manual assignment still synchronizes all
  affected schedules and fill-in state.

Implementation record:

- `get_manual_assignment_candidates_v1` derives the assignment context and
  returns active, same-role candidates with deterministic names and explicit
  unavailable/conflict reasons.
- `assign_member_to_slot_v2` locks and revalidates assignment, church, role,
  date, membership, unavailability, and same-service rules before updating.
- Both Schedule routes use the same React Query-backed picker. Clearing an
  assignment still uses the released path, and the existing database trigger
  still synchronizes fill-in requests after a successful reassignment.
- Production contains the additive migration and its two forward corrections:
  `add_role_aware_manual_assignment`,
  `fix_role_aware_manual_assignment_builtin_calls`, and
  `fix_manual_assignment_service_date_contract`.
- Rollback remains a previous client build. The Package 17 RPCs can stay live
  because they do not change any released contract.

#### Package 18: Role-Scoped Fill Empty and Reassign All

Status:

- Implemented and deployed to Supabase production on August 2, 2026.
- The additive `auto_assign_service_slots_v2` RPC is live. The released
  six-argument RPC and all direct assignment paths remain unchanged, so older
  app versions continue working.
- Automated client, SQL, advisor, type, lint, regression, and production-export
  gates are complete. Physical Android and iOS checks remain required before
  publishing the new client build.

Goal:

- Let an admin run `Fill Empty Slots` or `Reassign All Upcoming Slots` for all
  roles or one selected church role without modifying assignments for any
  unselected role.

Checkpoint 18A: freeze current auto-assignment behavior:

- Extend the existing preview/apply tests for date ranges, visible services,
  unavailable dates, weekly-service preferences, role rounds, recent-history
  fairness, service spacing, admins with assigned roles, same-service duplicate
  rules, skipped reports, and preview/apply parity.
- Record exact current results for `fill_empty` and `reassign_all` so adding a
  role scope cannot silently change the all-role default.

Checkpoint 18B: add a versioned role-scoped RPC:

- Add a new RPC name rather than replacing or overloading the released
  six-argument `auto_assign_service_slots` contract. Accept the current mode,
  dry-run, date/service range, and a nullable target role id where `null` means
  all roles.
- Validate that the selected role belongs to the target church. Restrict the
  candidate slots, open-slot counts, clearing, preview, and skipped report to
  that role, while still reading prior schedule history needed for fair load
  and spacing decisions.
- In `reassign_all`, clear and rebuild only the selected role's slots. Never
  clear another role, even when both roles are on the same service. Keep the
  operation atomic and preserve preview/apply parity under concurrent admin
  requests.
- Keep the released RPC and its output unchanged, regenerate TypeScript types,
  and add an index only if `EXPLAIN` shows the role-scoped filter needs it.

Checkpoint 18C: add role scope to the admin workflow:

- Add a compact `All Roles` / `Specific Role` control to the existing assign
  workflow. When `Specific Role` is selected, require one active church role
  before preview can run and retain that selection while changing range/mode.
- Include the selected role in the preview key so an old preview cannot be
  confirmed after the role changes. Display the scope in the preview heading,
  summary counts, skipped report, confirmation text, and completion result.
- Invalidate only the affected church schedule/assignment queries after apply,
  then let Realtime reconcile without duplicate rows or a full-screen reload.

Verification and release gate:

- Test all-role parity, each mode with one role, no eligible members,
  unavailable dates, role deletion between preview/apply, concurrent admins,
  selected-date and visible-service ranges, and proof that unrelated role
  assignments remain byte-for-byte unchanged.
- Deploy the additive RPC first and smoke-test released builds before the new
  client is published. Rollback is the previous client, with the versioned RPC
  left live.

Done when:

- Both auto-assignment modes can safely target one role, the preview precisely
  matches the committed scope, and choosing `All Roles` preserves today's
  scheduling behavior.

Implementation record:

- `auto_assign_service_slots_v2` accepts the existing range/mode inputs plus a
  nullable role id and a preview token. `null` retains exact All Roles behavior.
- The private v2 planner restricts clearing, slot counts, preview rows, skipped
  reports, and writes to the selected role while preserving full church history
  and unrelated same-service assignments for fairness and conflict decisions.
- Apply recomputes the plan under the church advisory lock, rejects stale
  tokens before writing, and rolls the transaction back if the committed member
  plan differs from the approved preview.
- The Church workflow includes accessible `All Roles` / `Specific Role`
  controls, requires an active role, includes scope in preview identity and
  result copy, and handles deleted roles or stale previews without exposing raw
  database errors.
- Production SQL proves all-role parity, both scoped modes, selected date and
  visible-service ranges, unavailable/no-candidate reports, preview/apply
  parity, deleted roles, stale previews, and byte-for-byte preservation of
  unrelated assignments.
- `EXPLAIN` and both Supabase advisors found no Package 18 index requirement or
  advisory issue. Rollback is the previous client; the additive v2 RPC can stay
  live.

#### Package 19: One-Time Fill-In Escalation After Three Hours

Status:

- Implemented and deployed to the live Supabase project on 2026-08-01/02 UTC.
  The private queue and service-only lease RPCs are additive, and released
  fill-in inserts, acceptance/cancellation, initial push delivery, notification
  preferences, Realtime rows, and navigation payloads remain unchanged.
- Live migration versions are `20260802013910` (queue/RPC/Vault contract) and
  `20260802014444` (five-minute cron). Edge Function
  `send-fill-in-escalations` is active at version 2 with `verify_jwt = false`
  plus a dedicated Vault-backed secret header.
- The rollback-safe SQL behavior suite passed live for 2h59/3h eligibility,
  overlapping workers, release/retry, final relevance, skipped stale work, and
  successful replay. Custom-auth rejection returned 401, Vault-authenticated
  diagnostics returned 200, and the first scheduled cron invocation returned
  200 with zero due work and zero sends.
- Deno, Package 19 behavior/contracts, TypeScript, and targeted lint pass.
  Supabase advisors found no Package 19 issue. See
  `docs/PACKAGE_19_FILL_IN_ESCALATIONS.md`.
- Remaining external release gate: a three-hour physical iOS/Android canary must
  confirm one reminder per registered device, no Android duplicate, navigation,
  and acceptance/cancellation suppression before Package 19 is called fully
  device-verified.

Goal:

- When a fill-in request is still pending three hours after creation, send one
  additional push to eligible members for that role and the church admins. Do
  not resend after the request is filled, cancelled, or no longer relevant.

Checkpoint 19A: define durable escalation state:

- Add nullable/defaulted timing and lease fields to `fill_in_requests`, or an
  additive child delivery table if the schema audit shows it better matches the
  existing notification model. Old client inserts must automatically become
  eligible without supplying new fields.
- Add a partial due-work index for pending, unsent escalations. Keep the current
  one-pending-request-per-assignment constraint and atomic accept/cancel trigger
  behavior unchanged.
- Add a private claim/finalize/release contract using row locks and a short lease
  so overlapping cron runs cannot send the same escalation. A failed network
  attempt must be retryable; a successful attempt must be durable.

Checkpoint 19B: add the escalation Edge Function and cron:

- Reuse the existing normalized role matching, notification preferences,
  multi-device subscription resolution, invalid-subscription cleanup, and
  OneSignal sender. Preserve admins as oversight recipients, exclude the
  requester, and deduplicate member ids and device subscription ids.
- Recheck `status = 'pending'`, the service still exists and is upcoming, and
  the assignment still matches before each send. Use a distinct deterministic
  event/idempotency key such as `fill_in_request_reminder:<request-id>` so a
  retry cannot create duplicate pushes or notification-center rows.
- Keep notification navigation compatible by retaining the existing
  `fill_in_request` data type and request/service identifiers, while using copy
  that clearly identifies this as a reminder and includes the requester's real
  display name, role, church, and service date.
- Schedule a cron run every five minutes; a request becomes eligible at exactly
  three hours and sends on the first successful run after that, normally within
  five minutes. Protect the `verify_jwt = false` cron endpoint with a dedicated
  secret header stored in Supabase secrets/Vault, accept no caller-selected
  request id, and keep the operation idempotent.

Checkpoint 19C: preserve app and notification-feed behavior:

- Record the escalation in `member_notifications` for each intended recipient
  using the distinct event key. Existing notification preference
  `fill_in_requests` controls both the initial request and its one-time reminder.
- Confirm accepting or cancelling from either device updates all signed-in
  devices through the existing RPC, cache, and Realtime paths and prevents a
  claimed-but-not-sent reminder from being finalized incorrectly.
- Add deployment diagnostics that report due, claimed, sent, skipped, retried,
  and failed counts without exposing secrets or making cron internals visible in
  the app's normal admin notification settings.

Verification and release gate:

- Use clock-controlled SQL/function tests for 2h59m, 3h, filled, cancelled,
  deleted/past service, opted-out members, admins without the role, no devices,
  two devices per account, overlapping cron calls, OneSignal failure/retry, and
  successful idempotent replay.
- Run Deno checks, shared notification tests, database tests/advisors, and a
  staged live canary with a temporary request. Verify exactly one escalation on
  each registered device and no Android duplicates, then remove test data.
- Deploy schema and function before enabling cron. Released builds need no
  update to create qualifying requests or open the resulting notification.

Done when:

- Every unresolved request receives at most one three-hour escalation per
  recipient device, accepted/cancelled requests receive none, preferences and
  admin oversight remain correct, and retries cannot produce duplicate pushes.

#### Package 20: Cross-Platform Popup and Sheet Consistency

Status:

- Implementation complete; automated verification is complete and the physical
  device release matrix remains a store-submission gate.
- Client-only. No database migration, Edge Function deployment, route change,
  mutation payload change, or persisted-data change was introduced, so released
  app versions continue to work unchanged.

Goal:

- Make every popup use one professional responsive presentation system on iOS
  and Android, with consistent width, spacing, header, actions, keyboard
  behavior, dismissal, and scrolling. Consistency means the same shell and size
  rules; confirmations stay compact while forms and long previews receive the
  space and scrolling they need.

Checkpoint 20A: inventory and classify every popup:

- Build a route-by-route inventory of every React Native `Modal`,
  `AdminFormModal`, notification panel, confirmation, form, date/time picker,
  preview, member selector, comments/songs editor, onboarding permission prompt,
  and bulk-action flow in both platform Schedule routes and shared components.
- Record purpose, current dimensions, safe-area behavior, keyboard behavior,
  Android back action, outside-tap behavior, scroll ownership, destructive
  action, loading lock, draft retention, and accessibility focus restoration.
- Capture screenshots on the same physical-device matrix used by Package 16 and
  add behavior tests before replacing any wrapper.

Checkpoint 20B: finish one shared modal system:

- Extend the Package 16 primitive with explicit `confirmation`, `form`, and
  `long-content` variants that share outer margins, maximum width, radius,
  backdrop, header, close control, body spacing, action footer, and semantic
  colors. Avoid per-screen height constants.
- Derive responsive maximum height from safe-area-adjusted window dimensions.
  Keep small forms stable when the keyboard opens, make long content scroll
  inside one owner, and keep save/confirm/cancel actions visible without nested
  scroll views or popups inside popups.
- Standardize drag/tap keyboard dismissal, date/time draft-and-confirm behavior,
  Android back, iOS accessibility escape, loading/disabled state, destructive
  confirmation, focus trap/return, and Larger Text reflow.

Checkpoint 20C: migrate by risk, not all at once:

- Migrate simple confirmations first, then short selectors, Church/Profile
  forms, Schedule member/fill-in/song/comment forms, notification center, date
  and time pickers, bulk service deletion, prepare-quarter, and auto-assignment
  preview last.
- Move genuinely shared Schedule popup content into shared components while
  retaining platform presentation adapters where behavior differs. Delete old
  wrappers only after Android/iOS parity tests pass for that flow.
- Preserve every mutation payload, draft, validation rule, preview key,
  destructive guard, cache update, and route. This package must not include a
  database migration or business-logic rewrite.

Verification and release gate:

- Add visual/interaction tests for open, close, outside tap, keyboard open and
  dismissed, orientation change, scroll to final action, loading lock, error,
  destructive confirmation, Android back, iOS VoiceOver escape, and focus
  restoration for every modal class.
- Run TypeScript, full lint/tests, Android/iOS production exports, screenshot
  comparisons, small/large phone and tablet checks, Larger Text, display
  scaling, and `git diff --check` after each migration group.
- Rollback is the previous client build; no backend rollback is allowed or
  needed.

Done when:

- Every popup follows the same responsive presentation contract, no keyboard or
  long list hides the final action, no popup blocks navigation, and all existing
  workflows behave identically on Android and iOS.

#### Package 21: iOS Upcoming-Schedule Widget

Status:

- Implemented locally on 2026-08-01. TypeScript behavior/contracts, Expo config,
  clean iOS prebuild, native Swift SDK typecheck, lint, Deno checks, and the full
  automated test suite pass.
- No Supabase migration or deployment is required. A physical-device preview
  build, Apple capability/profile regeneration, and TestFlight validation remain
  release gates because this environment cannot validate Apple credentials or a
  Home Screen widget on a real device.
- iOS-only native feature requiring a new EAS build. It must not require a
  Supabase schema change and must not alter Android or released-app behavior.

Goal:

- Add one WidgetKit extension with two independently addable widget choices for
  the currently selected church:
  - `Next Church Service`: the church's next scheduled service, whether or not
    the signed-in member has an assignment in it.
  - `My Next Assignment`: the next scheduled service where the signed-in member
    is assigned to at least one role.
- Let a user add either choice or both choices at the same time. Both open the
  existing Schedule tab when tapped.
- Implement these as two static widget kinds in one `WidgetBundle`, not as an
  iOS 17 AppIntent or a device-wide setting inside Profile. This keeps the full
  feature available on the existing iOS 16 deployment target and lets each Home
  Screen widget retain its own purpose without adding a native configuration
  intent or backend preference.

Checkpoint 21A: complete an isolated native compatibility spike:

- Verify the installed Expo SDK 54, CNG/prebuild setup, iOS 16 deployment
  target, and existing `@bacons/apple-targets` version can produce a minimal
  WidgetKit extension. Do not upgrade Expo solely to adopt a newer widget
  package and do not continue until a preview EAS build installs successfully.
- Give the widget a unique extension bundle identifier and declare it in
  `extra.eas.build.experimental.ios.appExtensions` before credentials are
  generated. Keep it distinct from the OneSignal Notification Service
  Extension and its app group.
- Create a dedicated widget app group and add it alongside, not in place of,
  `group.com.lbkchano.musicministry.onesignal` on the main target. The widget
  target receives only the widget group. Verify App ID capabilities and fresh
  provisioning profiles for both targets before the feature branch proceeds.
- Register one extension containing a `WidgetBundle` with two stable, unique
  widget kinds such as `MusicMinistryNextChurchService` and
  `MusicMinistryMyNextAssignment`. Give each kind a clear gallery title,
  description, icon treatment, and small/medium family declarations so users
  understand the difference before adding it.

Checkpoint 21B: define a private, local widget snapshot:

- Derive both widget projections from the already authenticated, currently
  selected church schedule cache. Do not let the widget extension contact
  Supabase or hold an Auth session.
- `Next Church Service` selects the first upcoming service after deterministic
  date/time ordering without checking assignment membership. It displays church
  name, service type, date, and time; it must not imply that the member is
  assigned when they are not.
- `My Next Assignment` filters services to assignments whose `member_id` equals
  the fully initialized current church member id, then selects the first result
  using the same ordering. If the member has multiple roles in that service,
  show all distinct assigned roles in stable role order rather than duplicating
  the service.
- Use the app's existing local service-date/time semantics so the widget does
  not shift a service to another day. Define deterministic tie-breaking by
  service date, service time, then service id. Treat an undated/invalid service
  as unusable, and define a consistent rule for same-day services with no time.
- Store only a versioned, sanitized JSON snapshot in the shared widget app
  group: current church display name, a bounded upcoming church-service list, a
  bounded upcoming member-assignment list, service id/date/time/type, assigned
  role names where applicable, generated-at time, and schema version. Keeping a
  few ordered entries for each mode lets WidgetKit advance to the following
  service without waiting for the app to reopen. Never store Supabase
  access/refresh tokens, OneSignal identifiers, account/member email,
  invitation codes, or service-role/anon secrets there.
- Update the snapshot after authenticated bootstrap, schedule or assignment
  query success, relevant Realtime changes, pull-to-refresh, church switch, and
  app foreground. Assignment insertion, reassignment, clearing, fill-in
  acceptance, service creation/edit/deletion, and bulk deletion must recompute
  both projections from the latest complete cache rather than patching only one
  widget mode.
- Clear the snapshot and reload both widget timelines immediately on sign-out,
  account deletion, lost membership, no-membership recovery, or account switch
  so another account's church or assignment cannot remain on the Home Screen.
- Make writes atomic and generation-scoped so a slow response from a previous
  account/church cannot overwrite the current snapshot. Widget refresh is
  best-effort, not Realtime. Reload both widget kinds after one committed
  snapshot write; do not write or reload once per widget and do not create a
  feedback loop between the extension and app.

Checkpoint 21C: build the WidgetKit presentation:

- Give the two choices a shared visual system but distinct headings and symbols:
  `Next Church Service` for the church-wide result and `My Next Assignment` for
  the member-specific result. Never silently fall back from an empty personal
  assignment to the next church service because that would misrepresent the
  member's schedule.
- Support small and medium families first. Keep the selected next service
  prominent; medium may show the following one or two entries from the matching
  projection when space permits. The church-wide widget never shows other
  members or role assignments. The personal widget shows only the current
  member's own role or roles.
- Use semantic system colors, readable dates, role labels, word-safe church
  names, privacy-sensitive redaction, and Dynamic Type-aware layouts without
  squeezing text mid-word. Each widget includes an accessibility label that
  announces its mode, church, service, time, and personal roles when applicable.
- Use one deep link into the existing Schedule tab. Keep the first release
  read-only because iOS 16 is supported; do not add iOS 17-only interactive
  buttons or a second scheduling implementation inside the extension.
- Provide mode-correct signed-out, no-church, stale-data, and unavailable-data
  timeline entries. `Next Church Service` uses `No upcoming services`; `My Next
  Assignment` uses `No upcoming assignments`. Both can show `Open Music
  Ministry to refresh` when the snapshot is absent, stale, malformed, or from
  an unsupported schema version.
- Build bounded timelines from the stored ordered lists and schedule the next
  refresh at safe service boundaries. When the last usable entry passes, show
  the correct empty or stale state instead of continuing to display a past
  service indefinitely.

Verification and release gate:

- Add TypeScript tests for snapshot filtering, stable ordering, bounded lists,
  versioning, account/church generation isolation, and atomic clearing. Include
  fixtures where the next church service has no personal assignment, the next
  personal assignment is a later service, one member has multiple roles in one
  service, two services share a time, a service is deleted, and an assignment is
  reassigned or accepted through fill-in.
- Add Swift tests or preview fixtures for both modes in small and medium sizes,
  including normal, multiple-role, no-service, no-assignment, stale, malformed,
  signed-out, long church name, Larger Text, and privacy-redacted states.
- Verify both widget choices can be added simultaneously and remain independent.
  Test sign-in, account/church switching, two devices on one account, assignment
  changes, fill-in acceptance, offline launch, sign-out, deletion, deep linking,
  app upgrade, and widget removal/re-addition on physical iOS devices.
- Run prebuild/config inspection to prove the main app retains OneSignal
  entitlements, the widget has only its intended app group, bundle identifiers
  do not collide, and EAS recognizes both extensions. Then run a preview build,
  notification regression test, production build, and TestFlight validation.
- Rollback is an app build without the widget extension. No database rollback,
  credential deletion, or Android release is required.

Done when:

- `Next Church Service` reliably shows the active church's next service without
  implying an assignment, `My Next Assignment` reliably shows only the active
  member's next assigned service and role or roles, either or both widgets can
  coexist, private data clears on every account transition, both deep-link to
  Schedule, and the extension ships without disturbing OneSignal delivery,
  Android, Supabase, or released clients.

#### Package 22: Responsive Schedule Experience Redesign

Status:

- Checkpoints 22A through 22J implemented locally on 2026-08-01. Android and iOS now
  use one shared Schedule tree, iOS widget synchronization is isolated behind a
  platform hook, and cache-local `All Services`, `My Schedule`, and
  `Needs Attention` views are implemented. Cache-local service type, role, and
  loaded-date filters include an active count and clear action. Services now use
  virtualized local-month sections and compact, expandable summaries with admin
  service deletion behind an overflow action. Responsive role-first team rows
  now use the focused availability-safe assignment interaction, and numbered
  song rows preserve author ownership, ordering, deletion, and long-list access.
  Pending fill-ins now use responsive attention rows with duplicate-action guards,
  and the bell opens a focused Schedule notification history backed by one shared
  read/unread and Realtime owner. Schedule bootstrap, membership loss, recoverable
  initialization failure, offline cache, range failure, setup, personal, filter,
  and no-service states are now distinct without replacing usable cached content.
  Schedule names, roles, songs, requester copy, notification titles, month labels,
  state copy, and action labels now share one measured word-safe typography
  contract with readable font floors, bounded lines, exact accessibility/source
  strings, and fixed action lanes. Services, sections, songs, fill-in alerts,
  assignments, filters, notification history, and modal actions now expose
  complete semantics and interaction states. Targets are at least 44dp, status
  colors meet contrast requirements and retain non-color cues, reorder changes
  are announced, and disclosure/modal motion follows the operating-system
  Reduced Motion preference.
- No backend, permission-delivery, push-recipient, event-key, Edge Function, or
  database contract changed; no Supabase migration or deployment is required for
  22A-22J.
- TypeScript, full ESLint, all 356 automated tests, Edge Function Deno checks,
  whitespace validation, and clean Android/iOS production exports pass. A
  physical-device visual pass remains part of the eventual Package 22 release
  gate.
- Client-only polish package. It must preserve every released Supabase table,
  policy, RPC, Edge Function, Realtime channel, notification payload, cache key,
  route, mutation, and response shape so installed older versions continue to
  work unchanged.

Goal:

- Rebuild the Schedule tab into a calm, professional, highly scannable
  experience that uses the same visual hierarchy, responsive typography,
  focused actions, loading behavior, and accessibility standards as Profile and
  Church.
- Preserve every current workflow. This package reorganizes and polishes the
  presentation; it does not remove scheduling, assignment, fill-in, song,
  notification, refresh, pagination, Realtime, or widget functionality.
- Make the same information and actions reliable on narrow and wide Android
  phones, supported iPhones, tablets, landscape, display scaling, and Larger
  Text without shrinking names unpredictably, breaking words, or covering
  actions.

Non-negotiable authorization boundary:

- Only a verified owner or scheduling admin for the active church may directly
  change services or assignments. Service deletion, manual assignment,
  reassignment, clearing an assignment, and every other direct schedule mutation
  remain behind the existing church-scoped admin check in both rendering and
  mutation handlers.
- A regular member receives no direct service or assignment editing control.
  Members may add songs and edit only songs they authored. A regular member must
  never receive edit/delete controls for another member's song.
- Preserve currently released constrained self-service workflows so redesigning
  the UI does not remove functionality: eligible members can accept fill-in
  requests, assigned members can request a fill-in, requesters can cancel their
  own pending requests, and currently authorized own-song delete/reorder actions
  remain available. Treat any future change to those permissions as a separate
  functional/security package, not part of this visual redesign.
- Admins retain all current song moderation and ordering capabilities. Every
  mutation must still rely on backend authorization; hiding a button is not the
  security boundary.
- Resolve permissions only from the fully initialized current church membership.
  Never infer admin access from account history, another church, cached UI mode,
  the account that originally created a church, or which onboarding button was
  used.

Checkpoint 22A: freeze behavior and define one shared Schedule contract:

- Record a regression matrix for every currently reachable action in both
  `index.tsx` and `index.ios.tsx`: refresh, range loading, service deletion,
  manual assignment, clear assignment, add/edit/delete/reorder songs, request/
  accept/cancel fill-in, notification history, permission onboarding, empty and
  error recovery, Realtime updates, and iOS widget snapshot refresh.
- Add permission fixtures for owner, scheduling admin, ordinary member, song
  author, non-author, assigned member, eligible fill-in member, requester, and a
  single account that is admin in church A and member in church B.
- Define one view model for month sections, card summaries, current-member
  assignment state, pending fill-in attention, ordered songs, admin capabilities,
  and member-owned actions. Derive it from the current query cache without
  changing fetched data or mutation contracts.
- Extract one shared Schedule screen and shared style/component system for
  Android and iOS. Keep only the native iOS widget synchronization in a small
  platform-specific hook or wrapper. Do not maintain two large visual trees or
  use platform name as the layout breakpoint.
- Preserve stable service and assignment identities, FlatList/SectionList keys,
  memoization boundaries, cache updates, scroll position, Realtime idempotency,
  and the current bottom safe-area clearance.

Checkpoint 22B: retain the shared tab header and add useful view controls:

- Keep `ResponsiveTabHeader`, the active church name, Schedule eyebrow, loaded
  range, notification bell, unread badge, safe-area behavior, and reserved bell
  lane. Reuse the existing adaptive and word-safe title primitives rather than
  introducing Schedule-specific font calculations.
- Replace the low-value raw service count with concise loaded-range and relevant
  schedule context while retaining an accurate upcoming count where it helps.
  Metadata must wrap as a group below the title and never compete with the bell.
- Add a true segmented control below the header for `All Services` and
  `My Schedule`. `All Services` remains the default and displays exactly the
  current service set. `My Schedule` derives locally and must not trigger a new
  backend contract.
- `My Schedule` includes services where the current member is assigned. Keep a
  separate visible `Needs Attention` section above the filtered results for the
  member's own fill-in requests and eligible fill-in requests, so selecting the
  personal view can never hide an actionable fill-in.
- Add one compact filter button for service type, role, and loaded date range
  only if all filters can be performed on the already loaded cache. Show an
  active-filter count and a clear action; never silently persist a filter that
  makes a future launch appear to have missing services.
- Keep `Load Next N Days` and retry behavior. A filter must never change the
  source window, pagination cursor, widget projection, notification targeting,
  or backend query semantics.

Checkpoint 22C: organize the schedule into virtualized month sections:

- Replace the uninterrupted service stream with one virtualized `SectionList`
  grouped by local service month and year. Use stable month keys and sticky,
  accessible section headers while retaining deterministic service date/time/id
  ordering.
- Keep service dates in the app's existing local-date semantics. Do not parse a
  date-only service through UTC or move it to another day at timezone or daylight
  saving boundaries.
- Preserve pull-to-refresh, nonblocking cached content, loaded range footer,
  maintain-visible-position behavior where supported, and sufficient bottom
  inset for the floating tab bar.
- Constrain the content to a readable maximum width on tablets while retaining
  one chronological column. Do not turn a schedule into a two-column card grid
  where reading order becomes ambiguous.

Checkpoint 22D: redesign the service summary for fast scanning:

- Use an 8px-or-less service surface with a hairline border, restrained or no
  shadow, 14-16px internal spacing, and clear separation between services. Avoid
  nested decorative cards and the current heavy 16px floating-card treatment.
- Lead with a stable date lane containing weekday, day, and month. Place service
  type and localized time in the flexible center lane. Reserve the right lane
  for status and one overflow action so text can never collide with controls.
- For admins, move destructive service actions into an accessible overflow menu
  with a confirmation. Do not expose a prominent trash icon in the title row.
  Include only actions backed by an existing working mutation; do not add a dead
  `Edit Service` command as visual decoration.
- Show a compact, prominent `Your Assignment` summary near the top when the
  current member has one or more roles. Combine multiple roles without
  duplicating the service and never imply assignment on an unassigned service.
- Use progressive disclosure for large services: the collapsed summary retains
  date, service, time, personal assignment, fill-in attention, team count, and
  song count; expanding reveals the complete team and ordered song list. Keep
  expansion device-local and ephemeral, and automatically expose content needed
  for an active action or error.

Checkpoint 22E: rebuild team rows around role and permission clarity:

- Present assignments as quiet Profile-style rows with role as the primary
  label, assigned person as the value, and an explicit `Unassigned` state.
  Maintain the church's configured role order.
- On compact widths or large font scales, stack role and person vertically.
  On wider widths, use separate flexible lanes. Never force the iOS inline row
  or Android stacked row purely by platform.
- For admins, tapping an assignment row opens the existing availability-safe,
  role-grouped manual assignment modal. Put assign/reassign/clear commands in
  that focused interaction instead of showing multiple small icons on every row.
- For members, assignment rows are read-only except for the existing
  `Request Fill-In` action on their own eligible assignment. Use a full minimum
  44x44 touch target and a clear pending state after a request exists.
- Keep unavailable-date blocking, role eligibility, candidate ordering, error
  messages, optimistic/cache updates, and all Package 17/18 RPC fallbacks exactly
  as implemented.

Checkpoint 22F: simplify songs without changing ownership or ordering:

- Display songs as one ordered list with stable numeric position, song type,
  optional song number, title/details, and author metadata. Use one list row per
  song rather than multiple badges and nested action surfaces competing for
  space.
- Put one icon-only Add Song command with an accessibility label in the Songs
  section heading. Keep the current multi-song draft, order controls, optional
  member notification selection, keyboard behavior, validation, and responsive
  shared modal.
- Tapping an authored song opens the existing edit flow. A regular member gets
  no edit affordance for a song authored by someone else. Admin moderation stays
  available through the row overflow menu.
- Preserve current delete and reorder functionality for every actor already
  authorized to use it. Reorder mode must expose position, disabled boundaries,
  busy state, rollback/error feedback, and minimum touch targets without
  changing persisted `display_order` semantics.
- For long song lists, show a useful ordered preview and an explicit `Show All`
  expansion rather than letting songs push assignments and actions many screens
  apart. No song may become inaccessible while collapsed.

Checkpoint 22G: elevate fill-in requests and notification history:

- Render pending fill-ins as a single high-priority, non-nested attention row
  immediately below the service summary. In one readable sentence show the
  requester's resolved display name, role, optional reason, and whether the
  current member can accept or cancel.
- Keep requester-name fallbacks, admin visibility, role eligibility, duplicate
  acceptance protection, cancellation, three-hour escalation, acceptance
  notification, navigation payload, and Realtime/cache convergence unchanged.
- Keep the bell in the shared header, but move long notification history to a
  focused Schedule-owned screen using the same focused header pattern as Profile
  subpages. Preserve unread count, read-at updates, realtime insert/update/delete,
  permission-disabled behavior, loading/error/empty states, and a route-safe
  fallback so notification taps and restored navigation cannot fail.
- Do not alter OneSignal identity, push subscriptions, recipient resolution,
  notification event keys, or any Edge Function in this package.

Checkpoint 22H: unify loading, refresh, empty, and recovery states:

- Use the shared app state and refresh notice primitives from Packages 6, 10,
  and 16. Initial bootstrap may use a full-screen state; background refresh must
  retain the last usable schedule and never flash the whole screen.
- Provide distinct states for no upcoming services, no personal assignments,
  filters with no matches, incomplete church setup, service-range failure,
  offline cached data, lost membership, and recoverable initialization failure.
- Admin-only recovery may link to the existing Church Setup destination. A
  regular member must never receive an admin setup command or a misleading blank
  admin tab.
- Keep notification permission education contextual and nonblocking. It must not
  displace the schedule repeatedly or trigger the OS prompt without the existing
  explicit Enable action.

Checkpoint 22I: make every name and action responsive once, not per screen:

- Apply the existing deterministic typography and word-safe wrapping system to
  church names, service types, member names, roles, song titles, requester names,
  notification titles, month labels, button labels, and empty/error copy where
  appropriate. Do not use viewport-proportional font sizes or arbitrary
  per-platform shrink rules.
- Test short names, ordinary names, long multi-word names, one very long token,
  compound and hyphenated names, apostrophes, accents, emoji, right-to-left text,
  long translated action labels, and duplicate names. Preserve exact stored text
  for database writes, selection, copying, notifications, and accessibility;
  visual normalization must never mutate source data.
- Allow names to wrap at word boundaries up to the component's explicit line
  limit. Disable hyphenation and mid-word breaks. After the readable font floor
  is reached, ellipsize only the visual label while VoiceOver/TalkBack announces
  the complete value.
- Reserve fixed-width action lanes before measuring text. Switch rows from
  horizontal to stacked layouts using available width and font scale, not device
  model. Text must never render beneath the bell, overflow an action, resize a
  touch target, or change card width when status changes.
- Validate 320, 360, 375, 390, 430, 768, and 1024 point/dp widths; portrait and
  landscape; Android display scaling; iOS Larger Text; and font scales from 1.0
  through the app's supported accessibility maximum.

Checkpoint 22J: accessibility and interaction polish:

- Give every service, section, assignment, song, fill-in alert, disclosure,
  menu, and action a semantic role, complete label, useful hint, selected/
  expanded/disabled/busy state, and logical reading order.
- Make every interactive target at least 44x44 points/dp. Support VoiceOver,
  TalkBack, Voice Control, keyboard navigation where available, reduced motion,
  sufficient contrast, and differentiation without color alone.
- Use subtle disclosure/row transitions only when reduced motion is off. Preserve
  scroll position when a card expands, a realtime event arrives, or a mutation
  updates one service.
- Keep all popups on the shared Package 20 modal contract with fixed actions,
  keyboard dismissal, accessibility escape, Android Back, safe areas, and one
  vertical scroll owner.

Compatibility and rollout gate:

- This package requires no Supabase migration or deployment. Do not alter or
  redeploy backend objects merely to support visual grouping, filters,
  disclosure, or notification presentation.
- Build the new view model and shared components beside the current screen,
  protect them with a local client rollout flag during development, and retain a
  one-build rollback path to the current Schedule presentation.
- Before removing duplicated visual code, compare every existing handler,
  mutation, modal, query, cache update, realtime subscription, permission gate,
  and iOS widget refresh trigger against the shared replacement. No handler may
  disappear because its visible button moved.
- Run the released Android and iOS builds against the unchanged backend before
  and after publishing the redesigned client. Installed older builds must still
  load, refresh, mutate, receive realtime changes and notifications, and use
  fill-ins exactly as before.
- Rollback is a client build that restores the old visual composition. It must
  not require a database rollback, data repair, push reconfiguration, or removal
  of user-created services, assignments, songs, or fill-in requests.

Verification:

- Add pure unit tests for section grouping, local date boundaries, ordering,
  `All Services`, `My Schedule`, needs-attention inclusion, filter clearing,
  expansion state, personal assignment summaries, and long-name layout choices.
- Add permission contract tests proving owner/admin controls are available only
  in the active admin church; ordinary members cannot mutate services or direct
  assignments; song authors cannot edit another author's song; and all current
  fill-in and own-song workflows remain reachable.
- Add component contracts proving Android and iOS render one shared Schedule
  tree, every action maps to its existing handler, admin menus contain no dead
  command, notification history retains read/realtime behavior, and Package 21
  widget sync remains iOS-only.
- Test service creation/deletion, manual reassignment/clear, bulk deletion,
  auto-assignment results, fill-in request/accept/cancel/escalation, song add/
  multi-add/edit/delete/reorder, notification opening, pull-to-refresh, range
  loading, offline recovery, and realtime changes while cards are collapsed and
  expanded.
- Capture visual screenshots for the complete width/name/font matrix in member,
  admin, no-assignment, multiple-role, unassigned-slot, many-song, fill-in-alert,
  empty, loading, refreshing, error, and filtered states on Android and iOS.
- Run TypeScript, ESLint, Deno function checks, all automated tests, Android and
  iOS JavaScript exports, and physical-device smoke tests before release.

Done when:

- Members can immediately understand what is next, what they are assigned to,
  and what needs attention; admins can manage the same complete schedule without
  cluttering every row; songs and fill-ins remain easy to use; every short or
  long name remains readable and stable; Android and iOS share one responsive
  implementation; all current functionality and permissions are preserved; and
  released app versions continue to work against the unchanged backend.

### Ownership Boundaries for Items 12-23

- Item 12 owns membership discovery, church switching, account-device push
  registration, recipient deduplication, and the atomic create/join backend.
- Item 23 owns signed-out/onboarding UI, Auth restoration coordination,
  verification/resume behavior, no-membership recovery, and first permission
  education. It consumes item 12's backend rather than duplicating it.
- Item 14 owns shared loading and refresh semantics. Later tabs consume those
  states instead of introducing new global loading booleans.
- Items 15 and 16 own shared header sizing and wrapping. Church and Profile must
  not add screen-specific font shrinking after those packages land.
- Item 13 owns admin-only church configuration and schedule management. It must
  not become a second account/church switcher or Profile settings screen.
- Item 17 owns the shared Profile shell and visual primitives; items 18 through
  22 own the data and behavior of their individual Profile sections.
- Item 18 owns membership identity and display-name editing; item 19 owns hard
  unavailable dates; item 20 owns soft scheduling preferences; item 21 owns
  notification delivery preferences; item 22 owns account-wide actions and
  deletion.
- A later package may remove old client code only after feature parity and
  rollback tests pass. No package may remove an old backend contract while a
  supported released build still uses it.


### 12. Support One Account Across Multiple Churches

Goal:

- Let one Supabase Auth account use the same email in any number of churches.
  The person can be an admin in one church and a regular member in another
  because authorization belongs to each church membership, not to the email or
  account globally.

Current finding:

- Supabase Auth correctly allows only one account for an email. The app should
  reuse that account rather than create duplicate auth users.
- `church_members` already stores a separate row per church and includes a
  per-membership `is_admin` flag. `private.is_church_admin(uuid)` also checks the
  selected church, so the core permission model is pointed in the right
  direction.
- `ChurchContext` already discovers both owned churches and churches connected
  through `church_members`, but the member signup screen always calls
  `auth.signUp`. An existing email therefore has no reliable "join another
  church" path.
- The Church tab is only visible when the current church grants admin access.
  A regular member who belongs to multiple churches therefore needs a church
  switcher somewhere available to every signed-in user.
- `createChurch` currently inserts the church separately from its owner member
  record. Every owner must also have a `church_members` row so assignments,
  roles, profile settings, comments, and notifications have a valid
  church-scoped member identity.
- Member-scoped multi-device push is already deployed:
  `onesignal_subscriptions` permits multiple physical subscriptions per member,
  `claim_onesignal_subscription` claims one device safely, and notification
  event keys prevent repeated history rows. Multi-church work must extend this
  implementation rather than recreate it.
- OneSignal is currently logged in and registered against only the active
  `church_members.id`. Switching churches can move the device subscription away
  from the other membership, which would make notifications depend on the
  church currently open in the app.

Database foundation:

- Add a preflight migration that reports duplicate or orphaned
  `(church_id, member_id)` records without deleting live data. Resolve any
  conflicts explicitly before adding a partial unique index for non-null
  member IDs.
- Add a new authenticated `join_church_by_invitation` RPC. It must validate the
  invitation code, lock the user/church pair, return the existing membership
  when already joined, and never let the caller choose `is_admin`.
- When the church already contains an unclaimed invited row with the signed-in
  account's verified email, claim that row instead of inserting a second
  member. Preserve its existing name, roles, and admin flag; only fill missing
  profile fields from trusted account metadata.
- Add an atomic `create_church_with_owner_membership` RPC that creates the
  church and its owner `church_members` row in one transaction. Return both
  records so the app can select the church immediately.
- Backfill missing owner memberships for existing `churches.admin_id` records
  with an idempotent migration. Never downgrade or overwrite an existing
  membership, role list, display name, or admin flag.
- Audit every admin RPC and RLS policy used by Church Setup, scheduling,
  unavailability, fill-ins, comments, and notifications. Authorization must
  always be evaluated for the target church through `private.is_church_admin`
  or an equivalent membership check.
- Keep `churches.admin_id`, `church_members.is_admin`, all current columns, and
  every existing RPC signature. New migrations must be additive so released
  Android and iOS builds continue to work.

Notification-safe multi-church registration:

- Add an account/device push-registration path that associates a physical
  OneSignal subscription with the authenticated user independently of the
  currently selected church. Do not replace or remove the existing
  `onesignal_subscriptions` behavior used by released builds.
- Prefer an account-device registry that references or resolves into the
  existing physical subscription ID. Do not copy notification history or create
  another member-scoped subscription table.
- Update notification recipient resolution to map each target
  `church_members.id` to its authenticated account devices, merge those with
  legacy member subscription rows, and deduplicate by physical OneSignal
  subscription ID before sending.
- Keep notification history and event idempotency church/member scoped. The
  same event must reach each signed-in device once, while unrelated events from
  another membership remain separate.
- Add a new sign-out cleanup RPC that removes the current physical device from
  every membership owned by the signed-in account. Logging out must stop
  notifications on that device without unregistering the user's other devices.
- Make legacy subscription deletion/reassignment deactivate the matching
  account-device registration as a downgrade bridge. This prevents a user who
  returns to an older app build from remaining registered after signing out.
- Update the existing delete-account Edge Function in the same deployment as
  the account-device table, preserving its current authenticated POST contract
  and making cleanup idempotent.
- Treat the existing OneSignal member alias as a fallback during rollout, not
  as the source of truth for multi-church delivery. Verify that changing the
  active church neither duplicates a push nor disables pushes from an inactive
  church.

App experience:

- Add a "Your Churches" section to both Profile implementations because Profile
  is available to admins and regular members. Show every church, the
  church-scoped label `Admin` or `Member`, and a clear selected state.
- Add "Join Another Church" beside the church list. Existing users enter only
  an invitation code and confirm their display name; they must not create
  another password or another auth account.
- Keep account creation for first-time users, but detect an already-registered
  email and guide the person to sign in and join instead of showing a raw Auth
  error.
- Switch churches through one context action that clears the previous
  church-scoped cache, selects the new church, loads its membership and data,
  recalculates `isAdmin`, rebuilds tabs, and refreshes Realtime channels without
  briefly exposing the previous church.
- Persist the last selected church by authenticated user ID on the device.
  Restore it only when that user still has access; otherwise select the first
  valid membership.
- Ensure the Church tab appears only while the selected membership is an admin
  and disappears when the same account switches to a church where it is only a
  member.
- Keep names, roles, unavailable dates, scheduling preferences, notification
  history, and assignments attached to the relevant `church_members` row. A
  profile edit in one church must not silently overwrite another church's
  member record.

Tests:

- Add SQL tests for first join, repeated idempotent join, invited-row claim,
  invalid code, duplicate prevention, owner membership creation, and attempts
  to self-promote to admin.
- Add RLS tests proving an admin in church A can manage A but cannot manage
  church B where the same account is only a member.
- Add context tests for discovery, persisted selection, rapid A-to-B switching,
  removed memberships, cache isolation, Realtime channel replacement, and
  per-church `isAdmin` recalculation.
- Add notification tests for two memberships and two devices. Each device
  receives one eligible event from either church, switching churches creates no
  duplicate, sign-out removes only that device, and another account on the same
  device receives only its own notifications.
- Run the new client and the currently released Android/iOS builds against the
  additive migration before enabling the new UI.

Done when:

- One email signs in once, joins multiple churches, switches safely between
  them, has the correct role in each church, receives each eligible
  notification once on every signed-in device, and released app versions still
  operate without schema or RPC errors.

### 13. Rebuild the Church Tab as a Guided Admin Hub

Goal:

- Make the Church tab immediately understandable for a first-time admin and
  efficient for an experienced admin who returns frequently.
- Replace the current mixture of configuration, schedule operations, horizontal
  sub-tabs, and many unrelated modals with two clear areas: `Church Setup` and
  `Schedule Management`.
- Preserve every existing Church and scheduling capability while improving the
  reliability of multi-part database writes.

Current finding:

- The current Church route is more than 5,000 lines and owns church selection,
  setup, members, roles, weekly services, notifications, song types,
  quarter preparation, single services, bulk deletion, auto-assignment, and
  approximately fourteen modal workflows.
- Schedule operations appear before the setup sections even though roles,
  weekly-service templates, members, and member roles are prerequisites for
  useful schedule generation and assignment.
- Four horizontal sub-tabs hide configuration and provide no indication of what
  is complete, incomplete, or recommended next.
- Member edits, recurring-service edits, and role ordering use multiple
  independent writes. A later request can fail after an earlier request has
  succeeded, leaving partially updated data.
- The current Notifications area contains long automation and troubleshooting
  explanations, including hard-coded cron timing that can become inaccurate
  when backend scheduling changes.
- Role deletion and member removal confirmations do not explain their effect on
  service templates, assignments, preferences, and related records.
- The Members area supports editing and deletion but does not provide a clear
  invitation action next to the member list.
- Large member and configuration lists are rendered inside one regular
  `ScrollView`, and many operation errors are displayed at the bottom of the
  whole screen rather than beside the failed action.

Target information architecture:

- Make the Church tab root a quiet operational Admin Hub, not a marketing page
  and not another row of horizontal tabs.
- Keep the current church name, invitation-code copy action, and add-church
  action in the header. Move Sign Out to Profile so ordinary Church management
  is not mixed with account controls.
- After item 12, use one clear current-church selector for admins with multiple
  churches. Never show or edit data from two churches in the same screen state.
- Present two full-width grouped destinations:
  `Church Setup` for persistent church configuration and
  `Schedule Management` for creating, assigning, and deleting scheduled
  services.
- Show a concise summary on every destination and editor row. Examples include
  `6 roles`, `2 weekly services`, `14 members`, `Multiple roles: Off`, and
  `Reminders: 6 and 24 hours`.
- Avoid nested cards. Use stable settings rows, section separators, clear
  status text, icons, and chevrons for navigation.

First-time setup:

- Derive setup readiness from existing church data instead of storing a new
  required completion flag. This keeps released clients and existing churches
  compatible.
- Guide a new admin through this dependency order:
  Church Details, Roles, Weekly Services, Members, Scheduling Rules, Song
  Types, and Reminder Settings.
- Open or highlight the first incomplete section and provide a clear next
  action, but never lock an experienced admin into a rigid wizard.
- Treat Church Details as ready when the church has a valid name and invitation
  code. Treat Roles and Weekly Services as core scheduling prerequisites.
  Members, rules, song types, and reminders should show useful status without
  preventing access to the rest of the app.
- Keep the established post-account-creation destination on Schedules. When a
  new church has no usable schedule configuration, show a `Finish Church Setup`
  action in the Schedules empty state. The first visit to Church opens the
  guided setup state.
- After an existing user creates an additional church, select that church and
  open its guided setup without changing the configuration of another church.

Church Setup sections:

- `Church Details`: editable church name, current church identity, copyable and
  shareable invitation code, and clear Owner/Admin status.
- `Roles`: add, rename, reorder, and delete roles. Use accurate reorder wording
  and accessible move controls. Before deletion, preview affected weekly
  services, member roles, assignments, and scheduling preferences.
- `Weekly Services`: add and edit recurring templates with name, weekday, time,
  roles, and notes. If no roles exist, direct the admin to Roles first. Explain
  that template edits affect future generated services and do not silently
  rewrite already generated schedules.
- `Members`: add a prominent `Invite Members` action that copies or shares the
  invitation code. Add search for larger churches, role summaries, and distinct
  Owner, Admin, and Member labels. Prevent owner deletion or demotion and
  explain why the action is unavailable.
- `Scheduling Rules`: contain `Allow one member in multiple roles` and future
  church-wide assignment settings. Show Saving, Saved, Error, and Retry beside
  the changed setting.
- `Song Types`: retain ordered add/remove behavior and the latest-state
  auto-save queue. Show concise save status and keep `Other` available without
  storing it as a configurable default.
- `Reminder Settings`: show only Active/Paused, selected reminder times, and
  Saving/Saved/Error status. Do not display cron schedules, polling frequency,
  long automation explanations, or troubleshooting instructions in the main
  setup flow.

Schedule Management:

- Group service creation separately from member assignment so the sequence is
  obvious.
- `Prepare Services` contains Prepare Next Quarter, Add Single Service, and
  Delete Scheduled Services.
- Keep bulk deletion beside quarter preparation. Preserve its preview/apply
  workflow, dependency counts, date-range mode, individual-selection mode, and
  atomic database behavior.
- `Assign Members` contains Fill Empty Slots and Reassign All Upcoming Slots.
  Preserve assignment range selection, full preview, skipped-slot report,
  unavailable-date handling, preferences, fairness, and confirmation behavior.
- Keep Fill Empty Slots as the visually preferred constructive action. Style
  Reassign All as a restrained secondary or tonal action using shared semantic
  theme tokens, not a brown/orange warning treatment.
- Define default, pressed, focused, loading, disabled, and error states for all
  schedule-management actions without changing their RPC payloads or behavior.
- Keep icons and text in addition to color so assignment modes remain distinct
  with Differentiate Without Color Alone.

Data reliability:

- Add behavior and contract tests around every existing Church operation before
  extracting or changing the UI.
- Add a shared `useChurchAdminSummary` model that derives setup readiness,
  counts, selected-church identity, permissions, and the recommended next
  action from existing cached data.
- Audit and reuse the deployed batch service/assignment, bulk-deletion,
  auto-assignment, song-ordering, and fill-in RPCs before adding new privileged
  functions.
- Add a new authenticated atomic RPC only where the current member update still
  performs multiple writes for allowed fields, admin status, and roles. Validate
  the target church and protect the owner from accidental demotion or removal.
- Add an atomic recurring-service RPC only if characterization tests confirm the
  template and selected roles still commit separately.
- Add an atomic role-order RPC only if the existing write path can still leave
  duplicate or partially changed display positions.
- Add an atomic notification-settings upsert RPC only if the current path still
  has a read-then-insert/update race.
- Add preview support for destructive role and member operations when the
  affected-record counts cannot be calculated safely on the client.
- Keep the existing atomic bulk-service deletion and auto-assignment RPCs
  unchanged unless a verified bug requires a separate migration.
- Every new privileged RPC must derive the signed-in user from `auth.uid()`,
  verify church-scoped admin access, validate all IDs against the target church,
  use a fixed `search_path`, and grant execution only to authenticated users.

Component architecture:

- Reduce `app/(tabs)/church.tsx` to a thin route that selects the current church
  and renders shared Admin Hub components.
- Move components and editor logic under `components/church-admin`, with
  focused boundaries for the overview, details, roles, weekly services,
  members, rules, song types, reminders, and schedule management.
- Keep route files under `app` and keep reusable components, hooks, types, and
  normalization helpers outside the route directory.
- Use one shared implementation for Android and iOS. Preserve platform-specific
  date/time-picker behavior only where the native interactions genuinely
  differ.
- Use dedicated routes or responsive full-screen sheets for long editors.
  Reserve the compact `AdminFormModal` for short forms that remain usable above
  the keyboard on small Android and iOS devices.
- Use `SectionList` or `FlatList` for member, role, weekly-service, and preview
  collections. Preserve scroll position during background refresh.
- Keep editor draft state local. Warn before discarding changed multi-field
  forms and prevent duplicate submissions while a save is running.

Caching, Realtime, and errors:

- Invalidate or update only the affected React Query keys after a successful
  write. Do not refetch the entire Church tab after every edit.
- Keep account ID and church ID in every church-scoped query key.
- Reconcile Realtime changes from another device without overwriting a newer
  local draft or briefly displaying the previous church's data.
- Show validation and server errors beside the relevant editor or action, with
  Retry where safe. Reserve a screen-level error state for failures that make
  the whole Admin Hub unusable.
- Announce save, retry, and failure status through an accessible live region
  without relying on transient system alerts for ordinary success feedback.

Backward-compatible rollout:

- All Supabase changes must be additive. Do not rename or remove existing
  tables, columns, policies, RPC signatures, function URLs, or response fields.
- Deploy new RPCs before publishing a client that calls them. Keep existing
  direct table/RLS paths operational for currently released Android and iOS
  builds.
- Do not tighten RLS in a way that blocks a released client's valid operations.
  Security corrections must preserve equivalent authorized access through an
  old path or be coordinated with a safe compatibility layer.
- Let the new client prefer atomic RPCs after deployment. Handle a missing new
  RPC as an unavailable capability rather than attempting a partially
  compatible multi-request write.
- Do not require old clients to send setup progress, new flags, or new payload
  fields. Existing defaults must retain their current meaning.
- After every migration, test the currently released Android and iOS builds
  before enabling the corresponding new editor.

Implementation packages:

1. Document current behavior and add contract, cache, permission, and
   navigation tests without changing the interface.
2. Deploy additive atomic RPCs and SQL/RLS tests, then smoke-test the released
   apps before any client depends on them.
3. Extract shared hooks, state adapters, and components while preserving the
   current layout and behavior.
4. Build the Admin Hub root, simplified header, Church Setup summaries, and
   Schedule Management summaries.
5. Add the guided first-time setup and Schedules `Finish Church Setup` empty
   action without changing successful onboarding navigation.
6. Move Church Details and Members into focused editors, including invitation,
   role/admin management, search, owner protection, and atomic saves.
7. Move Roles and Weekly Services into focused editors with dependency-aware
   empty states, atomic writes, and impact previews.
8. Move Scheduling Rules, Song Types, and concise Reminder Settings into
   focused editors with local save/error status.
9. Rebuild Schedule Management around Prepare Services and Assign Members,
   preserving quarter generation, single services, bulk deletion, previews,
   reports, and confirmations.
10. Apply the merged semantic assignment-action styling and verify all
    interaction states in the current appearance. Use semantic tokens so a
    later dark-mode package does not require another component rewrite.
11. Remove unused legacy UI state only after feature-parity, released-build,
    Realtime, accessibility, and physical-device tests pass.

Usability, accessibility, and device tests:

- Test a first-time owner, scheduling admin, and returning owner with one and
  multiple churches.
- Test incomplete setup, fully configured setup, rapid church switching,
  removed access, offline cached data, save failure, retry, and another account
  on the same device.
- Verify VoiceOver, TalkBack, Voice Control, keyboard navigation, focus return,
  expanded/collapsed state, and accessible save announcements.
- Verify 44-point iOS and 48-dp Android touch targets, sufficient contrast,
  icons plus text, Larger Text, display scaling, Reduced Motion, landscape, and
  tablet layouts.
- Test member and role lists large enough to require virtualization and search.
- Test long church, role, member, and service names without overlap or
  mid-word truncation.
- Compare auto-assignment and bulk-deletion previews before and after the
  redesign to prove that the visual reorganization did not change results.

Done when:

- A new admin can identify and complete the next useful setup task without
  horizontal-tab hunting.
- A returning admin can reach every common configuration or schedule operation
  in one obvious path.
- Every multi-part edit either succeeds completely or leaves the database
  unchanged.
- Reminder Settings remain concise and never expose cron implementation
  details.
- Android and iOS share the same behavior, all Church capabilities remain
  available, another device receives the expected Realtime updates, and
  currently released app versions continue working through the rollout.

### 14. Keep Pull-to-Refresh from Replacing the Whole Screen

Goal:

- Keep the current tab and its data visible while pull-to-refresh runs. The
  native refresh indicator should be the only loading treatment unless the
  screen is opening without usable data for the first time.

Current finding:

- The Church screen owns a local `refreshing` state and correctly passes it to
  `RefreshControl`, but its refresh handler also calls `refreshChurches()`.
- `refreshChurches()` currently calls the same `fetchChurches` path used for
  initial startup with `background = false`. That path sets the shared Church
  context `loading` flag to true.
- Church, Schedules, and Profile use that shared flag in full-screen loading
  guards. During refresh, the existing UI can therefore unmount and be replaced
  by a full-screen spinner, producing the reported flash.
- React Query service refetches already retain previous data in most cases. The
  remaining problem is the ambiguous global Church loading state and any screen
  guard that treats a background refresh like first initialization.

State model:

- Define three distinct phases: `initializing` when no usable account/church
  data exists, `refreshing` for user-requested background synchronization, and
  operation-specific loading for saves or mutations.
- Reserve the full-screen loading state for authentication initialization,
  first church discovery, or a church switch with no safe data to display.
- Make public refresh methods use background fetches that update React Query
  and context data without setting `initializing`.
- Keep each screen's existing `RefreshControl` as the visible progress
  indicator. Do not add a second overlay, modal, skeleton, or blocking spinner.

Implementation:

- Split or parameterize `refreshChurches` so pull-to-refresh calls
  `fetchChurches(accountId, 0, true)` while the provider's initial bootstrap can
  still use the blocking path.
- Audit `refreshMembers`, `refreshRecurringServices`, `refreshChurchRoles`,
  `refreshCurrentMember`, `refreshNotificationSettings`,
  `refreshFillInRequests`, and `refreshServices` to ensure refetching does not
  clear existing successful data.
- Change full-screen screen guards to depend on true initialization plus the
  absence of usable data, rather than any in-flight background request.
- Deduplicate overlapping refresh gestures and Realtime invalidations so one
  pull produces one logical refresh. Always release the local refresh indicator
  in `finally`.
- Keep previous content on partial failure, report a concise nonblocking retry
  message, and avoid converting a temporary refresh error into an empty screen.
- Preserve scroll position and mounted modal/local draft state while refreshing.

Tests:

- Add provider tests proving initial startup enters the blocking state but a
  later background refresh never does.
- Add screen tests that begin with populated data, trigger pull-to-refresh, and
  assert that the header, list, and current scroll content remain mounted.
- Cover success, one failed request inside a combined refresh, rapid repeated
  pulls, Realtime arriving during refresh, church switching, offline mode, and
  sign-out during an in-flight refresh.
- Run physical pull-to-refresh checks on Android and iOS for Schedules, Church,
  and every other screen that exposes a refresh gesture.

Compatibility:

- This is a client state-management change. It requires no Supabase migration
  and must not change query keys, RPCs, RLS, persisted data, or released-client
  behavior.

Done when:

- Pulling to refresh keeps the current screen fully visible, shows only the
  native refresh indicator, preserves successful data on failure, and initial
  app loading still prevents stale account or church content from flashing.

### 15. Make Profile and Church Header Names Deterministic

Goal:

- Keep a person's name prominent on Profile and keep church names consistently
  sized on every header. Short names must never become unexpectedly tiny
  because of device width, transient layout measurements, trailing icons, or
  platform-specific text fitting.

Current finding:

- `ResponsiveTabHeader` first selects a base size from the measured title-lane
  width and then also enables native `adjustsFontSizeToFit` with
  `minimumFontScale`.
- That creates two independent sizing systems. Android and iOS may apply the
  native second shrink differently, especially with two lines, display
  scaling, font scaling, or a trailing bell/edit/profile control.
- The component stores `onLayout` width in state. A temporary narrow first
  measurement can produce a visibly smaller render before the final layout,
  and short text can still be shrunk even though it would fit at the intended
  size.
- The same shared behavior controls Profile's member name, the Schedules church
  title, the Church title, and Profile's church subtitle. This package replaces
  the unstable auto-shrink behavior rather than adding more screen-specific
  font overrides.

Typography contract:

- Create explicit shared variants for `primaryTitle`, `profileName`, and
  `secondaryChurchName`. Each variant gets one preferred size, one readable
  floor, a stable line height, and a maximum of two lines.
- Remove `adjustsFontSizeToFit` from multi-line header names. Use one
  deterministic layout system instead of combining JavaScript size tiers with
  native auto-fit.
- Keep short Profile names and short church names at their preferred size. Only
  reduce a title after the final available width proves that the complete
  allowed two-line layout cannot fit.
- Reserve a known, stable width for trailing controls. On very narrow layouts,
  move or stack optional metadata rather than squeezing the title lane to an
  unreadable width.
- Use `useWindowDimensions` or the final container layout for responsive
  breakpoints and recalculate on rotation, split-screen resizing, or display
  changes without preserving stale width from the previous layout.
- Continue supporting system font scaling with a deliberate
  `maxFontSizeMultiplier` and tested Larger Text layout. Do not disable
  accessibility scaling globally to protect the visual design.

Implementation:

- Extract the name rendering into a shared `AdaptiveHeaderText` component used
  by Schedules, Church, and both Profile implementations.
- Normalize leading, trailing, and repeated whitespace before measuring while
  preserving the original value for storage and accessibility.
- Make size selection a pure function of typography variant and stable
  available width. Unit-test that function at named device widths and font
  scales.
- Avoid state loops between `onLayout`, text measurement, and font-size
  changes. Commit a new size only when the final layout inputs change.
- Keep the member name as Profile's primary title and the church name as its
  secondary title. Never reduce the member name merely because the church name
  or metadata is long.
- Add development-only layout diagnostics that can log variant, available
  width, selected size, font scale, and line count when reproducing a device
  issue, without exposing those details in production UI.

Tests:

- Add unit tests for short, medium, and long member/church names across small
  Android, current iPhone, large phone, tablet, landscape, and split-screen
  widths.
- Add component tests for zero/one/two trailing controls, notification badges,
  dynamic unread counts, orientation changes, font-loading completion, and
  church switching.
- Capture Android and iOS screenshots at default text size and Larger Text. A
  short name must remain at the preferred visual size and must not change after
  the first stable render.
- Verify VoiceOver and TalkBack announce the original full name once even when
  the visual renderer uses multiple internal text elements.

Compatibility:

- This is a shared client UI change with no database impact. Existing header
  props should remain supported while screens migrate to explicit typography
  variants.

Done when:

- The same short member or church name renders at a consistent, prominent size
  on every supported device, long names remain readable, rotation and trailing
  controls do not trigger surprise shrinking, and accessibility text scaling
  remains usable.

### 16. Wrap Church Names Only at Word Boundaries

Goal:

- Allow church names to occupy up to two header lines while preventing a normal
  word from being split between lines.

Current finding:

- The shared title currently relies on the native multi-line `Text` wrapping
  chosen by each platform. Native auto-fit and constrained title-lane width can
  still produce mid-word breaks.
- Church names are displayed in Schedules, Church, Profile, church selection,
  and the future multi-church switcher. The wrapping rule must be shared rather
  than fixed separately in each screen.

Word-safe layout:

- Normalize whitespace and treat complete words as the primary layout units.
  Prefer a line break at an existing space and preserve the original readable
  name for accessibility, selection, and copying.
- Use platform line-breaking controls where they are reliable, including no
  automatic hyphenation. Back them with a shared word-aware renderer so Android
  and iOS do not depend on different native fallback behavior.
- Fit normal multi-word names into at most two lines using the deterministic
  typography contract from item 15.
- Handle one genuinely overlong unbroken token separately: reduce only as far
  as the readable floor needed to fit the lane, then use a final-line ellipsis
  if it still cannot fit. Never split that token arbitrarily through its middle.
- Keep line height and header height stable so wrapping does not overlap the
  eyebrow, subtitle, metadata, bell, edit button, or content below the header.

Implementation:

- Add a reusable `WordSafeHeaderText` layer to `AdaptiveHeaderText`, with the
  original string exposed as one accessibility label.
- Reuse it for primary church titles, Profile's church subtitle, church
  selection rows, and the planned cross-church selector wherever two-line
  display is allowed.
- Keep compact pills and metadata single-line with deliberate truncation; do
  not force a two-line title policy into controls that cannot grow vertically.
- Add fixtures containing two-word names, many short words, punctuation,
  accented characters, apostrophes, hyphenated names, repeated whitespace,
  emoji, and one very long unbroken token.

Tests:

- Assert line output at narrow and wide widths so every normal word remains
  intact and lines break only between tokens.
- Compare Android and iOS screenshots for the same fixtures at default and
  Larger Text sizes.
- Test accessibility reading, selection/copy output, right-to-left layout, and
  names updated live from another device.
- Verify every header still leaves predictable space for the notification bell
  and other trailing actions.

Compatibility:

- This is a client rendering change. It must not modify church names stored in
  Supabase, alter name validation, or write normalized display strings back to
  the database.

Done when:

- Church names use one or two readable lines, ordinary words never break in the
  middle, pathological single tokens fail gracefully, copied/announced names
  remain exact, and the behavior is consistent on Android and iOS.

### 17. Build a Shared, Professional Profile Foundation

Goal:

- Replace the long, flat Profile page with a quiet settings-style experience
  that is easy to scan, keeps the member identity prominent, and gives each
  workflow an obvious destination.

Current finding:

- Android/default and iOS Profile files duplicate nearly the entire screen and
  differ only in logging metadata and one calendar icon. Maintaining two full
  copies makes visual and behavioral drift likely.
- Identity, a full calendar, every scheduling-preference switch, sign-out, and
  permanent deletion currently share one continuous `ScrollView` with similar
  visual weight.
- The screen uses static and hard-coded colors, legacy shadow/elevation styles,
  and local modal/toast implementations rather than one semantic,
  accessibility-aware component set.
- This package depends on item 14 for nonblocking refresh and items 15 and 16 for
  stable name sizing and word-safe church-name wrapping.

Information architecture:

- Keep one branded Profile header containing the member name, current church,
  church-scoped Admin/Member status, and a monogram or profile icon.
- Present full-width grouped sections in this order: Church and Roles,
  My Scheduling, Notifications, Account, and Danger Zone.
- Use concise settings rows with icon, title, current-value summary, and chevron
  for workflows that open a dedicated editor. Avoid nesting cards and avoid
  placing a large editor directly on the overview.
- Keep important status visible without requiring entry into another screen:
  current church, assigned roles, blocked-date count, scheduling-preference
  count, and notification permission.

Implementation:

- Move shared behavior into a single `ProfileScreen` implementation under
  `components/profile`; retain thin Expo Router route wrappers only if platform
  resolution still requires them.
- Add reusable `ProfileSection`, `ProfileRow`, `ProfileStatus`, and
  `ProfileDangerRow` primitives with stable touch targets, separators, and
  semantic theme tokens.
- Use a `SectionList` or equivalent virtualized grouped layout with safe-area
  and floating-tab-bar padding. Preserve scroll position during background
  refresh.
- Keep editors as routes or full-screen sheets so their drafts, loading states,
  and errors do not cause the Profile overview to rerender or jump.
- Replace ad hoc toasts with one accessible status mechanism that announces
  success/error through `accessibilityLiveRegion` and does not cover the bottom
  navigation.
- Provide explicit initial, stale-data, refreshing, partial-error, no-membership,
  and offline states. Never show another church's cached profile while
  switching.

Accessibility and design:

- Give every row a button role, concise label, useful hint, and state/value.
  Ensure VoiceOver, TalkBack, Voice Control, and keyboard focus order follow the
  visual section order.
- Use icons and text in addition to color. Reserve red for permanent or truly
  destructive actions.
- Use semantic color tokens with the current light appearance and verify
  sufficient contrast, Larger Text, display scaling, Reduced Motion, and
  Differentiate Without Color Alone. Full dark-mode behavior remains deferred.
- Keep rows at least 44 points high on iOS and 48 density-independent pixels on
  Android, with stable icon and trailing-control dimensions.

Compatibility:

- This package is client-only. It must reuse existing context/query contracts
  and must not rename routes, tables, columns, or RPCs.
- Land the shared shell first with feature parity. Move one Profile section at a
  time and keep a rollback path until both Android and iOS parity tests pass.

Tests:

- Add shared component tests for every row state and Profile integration tests
  for member, owner, scheduling admin, no-role, no-church, loading, offline, and
  error cases.
- Capture current-appearance screenshots on small Android, current iPhone,
  large phone, tablet, landscape, and Larger Text configurations.
- Compare navigation, focus, bottom padding, and scroll restoration on Android
  and iOS before removing duplicated screen code.

Done when:

- Profile reads as one clear overview, every major task is reachable in one
  obvious action, Android and iOS use the same behavior, and no existing
  Profile capability has been lost.

### 18. Add Church-Scoped Identity, Roles, and Profile Editing

Goal:

- Show who the person is in the currently selected church and make church
  switching, role visibility, and safe display-name editing understandable.

Dependencies:

- Complete item 12 first. Profile must use the final multi-church membership,
  account-scoped push registration, and church-switching transaction.
- Complete items 15 and 16 so member and church names remain stable and wrap
  correctly before the redesigned header ships.

Overview behavior:

- Show current church, Owner/Admin/Member status, assigned ministry roles, and
  verified account email without mixing global account data with
  church-membership data.
- Add `Your Churches` as the first section for accounts with multiple
  memberships. Show each church's role and selected state, plus `Join Another
  Church`.
- For a single membership, show a compact current-church row rather than an
  unnecessary selector, while keeping Join available.
- Use the atomic switch action from item 12. Disable repeated taps while
  switching and keep the previous church visible until the target membership
  has been validated, then replace all church-scoped data together.

Display-name editing:

- Treat the visible member name as church-scoped because each
  `church_members` row can represent the person differently in different
  churches. Keep the Supabase Auth email global and read-only in this package.
- Add a dedicated authenticated `update_own_church_profile` RPC that accepts the
  target church and display name, derives the member from `auth.uid()`, and can
  update only that membership's allowed profile fields.
- Validate trimmed name length and reject empty or control-character values.
  Do not let the RPC edit email, member ID, church ID, admin status, or roles.
- Keep the existing admin `updateMember` behavior and signatures unchanged.
  Deploy the additive RPC before exposing the Edit Profile action.
- Optimistically update only the matching church/member cache, roll back on
  failure, and let Realtime refresh another device without overwriting a newer
  local draft.

Compatibility and security:

- Add no global user role. Owner/Admin/Member and assigned roles remain scoped
  to the selected church.
- Keep existing `church_members` rows and policies. The new RPC supplements
  rather than replaces released-client update paths.
- Test RLS and RPC behavior with the same account as admin in church A and
  member in church B. Editing B must not grant B admin access or modify A's
  display name.

Tests:

- Cover one church, many churches, duplicate join, removed membership, owner
  membership, per-church roles, rapid switching, app restart, offline switch,
  and another account on the same device.
- Verify that church switching also changes unavailability, scheduling
  preferences, notification history, tab visibility, and push targeting to the
  correct membership.
- Run released Android/iOS builds against the additive RPC migration before
  publishing the new Profile section.

Done when:

- Profile always identifies the selected church and exact role, users can edit
  only their own church-scoped display name, and switching churches cannot leak
  data, permissions, or notifications.

### 19. Replace the Inline Calendar with an Availability Summary and Editor

Goal:

- Keep unavailable dates easy to understand and edit without letting a full
  calendar dominate Profile.

Overview:

- Replace the inline calendar with one `Unavailable Dates` row showing the
  total future blocked dates and the next two or three dates.
- Use a clear empty value such as `No unavailable dates` and a distinct unsaved
  or sync-error status when needed.
- Open a dedicated full-screen calendar editor from the row. The editor can use
  the available height, keep month navigation stable, and provide a persistent
  Cancel/Save footer above the device safe area.

Date correctness:

- Replace `toISOString().split('T')[0]` for local calendar boundaries with the
  project's local `YYYY-MM-DD` formatter so today does not change early or late
  because of UTC conversion.
- Keep dates as date-only database values. Never create a timezone-bearing
  timestamp for an unavailable day.
- Define the editable range from the scheduling horizon rather than an
  unexplained fixed one-year limit, while retaining old saved dates outside the
  visible range without deleting them.

Draft and save behavior:

- Load server dates into a draft set on editor entry. Tapping dates changes only
  the draft until Save.
- Always show selected count and unsaved status, including the important case
  where the draft contains zero dates after removing every saved date.
- Warn before discarding a changed draft through Back, swipe dismissal, or
  church switching.
- Keep the existing `member_unavailability` table and
  `saveUnavailableDates(memberId, dates)` behavior. Save once, verify the
  result, update the relevant React Query cache, and retain the draft with Retry
  after failure.
- Put loading cleanup in `finally`, cancel stale requests when switching
  memberships, and prevent a late response from church A replacing church B's
  availability.

Accessibility and tests:

- Give each date a selected/unselected label and explain that blocked dates are
  hard scheduling exclusions. Do not communicate selection through red alone.
- Test local date boundaries around midnight, daylight-saving transitions,
  Chihuahua timezone behavior, leap day, month/year navigation, zero-date save,
  rapid taps, offline save, and simultaneous edits on two devices.
- Verify auto-assignment still treats saved dates as hard blocks and released
  clients can read/write the unchanged table.

Compatibility:

- No schema migration is expected. If a helper RPC is added for atomic batch
  replacement, keep the current direct table/RLS path valid for released
  clients and deploy the RPC before the new editor.

Done when:

- Profile shows a concise availability summary, the editor never shifts dates
  through UTC conversion, drafts cannot be lost silently, and auto-assignment
  sees exactly the saved date set.

### 20. Move Scheduling Preferences into a Focused Editor

Goal:

- Keep Profile compact while preserving the current role/service-specific
  preferences and their effect on auto-assignment.

Overview:

- Replace the expanded list with a `Scheduling Preferences` row showing the
  number enabled and a summary such as `2 weekly-service preferences`.
- Show a useful empty value when no roles are assigned or assigned roles are
  not used by a weekly service.
- Open a dedicated editor grouped by assigned role, with weekly services as
  rows and the existing `Prefer not to be scheduled` switches.

Implementation:

- Reuse `useSchedulingPreferences`,
  `member_scheduling_preferences`, existing RLS, Realtime, and the deployed
  auto-assignment integration. Do not introduce a second preference model.
- Extract the current group-building and row behavior from
  `SchedulingPreferencesCard` into shared overview-summary and editor
  components.
- Keep optimistic auto-save, per-row progress, rollback, Retry, and the
  explanation that unavailability is a hard block while this is a soft
  preference.
- Add visible Saved/Error status that is announced accessibly. Disable only the
  row being saved rather than blocking the whole editor.
- Remove stale preferences through the existing database cleanup when an admin
  removes a role or recurring service. Never apply these preferences to
  one-time services without a safe recurring-source identity.

Compatibility and tests:

- No migration should be needed. Keep current RPC payloads and auto-assignment
  response shapes unchanged.
- Compare auto-assignment previews before and after editor changes with hard
  unavailability, all candidates avoiding a service, role removal, recurring
  service deletion, and uneven role history.
- Test two devices, offline rollback, rapid toggle reversal, Realtime
  reconciliation, church switching, empty states, and released-build
  compatibility.

Done when:

- The overview remains concise, every valid preference is editable in one
  focused screen, saves are reliable and visible, and scheduling behavior is
  identical to the existing deployed preference semantics.

### 21. Replace Generic Notification Categories with Real Member Settings

Goal:

- Give members an honest view of push permission and, where supported by the
  backend, control over Music Ministry notification categories.

Current finding:

- `notification-preferences.tsx` defines generic App Updates, Promotions, and
  Reminders toggles in local state and OneSignal tags.
- Production notifications target saved OneSignal subscription IDs directly.
  The current Edge Functions do not use those generic tags, so exposing those
  switches from Profile would imply controls that do not actually govern
  delivery.

Phase A: device permission:

- Add a Profile `Notifications` row showing Enabled, Disabled, or Permission
  Required for the current device.
- When permission is disabled, open the native app settings or request
  permission through the existing OneSignal flow. Do not imply that an in-app
  toggle can override an operating-system denial.
- Keep notification history in the bell; Profile settings control delivery,
  not whether existing history is visible.

Phase B: real category preferences:

- Add an RLS-protected, church-member-scoped notification preference table or
  equivalent additive structure keyed by membership and supported category.
- Use the existing production event types as the source of truth:
  `service_reminder`, `fill_in_request`, `fill_in_accepted`, and
  `service_comment`.
- Define absence of a preference row as enabled. This is essential: released
  clients and members who never visit the new screen must continue receiving
  the same notifications they receive today.
- Add authenticated read/update RPCs that derive membership ownership from
  `auth.uid()`. Clients must not choose another member's ID or alter church
  notification timing.
- Deploy the additive migration and RPCs first. Then update each Edge Function
  to filter explicit opt-outs before building OneSignal targets, while retaining
  current event deduplication and history behavior.
- Preserve the existing requirement that church admins receive operational
  fill-in oversight. If that category is mandatory for admins, show it as
  `Required for admins` instead of presenting a switch that cannot be honored.
- Remove the generic Promotions/App Updates UI only when the real settings are
  ready. Keep the route compatible or redirect it to the new implementation so
  no stale link opens a misleading screen.

Multi-church and multi-device behavior:

- Store delivery preferences per `church_members` row, not globally by email.
  A user can choose different preferences in different churches.
- Apply one preference decision to every device signed into that membership,
  while operating-system permission remains device-specific.
- Integrate with item 12's account-device registration and deduplicate the same
  physical subscription before sending.

Tests and rollout:

- Add SQL/RLS tests for own membership, cross-member rejection, per-church
  isolation, default-enabled absence, valid categories, and admin-required
  behavior.
- Add Edge Function tests proving each explicit opt-out suppresses only its own
  category, no row preserves current delivery, history is not falsely written
  for suppressed delivery, and duplicate-device protection remains intact.
- Test two churches, two devices, sign-out/account switching, denied OS
  permission, permission restored in Settings, and an older app build after the
  migration/function deployment.

Compatibility:

- Do not repurpose existing OneSignal tags as the only preference source.
- Do not remove or change existing subscription columns, notification event
  names, Edge Function URLs, cron settings, or public RPC signatures.
- Keep the feature hidden until migration, RLS, RPC, and all four sending
  functions are deployed and verified.

Done when:

- Profile reports real device permission, every displayed category accurately
  controls its corresponding backend delivery, missing preferences preserve
  legacy behavior, and older builds continue receiving notifications normally.

### 22. Rework Account Actions and the Danger Zone

Goal:

- Make ordinary account actions easy to find while isolating permanent deletion
  so it cannot be confused with signing out.

Account section:

- Show the verified Supabase Auth email as read-only account identity. Keep
  church-specific display-name editing in item 18.
- Add `Change Password` using an authenticated flow. Reauthenticate with the
  current password when required, validate the new password, update through
  Supabase Auth, and preserve the active session only after confirmed success.
- Keep the existing email recovery link as the fallback when the current
  password is unknown. Reuse the repaired deep-link/reset-password flow rather
  than creating a second recovery implementation.
- Show app version and native build number for support diagnostics.
- Present Sign Out as a neutral settings row with confirmation, progress, and
  retry. Red is not appropriate because signing out does not delete data.

Danger Zone:

- Place Delete Account in its own final section with red icon/text and a clear
  explanation that deletion affects every church membership and every church
  the account owns.
- Before exposing the redesigned action, audit the current `delete-account`
  Edge Function against item 12's multi-church membership/device tables and
  item 21's notification preferences.
- Decide and communicate owner behavior explicitly. The current function
  deletes churches owned by the account and their schedules, members, and
  related data; the confirmation must state that impact and show the affected
  church names/count before proceeding.
- Require a deliberate final confirmation such as entering `DELETE` and recent
  authentication. Do not close the confirmation before the request has safely
  started, and keep Retry available after a nonterminal failure.
- On success, clear all local query caches, stored church selection, drafts,
  Realtime channels, and only the current device's OneSignal identity before
  navigating to onboarding.

Backend and compatibility:

- Keep the existing `delete-account` URL and authenticated POST contract for
  released clients.
- Any new preview response or cleanup support must be additive. Do not require
  old clients to send new fields.
- Confirm that cleanup for account-device and preference tables shipped with
  the packages that introduced them. Package 22 may extend or preview that
  behavior, but must not be the first place those rows become deletable.
- Preserve non-owned churches and other members' data when a regular membership
  is deleted. Preserve the current complete cleanup semantics for owned
  churches unless a separate ownership-transfer feature is designed and tested.

Tests:

- Cover member-only account, scheduling admin, one owned church, multiple owned
  churches, mixed owner/member roles, two devices, in-flight notifications,
  partial cleanup failure, repeated request, expired session, and offline mode.
- Verify password change with valid/invalid current password, recovery fallback,
  session refresh, password-manager autofill, keyboard navigation, and screen
  reader announcements.
- Confirm sign-out leaves server data untouched and prevents pushes on that
  device, while account deletion removes Auth and intended database records and
  lands on onboarding without a loading loop.
- Test the current released Android/iOS build against every additive backend
  change before publishing the redesigned controls.

Done when:

- Account identity, password, version, and sign-out are easy to understand;
  deletion is clearly isolated and accurately described; multi-church cleanup
  is complete; and released clients remain functional throughout rollout.

### 23. Rebuild Onboarding and Authenticated Startup Safely

Goal:

- Make first account creation, joining a church, returning sign-in, email
  confirmation, session restoration, and first navigation deterministic.
- Prevent partial church/member setup, duplicate submissions, incorrect admin
  state, missing tabs, and indefinite loading screens.
- Preserve the behavior and database contracts required by every released app
  version throughout the migration.

Current finding:

- Welcome presents separate Admin and Member login actions even though both call
  the same Supabase password login. This conflicts with item 12's church-scoped
  permissions, where one account may be an admin in one church and a member in
  another.
- Admin signup creates the Auth user, church, and owner membership in separate
  requests. Member signup validates an invitation, creates an Auth user, and
  inserts membership separately. A failure between requests can leave partial
  setup that the user cannot resume cleanly.
- Signup continues into authenticated database writes when Supabase returns a
  user without a session because email confirmation is required.
- Post-signup navigation polls briefly for membership and can enter Schedules
  before Auth and ChurchContext have a confirmed current membership. Ordinary
  login also routes to tabs before church bootstrap is complete.
- Fixed loading timeouts can re-enable a still-running submit action or treat a
  slow session restore as signed out.
- Schedules automatically opens the native notification permission prompt as
  soon as member data loads, without first explaining the benefit or preserving
  a clear per-device `Not Now` choice.
- The current self-join RLS policy does not validate invitation codes. It must
  remain temporarily for released clients that insert membership directly, so
  the secure replacement requires a staged rollout rather than an immediate
  policy removal.

Phase 0: freeze and characterize current behavior:

- Add regression tests around the existing onboarding and startup behavior
  before restructuring it. Cover create-admin, create-member, both login paths,
  password recovery entry, session restore, current-church selection, and first
  notification prompt.
- Record the exact Supabase calls made by the currently released Android and
  iOS builds. Treat those tables, columns, policies, and response shapes as
  compatibility contracts during the rollout.
- Create fixtures for a new account, existing account with no membership,
  existing account with one or multiple memberships, invited unclaimed member,
  invalid invitation, removed membership, and slow/offline startup.

Phase 1: deploy only the additive backend foundation from item 12:

- Implement `create_church_with_owner_membership` as an authenticated,
  transactional, idempotent RPC. It must derive the owner from `auth.uid()`,
  create the church and owner membership together, generate a collision-safe
  invitation code in the database, and return both records.
- Implement `join_church_by_invitation` as an authenticated, transactional,
  idempotent RPC. It must validate the invitation code, return an existing
  membership when already joined, claim an eligible invited-email row, and
  prevent callers from granting themselves admin access.
- Add only new functions, indexes, helper objects, and grants. Do not rename,
  remove, or make newly required any existing table, column, policy, trigger,
  RPC argument, Edge Function contract, or response field.
- Keep the current direct church/member insert permissions available to old
  clients during this phase even though the new client will stop using them.
- Test the migration with SQL/RLS coverage, then smoke-test the currently
  released Android and iOS builds against the deployed schema before changing
  onboarding code.

Phase 2: create one authenticated startup coordinator:

- Replace timing-based routing with explicit states: `restoring_session`,
  `signed_out`, `loading_memberships`, `selecting_church`, `ready`,
  `recoverable_error`, and `no_membership`.
- Restore the last church only when it still belongs to the authenticated
  account. Otherwise select the first valid membership without exposing cached
  data or admin state from another church.
- Do not render protected tabs until session, church membership, current member,
  and church-scoped permissions agree. Build tab visibility from the selected
  membership rather than the button used to sign in.
- Remove arbitrary Auth initialization and onboarding submission timeouts that
  reinterpret an unknown state as signed out or permit a duplicate request.
  Provide explicit progress, cancellation where safe, retry after a known
  failure, and idempotent request handling.
- Add a recovery screen for a signed-in account with no valid membership:
  `Join a Church`, `Create a Church`, `Retry`, and `Sign Out`.
- Keep the existing root routes, password-reset deep links, callback contract,
  and password-manager behavior valid.

Phase 3: simplify the first-screen experience:

- Replace the four role-oriented actions with `Sign In`, `Join a Church`, and
  `Create a Church`. Login authenticates the account only; the selected
  membership decides whether the person is an owner, scheduling admin, or
  member.
- Keep all existing onboarding route names reachable during the release
  transition so a stale link or restored navigation state does not fail.
- Add concise progress for multi-step flows, visible field labels, required
  indicators, inline validation, first-invalid-field focus, password visibility,
  platform password-manager metadata, and friendly mapped Auth/database errors.
- Normalize email input safely and make the person's display name required for
  every new account. Preserve a valid pending draft through email verification
  without storing a password.
- Add Privacy Policy, Terms, and Support links using the production website.

Phase 4: make create and join flows resumable:

- For `Create a Church`, create the Auth account first. When a session exists,
  call the new atomic owner RPC and bootstrap its returned membership before
  navigating.
- When signup requires email confirmation and returns no session, stop all
  authenticated database work and show a dedicated verification screen with
  `Resend Email`, `Change Email`, and `I Have Confirmed`. Resume the saved
  non-secret intent after a confirmed session.
- For `Join a Church`, validate the invitation first and show only the church
  name needed for confirmation. Let a new user create an account or an existing
  user sign in, then call the authenticated join RPC.
- If the email already exists, guide the person to sign in and continue joining
  rather than showing a raw duplicate-account error.
- Make retries safe after network loss, app restart, repeated taps, an already
  completed RPC, or an account that exists without membership.

Phase 5: ask for notifications contextually:

- Wait until the first Schedule is visibly ready and the OneSignal identity is
  linked to the authenticated account/membership before presenting notification
  onboarding.
- Show an in-app explanation for service reminders and fill-in requests with
  `Enable Notifications` and `Not Now`. Open the operating-system prompt only
  after the explicit Enable action.
- Store explanation/prompt state per physical device, not globally by email or
  church. Do not repeatedly prompt after denial; provide `Open Settings` from
  the bell or Profile instead.
- Preserve existing notification registration and legacy subscription records.
  Coordinate with item 12 so church switching, two devices, logout, and another
  account on the same device never create duplicate or cross-account pushes.

Phase 6: accessibility, privacy, and visual verification:

- Give every field a persistent label and every button/input an appropriate
  accessibility role, label, state, hint, and minimum touch target. Announce
  validation, progress, verification, success, and recoverable errors.
- Support keyboard navigation, VoiceOver/TalkBack, Voice Control, Larger Text,
  display scaling, the current appearance, reduced motion, autofill, paste, and
  Android back behavior. Use semantic tokens without implementing full dark
  mode in this package.
- Keep invitation codes readable without forced letter spacing, allow church
  names to wrap only at word boundaries, and keep actions reachable on small
  screens without overlapping the keyboard.
- Remove or development-gate logs containing emails, invitation codes, user
  IDs, membership IDs, or OneSignal subscription IDs.
- Review native session storage separately and move to reliable encrypted
  storage only if it can be introduced without invalidating existing sessions;
  otherwise schedule it as a versioned migration with a tested fallback.

Compatibility rollout and security boundary:

- Ship in this order: baseline tests, additive backend migration, released-build
  smoke test, new startup coordinator, new create/join client, notification
  explanation, then accessibility polish.
- New clients use only the secure atomic RPCs, but old clients retain their
  direct insert path and continue working unchanged during the support window.
- Do not tighten or remove the legacy self-join RLS policy while a supported
  released version depends on it. Track app-version adoption and define a
  minimum-supported-version gate before closing that path.
- Once legacy clients are retired, remove direct anonymous/authenticated
  invitation lookup and self-join access in a separate reviewed migration.
  Keep the authenticated idempotent RPCs as the only supported create/join
  interface.
- Every phase requires a rollback plan that disables only the new client path;
  rollback must not require reversing a live additive migration or deleting
  user-created churches/memberships.

Tests:

- Unit-test validation, Auth error mapping, state transitions, draft recovery,
  invitation handling, and notification-explainer persistence.
- Integration-test email confirmation on/off, existing-email join, repeated
  submit, interrupted RPC, app restart, expired session, offline/slow startup,
  removed membership, and no-membership recovery.
- Test owner, admin, and member access in one and multiple churches, including
  switching, cached state, Realtime replacement, sign-out, and another account
  on the same device.
- Test one account on two Android/iOS devices. Each receives one eligible push;
  notification permission and `Not Now` remain device-specific; logout removes
  only the current device.
- Run physical-device checks on small and large Android phones, current and
  older supported iPhones, tablet, landscape, Larger Text, display scaling,
  TalkBack, VoiceOver, password managers, and poor network conditions.
- After every backend phase, run the currently released Android and iOS builds
  through signup, login, member join, church creation, scheduling, and
  notifications before continuing.

Done when:

- Every onboarding path either reaches a fully initialized selected membership
  or a clear recoverable state; no path relies on a blind timeout or partial
  multi-request setup; email confirmation can resume safely; notification
  permission is understandable and device-specific; multi-church roles are
  correct; and the currently released app versions continue to work throughout
  the compatibility window.

#### Package 23: Semantic Theme Foundation and Header Contract

Status:

- Implemented locally on 2026-08-11. The active app remains deliberately light;
  future-dark tokens are defined and contrast-tested but are not selectable or
  activated automatically.
- Client-only. No Supabase migration, Edge Function, Auth contract,
  notification behavior, route, permission, scheduling behavior, or persisted
  setting changed. Released app versions continue using their existing bundled
  code and backend contracts.
- The legacy `colors` export remains as a compatibility bridge for unmigrated
  screens and is backed by the new semantic source. It will be retired only
  after Packages 24-28 migrate all remaining consumers.

Goal:

- Replace the current white-on-white visual foundation with one semantic theme
  API that can support the approved light redesign now and a complete dark-mode
  implementation later.
- Preserve the branded header direction from the earlier three-screen preview:
  deep navy flowing into restrained royal blue, responsive white titles, the
  subtle geometric accent, and the thin blue lower accent line. Do not adopt
  the later Schedule-only preview's flatter dark header.

Checkpoint 23A: inventory the current visual contract:

- Record screenshots and token usage for Schedule, Church, Profile, onboarding,
  recovery screens, focused editors, modals, notification history, assignment
  previews, and both two-tab and three-tab navigation.
- Record the current login/onboarding mark, app icon, splash mark, Profile
  identity icon, modal headers, service date/details treatment, and app-version
  presentation so the redesign uses one intentional brand source instead of
  accumulating near-duplicate artwork and styles.
- Find hard-coded light colors, opacity-derived colors, shadows, borders, and
  direct imports of the static `colors` object. Classify each use by semantic
  purpose instead of performing a mechanical hex replacement.
- Add characterization tests for the current `ResponsiveTabHeader`, safe-area
  behavior, word-safe titles, status contrast, modal dimensions, and floating
  tab clearance before changing shared primitives.

Checkpoint 23B: introduce one semantic theme API:

- Add a typed `useAppTheme()` source with light and future-dark token groups for
  `canvas`, `surface`, `surfaceMuted`, `surfaceElevated`, `surfaceStrong`,
  `textPrimary`, `textSecondary`, `textTertiary`, `borderSubtle`,
  `borderStrong`, `accent`, `accentSoft`, `navigationSurface`,
  `navigationSelected`, `navigationInactive`, and success/warning/error/info
  status surfaces and foregrounds.
- Include explicit foreground-on-strong-surface, service-metadata, modal-header,
  input-highlight, and brand-mark tokens. This keeps the requested dark navy
  schedule details, richer focused-screen headers, and login logo readable in
  both the approved light palette and the future dark palette.
- Include semantic spacing, corner-radius, divider, elevation, icon-tile, and
  pressed/focus-state values where they prevent components from inventing new
  one-off treatments.
- Keep compatibility exports while components migrate. Do not replace every
  style in one commit or leave two authoritative theme systems indefinitely;
  document the retirement condition for the compatibility bridge.
- Define the future dark token values and contrast-test them, but do not expose
  a dark-mode setting or automatically switch the app in this package.

Checkpoint 23C: lock the header direction:

- Move the approved gradient stops, accent panel, accent line, icon surfaces,
  metadata pills, and header shadows into semantic header tokens consumed by
  `ResponsiveTabHeader`.
- Preserve all existing title sizing, word-safe wrapping, reserved action
  lanes, invitation-code behavior, notification badge behavior, Profile member
  identity, and accessibility strings.
- Fix the Church header's selected-church identity contract while migrating the
  shared header. The visible title must come from the same ready membership
  snapshot as the Church content, update immediately after church switching or
  name editing, and never retain the previous church name or show a partial
  fallback after the selected membership is ready.
- Add short, long, multiword, single-word, renamed, rapidly switched, cached,
  Realtime-updated, and Larger Text Church title fixtures. Preserve word-safe
  wrapping and the add-church/invitation-code action lanes at every width.
- Keep the header visually prominent without allowing its blue treatment to
  dominate every surface below it.

Compatibility and verification:

- Run TypeScript, full lint, all existing tests, Android/iOS production exports,
  and `git diff --check` after each checkpoint.
- Add token-completeness and contrast tests so a future theme cannot omit a
  required semantic role or make text/statuses unreadable.
- Package 23 is complete when shared primitives can consume light or dark token
  objects without changing business behavior and the approved header remains
  visually unchanged on all supported sizes.

Completed verification:

- Added typed light and future-dark themes, an active light-only provider,
  React Navigation token derivation, and semantic header tokens without adding
  stored theme state.
- Preserved header geometry, safe-area handling, word-safe title behavior, and
  action lanes while moving its palette and elevation to semantic tokens.
- Synchronized selected Church records across context state, refs, list/detail
  caches, discovery cache, rename responses, refreshes, and Realtime-driven
  refetches. The header now accepts only the ready account-matched membership.
- Passed TypeScript, all six Edge Function checks, ESLint, 373 tests, token
  completeness/contrast checks, `git diff --check`, and iOS/Android production
  exports on 2026-08-11.

#### Package 24: Futuristic Floating Navigation Dock

Status:

- Implemented locally on 2026-08-11. Client-only and isolated from tab
  authorization, route behavior, and persisted state.
- No Supabase migration, Edge Function, Auth contract, notification behavior,
  scheduling behavior, or released-client contract changed. Older installed
  versions continue using their existing bundled navigation implementation.

Goal:

- Replace the current square, gray, heavy floating bar with a lighter futuristic
  dock that feels modern without becoming decorative, distracting, or difficult
  to read.

Visual contract:

- Use a 60-64px floating shell with approximately 20-22px corners, a thin cool
  border, a soft short shadow, and clear separation from page content.
- Use a translucent white/cool surface with controlled blur on iOS and a tested
  opaque fallback on Android so the dock never becomes muddy gray.
- Give the selected tab a pale-blue moving capsule, crisp navy icon and label,
  and one restrained futuristic accent such as a thin luminous blue edge or
  short underglow. Do not use a large dark rectangle, glowing orb, rainbow
  gradient, or color-only selected state.
- Keep inactive icons and labels in readable slate. Keep labels visible for all
  tabs rather than switching to icon-only navigation.
- Let the active capsule move with a short spring and provide an immediate
  Reduced Motion path. Press feedback may use a subtle scale/opacity response,
  but the dock must remain stable in size.

Behavior and layout safeguards:

- Preserve Schedule, Church, Profile order, route names, proper tab switching,
  active-route resolution, and dynamic admin-only Church visibility.
- Support both two-tab members and three-tab admins without changing tab widths
  unexpectedly during a church/account transition.
- Guarantee 44x44 minimum targets, safe-area clearance, keyboard avoidance,
  landscape placement, tablet maximum width, Larger Text labels, and enough
  list bottom inset that no service or setting row is covered.
- Keep selected icon, label, accessibility selected state, and visible capsule
  synchronized throughout navigation and church permission changes.

Verification:

- Add focused tests for two/three-tab geometry, selected-state animation,
  Reduced Motion, admin-to-member changes, repeated tab presses, safe-area
  padding, and content clearance.
- Compare physical Android and iOS screenshots because blur and elevation render
  differently. The Android fallback must look intentionally designed rather
  than like a disabled gray control.

Completed verification:

- Replaced the heavy gray bar with a stable 64px, 22px-corner floating shell,
  pale-blue selected capsule, navy selected content, slate inactive content,
  thin cool border, short blue under-accent, and semantic shadow.
- Added controlled iOS material blur and an opaque cool Android fallback. Both
  branches use Package 23 semantic tokens and compile independently.
- Preserved Schedule, Church, Profile order, `router.navigate`, active-route
  resolution, selected accessibility state, and ready-admin-only Church
  visibility. The shell width remains stable when changing between two and
  three tabs.
- Added deterministic phone/tablet geometry, safe-area clearance, keyboard
  hiding, 56px tab targets, Larger Text bounds, Reduced Motion behavior, and
  verified existing 140/144px main-list bottom clearance.
- Visually checked real rendered three-tab 390x844 and two-tab 320x700 layouts.
  The temporary preview route and bypass were removed afterward.
- Passed TypeScript, all six Edge Function checks, ESLint, 383 tests,
  `git diff --check`, and iOS/Android production exports on 2026-08-11.

#### Package 25: Cross-App Surface Hierarchy

Status:

- Completed on 2026-08-11. Client-only; no Supabase migration or backend
  deployment was required.

Goal:

- Introduce the approved light visual hierarchy across the main tabs without
  changing any workflow: a cool blue-gray canvas, crisp white primary surfaces,
  restrained pale-blue secondary surfaces, deep navy accents, and small semantic
  green/amber/red states.

Checkpoint 25A: shared canvas and grouped surfaces:

- Set the main page canvas to a subtle cool blue-gray instead of pure white.
  Keep primary content surfaces white and secondary/expanded content on a
  restrained blue-gray tint.
- Add shared grouped-row, section-header, icon-tile, value-chip, metadata-chip,
  divider, and pressed-state primitives. Reuse them across tabs instead of
  creating Schedule-, Church-, and Profile-specific copies.
- Avoid card-inside-card decoration. A grouped row surface may contain internal
  separators, while genuinely nested information such as expanded service
  details uses one quiet tinted band rather than another floating card.
- Reduce bright pale-blue outlines. Use neutral blue-gray borders and reserve
  stronger blue for selection, personal relevance, and actions.
- Give repeated Schedule, Church, and Profile content enough surface contrast
  to remain distinct from the canvas. The result must add depth and color
  without turning every section into a floating card or making the app feel
  dominated by one blue shade.

Checkpoint 25B: semantic status system:

- Standardize success, attention, error, informational, personal, assigned,
  unassigned, and disabled treatments as icon/text/surface combinations.
- Never communicate completion, assignment, fill-in state, or ownership through
  color alone. Every status must retain a readable label or accessible value.
- Keep green for complete/assigned, amber for pending attention, red for errors
  or destructive actions, and blue for selection/personal relevance.

Checkpoint 25C: typography and rhythm:

- Preserve the responsive and word-safe name system while standardizing section
  spacing, heading sizes, supporting copy, row density, and tablet maximum
  widths across Schedule, Church, and Profile.
- Ensure all church and person names wrap only between words, retain full
  accessibility labels, and do not shrink unpredictably because of decorative
  controls.

Verification:

- Use before/after screenshots on narrow Android, current iPhone, large phone,
  and tablet. Verify normal and Larger Text, sufficient contrast, no overlap,
  and no lost actions.
- No Supabase migration or backend deployment belongs to Package 25.

Completed implementation:

- Added one shared semantic surface system for the cool canvas, white grouped
  rows, quiet secondary bands, icon tiles, value/metadata chips, dividers,
  pressed states, and labeled status badges. The status resolver covers success,
  attention, error, informational, personal, assigned, unassigned, and disabled
  states without relying on color alone.
- Applied the system to the main Schedule, Church, and Profile views while
  preserving every route, callback, query, mutation, role check, and released
  data contract. Existing responsive name handling and tablet width limits stay
  in place.
- Added Package 25 behavior and contract coverage for contrast, future dark-mode
  token compatibility, semantic mappings, shared primitive reuse, tab adoption,
  and the client-only boundary.

Completed verification:

- Visually checked rendered Schedule, Church, and Profile states at 320x700,
  390x844, and 768x1024. Grouped surfaces, status labels, long content, expanded
  details, and the floating dock remained readable without overlap or lost
  actions.
- Passed TypeScript, all six Edge Function checks, ESLint, 391 tests,
  `git diff --check`, and iOS/Android production exports on 2026-08-11.

#### Package 26: Schedule Comprehension and Role Symbols

Status:

- Completed on 2026-08-12. The additive backend checkpoint was deployed and
  verified before the client began using it. The original role-save RPC and all
  released-client paths remain available; the new client also falls back to the
  original RPC if it encounters an older backend.

Goal:

- Make every service answer, in order: what service is this, when is it, am I
  serving, what is my role, is the team complete, and where are the songs/team
  details.
- Add optional admin-selected role symbols without ever replacing written role
  names or changing role eligibility, assignment, auto-assignment, or fill-in
  behavior.
- Replace the current generic 90-day summary with truthful date context and use
  stronger visual emphasis for service metadata and song numbering without
  changing schedule loading, assignment permissions, or song behavior.

Checkpoint 26A: additive role-symbol foundation:

- Confirm no existing role metadata already represents this capability.
- Add one nullable `icon_key`-style field to the existing church-role record,
  using an additive idempotent migration. Do not rename the roles table, change
  existing role IDs/names, or require a value for old rows.
- Store only a controlled semantic key such as `microphone`, `keyboard`,
  `guitar`, `drums`, `music`, `reading`, `presentation`, `sound`, `camera`,
  `hospitality`, or `person`. Map that key in client code to reviewed SF Symbol
  and Material icon names; never execute or render an arbitrary icon identifier
  from the database.
- Keep null/unknown keys safe with a neutral person/music fallback. Released
  builds continue reading and writing roles without the optional field.
- Regenerate Supabase types, add RLS/behavior tests, run advisors, deploy the
  migration before client use, and smoke-test the currently released Android
  and iOS builds.

Checkpoint 26B: admin role-symbol editor:

- Add an optional symbol picker to the existing Church Setup role add/edit
  workflow. Use a compact, labeled grid/list of familiar symbols with `None` or
  `General` as a valid choice.
- Save symbol changes through the existing role mutation/cache/Realtime path.
  Do not create a separate role-settings table, role identity, or competing
  editor.
- Display both icon and role name in the picker, preview, and saved row. Add
  full VoiceOver/TalkBack labels and a non-color selected indicator.

Checkpoint 26C: member-first Schedule defaults:

- Open regular members on local `My Schedule` presentation state and admins on
  `All Services`. Keep both segments available and keep `Needs Attention`
  visible in either view. Do not persist a hidden filter that makes services
  appear missing on a future launch.
- Retain the earlier approved branded header from Package 23. Do not use the
  flatter header from the last Schedule-only concept image.
- Keep month grouping, loaded windows, filters, pagination, refresh, Realtime,
  notification history, and widget behavior unchanged.
- Add a compact, noninteractive `Today` date marker near the Schedule controls,
  styled from the same date-tile family as a service but clearly distinguished
  from a real service row. It must show the device-local weekday, day, and month,
  update after midnight/app resume, and never create, filter, or scroll to a
  nonexistent service.
- Replace any visible `next 90 days` or query-horizon wording in the main
  Schedule summary with the actual first-to-last date represented by scheduled
  service records. Keep the existing incremental loading horizon internally;
  if later services are not loaded, use a lightweight cached min/max summary
  query against existing service data rather than pretending the loaded window
  is the church's complete scheduled range.
- Define clear empty and partial-data wording: no range when no services exist,
  one date when only one scheduled date exists, and an honest `Loaded through`
  state while the complete min/max summary is unavailable. Filters may show a
  separate visible-result range but must not overwrite the church schedule
  range.
- Stabilize `Load Next 90 Days` before changing its appearance. Track one
  explicit pending range key from press through settled query state, reject
  repeated presses for that range, and do not infer the button's busy state
  solely from a newly appended query that may not be fetching until the next
  render.
- Keep the footer's dimensions and label lane stable while loading so the icon,
  spinner, and text cannot flicker or move the list. Preserve all already-loaded
  services, scroll position, expanded cards, filters, and widget input while the
  next range loads; show one stable Retry state on failure and advance
  `loadedThrough` only after success.
- Add slow-network, cached-range, rapid-double-press, failed/retried range,
  church-switch-during-load, empty-range, Realtime update, and end-of-list tests.
  Loading a range must issue one request and must never duplicate or temporarily
  remove visible services.

Checkpoint 26D: faster collapsed-card comprehension:

- Use a stable deep-navy metadata treatment with white/high-contrast text for
  the service date and restrained dark-blue emphasis for the time and service
  type/name. Keep the primary card surface lighter so services stand out from
  the canvas without becoming dense dark blocks. Reserve the right lane for
  status and the existing admin overflow action.
- When the current member is assigned, show a prominent soft-blue
  `You're serving` summary with the configured symbol and written role name.
  Combine multiple roles clearly without duplicating the service.
- When not assigned, show the explicit quieter text `Not assigned`. Show
  `Fill-in requested`, open-role, or other attention states with text and icon.
- Keep compact Team and Songs metadata chips. Rename the disclosure to the more
  descriptive `View team and songs` / `Hide team and songs`.
- Give services involving the current member a subtle blue edge/accent without
  relying on that accent as the only assignment cue.

Checkpoint 26E: clearer expanded team and songs:

- Place expanded details on one softly tinted inner surface with Team first and
  Songs second.
- Render each team role as a structured row: icon tile, written role name,
  assigned member, and explicit `You`, `Assigned`, `Open`, or
  `Fill-in requested` state. Highlight the current member's row with both a
  soft-blue surface and a `YOU` badge.
- Preserve church role order. For members, rows stay read-only except the
  existing own-assignment fill-in actions. For admins, the existing
  availability-safe assignment interaction remains available and no direct
  mutation is added to a decorative icon.
- Keep songs as an ordered written list. Show the existing add/edit/delete
  controls only to the same authorized admin or song author as today.
- Make an entered `song_number` immediately scannable with a compact accent
  `#number` chip beside the song type/title. Give the existing Song Number input
  the same visual emphasis while adding or editing one/multiple song drafts,
  including a clear selected/focused state. Do not generate a number when the
  field is empty or alter ordering, validation, edit/delete ownership, or
  notification behavior.

Compatibility and verification:

- Add tests proving icons never affect role matching, manual assignment,
  auto-assignment, unavailable-date enforcement, notification targeting, or
  fill-in eligibility.
- Verify services with null, known, and unknown symbol keys; duplicate role
  names; several roles assigned to one person; multiple roles for the current
  user; long translated role names; open slots; and pending fill-ins.
- Run the full schedule authorization suite for owner, scheduling admin,
  ordinary member, assigned member, fill-in requester, and song author.

Completed implementation:

- Deployed migration `20260812145305_add_church_role_symbols`, adding only the
  nullable controlled `church_roles.icon_key` field and the additive
  `save_church_role_admin_v2` RPC. Null and unknown client values resolve to a
  neutral General symbol; written role names remain authoritative everywhere.
- Added the accessible Church Setup symbol picker with labeled SF Symbol and
  Material mappings, explicit checked indicators, and the written role name in
  every saved-row presentation.
- Regular members now open Schedule on `My Schedule`; admins open on `All
  Services`. Both views and all filters remain available and reset only when
  the selected church/session role changes.
- Added a device-local Today marker that refreshes after midnight and on app
  resume, plus a cached first/last upcoming-service summary so the header shows
  the real scheduled range instead of the internal query horizon.
- Rebuilt incremental loading around one synchronous pending-range lock. A
  range is appended only after a successful query, failed ranges retry in
  place, stale church responses are ignored, and existing services remain
  visible while loading or retrying.
- Updated collapsed cards with strong date metadata, explicit `You're serving`
  and `Not assigned` states, written roles with optional symbols, team/song
  counts, and clearer disclosure wording. Expanded content now reads and
  renders in disclosure, Team, then Songs order on one muted inner surface.
- Team rows retain church role order and expose written role/member names plus
  explicit You, Assigned, Open, or Fill-in requested badges. Existing admin
  assignment safety, member fill-in actions, song ownership, editing, deletion,
  reordering, and notifications are unchanged. Song numbers now use a compact
  accent chip in saved and draft states.

Completed verification:

- Live rollback-safe SQL behavior checks passed. Supabase confirms the nullable
  column, controlled constraint, original RPC, authenticated v2 RPC, and remote
  migration record. Security and performance advisors show no new Package 26
  findings; their remaining notices predate this package.
- Passed TypeScript, all six Edge Function checks, ESLint, 404 repository tests,
  `git diff --check`, and final iOS/Android production exports on 2026-08-12.

#### Package 27: Church and Profile Visual Polish

Status:

- Completed on 2026-08-12 as a client-only package. It adds no migration and
  keeps the released preference-row, availability, quarter-generation, modal,
  query, cache, Realtime, and permission contracts intact.

Church direction:

- Preserve the approved header, church name, invitation-code copy action, and
  add-church action.
- Place Church Setup on the tinted canvas and group related destinations into
  clean white row surfaces with restrained separators, pale-blue icon tiles,
  concise summaries, green labeled completion states, and stable chevrons.
- Keep Schedule Management visually separate from core setup so first-time
  admins understand what must be configured before creating and assigning
  services.
- Preserve every existing setup editor, readiness calculation, recommended next
  step, bulk deletion, quarter preparation, auto-assignment, reminder setting,
  and permission boundary.
- Keep Church editor content ready for Package 28's taller responsive popup
  presentation. Do not add per-editor height overrides or duplicate modal
  shells while polishing the launch rows in this package.
- Guard quarter preparation against a quarter whose local-calendar end date is
  earlier than today. Mark every fully elapsed quarter/year option unavailable,
  explain `This quarter has already ended`, and disable Continue/Generate before
  any draft or request is created.
- Repeat the elapsed-quarter validation in the final prepare handler so stale
  modal state, a midnight rollover, or programmatic invocation cannot create
  past-quarter services. The current or a future quarter remains selectable;
  keep all existing block-date, special-service, duplicate protection, batch
  creation, cache, and Realtime behavior unchanged.

Profile direction:

- Preserve the approved member-identity header and place each settings group on
  a distinct white grouped surface over the tinted canvas.
- Restyle the Profile identity symbol as an unframed avatar/identity mark rather
  than a bordered square that appears tappable. It must not expose button
  semantics, pressed feedback, or a hit target unless a real profile-photo
  action is added in a separately approved feature.
- Use semantic icon tiles and compact value chips for Owner/Admin/Member,
  connected churches, unavailable-date count, scheduling preference summary,
  notification count, and account state.
- Distinguish actionable rows with chevrons and pressed states from informational
  values. Keep Account and destructive actions in their existing lower sections
  with a clearly separate danger treatment.
- Preserve all Profile queries, immediate saves, rollback behavior, church
  switching, password-manager metadata, notification settings, sign-out, and
  account deletion.
- Add restrained navy/pale-blue section accents, icon surfaces, and status/value
  treatments so the tab no longer reads as a long white page. Keep text-heavy
  information on quiet surfaces and preserve sufficient contrast.
- In visible App Information, show the marketing app version only. Remove the
  native build number from the user-facing row while retaining it internally
  for logs, diagnostics, store submissions, and support data where it is not
  rendered as ordinary Profile content. This intentionally supersedes Package
  22's earlier visible-build-number presentation without changing build config.
- Extend the Unavailable Dates editor from the shared 90-day service window to
  a true six-calendar-month range beginning on the device-local current date.
  Calculate the end with calendar-month arithmetic instead of assuming every
  month has 30 days. This is a client range change only: preserve existing saved
  dates outside the visible range and keep the current table, save operation,
  auto-assignment hard block, manual-assignment validation, and older clients
  unchanged.
- Reverse only the presentation semantics of Scheduling Preferences. Every
  eligible weekly-service/role switch appears ON by default and means `Schedule
  me here when needed`; switching it OFF means `Prefer not to schedule me here`.
  Continue storing only OFF/avoid combinations in the existing
  `member_scheduling_preferences` rows so released builds and every deployed
  auto-assign RPC retain exactly the same meaning.
- Rename client helpers and mutation arguments around `isAvailable`/`shouldAvoid`
  so the inversion is explicit rather than relying on scattered boolean
  negation. Update summaries, accessibility labels, optimistic updates,
  rollback/retry copy, Realtime replacement, and multi-device tests. A missing
  row must always render ON; an existing avoidance row must always render OFF.

Verification:

- Compare one/many-church, owner/admin/member, incomplete/complete setup,
  no-role/many-role, and long-name fixtures at all supported sizes.
- Ensure no grouped surface is hidden behind the new dock and pull-to-refresh
  retains visible cached content without a full-screen flash.

Completion notes:

- Church Setup and Schedule Management retain every existing destination while
  using grouped white surfaces, labeled readiness states, icon tiles, and
  separate section accents over the shared tinted canvas.
- Fully elapsed quarters are disabled and labeled in the selector. Continue,
  special-service staging, and final generation all repeat the local-date guard
  before creating drafts or requests; current-quarter end dates remain valid.
- Profile now uses an unframed, noninteractive identity mark, accented section
  headings, semantic value chips, and the existing separated danger treatment.
  Visible App Information shows version only while the internal build resolver
  remains available for diagnostics and store tooling.
- The availability editor now defaults to six true calendar months and clamps
  end-of-month dates safely. Its optional legacy day-range argument and all
  saved dates outside the visible range remain supported.
- Scheduling switches now display ON as available and OFF as avoid. Only OFF
  states continue to persist rows, and the released avoidance helpers remain as
  compatibility aliases for older callers and tests.
- Passed TypeScript, all six Edge Function checks, ESLint, 416 repository tests,
  `git diff --check`, and clean iOS/Android production exports on 2026-08-12.

#### Package 28: Focused Screens, Modal Parity, and Dark-Mode Readiness Gate

Status:

- Completed on 2026-08-12 as a client-only package. No migration, Edge
  Function, database contract, Auth route, notification payload, scheduling
  request, or permission boundary changed, so released app versions remain
  compatible with the same backend.

Goal:

- Finish the design system beyond the three main tabs and prove that all new
  visual primitives can switch to a dark token set later without another
  component rewrite.

Implementation:

- Migrate focused Church/Profile editors, onboarding, password reset, account
  actions, notification history, filters, assignment pickers, song editors,
  quarter preparation, bulk deletion, and auto-assignment previews to the same
  canvas, surface, input, status, button, and modal tokens.
- Replace the login/onboarding placeholder or generic symbol with the canonical
  Music Ministry app mark selected from the existing app/splash assets. Use one
  transparent, high-quality source with responsive bounds, correct aspect
  ratio, accessible treatment, and no button styling; do not duplicate the full
  splash experience or alter authentication routing and validation.
- Extend, rather than bypass, the Package 20 modal contract. Keep consistent
  outer margins and maximum width, but give Church forms and other content-rich
  forms a taller safe-area-derived body on normal/large devices. Confirmations
  remain compact, forms use a comfortable medium/tall range, and previews use
  capped long-content height with one internal scroll owner.
- Do not use one fixed height for every popup. Preserve Package 20 keyboard and
  dismissal behavior, pinned/reachable footer actions, Android back, iOS
  accessibility escape, date/time draft confirmation, and compact fallbacks on
  small phones or landscape. No popup may expand underneath the keyboard or
  beyond the safe area.
- Redesign focused-screen and popup headers as contextual header zones using the
  semantic modal-header surface, relevant icon, concise title, optional helpful
  subtitle, and a clearly separated close/back action. Avoid the current
  one-stripe-bar appearance, decorative card nesting, and oversized hero
  typography; the header must make the displayed task or information easy to
  identify at a glance.
- Give `Manage Assignment` the taller long-content allocation from the shared
  modal system so role-grouped member names and unavailable explanations are
  visible without making the footer leave the safe area. Keep selection,
  availability enforcement, assign/reassign/clear permissions, and request
  payloads unchanged.
- Make the assignment list the only vertical scroll owner inside that modal.
  Reset it to the top whenever a newly opened assignment target/role replaces
  the previous one, but do not jump while the user is reading the same list or
  while a background refresh settles. Verify upward and downward scrolling from
  both ends, momentum interruption, orientation change, Android nested-scroll
  behavior, iOS bounce, keyboard dismissal, and Larger Text.
- Replace remaining hard-coded light colors in migrated UI with semantic tokens.
  Document any deliberate platform/native exceptions.
- Render every migrated screen against the future dark token object in automated
  component/contract tests or a development-only visual harness. Fix missing
  tokens and contrast failures, but keep production dark-mode activation
  deferred until separately approved.

Final visual release gate:

- Run TypeScript, full ESLint, all package tests, Deno checks where unchanged
  backend contracts are revalidated, Android/iOS/web production exports, and
  `git diff --check`.
- Capture light-theme screenshots for Schedule collapsed/expanded/attention,
  Church setup/management, Profile overview/focused editors, onboarding,
  recovery, every modal family, and two/three-tab navigation.
- Include dedicated visual fixtures for the branded login mark, Profile's
  noninteractive identity icon, App Information without a visible build number,
  the Today marker, actual scheduled date ranges, navy service metadata,
  highlighted song numbers, compact confirmations, taller forms, and long
  scrollable previews.
- Test small Android, current and older supported iPhones, large phone, tablet,
  landscape, Larger Text, display scaling, VoiceOver, TalkBack, Voice Control,
  Reduced Motion, keyboard interaction, and gesture navigation.
- Confirm no functionality, action, permission, notification, cache update,
  Realtime event, widget refresh, route, or older-version database contract was
  removed or changed by the redesign.

Done when:

- The approved header, futuristic dock, layered light surfaces, clearer
  Schedule, role symbols, Church setup, Profile settings, focused screens, and
  modals read as one coherent product; first-time members can identify their
  service and role without opening every card; and activating dark mode later
  requires selecting a palette rather than rewriting components.

Completion notes:

- The shared modal now owns semantic backdrop/body/footer/button colors,
  contextual icon/title/subtitle/close zones, and safe-area-derived compact,
  form, and long-content allocations. Forms are taller without using fixed
  device heights; confirmations remain compact and previews remain capped.
- `Manage Assignment` and bulk service deletion use one native list as the only
  vertical scroll owner. Assignment lists reset only when the assignment/role
  target changes, never when the same query refreshes in the background.
- Focused Church/Profile headers, Profile editors, church switching,
  onboarding, recovery, account actions, notification history, filters, and
  custom preview/footer states resolve from semantic theme tokens. A temporary
  focused-screen adapter maps legacy style names to the active theme without
  changing any screen's data or mutation logic.
- Onboarding uses the existing transparent `assets/splash-mark.png` as the one
  canonical accessible app mark. Password recovery keeps Supabase recovery
  validation and password-manager metadata intact; visible App Information
  continues to show the marketing version without exposing the build number.
- Future-dark remains intentionally disabled in production, but automated
  checks render its token contracts and enforce WCAG text contrast for modal,
  input, button, status, and focused-screen surfaces. Deliberate exceptions are
  native `DateTimePicker` chrome and operating-system `Alert` confirmations,
  whose appearance is controlled by iOS/Android.
- Passed TypeScript, all six Edge Function checks, ESLint, 426 repository tests,
  `git diff --check`, and clean web, Android, and iOS production exports on
  2026-08-12. Physical small/large phone, tablet, landscape, VoiceOver,
  TalkBack, Voice Control, display scaling, and keyboard inspection remains the
  candidate-build release QA matrix.

#### Package 29: Notification Lifecycle and iOS Widget Reliability

Status:

- Implemented locally on 2026-08-12. The additive retention migration was
  deployed on 2026-08-12 after live compatibility verification. The widget
  repair still requires a fresh iOS build and physical-device verification
  before release.
- Do not publish the widget repair until released Android/iOS builds pass the
  compatibility checks described below.

Implementation checkpoint:

- Added a private 500-row retention routine scheduled once daily. It deletes
  only notifications read more than 90 days ago and preserves all unread rows.
- Added a private durable `(member_id, event_key)` ledger and insert trigger so
  presentation-history cleanup cannot recreate an already claimed event. The
  public table, existing unique constraint, RLS policies, Realtime publication,
  and released Edge Function upserts remain compatible.
- Notification Realtime DELETE handling removes only the matching cached row,
  keeps the unread count nonnegative, and coalesces count-only reconciliation
  instead of refetching the 50-row history list.
- Moved iOS widget synchronization from Schedule-screen mount to an
  authenticated selected-membership lifecycle component backed by the existing
  React Query service cache. Intermediate loading/errors preserve valid data;
  sign-out and terminal no-membership clear it.
- App Group writes are verified, both unchanged widget kinds reload explicitly,
  and duplicate timeline reloads are coalesced. Snapshot schema v1, App Group
  names, extension bundle identifier, OneSignal configuration, and Android code
  paths are unchanged.
- Added rollback-safe SQL fixtures plus Package 29 behavior/contracts. Passed
  TypeScript, all six Edge Function checks, ESLint, 439 repository tests,
  `git diff --check`, and clean web, Android, and iOS production exports on
  2026-08-12. Live migration `20260812181757` was then applied successfully:
  the ledger backfilled 106 claims with none missing, all 49 unread rows were
  preserved, both released notification policies remained active, the private
  function was unavailable to Data API roles, and rollback-only old-client and
  duplicate-event smoke tests passed.

Goal:

- Keep in-app notification history useful without retaining old read entries
  indefinitely, and make both iOS widget choices reliably load the selected
  church's real upcoming service details without requiring the user to visit the
  Schedule tab first.

Checkpoint 29A: bounded notification-history retention:

- Treat the request as automatic cleanup of old in-app history. Use a proposed
  default of 90 days and confirm that period before deployment. Prune only read
  `member_notifications` whose `read_at` is older than the retention threshold;
  never delete unread entries merely because they are old.
- Keep push delivery and idempotency independent from presentation cleanup. Do
  not delete or shorten `notification_log`, OneSignal device/subscription rows,
  event-key ledgers, fill-in requests, service assignments, or any source record
  required to prevent duplicate pushes.
- Implement the cleanup as an idempotent, bounded-batch private database routine
  scheduled at most daily. It must not be publicly callable, must not use a
  client service-role key, and must be safe when rerun after a partial failure.
- Keep the notification list and unread-count queries valid when rows disappear.
  Realtime DELETE payload handling must remove only the matching cached row and
  must not make the bell count negative or refetch the whole history repeatedly.
- Add migration/RLS/security-advisor tests, retention-boundary fixtures, unread
  preservation, dedupe-ledger preservation, multi-church/member isolation, and
  old-client smoke tests before live deployment. Released builds should simply
  show a shorter recent-history list and continue receiving pushes normally.

Checkpoint 29B: repair widget snapshot delivery:

- Reproduce the reported `widget shell displays but service details do not`
  state on a physical iPhone and inspect, in order: main-app and extension App
  Group entitlements, provisioning profiles, shared defaults suite/key,
  snapshot decoding, scope fingerprint, query readiness, timeline reload, and
  stale/empty-state selection. Do not mask a provisioning failure with UI copy.
- Move snapshot synchronization from Schedule-screen mount ownership to an
  authenticated selected-membership lifecycle owner. Once the selected church,
  current member, and upcoming service query are ready, write the sanitized
  snapshot and reload both widget kinds even when the user opens Church/Profile
  or leaves the app without visiting Schedule.
- Reuse the existing React Query service cache or one deduplicated lightweight
  upcoming-service query; do not create a second polling loop. Ensure the
  personal projection receives assignments and role names while the church-wide
  projection receives service name, date, and time.
- Never replace a valid snapshot with `unavailable` during ordinary intermediate
  loading. Clear it only on sign-out, account/church scope change, removed
  membership, or an explicit terminal no-church state; then write the new scope
  atomically after it becomes ready.
- Preserve snapshot schema v1 unless a change is demonstrably required. If a
  new schema is needed, make the Swift decoder and app writer tolerate the last
  schema during an app upgrade and safely rewrite it; keep App Group names,
  widget kinds, extension bundle identifier, and OneSignal App Group untouched.
- Reload timelines after committed service/assignment/song-independent schedule
  changes, app resume, pull-to-refresh success, and church/account switching,
  while coalescing duplicate reloads. Widget refresh remains best-effort and
  must never block app navigation or schedule mutations.

Compatibility and verification:

- Notification retention requires a backend-first released-build canary before
  enabling the daily schedule. Confirm one push per eligible device before and
  after cleanup and verify old Android/iOS clients can open and mark the
  remaining history read.
- Widget repair requires a fresh iOS development/TestFlight build because the
  extension and entitlements are native. Test both widget kinds simultaneously
  in small and medium sizes after first login, app restart, app termination,
  church switch, account switch, assignment change, service deletion, no
  upcoming services, denied notifications, and an app upgrade with an existing
  snapshot.
- Add TypeScript model tests, extension contract tests, Swift build/export
  verification, app-group entitlement checks for both targets, and a physical
  timeline-reload test. Android behavior and builds must remain unchanged.

Done when:

- Read notification history expires only under the confirmed policy without
  affecting delivery or duplicate prevention, and each iOS widget displays the
  correct selected-church service details after login without requiring the
  Schedule tab to be opened.

## Cross-Feature Release Gate

- Run a released Android/iOS build against every deployed migration before
  publishing the new client.
- Verify one account as an admin in church A and a member in church B, including
  switching, app restart, tab visibility, RLS isolation, and notification
  delivery while either church is active.
- Complete the guided setup and every returning-admin Church Setup editor on the
  physical-device matrix, including failure/retry, Realtime, and multi-church
  switching.
- Verify that Reminder Settings show only delivery status, selected reminder
  times, and save state, with no cron or polling implementation details.
- Capture Android and iOS screenshots of every Schedule Management and
  auto-assignment action state in the current appearance, and verify that
  previews, payloads, and results remain unchanged.
- Pull to refresh every refreshable tab while watching for full-screen loader,
  scroll-position, modal, draft-state, and stale-data regressions.
- Capture the header name matrix for short and long people/church names across
  all target widths, font scales, orientations, trailing actions, and both
  platforms.
- Verify church-name line breaks from the word-safe fixture set and confirm
  selected/copied and accessibility-announced names remain unchanged.
- Run the complete Profile flow as owner, scheduling admin, and member in one
  and multiple churches, including switching, app restart, offline mode, and
  another account on the same device.
- Verify availability summaries and edits at local-date boundaries and compare
  auto-assignment output against the exact saved unavailable dates.
- Verify scheduling-preference summaries, editor auto-save, rollback, Realtime,
  and unchanged auto-assignment semantics.
- Confirm every displayed notification control changes real backend delivery,
  while released clients with no preference rows retain current behavior.
- Run sign-out, password change/recovery, and account deletion against mixed
  multi-church ownership, two devices, and the current released app build.
- Run every onboarding path with email confirmation both enabled and disabled,
  including duplicate taps, app restart, slow/offline recovery, existing-email
  join, and an authenticated account with no membership.
- Verify a released Android and iOS build can still create/join/sign in after
  every onboarding migration, and do not retire the legacy self-join policy
  until the documented minimum-version gate is met.

## Verification Backlog

- Capture the documented performance baseline on physical Android and iOS
  devices.
- Run the documented two-device Realtime, notification delivery, sign-out, and
  account-switching checks.
- Test long schedules and auto-assignment previews on physical Android and iOS
  devices.

## Future Database Cleanup

- Review and consolidate duplicate permissive RLS policies one table at a time.
  Preserve every existing access rule and older app compatibility.
