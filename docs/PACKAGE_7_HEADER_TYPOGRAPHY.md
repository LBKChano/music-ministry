# Package 7: Deterministic Header Typography

Package 7 is a client-only shared UI change. It does not alter Supabase tables,
policies, RPCs, Edge Functions, query keys, or stored church and member names.

## Typography contract

- `primaryTitle` renders Schedule and Church titles.
- `profileName` keeps the selected membership's display name prominent.
- `secondaryChurchName` sizes Profile's church subtitle independently.
- Every variant defines one preferred size, one readable floor, a stable line
  height, and a deliberate `maxFontSizeMultiplier`.
- Visual text normalizes leading, trailing, repeated, and newline whitespace.
  Accessibility continues receiving the original full source value.

`AdaptiveHeaderText` chooses a size from stable inputs: the variant, normalized
text, current window width, reserved trailing-action width, and font scale. It
does not use native auto-fit or an `onLayout` state loop.

## Responsive behavior

- Schedule reserves the notification bell's 52-point lane.
- Profile reserves its 54-point identity surface independently of its names.
- Church reserves a stable 140-point lane for its three action buttons.
- Rotation, split-screen changes, and display changes recalculate directly from
  `useWindowDimensions`.
- Optional development diagnostics can be enabled with
  `EXPO_PUBLIC_HEADER_LAYOUT_DIAGNOSTICS=1`.

Package 8 owns word-boundary wrapping. Package 7 keeps the current two-line
native wrapping behavior while making size selection deterministic.

## Compatibility

The existing `ResponsiveTabHeader` props remain supported. Explicit typography
and trailing-width props are additive, and released app versions continue using
the unchanged backend.

## Verification

Run:

```sh
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint .
node --experimental-strip-types --test tests/*.test.mjs
EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo export --platform android
EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo export --platform ios
```

Physical release checks should compare Android and iOS at default and Larger
Text sizes on a small phone, current phone, large phone, landscape, split
screen, and tablet.
