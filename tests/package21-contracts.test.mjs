import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const app = JSON.parse(read('app.json')).expo;

const widgetGroup = 'group.com.lbkchano.musicministry.widgets';
const oneSignalGroup = 'group.com.lbkchano.musicministry.onesignal';

test('Package 21 adds an isolated iOS extension without changing Android', () => {
  assert.equal(app.ios.appleTeamId, '22ZT5M8WQ5');
  assert.deepEqual(app.ios.entitlements['com.apple.security.application-groups'], [
    oneSignalGroup,
    widgetGroup,
  ]);
  assert.equal(app.plugins.includes('@bacons/apple-targets'), true);
  assert.equal(JSON.stringify(app.android).includes(widgetGroup), false);

  const target = read('targets/ScheduleWidgets/expo-target.config.js');
  assert.match(target, /type: 'widget'/);
  assert.match(target, /bundleIdentifier: '\.ScheduleWidgets'/);
  assert.match(target, /deploymentTarget: '16\.0'/);
  assert.match(target, new RegExp(widgetGroup.replaceAll('.', '\\.')));
  assert.equal(target.includes(oneSignalGroup), false);
});

test('the extension exposes two independent static iOS 16 widget choices', () => {
  const swift = read('targets/ScheduleWidgets/ScheduleWidgets.swift');

  assert.match(swift, /MusicMinistryNextChurchService/);
  assert.match(swift, /MusicMinistryMyNextAssignment/);
  assert.equal((swift.match(/StaticConfiguration\(/g) ?? []).length, 2);
  assert.match(swift, /struct MusicMinistryScheduleWidgets: WidgetBundle/);
  assert.match(swift, /\.supportedFamilies\(\[\.systemSmall, \.systemMedium\]\)/);
  assert.equal(swift.includes('AppIntentConfiguration'), false);
  assert.equal(swift.includes('Supabase'), false);
  assert.equal(swift.includes('URLSession'), false);
});

test('the church widget shows one service with its assigned team', () => {
  const model = read('lib/widgets/schedule-widget-model.ts');
  const swift = read('targets/ScheduleWidgets/ScheduleWidgets.swift');

  assert.match(model, /person_name\?: string \| null/);
  assert.match(model, /team\?: ScheduleWidgetTeamMember\[\]/);
  assert.match(model, /team: assignedTeam\(service\.assignments\)/);
  assert.match(swift, /let team: \[StoredScheduleTeamMember\]\?/);
  assert.match(swift, /prefix\(1\)/);
  assert.match(swift, /Assigned Team/);
  assert.match(swift, /member\.role[\s\S]*member\.memberName/);
  assert.doesNotMatch(swift, /followingServices|dropFirst\(\)\.prefix/);
});

test('the medium widget prioritizes complete service and team details', () => {
  const swift = read('targets/ScheduleWidgets/ScheduleWidgets.swift');

  assert.match(swift, /case \.church: return "Next Service"/);
  assert.match(swift, /team\.isEmpty \? "Team" : "Team \(\\\(team\.count\)\)"/);
  assert.match(swift, /geometry\.size\.width \* 0\.4/);
  assert.match(swift, /Text\(member\.role\)\.bold\(\)[\s\S]*Text\(member\.memberName\)/);
  assert.equal((swift.match(/\.minimumScaleFactor\(/g) ?? []).length >= 5, true);
  assert.match(swift, /return "\\\(dateText\) • \\\(date\.formatted/);
});

test('widget team typography adapts without unbounded layout measurement', () => {
  const swift = read('targets/ScheduleWidgets/ScheduleWidgets.swift');

  assert.match(swift, /struct ScheduleWidgetTeamTypography/);
  assert.match(swift, /case 0, 1: baseSize = 13\.5/);
  assert.match(swift, /case 2: baseSize = 12/);
  assert.match(swift, /case 3: baseSize = 11/);
  assert.match(swift, /default: baseSize = 10/);
  assert.match(swift, /longestEntry[\s\S]*?fontSize: max\(9\.5, baseSize - lengthAdjustment\)/);
  assert.match(swift, /minimumScaleFactor: longestEntry > 32 \? 0\.68 : 0\.76/);
  assert.doesNotMatch(swift, /PreferenceKey|onPreferenceChange|sizeThatFits/);
});

test('snapshot identifiers and privacy boundaries match across JavaScript and Swift', () => {
  const model = read('lib/widgets/schedule-widget-model.ts');
  const nativeStorage = read('lib/widgets/schedule-widget.ios.ts');
  const swift = read('targets/ScheduleWidgets/ScheduleWidgets.swift');

  for (const value of [widgetGroup, 'musicMinistry.scheduleWidget.snapshot.v1']) {
    assert.equal(model.includes(value), true);
    assert.equal(swift.includes(value), true);
  }
  assert.match(model, /SCHEDULE_WIDGET_SCHEMA_VERSION = 1/);
  assert.match(swift, /snapshotSchemaVersion = 1/);
  assert.match(swift, /withFractionalSeconds/);
  assert.match(swift, /fractionalFormatter\.date[\s\S]*ISO8601DateFormatter\(\)\.date/);
  assert.match(model, /replace\(\/\\\.\\d\{3\}Z\$\/, 'Z'\)/);
  assert.match(nativeStorage, /ExtensionStorage/);
  assert.match(nativeStorage, /ExtensionStorage\.reloadWidget\(NEXT_CHURCH_SERVICE_WIDGET_KIND\)/);
  assert.match(nativeStorage, /ExtensionStorage\.reloadWidget\(MY_NEXT_ASSIGNMENT_WIDGET_KIND\)/);
  assert.equal(swift.includes('access_token'), false);
  assert.equal(swift.includes('refresh_token'), false);
  assert.equal(swift.includes('invitation_code'), false);
});

test('the iOS membership lifecycle owns refreshes while Android remains untouched', () => {
  const iosSchedule = read('app/(tabs)/(home)/index.ios.tsx');
  const androidSchedule = read('app/(tabs)/(home)/index.tsx');
  const sharedSchedule = read('components/schedules/schedule-screen.tsx');
  const lifecycle = read('components/widgets/schedule-widget-lifecycle-sync.ios.tsx');
  const defaultLifecycle = read('components/widgets/schedule-widget-lifecycle-sync.tsx');
  const iosSync = read('hooks/useScheduleWidgetSync.ios.ts');
  const defaultSync = read('hooks/useScheduleWidgetSync.ts');
  const rootLayout = read('app/_layout.tsx');
  const churchContext = read('contexts/ChurchContext.tsx');

  assert.match(iosSchedule, /schedule-screen/);
  assert.match(androidSchedule, /schedule-screen/);
  assert.doesNotMatch(sharedSchedule, /useScheduleWidgetSync/);
  assert.match(lifecycle, /useScheduleWidgetSync/);
  assert.match(lifecycle, /useServices/);
  assert.doesNotMatch(defaultLifecycle, /useServices|ExtensionStorage/);
  assert.match(iosSync, /buildScheduleWidgetSnapshot/);
  assert.match(iosSync, /writeScheduleWidgetSnapshot/);
  assert.match(iosSync, /AppState\.addEventListener/);
  assert.match(iosSync, /syncScheduleWidget\(\);[\s\S]*reloadScheduleWidgets\(\);[\s\S]*refreshServices\(\)/);
  assert.match(iosSync, /canBuildScheduleWidgetSnapshot/);
  assert.equal(defaultSync.includes('schedule-widget'), true);
  assert.equal(defaultSync.includes('buildScheduleWidgetSnapshot'), false);
  assert.match(rootLayout, /ScheduleWidgetLifecycleSync/);
  assert.doesNotMatch(rootLayout, /prepareScheduleWidgetScope|clearScheduleWidgetSnapshot/);
  assert.match(churchContext, /clearScheduleWidgetSnapshot\('signed_out'\)/);
});

test('Package 21 has no Supabase migration or Edge Function', () => {
  const migrations = fs.readdirSync(path.join(root, 'supabase/migrations'));
  const functions = fs.readdirSync(path.join(root, 'supabase/functions'));

  assert.equal(migrations.some(file => /package[_-]?21|widget/i.test(file)), false);
  assert.equal(functions.some(file => /widget/i.test(file)), false);
});
