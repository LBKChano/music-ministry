# Package 13: Scheduling Preference Editor

## What Shipped

- Profile now shows one concise `Scheduling Preferences` row instead of the
  complete role-by-service switch list.
- A shared Android/iOS full-screen editor groups every meaningful weekly
  service beneath the member role it uses.
- Each switch saves immediately. The selected row shows progress, successful
  changes are announced, and a failed change restores the previous cache value
  with a visible Retry action.
- Preference state includes written labels as well as switch position and
  accessibility state, so it does not rely on color alone.
- The editor clearly distinguishes soft preferences from hard unavailable
  dates.

## One State and Mutation Path

Package 13 continues to use only `useSchedulingPreferences`.

- Profile and the focused editor share the same account/church/member React
  Query key.
- `useIsFocused` ensures only the visible screen owns the Realtime subscription.
- The existing direct INSERT/DELETE operations, optimistic cache update,
  rollback, table subscription, and channel cleanup remain in that hook.
- One mutation runs at a time so every failed change retains its own retry
  state.
- The account/church/member operation scope is captured before a mutation.
  Late completion from a previous scope can update only its original query
  cache; it cannot change the pending, error, or success state now visible for
  another membership.
- Navigation is guarded while an immediate save is in progress.

## Backend Compatibility

Package 13 is client-only. It adds no migration, RPC, table, column, policy,
trigger, or Realtime dependency.

Live Supabase verification confirmed:

- `member_scheduling_preferences` still has RLS enabled with its authenticated
  SELECT, INSERT, and DELETE policies.
- The table remains in the `supabase_realtime` publication.
- Removing a member role or recurring service still deletes its preference rows
  through the existing cascading foreign keys.
- The private auto-assignment implementation still checks hard unavailable
  dates first, reads soft preferences by recurring-service and normalized role,
  emits `preference_override`, and includes three months of assignment history.
- Two identical live 90-day dry-run previews matched inside one rolled-back
  transaction. The selected church supplied 73 hard unavailable-date rows and
  115 recent historical assignments.

The final live check created a valid role/service soft preference inside a
transaction, confirmed that two identical dry-run previews matched and read
the preference, then rolled the transaction back. No Package 13 test data was
persisted. Two genuine preference rows existed after that rollback and were
left untouched.

Released Android and iOS clients retain their existing direct table/RLS
contract.

## Physical Release Checks

1. Enable and disable preferences for several roles on Android and iOS.
2. Force a network failure, confirm the switch rolls back, then reconnect and
   use Retry.
3. Press Back during a save and confirm the editor waits for completion.
4. Switch between two church memberships and verify each summary and editor
   shows only its own preference rows.
5. Remove a member role and a weekly service as an admin, then confirm the
   member editor no longer shows those combinations.
6. Compare auto-assignment previews with no preference, one soft preference,
   a hard unavailable date, and uneven recent assignment history.
7. Test TalkBack, VoiceOver, Larger Text, a small Android phone, and an older
   iPhone layout.
