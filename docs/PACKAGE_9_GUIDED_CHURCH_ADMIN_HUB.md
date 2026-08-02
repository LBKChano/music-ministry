# Package 9: Guided Church Admin Hub

Package 9 reorganizes the Church tab around two destinations: Church Setup and
Schedule Management. It preserves existing scheduling behavior and released
client database paths while adding atomic RPCs for new editor saves.

## Admin Hub

The overview derives readiness from current church data. No setup-completion
column or flag is stored. Church Details, Roles, and Weekly Services are the
core prerequisites. Members, Scheduling Rules, Song Types, and Reminder
Settings remain available without blocking the rest of the app.

Focused destinations include:

- Church Details
- Roles
- Weekly Services
- Members
- Scheduling Rules
- Song Types
- Reminder Settings
- Prepare Services
- Assign Members

The Schedule empty state links an incomplete admin to Church Setup. Successful
onboarding still lands on Schedule.

## Atomic Operations

Migration `20260730035223_guided_church_admin_atomic_operations.sql` adds:

- `save_church_member_admin`
- `save_recurring_service_admin`
- `save_church_role_admin`
- `reorder_church_roles_admin`
- `upsert_church_notification_settings_admin`
- `preview_church_admin_delete_impact`

Each public function has an authenticated-only invoker wrapper. Private
implementations derive the caller from `auth.uid()`, verify target-church admin
access, validate submitted IDs, and use an empty fixed search path. Existing
tables, policies, functions, and direct write paths are unchanged.

The additive migration was deployed to the live Supabase project on 2026-07-29
as recorded migration version `20260730035223`. Currently released builds
continue using their existing paths normally.

## Preserved Workflows

- Prepare Next Quarter
- Add Single Service
- Atomic bulk scheduled-service deletion
- Fill Empty Slots and Reassign All
- Assignment ranges, previews, skipped reports, preferences, unavailable dates,
  fairness, and confirmation
- Role, weekly-service, member, song-type, reminder, and scheduling-rule edits

Reminder Settings now show only Active/Paused state, selected reminder times,
and local save status. Cron and polling details are intentionally absent.

## Verification

The exact migration was compiled and exercised in an isolated in-memory
PostgreSQL instance. All six atomic operations passed, together with
cross-church denial, owner-demotion protection, invalid-input rollback, and
authenticated-only function grant checks. TypeScript, full ESLint, all 172
automated tests, and Android/iOS production Metro exports pass.

Run:

```sh
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint .
node --experimental-strip-types --test tests/*.test.mjs
npm exec --yes supabase@latest -- db lint --linked
EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo export --platform android
EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo export --platform ios
```

The linked database inventory confirms that the live tables, columns, unique
constraint, and `private.is_church_admin` dependency match the migration's
assumptions. The live linter still reports older findings in
`private.auto_assign_service_slots_impl` (its temporary table is not visible to
the static analyzer), `public.delete_account` (a stale `user_id` reference),
and unrelated file helper functions. Package 9 does not alter those live
objects.

Post-deployment checks confirm all 12 functions have fixed search paths,
authenticated-only execution, six public invoker wrappers, and six private
definer implementations. The public table count, public column count, and 29
legacy policies on affected tables remained unchanged. Live read-only impact
previews succeeded for an existing owner, member, and role.

Smoke-test the currently released Android and iOS builds before publishing a
Package 9 client.
