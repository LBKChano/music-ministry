# Package 6: Refresh and Initial Loading

Package 6 is a client-only state-management change. It does not add or alter
Supabase tables, policies, RPCs, Edge Functions, query keys, or stored values.

## Behavior

- `initializing` remains the blocking Auth/church startup and transition state.
- `refreshing` represents background Church-context synchronization.
- Schedules and Church use a screen-local refresh controller for the native
  pull indicator and a concise inline error notice.
- Populated content stays mounted while background reads run, preserving list
  position, open modals, and local drafts.
- Refreshes for the same account, church, and resource share one in-flight
  promise. Church Realtime invalidations use the same resource keys.
- Failed background reads retain the last successful current-member and
  notification-settings state.

The existing `loading` context field remains as an alias for `initializing` so
existing code keeps its source-level contract.

## Compatibility

Released Android and iOS builds continue using the unchanged Supabase schema,
queries, RPCs, and Edge Functions. No live deployment is required for this
package.

## Verification

Run:

```sh
./node_modules/.bin/tsc --noEmit
node --experimental-strip-types --test tests/*.test.mjs
./node_modules/.bin/eslint contexts/ChurchContext.tsx hooks/useServices.ts \
  hooks/useRefreshController.ts lib/query/refresh-coordinator.ts \
  components/RefreshErrorNotice.tsx app/\(tabs\)/church.tsx \
  app/\(tabs\)/\(home\)/index.tsx app/\(tabs\)/\(home\)/index.ios.tsx \
  app/\(tabs\)/profile.tsx app/\(tabs\)/profile.ios.tsx
```

Physical release checks should cover rapid repeated pulls, a Realtime update
during a pull, offline refresh with populated data, sign-out during refresh,
and Android/iOS scroll and modal preservation.
