# Performance Package 7: Rerender Isolation

## Compatibility Gate

This package is a client-only rendering refactor. It does not change:

- Supabase tables, columns, migrations, RLS policies, or Realtime publication.
- RPC names, arguments, return values, or auto-assignment behavior.
- Edge Function URLs, request bodies, responses, or JWT settings.
- OneSignal identity, subscription, or notification delivery logic.
- The existing `useChurch()` hook or its returned fields and functions.

Previously released app versions continue using the same backend contracts.

## Schedule Card Boundary

Android and iOS now render the same memoized `ScheduleServiceCard` component.
The component receives the existing service object, only that service's pending
fill-in requests, stable member/role lookup data, and stable action callbacks.

The memo boundary rerenders a card when data that can change that card changes:

- The service object changes because its service fields, assignments, or songs
  changed.
- A pending fill-in request for that service changes.
- Member display names, the current member, current roles, or admin access change.
- A schedule action callback or platform layout changes.

Typing in the song modal, changing draft fields, opening an unrelated modal, or
other parent state changes no longer recreate every visible service card.

The component preserves platform behavior:

- Android uses the existing stacked assignment row with actions below the names.
- iOS uses the existing compact inline assignment row.
- Add, edit, and delete song actions are unchanged.
- Request, accept, and cancel fill-in actions are unchanged.
- Admin assignment, clearing, and service deletion actions are unchanged.

## Derived Data

Each schedule screen now computes shared data once per relevant source update:

- Pending fill-in requests are grouped by service ID once instead of filtering
  the complete request list inside every card render.
- Member display names are indexed once by member ID.
- Current-member role names use a set for constant-time fill-in eligibility checks.
- Existing role sorting and upcoming-service filtering remain memoized.
- `FlatList.renderItem` is a stable callback on Android and iOS.

## Context Isolation

`ChurchContext` now memoizes its complete public value. Refresh callbacks depend
on stable account and church IDs rather than complete row objects.

A new `useChurchSession()` hook exposes only:

- Current church.
- Signed-in user.
- Current church member.
- Admin status.
- Church loading and error state.

The root navigation shell, Android and iOS tab layouts, and notification bell use
this smaller context. They no longer rerender because a role list, recurring
service, fill-in request, or notification setting collection changed. Existing
callers of `useChurch()` are unchanged.

## Verification

Completed on July 26, 2026:

- `tsc --noEmit`
- Full ESLint run: zero errors; one unrelated existing `Array<T>` style warning
  in `supabase/functions/delete-account/index.ts`
- Direct Deno checks for all five Edge Functions
- Android production Expo export
- iOS production Expo export
- `git diff --check`

No Supabase deployment is required for this package.

## Physical-Device Checklist

1. Open Schedules with enough services to render multiple cards.
2. Open Add Song and type several characters; verify list scrolling remains
   responsive behind and after the modal.
3. Add, edit, and delete a song and verify only the affected service changes.
4. Manually assign and clear a member and verify the affected card updates.
5. Create, accept, and cancel fill-in requests on two devices.
6. Rename a member and verify the new display name appears where required.
7. Add or remove the current member's role and verify fill-in eligibility updates.
8. Change admin access and verify tab visibility and schedule controls update.
9. Run the development performance baseline before and after these actions and
   record schedule render counts for comparison.
