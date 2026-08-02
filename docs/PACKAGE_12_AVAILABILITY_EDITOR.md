# Package 12: Availability Summary and Editor

## What Shipped

- Profile now shows one concise `Unavailable Dates` row with the number of
  future hard blocks and the next three dates.
- A focused full-screen calendar editor owns the draft, status, retry, and
  save workflow.
- The editor uses the same 90-day horizon as schedule loading.
- Every saved date outside the visible horizon remains in the draft and is
  included in Save, so hidden rows are never deleted accidentally.
- Selected dates include a checkmark and checkbox accessibility state rather
  than relying on red alone.

## Date Correctness

- Calendar boundaries use the shared local `YYYY-MM-DD` formatter.
- No availability code converts a date-only value through `toISOString()`.
- Local-midnight, Chihuahua timezone, leap-day, and seasonal-clock fixtures
  are covered by automated tests.

## Draft and Consistency Rules

- Server rows initialize one membership-keyed React Query cache.
- Taps modify only a local `Set` until Save.
- Back, swipe dismissal, and Cancel warn before discarding a changed draft.
- Navigation is also blocked while Save is running.
- Save uses the existing `saveUnavailableDates(memberId, dates)` action once,
  refetches, and compares the exact persisted set before confirming success.
- Empty drafts are valid and clear every saved unavailable date.
- Late responses are ignored after account, church, or membership changes.
- A failed refresh retains the last good set and reports a sync error.

## Backend Compatibility

Package 12 is client-only. It adds no migration, RPC, table, column, policy, or
Realtime dependency.

Live Supabase verification confirmed:

- `member_unavailability.unavailable_date` remains a non-null Postgres `date`.
- Existing member and admin RLS policies remain enabled.
- Auto-assign still checks
  `member_unavailability.unavailable_date = services.date` exactly.
- Two identical live dry-run previews produced identical results inside a
  rolled-back transaction.

Released Android and iOS clients retain their existing direct table/RLS path.

## Physical Release Checks

1. Save one date, several dates, and an empty draft on Android and iOS.
2. Try Back, swipe dismissal, and Cancel with unsaved changes.
3. Edit while offline, reconnect, retry, and verify the draft remains.
4. Edit the same membership from two devices and confirm the conflict message.
5. Switch between an admin church and a member church and verify dates never
   cross membership boundaries.
6. Test TalkBack, VoiceOver, Larger Text, small Android, and older iPhone
   layouts.
