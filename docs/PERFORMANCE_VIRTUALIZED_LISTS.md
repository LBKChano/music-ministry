# Performance Package 6: Virtualized Lists

## Scope

This package reduces rendering and memory pressure in the two longest app views:

- The Schedules tab on Android and iOS.
- The auto-assignment schedule preview and skipped-slot report.

It changes only client rendering. There are no database migrations, RLS changes,
RPC changes, Edge Function changes, or Supabase API contract changes. Older
installed app versions remain compatible.

## Schedule Lists

Both schedule implementations now use `FlatList` instead of mounting every
service card inside a `ScrollView`.

- Service IDs are stable list keys.
- Five rows render initially and per batch.
- The render window is limited to seven viewports.
- Live cache updates preserve the currently visible position.
- Pull-to-refresh, empty and error states, load-more controls, admin service
  creation, service deletion, songs, assignments, fill-in requests, and comment
  actions remain available.
- Existing bottom content padding remains in place so the floating tab bar does
  not cover the final controls.

Service cards intentionally remain variable height because their assignment,
song, comment, and fill-in content varies. Fixed row measurements and aggressive
clipping were not enabled because they can produce incorrect offsets or clipped
content for these cards.

## Auto-Assignment Preview

The bounded auto-assignment modal now uses one `SectionList`:

- The existing range controls, optional date pickers, preview action, and summary
  statistics are the list header.
- Assignment changes form the `Schedule Preview` section.
- Unassigned slots form the `Skipped Slots` section.
- Assignment IDs provide stable keys for both section types.
- Preview rows are memoized and format their date and time once per render.
- Ten rows render initially, eight per batch, with a seven-viewport window.

The modal header and Cancel/Confirm footer remain outside the virtualized list.
The modal therefore keeps its previous maximum size while the full preview can be
scrolled and the confirmation action remains reachable.

## Verification

Completed on July 26, 2026:

- `tsc --noEmit`
- Full ESLint run: zero errors; one unrelated existing `Array<T>` style warning
  in `supabase/functions/delete-account/index.ts`
- Direct Deno checks for all five Edge Functions
- Android production Expo export
- iOS production Expo export
- `git diff --check`

## Physical-Device Checklist

Run this before release with a church containing several months of services and a
large assignment preview:

1. Scroll rapidly from the first to the final schedule card on Android and iOS.
2. Pull to refresh, load another 90-day range, and confirm the list does not jump
   unexpectedly after a realtime assignment or comment update.
3. Add, edit, and delete a song on a service away from the top of the list.
4. Request and accept a fill-in, then confirm the affected service updates.
5. Open both auto-assignment modes and generate a long preview.
6. Scroll through all preview and skipped rows while the modal remains responsive.
7. Change the assignment range, regenerate, and confirm the new result.
8. Confirm Cancel and Confirm stay visible and work on small and large screens.
