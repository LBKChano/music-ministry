# TODO

## Product Roadmap

Implementation status: roadmap packages 1 through 7 have been implemented and
pass automated verification. Their physical-device recovery, keyboard, and
viewport checks remain before release.

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
- Do not deploy, commit, or push a package until its checks pass and the user
  explicitly requests that action.

### Recommended Execution Order

1. Password reset reliability and password-manager support: items 7 and 8.
   Code and automated verification are complete; physical-device recovery and
   autofill checks remain.
2. Schedule button cleanup and modal sizing: items 2, 3, and 4.
   Code and automated verification are complete; physical-device keyboard and
   viewport checks remain.
3. Shared responsive headers and prominent names: item 5.
   Code and automated verification are complete; physical-device viewport and
   Larger Text checks remain.
4. Song-type auto-save: item 11.
   Code and automated verification are complete; physical two-device Realtime
   and offline retry checks remain.
5. Song ordering: item 6.
   Code, automated verification, and additive migration deployment are
   complete; released-build compatibility and physical two-device checks
   remain.
6. Bulk service deletion: item 9.
   Code, automated verification, and additive migration deployment are
   complete; released-build compatibility and physical preview/apply checks
   remain.
7. Weekly-service role preferences and auto-assignment integration: item 10.
   Code, automated verification, additive migration deployment, and live
   rollback-based SQL behavior checks are complete; released-build compatibility
   and physical two-device Profile/auto-assignment checks remain.
8. Public website contact form: item 1, once the website source/deployment
   target and support destination are identified. Complete and deployed at
   `https://music-ministry-app.lisandrobk.chatgpt.site/support`.

### 1. Replace the Public Email with a Contact Form

Current finding:

- Completed in the separate Music Ministry public website. The homepage,
  footer, Support page, and Privacy Policy no longer expose a personal email
  address and now route visitors to one contact form.
- The public form validates name, account email, category, subject, and message,
  provides accessible pending/success/error states, and works responsively.
- A same-origin server endpoint stores submissions in the website's private D1
  database and forwards them through Resend using server-only secrets. It sets
  the submitter as `Reply-To`, uses the submission ID as the email idempotency
  key, and retains failed deliveries for retry. It also applies request-size
  limits, duplicate protection, a honeypot, per-address rate limiting, and
  180-day retention. The database has no public read route.
- Production version 3 was deployed to
  `https://music-ministry-app.lisandrobk.chatgpt.site` on 2026-07-26. A live
  delivery test succeeded with reference `97E35CD4`.

Implementation:

- Confirm the public website URL, its source repository, hosting provider, and
  the private inbox or support workflow that should receive submissions.
- Replace the visible email or `mailto:` action with an accessible form for
  name, reply email, subject/category, and message.
- Add client validation, clear pending/success/error states, keyboard-friendly
  submission, and a consent/privacy note. Do not expose the destination email,
  provider key, or Supabase service key in browser code.
- Create a narrowly scoped backend submission endpoint. Preferred design:
  a Supabase Edge Function that validates and normalizes the payload, applies
  body-size limits, rate-limits repeated submissions, verifies a bot-protection
  token, stores an audit-safe submission record, and sends or forwards the
  message using a server-side secret.
- Store submissions in a private table with RLS enabled and no anonymous read
  access. Retain only the information needed for support and define a retention
  period.
- Add abuse controls such as a honeypot plus Turnstile or an equivalent
  challenge. Return a generic success response so the endpoint cannot be used
  to discover inbox or account details.
- Update App Store and Play Store support URLs/copy only after the new page is
  live and tested.

Compatibility and rollout:

- This can be deployed independently of mobile releases. Any Supabase table and
  function are additive and must not change existing app APIs.

Done when:

- No personal email address is visible in the public page source or interface.
- A valid submission reaches the private support destination exactly once.
- Invalid, oversized, duplicate, and bot-like submissions are rejected safely.
- The form works with keyboard navigation, screen readers, mobile browsers, and
  a temporary delivery-provider failure.

### 2. Remove "Add Service" from Schedules

Implementation status:

- Complete in code and automated verification. Physical Android and iOS
  navigation checks remain.

Current finding:

