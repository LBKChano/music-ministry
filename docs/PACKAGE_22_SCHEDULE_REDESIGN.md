# Package 22: Schedule Redesign

## Implemented scope

Checkpoints 22A through 22J establish one shared Schedule screen for Android and
iOS, local view controls, virtualized month sections, compact service summaries,
responsive team rows, ordered song rows, focused notification history, and
explicit recovery states. The route files are thin exports, while the iOS widget
refresh remains in a platform-resolved hook. This removes visual and
mutation-handler drift without changing a Supabase mutation, policy, RPC, Edge
Function, push-recipient, event-key, or notification-delivery contract.

The shared screen adds device-local `All Services` and `My Schedule` views.
`All Services` remains the default. `My Schedule` includes services where the
current church member is assigned. Relevant pending fill-ins are separated into
`Needs Attention`, so filtering cannot hide a request the member can accept or
cancel. Admins retain visibility of every pending request.

The compact filter control narrows only the already loaded cache by service
type, assignment role, or the next 30/90 days. It shows the number of active
filters, supports one-tap clearing, and never changes pagination, queries,
widgets, notifications, or backend state.

## Month sections

One `SectionList` now renders `Needs Attention` followed by deterministic local
calendar-month sections. Services sort by date, time, and stable service id.
Date-only values are constructed in local time, so grouping cannot move a
service across a day or month at a timezone boundary. Refresh, loaded-range
pagination, stable service keys, and bottom tab-bar clearance are unchanged.

## Service summaries

Each service uses a restrained 8px surface with a stable weekday/day/month lane,
flexible service name and time, status lane, personal assignment summary, and
team/song/fill-in counts. Full team and song controls remain available through
device-local progressive disclosure. Pending fill-ins stay visible while the
details are collapsed. Admin service deletion moved from the title row to an
accessible overflow action followed by the existing confirmation.

## Team assignments

Assignments retain configured role order and display role first, followed by the
resolved member name or an explicit `Unassigned` state. Rows switch between
wide and stacked layouts from available width and text scale, never platform
name. Admin taps open the existing availability-safe candidate picker, which now
also shows the current assignment and routes clearing through the existing
confirmation. Members retain only their own fill-in request action and receive a
clear pending state after requesting one.

## Songs

Songs render as a stable numbered list with type, optional song number, title,
author, and date metadata. Authors can tap their own row to edit; non-authors get
no edit affordance. Admins and authors use a focused overflow surface for delete
and edit actions. Reorder mode keeps the existing mutation and rollback behavior
with full 44px controls, while long lists preview four songs and expose every
remaining song through `Show All`. The existing multi-song form and notification
selection are unchanged behind one icon-only Add Song action.

## Permission boundary

Only the current church owner or scheduling admin receives direct service and
assignment controls. Members retain the existing fill-in workflows and may add
songs; edit/delete controls remain limited to the song author or an admin. The
backend remains the authorization boundary.

## Fill-ins and notifications

Each pending fill-in appears directly below the service summary as one
responsive attention row. The row resolves the requester's existing display-name
fallback, role, optional reason, and the action available to the current member.
Accept and cancel commands retain the existing backend calls and add a local
in-flight guard, while the atomic acceptance RPC remains the concurrency boundary.

The Schedule bell now reads a dedicated unread-count query and opens a focused
notification-history route. History is fetched only on that route. One root-level
member notification synchronizer retains INSERT, UPDATE, and DELETE Realtime
cache convergence, while read updates continue writing the released `read_at`
column. Permission-disabled devices retain explicit Enable or Open Settings
actions, and direct/restored navigation has a safe return to Schedule.

## Schedule states

Initial bootstrap uses the shared full-screen app state. Once usable services
exist, refresh and range failures retain them. The shared list state resolver
distinguishes filter misses, no personal assignments, incomplete admin setup,
initial range failure, offline without cache, and a genuinely empty upcoming
schedule. Lost membership and recoverable church initialization errors have
separate routes and retry actions. Only the admin setup state exposes Church
Setup; members never receive an admin command. Notification permission education
is a one-time inline notice with explicit Enable and Not Now actions, never an
automatic operating-system prompt.

## Responsive copy

Schedule copy now uses one measured typography contract for service types,
member and requester names, roles, song and notification titles, month labels,
actions, and shared empty/error states. It chooses from a bounded readable font
range, packs complete words into an explicit line limit, disables native
hyphenation and mid-word wrapping, and applies visual ellipsis only after the
font floor is reached. The original source string remains the accessibility and
selectable value, so visual whitespace normalization never changes stored or
announced data.

Action and status lanes reserve their width before text measurement. Team and
fill-in rows use their measured card width plus font scale to decide whether to
stack. The pure layout matrix covers 320, 360, 375, 390, 430, 768, and 1024
point/dp widths, supported font scales, translated actions, long unbroken
tokens, compound names, apostrophes, accents, emoji, RTL text, and duplicates.

## Accessibility and interaction

Each service exposes one concise summary before its actions. Month and attention
sections, assignments, songs, fill-in alerts, disclosures, filters, notification
rows, and modal actions have explicit semantic roles, complete labels and hints,
and selected, expanded, disabled, checked, or busy states where relevant. The
reading order keeps information before its related action without grouping
interactive descendants into an inaccessible parent.

All Schedule interaction targets are at least 44 points/dp. Song ordering
announces successful position changes to VoiceOver and TalkBack, selected states
retain weight, shape, icon, or text cues beyond color, and meaningful foreground
colors meet normal-text contrast against their surfaces. Native Pressable and
Touchable controls remain keyboard and Voice Control reachable.

Disclosure transitions use a short layout animation only when the operating
system permits motion. Shared modals suppress their fade when Reduced Motion is
enabled, isolate the accessibility tree, focus the close control, support
accessibility escape and Android Back, dismiss the keyboard before actions,
respect safe-area layout, and keep one vertical scroll owner. Stable service
keys and maintain-visible positioning remain unchanged during expansion,
Realtime updates, and mutations.

## Compatibility

No backend deployment is required. Older builds continue using the unchanged
database and notification contracts. The view mode and filters are not persisted
and reset to `All Services` with no filters when the selected church changes,
preventing a previous choice from making another church appear empty.

All Package 22 implementation checkpoints are complete. Physical-device visual,
VoiceOver, TalkBack, Voice Control, keyboard, and release-build smoke passes
remain part of the release gate rather than a code checkpoint.
