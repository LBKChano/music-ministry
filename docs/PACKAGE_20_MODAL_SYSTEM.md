# Package 20 Modal System

Package 20 is client-only. It changes popup presentation without changing routes,
Supabase schema, mutation payloads, validation, cache keys, or persisted data.
Released app versions continue to use their existing UI against the same backend.

## Shared Contract

- `confirmation`: compact content-sized destructive or irreversible prompts.
- `form`: short editors with a stable body and fixed action footer.
- `long-content`: previews, lists, and multi-step editors using the largest safe
  viewport area. A nested `SectionList` or `FlatList` becomes the only vertical
  scroll owner by setting `bodyScroll={false}`.
- Width and height derive from the safe-area-adjusted resting viewport. Small
  phones use 12-point outer margins; other layouts use 16-point margins.
- Header, close control, radius, backdrop, body spacing, disabled/loading state,
  destructive color, Android back, iOS accessibility escape, and focus return
  are owned by `AppModal`.
- A backdrop or close attempt dismisses the keyboard first. Busy actions lock
  dismissal. Actions stay outside the scrolling body and stack for narrow
  screens or Larger Text.

## Inventory

| Surface | Popup | Variant | Scroll owner | Keyboard / draft behavior |
| --- | --- | --- | --- | --- |
| Schedule Android/iOS | Add or edit songs and recipients | Long content | AppModal | Interactive/on-drag dismissal; fixed Post action |
| Schedule Android/iOS | Request fill-in | Form | AppModal | Reason remains editable; fixed Request action |
| Schedule Android/iOS | Manual member assignment | Long content | SectionList | Candidate refresh remains mounted |
| Schedule Android/iOS | Delete service / clear assignment | Confirmation | Content-sized | Destructive action remains explicit |
| Shared header | Notification center | Long content | AppModal | Realtime/read-state behavior unchanged |
| Notification onboarding | Permission explanation | Form | AppModal | Loading lock while opening system permission |
| Profile | Sign out | Confirmation | Content-sized | Loading lock and account navigation unchanged |
| Church | Create/rename church; role/service/member editors | Form/long content | AppModal | Inputs and role selection retain local drafts |
| Church | Delete member/role/weekly service | Confirmation | Content-sized | Impact checks and destructive handlers unchanged |
| Church | Bulk scheduled-service deletion | Long content | FlatList | Date picker uses draft then explicit confirm |
| Church | Prepare quarter | Long content | AppModal | Step-specific fixed footer; date/time draft then confirm |
| Church | Auto-assignment preview | Long content | SectionList | Preview key, scope, range, and apply handler unchanged |

Native operating-system permission dialogs, React Native `Alert` messages, and
the platform `DateTimePicker` surface keep their native presentation. They are
not app-owned modal wrappers.

## Release Matrix

Before store submission, exercise every row above on a small and large Android
phone, current and oldest-supported iPhone, and tablet. Repeat with keyboard
open, landscape, display scaling, Larger Text, TalkBack/VoiceOver, Android back,
outside tap, loading, error, and destructive states. Confirm long lists scroll
while their final action remains visible.