- Both `app/(tabs)/(home)/index.tsx` and
  `app/(tabs)/(home)/index.ios.tsx` render an admin-only "Add Service" footer
  button and maintain a duplicate add-service modal. Church already has the
  intended "Add Single Service" admin workflow.

Implementation:

- Remove the footer button from both schedule implementations.
- Remove the now-unused schedule modal, local state, handlers, recurring-service
  selection state, styles, imports, and callbacks only after verifying that they
  have no other caller.
- Keep viewing, editing, deleting, fill-ins, songs, loading more dates, and the
  Church "Add Single Service" flow unchanged.
- Confirm the schedule list footer still has correct spacing above the floating
  tab bar after the button is gone.

Compatibility and rollout:

- Client-only change. No Supabase migration is needed and released builds remain
  unaffected.

Done when:

- No admin or member sees "Add Service" on Schedules on Android or iOS.
- Admins can still create single and recurring services from Church.

### 3. Keep the Single-Service Modal Stable While Typing

Implementation status:

- Complete in code and automated verification. Physical-device keyboard,
  picker, Larger Text, and small-screen checks remain.

Interpretation:

- Treat "gets smaller as soon as I start typing" as a layout bug. The modal
  should keep a stable professional size when the keyboard opens while moving or
  scrolling only enough to keep the active field and actions reachable.

Current finding:

- The Church single-service form combines a modal, scroll view,
  `KeyboardAvoidingView`, date/time pickers, and flexible content sizing. Android
  keyboard resize can recalculate the modal height and collapse its content.

Implementation:

- Extract a shared keyboard-aware admin form shell used by single-service and
  weekly-service forms.
- Give the sheet a stable width, a sensible non-keyboard maximum height, and a
  minimum content height. Recalculate available height from safe-area and
  keyboard insets without continuously shrinking the form as text changes.
- Put form fields in one scroll region and keep Cancel/Create actions visible in
  a fixed footer. Scroll the focused field into view instead of resizing the
  whole modal.
- Add a visible keyboard Done action where appropriate, support tapping the
  backdrop to dismiss, and make Android back close the keyboard before closing
  the modal.
- Preserve draft date/time confirmation behavior and do not reset entered values
  when the keyboard opens or closes.

Compatibility and rollout:

- Client-only change shared by Android and iOS, with platform-specific keyboard
  behavior where required.

Done when:

- Opening and dismissing the keyboard does not collapse, jump, or reset the
  single-service form.
- Every field, picker control, and action remains reachable on small devices and
  with large text.

### 4. Reduce the Weekly-Service Modal on Android

Implementation status:

- Complete in code and automated verification. Physical Android create/edit,
  keyboard, role-list, and small-screen checks remain.

Current finding:

- The add/edit recurring-service modal in `app/(tabs)/church.tsx` uses the same
  large generic modal content style and a full scroll container. On shorter
  Android viewports it can fill too much of the screen before the keyboard is
  shown.

Implementation:

- Move add and edit recurring-service forms onto the shared admin form shell from
  item 3.
- Use compact field spacing, a bounded modal width, and a maximum height derived
  from safe-area and keyboard insets. Do not use one fixed pixel height.
- Keep the service name, weekday, time, notes, and role selection in a scrollable
  body with a stable action footer.
- Keep native picker confirmation explicit so changing date/time does not commit
  or reset until the user confirms.
- Verify both creating and editing a recurring service because they share state
  but can enter the modal through different paths.

Compatibility and rollout:

- Client-only. No recurring-service database contract changes.

Done when:

- The weekly-service modal is visually consistent with Prepare Quarter and Add
  Single Service, never exceeds the usable Android viewport, and remains usable
  with the keyboard and role list open.

### 5. Make Headers and Prominent Names Adapt to Available Space

Implementation status:

- Complete in code and automated verification. Physical-device checks remain
  for narrow phones, tablets, landscape, display scaling, and Larger Text.

Current finding:

- Schedule and Profile each duplicate nearly identical Android/iOS header styles,
  while Church has another implementation. Fixed 32-36 point titles have caused
  long church and member names to alternate between too small, too large, and
  overlapping adjacent actions.

Implementation:

