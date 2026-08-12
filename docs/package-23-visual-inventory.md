# Package 23 Visual Inventory

Package 23 is a client-only theme foundation. It does not change Supabase,
authentication, routes, permissions, scheduling logic, notification contracts,
or persisted user settings.

## Baseline Surfaces

| Area | Current source | Semantic destination | Package |
| --- | --- | --- | --- |
| Main canvas | `colors.background` and hard-coded white | `colors.canvas` | 25 |
| Cards and grouped rows | `colors.card`, `colors.backgroundAlt` | `surface*` | 25-27 |
| Branded tab headers | hard-coded gradient and translucent controls | `header` | 23 |
| Floating navigation | hard-coded white/navy/slate | `navigation*` | 24 |
| Focused headers | `colors.headerBackground` or card surface | `modalHeader`/header tokens | 28 |
| Modals | caller-supplied legacy colors | semantic surfaces and status tokens | 28 |
| Service metadata | white cards with light-blue borders | `serviceMetadata` | 26 |
| Inputs | `colors.inputBackground` and local focus colors | `inputHighlight` | 28 |
| Login and splash marks | app icon, splash mark, and route-local artwork | `brandMark` | 28 |

## Existing Color Ownership

- 31 app/component files import the legacy `colors` object.
- The Church screen contains the largest concentration of local color values.
- `ResponsiveTabHeader`, `FloatingTabBar`, `AppModal`, onboarding/recovery, and
  feedback states each own additional hard-coded colors.
- Package 23 keeps `colors` as a compatibility adapter backed by the light
  semantic theme. It is retired only after Packages 24-28 migrate every listed
  consumer and a repository search finds no imports outside the adapter tests.

## Geometry and Behavior Contracts

- Tab headers retain safe-area padding, 24px lower corners, a reserved trailing
  action lane, two-line word-safe titles, metadata wrapping, and 42x42 controls.
- The current modal variants and viewport calculations remain unchanged.
- The floating tab bar keeps its current size and clearance until Package 24.
- Header titles must use the selected church and matching account membership
  from one ready session snapshot. Cached, renamed, switched, and Realtime
  church records must update the same selected object.

## Verification Matrix

- Widths: 320, 375/390, 430, 768/1024, and landscape split view.
- Text: default, 1.35x, and maximum supported header scaling.
- Names: short, long multiword, long single-token, punctuation, accents, and RTL.
- States: initial restore, ready, rapid church switch, rename, Realtime rename,
  stale cache replacement, missing membership, and admin action lanes.
- Themes: active light tokens and inactive future-dark tokens are both checked
  for completeness and meaningful text/status contrast.
