import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const androidRoute = read('app/(tabs)/(home)/index.tsx');
const iosRoute = read('app/(tabs)/(home)/index.ios.tsx');
const screen = read('components/schedules/schedule-screen.tsx');
const widgetLifecycle = read('components/widgets/schedule-widget-lifecycle-sync.ios.tsx');
const card = read('components/schedules/schedule-service-card.tsx');
const notificationBell = read('components/NotificationBell.tsx');
const notificationHistory = read(
  'components/schedules/schedule-notifications-screen.tsx',
);
const notificationHook = read('hooks/useMemberNotifications.ts');
const permissionOnboarding = read(
  'components/notifications/NotificationPermissionOnboarding.tsx',
);
const appModal = read('components/ui/app-modal.tsx');
const viewControls = read('components/schedules/schedule-view-controls.tsx');
const filterModal = read('components/schedules/schedule-filter-modal.tsx');

test('Android and iOS routes render one shared Schedule tree', () => {
  assert.equal(androidRoute, iosRoute);
  assert.match(androidRoute, /schedule-screen/);
  assert.match(screen, /implementation: 'shared'/);
  assert.doesNotMatch(screen, /useScheduleWidgetSync/);
  assert.match(widgetLifecycle, /useScheduleWidgetSync/);
  assert.doesNotMatch(screen, /buildScheduleWidgetSnapshot|AppState\.addEventListener/);
});

test('every released Schedule workflow remains connected to the shared screen', () => {
  for (const contract of [
    'deleteService',
    'updateAssignment',
    'loadManualAssignmentCandidates',
    'assignMemberValidated',
    'addServiceComment',
    'addServiceComments',
    'updateServiceComment',
    'deleteServiceComment',
    'reorderServiceComments',
    'notifyServiceComments',
    'createFillInRequest',
    'acceptFillInRequest',
    'cancelFillInRequest',
    'loadMoreServices',
    'NotificationPermissionOnboarding',
    'NotificationBell',
  ]) {
    assert.match(screen, new RegExp(contract));
  }
});