- Build a shared `ResponsiveTabHeader` for Schedule, Profile, and Church with
  slots for eyebrow, primary name/title, secondary metadata, and trailing
  actions such as the notification bell, copy button, and add-church button.
- Reserve stable action widths first, then let the title use only the remaining
  measured space. Use `flexShrink`, one- or two-line limits, and
  `adjustsFontSizeToFit`/`minimumFontScale` where reliable.
- On platforms where automatic fitting is inconsistent, choose from a small set
  of semantic title sizes after measuring the text container. Do not calculate
  font size as a percentage of screen width.
- Apply the same fitting behavior to the prominent user name in Profile and
  church name in all tab headers. Keep labels such as "Profile" at their intended
  smaller hierarchy instead of enlarging them with the user name.
- Preserve system font scaling without allowing text to overlap the bell,
  avatar, invitation code, or tab controls. Truncate only as a last fallback and
  expose the full name to accessibility services.
- Add shared snapshot/layout cases for short, medium, very long, and unbroken
  names at narrow, regular, landscape, tablet, and Larger Text sizes.

Compatibility and rollout:

- Client-only. Introduce the shared component incrementally and compare both
  platform implementations before deleting duplicate styles.

Done when:

- Church and member names remain prominent and readable without clipping,
  wrapping into controls, or moving the notification badge on tested devices.
- Schedule, Profile, and Church retain a consistent visual hierarchy.

### 6. Allow Songs to Be Reordered

Current finding:

- Songs are rows in `public.service_comments` and are currently sorted only by
  `created_at` in `hooks/useServices.ts` and
  `lib/realtime/cache-updates.ts`. Pending multi-song drafts also preserve only
  insertion order. There is no persisted display-order column.

Implementation status:

- Implemented in the current worktree. The additive migration backfills and
  appends `display_order`, adds the indexed atomic reorder RPC, and preserves
  older clients that omit the new column. Android and iOS now provide accessible
  queued-song and saved-song move controls, with optimistic React Query updates,
  rollback/refetch on failure, and Realtime convergence through one shared
  comparator.
- Migrations `20260727002157_add_service_song_ordering.sql` and
  `20260727002408_harden_service_song_ordering_rpc.sql` are deployed. Complete
  the released-build compatibility and two-device checks in the release gate
  before releasing the client UI.

Database implementation:

- Add a nullable/backward-compatible `display_order` integer to
  `service_comments`, then backfill a dense order per service using
  `created_at, id`.
- Add a trigger that assigns the next order when an older app inserts a song
  without `display_order`. This is required so released builds continue to append
  songs correctly.
- Add an index supporting `(service_id, display_order, created_at)`.
- Add an atomic `reorder_service_songs` RPC. It must lock one service, verify
  that every submitted song belongs to that service and church, reject duplicate
  or missing IDs, authorize the current church member, and write a dense order
  in one transaction.
- Preserve existing insert/update/delete policies and RPCs. Add only the minimum
  policy or RPC grant needed for ordering.

Client implementation:

- Add move-up/move-down controls and a drag handle to queued songs so their order
  can be adjusted before one batch post.
- Add a reorder mode to the saved Songs list. Use an accessible up/down
  alternative even if drag-and-drop is available.
- Recommended permission rule: admins and members assigned to that service may
  reorder the shared service song list. Enforce the same rule in the RPC and UI.
- Sort every query, optimistic update, and Realtime payload by
  `display_order`, then `created_at`, then `id`.
- Reordering must not send a push notification. Adding songs keeps the existing
  optional one-batch notification behavior.

Compatibility and rollout:

- Deploy the additive column, trigger, index, and RPC first. Verify an old build
  can still add, edit, and delete songs before releasing the new UI.

Done when:

- Pending and saved songs can be reordered on Android and iOS, all devices
  converge on the same order through Realtime, and concurrent reorder attempts
  never create duplicate or missing positions.
- Songs created by an older app append normally.

### 7. Repair Password-Reset Link and Button Handling

Implementation status:

- Implemented in the current worktree. The callback parser, dedicated reset
  route, warm/cold deep-link routing, recovery-session checks, invalid-link
  recovery actions, and regression tests pass. Android and iOS production
  exports pass.
