# Package 18: Role-Scoped Auto-Assignment

Package 18 lets an admin run Fill Empty Slots or Reassign All for every role or
one active church role. The implementation is additive and compatible with
released app versions.

## Client workflow

1. Open Fill Empty Slots or Reassign All Upcoming Slots.
2. Choose `All Roles` or `Specific Role`.
3. When using a specific role, choose one church role before generating the
   preview.
4. Choose the existing date or visible-service range and generate the preview.
5. Review the selected scope, counts, assignments, and skipped-slot report.
6. Confirm using the preview token returned by Supabase.

Changing the role, range, mode inputs, services, members, or assignment state
changes the local preview identity. The database also recomputes the plan before
apply and rejects a stale token without writing.

## Database contract

The production migration is:

- `20260802005940_add_role_scoped_auto_assignment.sql`

It adds these APIs without replacing the released allocator:

- `private.auto_assign_service_slots_v2_impl(...)`
- `public.auto_assign_service_slots_v2(...)`

The public wrapper is a security invoker. The private implementation is a
security definer that retains the existing church-admin authorization check.
Both use a fixed search path; `PUBLIC` and `anon` execution are revoked, and
only `authenticated` is granted execution.

For one-role Reassign All, only matching role rows are cleared and rebuilt.
Assignments for every other role remain stored and are still considered for
same-service conflicts and total-load fairness. Past schedule history remains
available to the existing role rounds, spacing, unavailability, preference, and
fairness rules.

## Preview integrity

The public v2 RPC always creates a dry-run plan under the church advisory lock.
Apply requires its token, recomputes the plan, and refuses stale input before
writing. After applying, it compares the committed slot/member plan and all
counts against the approved preview. Any divergence raises an error and rolls
back the transaction.

## Verification

Run the local Package 18 gate with:

```sh
pnpm verify:package18
```

The production SQL test is
`supabase/tests/role_scoped_auto_assignment.sql`. It creates an isolated church,
executes the released and v2 allocators, and rolls back every fixture.

No new expression index was added. The production `EXPLAIN` plan had a small
estimated cost for the current data volume, and Supabase's performance advisor
reported no Package 18 finding.

Before publishing, verify on physical Android and iOS devices:

- All Roles produces the same preview as the previous workflow.
- Each role can preview and apply Fill Empty and Reassign All.
- A role choice survives range changes while invalidating only the old preview.
- Unavailable and no-candidate slots retain their detailed explanations.
- Unselected role assignments do not change during scoped Reassign All.
- A deleted role or concurrent schedule change shows friendly recovery copy and
  writes nothing.
- Long role names, Larger Text, TalkBack, VoiceOver, and small screens can reach
  every scope, preview, and confirmation control.
