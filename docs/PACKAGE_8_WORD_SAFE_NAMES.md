# Package 8: Word-Safe Church Names

Package 8 is a client-only rendering change built on Package 7. It does not
alter Supabase data, validation, policies, RPCs, Edge Functions, query keys, or
the original church-name value.

## Rendering contract

- `WordSafeHeaderText` disables Android hyphenation and uses simple native line
  breaking on Android and no automatic line-break strategy on iOS.
- Branded headers use a pure token-boundary layout to produce at most two
  intentional visual lines.
- A normal multi-word name breaks only between complete whitespace-delimited
  tokens.
- A genuinely overlong single token first uses Package 7's readable font-size
  floor and then stays on one ellipsized line.
- Compact pills and metadata remain deliberately single-line.

The layout retains both `sourceText` and normalized `displayText`. Visual
whitespace is normalized, while accessibility labels, church selection,
copying actions, queries, and writes continue using the original source value.

## Shared surfaces

- Schedule and Church primary titles through `AdaptiveHeaderText`.
- Profile's secondary church title.
- Profile's cross-church selector.
- Church tab church-selection rows.

Punctuation, accents, apostrophes, hyphens, emoji, and right-to-left token order
remain intact because the renderer never splits inside a token.

## Compatibility

No migration or deployment is required. Existing and released clients continue
using the same backend contracts and stored names.

## Verification

Run:

```sh
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint .
node --experimental-strip-types --test tests/*.test.mjs
EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo export --platform android
EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo export --platform ios
```

Physical screenshot checks should compare the same fixture names on Android
and iOS at default and Larger Text sizes.