- No Supabase migration is required. Physical reset-email checks remain before
  release. See `docs/PASSWORD_RECOVERY_AND_AUTOFILL.md`.

Original finding:

- `app/reset-password.tsx` and `app/onboarding.tsx` duplicate recovery handling.
  They currently accept hash tokens with `type=recovery`, but do not exchange a
  `code` query parameter. When the link arrives in that format,
  `canResetPassword` remains false and the form and Update button stay disabled.
- The standalone reset screen also treats any existing session as sufficient
  recovery proof, which should be tightened while preserving valid recovery
  links.

Implementation:

- Centralize recovery URL parsing and session establishment in one tested helper.
- Support both valid Supabase callback formats: authorization-code exchange with
  `exchangeCodeForSession(code)` and the legacy recovery access/refresh-token
  fallback used by existing emails/builds.
- Listen for the Supabase password-recovery auth event and accept only a verified
  recovery session, not an unrelated signed-in session.
- Route every recovery link to the dedicated reset screen and remove the
  duplicate inline reset form after backward-link handling is confirmed.
- Separate "verifying link", "ready", "expired/invalid", "saving", and
  "complete" states. Never leave the screen in an indefinite disabled state.
- Keep Back to Login usable when verification fails. Add a Request New Link
  action for expired links.
- Make the form keyboard-safe, add focus progression and submit behavior, and
  ensure the keyboard or loading overlay cannot intercept the buttons.
- After a successful update, clear the recovery session, sign out, clear
  account-scoped React Query state, and route to onboarding with a success
  message.

Configuration and tests:

- Verify the app scheme, Android intent filters, iOS associated link behavior,
  Supabase Site URL, and allowed redirect URLs all point to the same callback
  contract.
- Test a cold app, warm app, link opened twice, expired link, malformed link,
  code callback, legacy hash callback, network failure, and successful reset on
  both platforms.

Compatibility and rollout:

- Keep legacy token parsing for emails already sent and released builds. No
  database migration is expected; Supabase Auth URL configuration may need an
  additive redirect entry.

Done when:

- A valid reset email always enables the fields and buttons, an invalid link
  offers a recovery path, and a completed reset returns to onboarding where the
  new password works.

### 8. Support Password Managers and Platform Autofill

Implementation status:

- Implemented in the current worktree for admin/member signup, admin/member
  login, forgot-password, and reset-password fields. Native autofill metadata,
  focus progression, submit behavior, and new-password rules are centralized in
  `components/auth/AuthTextInput.tsx`.
- Physical Apple Passwords, Google Password Manager, and third-party manager
  checks remain. Website credential association remains optional until a
  verified public domain is identified.

Original finding:

- Password inputs currently use `secureTextEntry`, but the onboarding and reset
  forms do not consistently provide `autoComplete`, `textContentType`, or Android
  autofill hints. Password managers therefore cannot reliably identify login,
  signup, and reset fields.

Implementation:

- Create shared auth field wrappers so all admin login, member login, admin
  signup, member signup, forgot-password, and reset-password forms use consistent
  metadata.
- Mark identifier fields as email/username and pair them with the corresponding
  password field in the same form.
- Mark login passwords as current-password and signup/reset passwords as
  new-password using the correct React Native props per platform. Enable Android
  autofill with `importantForAutofill` where appropriate.
- Keep secure text entry, paste, reveal-password controls, return-key flow, and
  validation compatible with 1Password, Apple Passwords, Google Password
  Manager, and common third-party providers.
- If a verified public website domain is available, add the optional iOS
  `webcredentials` associated domain and matching
  `apple-app-site-association` file so website and app credentials can be shared.
  Do not block normal in-app autofill on that optional domain work.

Compatibility and rollout:

- Client/config-only unless website credential association is added. Any native
  entitlement change requires a new store build but does not affect older builds.

Done when:

- Users can generate/save a password during signup, fill it on later login, and
  fill or replace it during reset on physical Android and iOS devices without
  incorrect suggestions or fields being skipped.

### 9. Add Admin Bulk Deletion for Scheduled Services

Current finding:

