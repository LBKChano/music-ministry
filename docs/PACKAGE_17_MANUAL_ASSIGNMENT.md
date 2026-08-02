# Package 17: Manual Assignment

Package 17 makes manual assignment role-aware and enforces unavailable dates at
the database boundary. It is additive and remains compatible with released app
versions.

## Client flow

1. An admin opens an assignment slot from either Schedule route.
2. The shared picker calls `get_manual_assignment_candidates_v1` for that slot.
3. Available same-role members appear first in deterministic name order.
4. Blocked same-role members remain visible under `Unavailable` with a friendly
   date or same-service reason.
5. Confirming calls `assign_member_to_slot_v2`, which reloads and validates the
   current database state before writing.
6. The existing assignment cache, Realtime reconciliation, and fill-in trigger
   process the successful row exactly as before.

The new client never treats weekly-service scheduling preferences as a hard
manual-assignment block. A member's explicit unavailable date is always a hard
block.

## Database contract

The production migrations are:

- `20260802003206_add_role_aware_manual_assignment.sql`
- `20260802004552_fix_role_aware_manual_assignment_builtin_calls.sql`
- `20260802004700_fix_manual_assignment_service_date_contract.sql`

The public RPC wrappers are security invokers with a fixed empty `search_path`.
Their private implementations are security definers with the same fixed search
path, fully qualify database objects, and recheck the caller's church-admin
authority. Execution is revoked from `PUBLIC` and `anon` and granted only to
`authenticated`.

Existing assignment tables, policies, triggers, RPCs, and direct update grants
remain unchanged for released clients. The new RPCs may remain deployed if the
new client build is rolled back.

## Verification

`supabase/tests/role_aware_manual_assignment.sql` runs inside a transaction and
rolls back its fixtures. It proves valid assignment and rejects non-role,
unavailable, cross-church, unauthorized, stale-date, deleted-member, and
same-service-conflict cases. The test also covers duplicate display names and an
owner/admin who holds a ministry role.

Run the local Package 17 gate with:

```sh
pnpm verify:package17
```

Before publishing the client, verify on physical Android and iOS devices:

- Available and unavailable sections display correctly for a role.
- Unavailable rows explain the service date and cannot be selected.
- Duplicate names remain selectable as distinct members.
- Reassignment updates every signed-in device and resolves related fill-in
  state through the existing trigger.
- Clearing an assignment still works.
- A service or role changed while the picker is open produces a friendly error,
  refreshes candidates, and leaves the modal usable.
- Church switching cannot apply a picker opened for the previous church.
- The same-service duplicate rule follows the church setting.
