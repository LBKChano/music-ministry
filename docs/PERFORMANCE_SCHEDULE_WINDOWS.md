# Schedule Windows

Performance package 3 bounds normal schedule loading without changing any live
Supabase contract.

## Loading Model

- The Schedules and Church tabs initially request services from today through
  the next 89 days.
- Each additional request loads the next non-overlapping 90-day window.
- Every account, church, and date range has an independent React Query key.
- Results from loaded ranges are merged by service ID and sorted by service date
  and time.
- Assignments and service comments remain joined into the service query, so the
  app does not issue one request per service.
- Pull to refresh refetches only the ranges currently loaded for that church.

The previous unbounded `useServices(churchId)` mode remains available for
untouched callers. Current schedule surfaces opt into bounded loading with
`useServices(churchId, { windowed: true })`.

## User Behavior

- The schedule header shows the last successfully loaded date.
- `Load Next 90 Days` appends the next cached range without hiding already loaded
  services.
- A failed range shows a retry action and cannot be skipped accidentally.
- Creating a service outside the loaded period adds the required intervening
  windows so the new service can appear.

## Auto-Assignment

Auto-assignment preview and apply operations continue calling
`auto_assign_service_slots` with their existing target dates or service IDs.
The database function reads the previous three months of assignments itself.
Client schedule history is therefore not used for fairness calculations.

In the Church tab, `Visible Services` means the currently loaded windows
(initially 90 days). Admins can use `Next Quarter` or `Selected Date Range` for
server-side assignment beyond that visible period.

## Live Verification

A read-only aggregate query on July 26, 2026 returned:

- 224 total service rows
- 62 service rows in the current 90-day window

This confirms the initial query reads roughly 28 percent of the current service
history while retaining all assignments and comments for the visible period.
No production rows or schema objects were changed.

## Compatibility

This package adds only client-side filters and UI controls. It does not change
tables, columns, RLS policies, RPC signatures, Edge Functions, realtime payloads,
or notification behavior. Older installed app versions continue using the same
Supabase backend.

## Verification Completed

- range boundary test across consecutive 90-day windows
- application TypeScript check
- full ESLint check with zero errors
- all Supabase Edge Function Deno checks
- Android production Expo export
- iOS production Expo export
- read-only production aggregate query
- whitespace and patch validation

The repository still has one unrelated ESLint style warning in
`supabase/functions/delete-account/index.ts`. Physical interaction testing is
pending because this workspace has no Android device bridge or iOS simulator
tooling.