- The app supports deleting one service at a time. There is no atomic range or
  multi-selection delete operation. Service comments already cascade on service
  deletion; every other dependent foreign key must be audited before batch work
  is allowed.

Implementation status:

- Implemented in the current worktree. Church now has a virtualized scheduled
  service manager with date-range and individual selection, Select All Visible,
  Clear, exact dependency previews, and a final destructive confirmation.
- Live migration `20260727004445_add_bulk_scheduled_service_deletion.sql` adds the
  admin-only preview/apply RPC, a 200-service limit, exact-ID apply behavior,
  church/service locks, complete dependent cleanup, and supporting indexes. It
  was deployed additively on 2026-07-26 and leaves all existing tables, RPCs,
  policies, single-service deletion, and recurring-service behavior unchanged.
- React Query removes applied IDs from every loaded schedule window immediately,
  while existing Realtime service and dependent-row deletes update other devices.
  The existing single-service delete path and recurring templates are unchanged.

Database implementation:

- Audit assignments, fill-in requests, comments/songs, sent-reminder records, and
  any notification references for service-delete behavior.
- Add an admin-only atomic RPC with separate preview and apply behavior. It
  accepts a church ID plus either a date range or explicit service IDs, validates
  church ownership, applies a conservative maximum batch size, and returns the
  exact matching services and dependent-row counts.
- Make apply delete the exact previewed service IDs, not a newly evaluated date
  range, so a service created after preview cannot be removed accidentally.
- Use a church-scoped transaction/advisory lock and roll back the entire
  operation if any service or dependent row cannot be removed.
- Keep the existing single-service delete path and all old client-facing table
  permissions unchanged.

Client implementation:

- Add a "Manage Scheduled Services" admin tool in Church, not in the member
  Schedules interface.
- Provide two modes: Select Date Range and Select Individual Services.
- For individual selection, show a virtualized, date-ordered list with
  checkboxes, Select All Visible, Clear Selection, and a selected count.
- Require a preview listing service name/date/time and dependent data that will
  be removed. Use a clear destructive confirmation containing the final count.
- On success, remove returned IDs from every matching React Query window.
  Realtime deletes must update other signed-in devices without a full reload.
- Preserve recurring templates. Deleting generated scheduled services must not
  delete their weekly recurring-service definitions.

Compatibility and rollout:

- Deploy the new RPC first. Verify released apps can still create and delete one
  service. Then release the new Church UI with a controlled missing-RPC error
  rather than a client-side partial-delete fallback.

Done when:

- Cross-church IDs and non-admin calls are rejected, preview and apply agree,
  dependencies are cleaned up, recurring templates remain, and a failure leaves
  all selected services intact.

### 10. Add Weekly-Service and Role Scheduling Preferences

Implementation status:

- Implemented in the current worktree. Both Profile implementations now show a
  shared role-grouped Scheduling Preferences card with meaningful weekly
  service-role combinations, optimistic auto-save, rollback, retry messaging,
  per-toggle progress, and Realtime refresh.
- Migration `20260727011634_add_weekly_service_role_preferences.sql` was
  deployed live on 2026-07-26. It adds nullable recurring-source tracking,
  unambiguous legacy inference/backfill, a normalized RLS-protected preference
  table, cascade cleanup, optional batch payload support, and a soft preference
  tier in the unchanged public auto-assign signatures.
- The deployed migration was verified with the SQL behavior suite inside a live
  transaction that was rolled back. Tests confirmed non-avoiding priority,
  preference fallback metadata, hard unavailable-date blocking, role-removal
  cleanup, and compatibility with released batch payloads. No test data was
  retained.
- Follow-up migration
  `20260727012039_index_member_scheduling_preference_role.sql` covers the
  composite role foreign key identified by Supabase's performance advisor.

Product rule:

- This is a soft preference, not an unavailable date. A hard unavailable date
  always blocks assignment. A preferred avoidance makes that member lower
  priority for that recurring service and role, but the member may still be used
  if no acceptable non-avoiding candidate can fill the slot.

Database implementation:

- Add a nullable `recurring_service_id` relationship to generated `services`.
  Existing one-off and legacy services remain valid with `null`.
