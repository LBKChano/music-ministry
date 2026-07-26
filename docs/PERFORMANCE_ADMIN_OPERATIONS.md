# Heavy Admin Operations

Performance package 9 reduces network round trips during auto-assignment,
quarter creation, manual reassignment, and multi-song posting while preserving
all existing app and backend contracts.

## Compatibility

- Production migration `20260726220926_batch_heavy_admin_writes` is additive.
- No table, column, RLS policy, existing RPC, Realtime publication, or Edge
  Function contract was removed or changed.
- Older app versions continue using their existing individual insert and update
  requests.
- New app versions use the batch RPCs when available. They fall back to the old
  write paths only when PostgREST reports that a batch function is missing.
- Authorization remains church-scoped. Both batch implementations verify the
  signed-in user is a church admin and reject member IDs or assignments from a
  different church.

## Request Model

| Operation | Previous write requests | Package 9 write requests |
| --- | ---: | ---: |
| Auto-assign preview | 1 RPC every time | 1 RPC when inputs changed; 0 when unchanged |
| Apply auto-assign preview | 1 atomic RPC | 1 atomic RPC |
| Create `N` quarter services with slots | Up to `2N` | 1 atomic RPC |
| Update `N` assignments through the batch helper | `N` | 1 atomic RPC |
| Add `N` songs, then notify | `N` inserts + 1 function | 1 insert + 1 function |

Reads used by React Query after a mutation are not included in the write-request
column. Active schedule windows are refreshed once after a successful batch
instead of after every inserted service or assignment.

## Auto-Assignment

- Preview and apply still call the existing `auto_assign_service_slots` RPC.
- Only the selected start/end range or selected service IDs are sent by the app.
- Fairness history remains server-owned; the RPC reads the required past-quarter
  assignments without downloading them into the visible schedule.
- A deterministic preview fingerprint covers church, mode, selected range,
  multiple-role setting, visible services and assignments, and eligible members
  and roles.
- Pressing Preview again with the same fingerprint reuses the current result.
- Apply is rejected when the schedule, members, range, mode, or setting changed
  after preview generation.

## Atomic Writes

`create_services_with_assignments_batch` creates all selected recurring and
special services and their open role slots in one database transaction.
`update_assignments_batch` validates and updates all submitted assignments in one
transaction. Both operations take a church-scoped advisory transaction lock so
two admin devices cannot interleave the same class of batch write.

Quarter generation, preview/application, and manual reassignment now expose a
controlled busy state. Destructive modal controls and repeated assignment taps
are disabled until the active request completes.

## Regression Coverage

`pnpm test:admin` verifies:

1. Unchanged assignment previews have stable fingerprints.
2. Assignment, range, and church-setting changes invalidate a preview.
3. Legacy fallback is allowed only for a genuinely missing RPC.
4. Service deletion removes the row from every cached date window.
5. Manual reassignment updates one cached assignment without duplicates.
6. Fill-in acceptance updates status and resolves the accepting member name.
7. Duplicate song and notification Realtime payloads remain idempotent.
8. Account-scoped cache cleanup cannot remove another account's data.

The suite currently contains nine passing tests because preview invalidation is
split across assignment and range/settings cases.

## Verification

Completed on 2026-07-26:

- TypeScript: pass
- ESLint: pass with zero errors and zero warnings
- All five Supabase Edge Function Deno checks: pass
- Admin and notification regression suite: 11/11 pass
- Android production export: pass
- iOS production export: pass
- Live migration rollback exercise: pass; no test services remained
- Supabase security and performance advisors: no findings introduced by this
  migration

## Physical Release Check

The workspace has no connected Android or iOS device, so device load time,
memory, rerender counts, push delivery, and two-device Realtime behavior are not
claimed as measured here. Repeat `docs/PERFORMANCE_BASELINE.md` on physical
devices, then verify:

1. Generate a long preview, scroll through it, apply it, and confirm one
   consistent schedule on a second admin device.
2. Generate a quarter and confirm every service and role slot appears together.
3. Delete a service and confirm it disappears on both devices and after reload.
4. Reassign a member and accept a fill-in; confirm names and assignments update
   on both devices.
5. Add several songs in one post, notify an assigned member, then edit and delete
   a song.
6. Switch accounts and churches; confirm cached data and notifications belong
   only to the active account.
7. Capture the Android, iOS, and two-device performance reports for the final
   before/after comparison.

## Rollback

The migration file contains reviewed drop statements for the four new public and
private functions. Rolling back removes only the new acceleration path; new app
versions then use their missing-function fallback and older versions continue
unchanged.