test('direct schedule controls remain admin-only and songs remain author-scoped', () => {
  assert.match(card, /\{isAdmin \? \([\s\S]*?onOpenServiceActions\(service\)/);
  assert.match(screen, /title="Service Actions"[\s\S]*?Delete Service/);
  assert.match(screen, /title="Delete Service"[\s\S]*?handleDeleteService/);
  assert.match(card, /canManageScheduleSong\(/);
  assert.match(card, /canEditSong && !isSongReorderMode[\s\S]*?onEditSong/);
  assert.match(card, /canEditSong \? \([\s\S]*?onOpenSongActions/);
  assert.match(screen, /title="Song Actions"[\s\S]*?Edit Song[\s\S]*?Delete Song/);
  assert.match(card, /\{isAdmin \? \([\s\S]*?onAssignMember/);
  assert.match(card, /isMyAssignment \? \([\s\S]*?onRequestFillIn/);
  assert.match(card, /!isMyRequest && canAccept[\s\S]*?onAcceptFillIn/);
  assert.match(card, /isMyRequest[\s\S]*?onCancelFillIn/);
});

test('team rows are responsive and route admin changes through the focused picker', () => {
  const modal = read('components/schedules/manual-assignment-modal.tsx');

  assert.match(card, /useWindowDimensions/);
  assert.match(card, /shouldStackScheduleTeamRows/);
  assert.match(card, /sortedRoles\.map/);
  assert.match(card, /assignedMemberName \|\| 'Unassigned'/);
  assert.match(card, /accessibilityHint="Opens availability-checked assignment options"/);
  assert.match(card, /Fill-in requested/);
  assert.match(card, /minHeight: 44/);
  assert.doesNotMatch(card, /onDeleteAssignment|assignmentLayout|Platform\.OS/);
  assert.match(modal, /title="Manage Assignment"/);
  assert.match(modal, /Current assignment/);
  assert.match(modal, /onClear\(target\.serviceId, target\.assignmentId\)/);
  assert.match(screen, /onClear=\{openDeleteAssignmentModal\}/);
});

test('songs use ordered rows, bounded previews, ownership gates, and focused actions', () => {
  const model = read('lib/schedules/schedule-view.ts');

  assert.match(card, /songPosition/);
  assert.match(card, /commentIndex \+ 1/);
  assert.match(card, /accessibilityLabel="Add song"/);
  assert.match(card, /getVisibleScheduleSongs/);
  assert.match(card, /Show All \$\{service\.service_comments\.length\} Songs/);
  assert.match(card, /onOpenSongActions\(service, comment\)/);
  assert.match(card, /height: 44/);
  assert.match(model, /canManageScheduleSong/);
  assert.match(model, /currentMemberId === authorMemberId/);
  assert.match(model, /SCHEDULE_SONG_PREVIEW_LIMIT = 4/);
  assert.doesNotMatch(card, /songTypeBadge|songNumberBadge/);
});

test('All and My Schedule are local presentation state with attention preserved', () => {
  const controls = read('components/schedules/schedule-view-controls.tsx');
  const filterModal = read('components/schedules/schedule-filter-modal.tsx');
  const model = read('lib/schedules/schedule-view.ts');

  assert.match(controls, /All Services/);
  assert.match(controls, /My Schedule/);
  assert.match(controls, /accessibilityRole="tab"/);
  assert.match(model, /title: 'Needs Attention'/);
  assert.match(screen, /buildScheduleView/);
  assert.match(screen, /setViewMode\('all'\)/);
  assert.match(controls, /Schedule filters/);
  assert.match(filterModal, /Service Type/);
  assert.match(filterModal, /Role/);
  assert.match(filterModal, /Date Range/);
  assert.match(filterModal, /services already loaded on this device/);
  assert.doesNotMatch(controls + filterModal + model, /supabase|AsyncStorage|SecureStore/);
});

test('Schedule uses local-date virtualized month sections without changing pagination', () => {
  const model = read('lib/schedules/schedule-view.ts');

  assert.match(screen, /<SectionList/);
  assert.match(screen, /sections=\{scheduleSections\}/);
  assert.match(screen, /stickySectionHeadersEnabled/);
  assert.match(screen, /maintainVisibleContentPosition/);
  assert.match(screen, /maxWidth: 760/);
  assert.match(screen, /loadMoreServices/);
  assert.match(model, /buildScheduleSections/);
  assert.match(model, /new Date\(year, month - 1, day\)/);
  assert.match(model, /left\.id\.localeCompare\(right\.id\)/);
  assert.doesNotMatch(model, /new Date\(service\.date\)/);
});

test('service cards expose a compact summary and progressive details', () => {
  assert.match(card, /getDateParts/);
  assert.match(card, /Your Assignment/);
  assert.match(card, /buildScheduleServiceSummary/);
  assert.match(card, /Team \{summary\.assignedCount\}/);
  assert.match(card, /Show Details/);
  assert.match(card, /accessibilityState=\{\{ expanded: isExpanded \}\}/);
  assert.match(card, /android_material_icon_name="more-vert"/);
  assert.match(screen, /serviceCard: \{[\s\S]*?borderRadius: 8,[\s\S]*?StyleSheet\.hairlineWidth/);
  assert.doesNotMatch(screen.match(/serviceCard: \{[\s\S]*?\n\s{2}\},/)?.[0] ?? '', /shadow|elevation/);
});

test('header typography and iOS widget ownership remain isolated', () => {
  const iosWidget = read('hooks/useScheduleWidgetSync.ios.ts');
  const defaultWidget = read('hooks/useScheduleWidgetSync.ts');

  assert.match(screen, /<ResponsiveTabHeader/);
  assert.match(screen, /titleVariant="primaryTitle"/);
  assert.match(screen, /trailingWidth=\{HEADER_ACTION_LANE_WIDTHS\.bell\}/);
  assert.match(iosWidget, /buildScheduleWidgetSnapshot/);
  assert.match(iosWidget, /AppState\.addEventListener/);
  assert.doesNotMatch(defaultWidget, /ExtensionStorage|writeScheduleWidgetSnapshot|AppState/);
});

test('fill-ins use one responsive attention row without changing workflows', () => {
  assert.match(card, /fillInAttentionRow/);
  assert.match(card, /requestingMemberDisplayName/);
  assert.match(card, /request\.role_name/);
  assert.match(card, /request\.reason\?\.trim/);
  assert.match(card, /You can accept this request/);
  assert.match(card, /You can cancel this request/);
  assert.match(card, /busyFillInRequestIds/);
  assert.doesNotMatch(card, /fillInRequestCard|TouchableOpacity/);
  assert.match(screen, /busyFillInRequestIdsRef/);
  assert.match(screen, /acceptFillInRequest/);
  assert.match(screen, /cancelFillInRequest/);
});

test('the bell opens a focused realtime notification history', () => {
  assert.match(notificationBell, /router\.push\('\/schedule-notifications'\)/);
  assert.match(notificationBell, /memberNotificationUnreadCount|useMemberNotifications/);
  assert.doesNotMatch(notificationBell, /AppModal|member_notifications|\.limit\(50\)/);

  assert.match(notificationHistory, /FocusedScreenHeader/);
  assert.match(notificationHistory, /router\.canGoBack\(\)/);
  assert.match(notificationHistory, /router\.replace\('\/\(tabs\)\/\(home\)'\)/);
  assert.match(notificationHistory, /markNotificationsRead/);
  assert.match(notificationHistory, /History unavailable/);
  assert.match(notificationHistory, /No notifications yet/);
  assert.match(notificationHistory, /Open Settings/);

  assert.match(notificationHook, /member_notifications/);
  assert.match(notificationHook, /\.limit\(50\)/);
  assert.match(notificationHook, /read_at/);
  assert.match(notificationHook, /applyNotificationRealtimePayload/);
  assert.match(notificationHook, /event: 'INSERT'/);
  assert.match(notificationHook, /event: 'UPDATE'/);
  assert.match(notificationHook, /event: 'DELETE'/);
});

test('Schedule exposes nonblocking cached content and distinct recovery states', () => {
  assert.match(screen, /<AppStateScreen/);
  assert.match(screen, /useNetworkState/);
  assert.match(screen, /resolveScheduleListState/);
  assert.match(screen, /Church access changed/);
  assert.match(screen, /Schedule unavailable/);
  assert.match(screen, /No filter matches/);
  assert.match(screen, /No personal assignments/);
  assert.match(screen, /Schedule unavailable offline/);
  assert.match(screen, /Services could not load/);
  assert.match(screen, /Church setup is incomplete/);
  assert.match(screen, /No upcoming services/);
  assert.match(screen, /Showing the schedule saved on this device/);
  assert.match(screen, /isAdmin,[\s\S]*?setupIncomplete/);
  assert.match(permissionOnboarding, /if \(!visible\) return null/);
  assert.match(permissionOnboarding, /Enable Notifications/);
  assert.match(permissionOnboarding, /Not Now/);
  assert.doesNotMatch(permissionOnboarding, /AppModal|requestPermission\(\)[\s\S]*useEffect/);
});

test('Schedule typography uses one word-safe system and fixed action lanes', () => {
  const responsiveText = read('components/ui/responsive-text.tsx');
  const responsiveCopy = read('lib/ui/responsive-copy.ts');
  const modal = read('components/ui/app-modal.tsx');
  const assignmentModal = read('components/schedules/manual-assignment-modal.tsx');
  const filters = read('components/schedules/schedule-filter-modal.tsx');
  const controls = read('components/schedules/schedule-view-controls.tsx');

  assert.match(responsiveText, /android_hyphenationFrequency="none"/);
  assert.match(responsiveText, /lineBreakStrategyIOS="none"/);
  assert.match(responsiveText, /accessibilityLabel=\{accessible \? accessibilityLabel \?\? text/);
  assert.match(responsiveCopy, /sourceText/);
  assert.match(responsiveCopy, /minimumSize/);
  assert.match(responsiveCopy, /maxFontSizeMultiplier/);
  assert.doesNotMatch(responsiveCopy, /Platform|Dimensions/);

  for (const source of [card, screen, notificationHistory, assignmentModal, filters, controls, modal]) {
    assert.match(source, /ResponsiveText/);
  }
  assert.match(card, /summaryActions:[\s\S]*?width: 96/);
  assert.match(card, /fillInPrimaryAction:[\s\S]*?width: 112/);
  assert.match(assignmentModal, /memberActionLane:[\s\S]*?width: 32/);
  assert.doesNotMatch(controls, /adjustsFontSizeToFit|minimumFontScale/);
});

test('services, sections, songs, fill-ins, and assignments expose complete semantics', () => {
  assert.match(card, /accessibilityRole="summary"/);
  assert.match(card, /accessibilityLabel=\{serviceSummaryAccessibilityLabel\}/);
  assert.match(card, /accessibilityRole="alert"/);
  assert.match(card, /accessibilityLabel=\{isExpanded \? 'Hide service details'/);
  assert.match(card, /accessibilityState=\{\{ expanded: isExpanded \}\}/);
  assert.match(card, /Song \$\{commentIndex \+ 1\}/);
  assert.match(card, /accessibilityState=\{\{[\s\S]*?busy: isReorderingSongs,[\s\S]*?disabled:/);
  assert.match(card, /accessibilityRole="text"[\s\S]*?accessible[\s\S]*?cardStyles\.teamRow/);
  assert.match(card, /Request fill-in for \$\{assignment\.role\}/);
  assert.match(card, /announceForAccessibility/);

  assert.match(screen, /accessibilityRole="header"[\s\S]*?styles\.sectionHeader/);
  assert.match(screen, /maintainVisibleContentPosition/);
  assert.match(screen, /keyExtractor=\{service => service\.id\}/);
});

test('Schedule controls expose labels, states, keyboard targets, and non-color cues', () => {
  assert.match(viewControls, /accessibilityLabel=\{option\.label\}/);
  assert.match(viewControls, /accessibilityState=\{\{ selected \}\}/);
  assert.match(viewControls, /minHeight: 44/);
  assert.match(viewControls, /optionTextSelected:[\s\S]*?fontWeight: '900'/);
  assert.match(filterModal, /accessibilityRole="radio"/);
  assert.match(filterModal, /accessibilityState=\{\{ checked: selected \}\}/);
  assert.match(screen, /accessibilityRole="checkbox"/);
  assert.match(screen, /accessibilityState=\{\{ checked: selected \}\}/);
  assert.match(screen, /accessibilityLabel="Song title or details"/);
  assert.match(screen, /pendingSongMoveButton:[\s\S]*?width: 44,[\s\S]*?height: 44/);
  assert.match(screen, /accessibilityState=\{complete \? undefined : \{[\s\S]*?busy: loading/);
  assert.match(screen, /All scheduled services loaded/);
  assert.match(screen, /loadMoreLabelLane:[\s\S]*?alignSelf: 'center',[\s\S]*?justifyContent: 'center'/);
  assert.match(card, /cardStyles\.fillInAction,[\s\S]*?theme\.button\.primarySurface/);
  assert.match(card, /style=\{cardStyles\.fillInActionLabelLane\}/);
  assert.match(card, /fillInActionLabelLane:[\s\S]*?alignSelf: 'center'/);
  assert.match(card, /fillInActionText:[\s\S]*?textAlign: 'center'/);
  assert.match(card, /color=\{theme\.button\.primaryForeground\}/);
  assert.match(card, /personalAssignment:[\s\S]*?borderRadius: 8,[\s\S]*?borderWidth: 1/);
  assert.match(card, /personalRoleChip:[\s\S]*?borderRadius: 999,[\s\S]*?justifyContent: 'center'/);
  assert.match(card, /showAssignmentState = isMyAssignment[\s\S]*?\|\| !assignedMemberName/);
  assert.match(card, /\{showAssignmentState \? \([\s\S]*?<AppStatusBadge/);
  assert.doesNotMatch(card, /color: colors\.accent/);
});

test('Reduced Motion and the shared modal contract govern every Schedule popup', () => {
  const reducedMotionHook = read('hooks/useReducedMotionPreference.ts');

  assert.match(reducedMotionHook, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(reducedMotionHook, /reduceMotionChanged/);
  assert.match(card, /shouldAnimateScheduleDisclosure\(reduceMotionEnabled\)/);
  assert.match(appModal, /animationType=\{reduceMotionEnabled \? 'none' : 'fade'\}/);
  assert.match(appModal, /accessibilityViewIsModal/);
  assert.match(appModal, /accessible=\{false\}/);
  assert.match(appModal, /onAccessibilityEscape/);
  assert.match(appModal, /onRequestClose/);
  assert.match(appModal, /Keyboard\.dismiss/);
  assert.match(appModal, /keyboardDismissMode/);
  assert.match(appModal, /useSafeAreaInsets/);
  assert.match(screen, /<AppModal/g);
  assert.doesNotMatch(screen, /<Modal[\s>]/);
  assert.match(read('components/schedules/manual-assignment-modal.tsx'), /bodyScroll=\{false\}/);
});

test('notification history and permission education remain fully operable', () => {
  assert.match(notificationHistory, /accessibilityRole="text"/);
  assert.match(notificationHistory, /accessible/);
  assert.match(notificationHistory, /accessibilityState=\{\{ busy: updatingPermission, disabled: updatingPermission \}\}/);
  assert.match(permissionOnboarding, /accessibilityLabel="Enable notifications"/);
  assert.match(permissionOnboarding, /accessibilityLabel="Not now"/);
});

test('Package 22A through 22J add no Supabase object', () => {
  const migrations = fs.readdirSync(path.join(root, 'supabase/migrations'));
  const functions = fs.readdirSync(path.join(root, 'supabase/functions'));

  assert.equal(migrations.some(file => /package[_-]?22|schedule[_-]?redesign/i.test(file)), false);
  assert.equal(functions.some(file => /schedule[_-]?view|schedule[_-]?redesign/i.test(file)), false);
});