- Extend new service-generation payloads to include the recurring template ID
  when known. Keep every existing RPC argument and JSON key optional so released
  apps continue creating services.
- Backfill existing services only when one recurring template matches
  unambiguously by church, service type, weekday, and time. Leave ambiguous rows
  null rather than guessing.
- Add a normalized preference table keyed by church member, recurring service,
  and church role, with a unique constraint and cascade behavior for deleted
  members/templates/roles.
- Enable RLS. Members may read and change only their own preferences and only for
  roles currently assigned to them. Church admins may read preferences needed
  for scheduling diagnostics. No anonymous access.
- Add the preference table to Realtime only if direct cross-device profile
  updates require it.

Client implementation:

- Add a Profile section titled "Scheduling Preferences".
- Group controls by the member's current roles and list the church's recurring
  weekly services under each role. Use clear toggles or checkboxes labeled
  "Prefer not to be scheduled" and auto-save each change with rollback on error.
- Hide roles the member does not hold. Remove or ignore a preference safely if
  an admin later removes that role or recurring service.
- Explain in concise product copy that preferences are considered when possible
  and unavailable dates remain the hard blockout mechanism.

Auto-assignment implementation:

- Update the private auto-assignment implementation without changing the public
  `auto_assign_service_slots` signature or existing response fields.
- Continue excluding unavailable members first.
- For each service-role slot, rank eligible non-avoiding members before avoiding
  members. Preserve the existing role-round fairness, past-quarter load,
  consecutive-role spacing, same-service-role rules, and deterministic
  tie-breaking inside each preference tier.
- Use an avoiding member only when the slot would otherwise remain open. Record
  that override in new optional preview/skipped-report metadata so admins can see
  why it happened without breaking old response parsing.
- Do not apply recurring preferences to one-off services or legacy services whose
  recurring source cannot be identified safely.

Compatibility and rollout:

- Deploy additive schema/RLS changes and the backward-compatible function update
  first. Run auto-assignment previews from both the released build and the new
  build before publishing the Profile UI.

Done when:

- Preferences are member-, church-, recurring-service-, and role-specific.
- Auto-assign honors hard unavailability, prefers non-avoiding eligible members,
  preserves fair role rounds, and uses an avoiding member only as the documented
  fallback.
- Old builds continue generating services and auto-assigning without errors.

### 11. Auto-Save Song-Type Changes

Implementation status:

- Complete in code and automated verification. Physical-device offline retry
  and cross-device Realtime checks remain.

Current finding:

- Church keeps a local `songTypeDraftOptions` array and writes the complete array
  only when the admin presses Save. The existing
  `update_church_song_type_options` RPC already supports ordered add/remove
  updates and can remain unchanged.

Implementation:

- Remove the Save button only after add and remove actions persist reliably.
- Make each valid Add or Remove update the local React Query cache immediately
  and enqueue the latest normalized option list for the existing RPC.
- Serialize writes or use a latest-state mutation queue so rapid add/remove
  actions cannot arrive out of order and restore an older list.
- Show a small Saving/Saved status near the Song Types heading. On failure,
  restore the last confirmed server value and show an actionable retry message.
- Keep validation for blank, duplicate, overlong, and reserved "Other" values.
  Keep at least one default song type.
- Let the existing church Realtime update refresh the type buttons on Schedules
  for other devices.

Compatibility and rollout:

- No migration should be needed. Released builds continue using the same RPC and
  still display the Save button against the latest stored array.

Done when:

- Adding or removing a type persists without Save, rapid edits cannot overwrite
  newer state, failures roll back visibly, and another device receives the
  updated Schedules choices through Realtime.

## Cross-Feature Release Gate

- Run password recovery and password-manager tests before any store build.
- Run modal and responsive-header screenshots on the full device matrix.
- Verify queued and saved song ordering on two devices, including one released
  build inserting a song after the migration.
- Preview and apply bulk deletion against test data containing assignments,
  fill-ins, comments, reminders, and notifications.
- Compare auto-assignment preview before and after preferences using members with
  unavailable dates, preference conflicts, multiple roles, and uneven historical
  loads.
- Run a released Android/iOS build against every deployed migration before
  publishing the new client.

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
