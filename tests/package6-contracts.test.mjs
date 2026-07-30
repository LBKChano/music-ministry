import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const readSource = (...segments) => readFileSync(
  join(projectRoot, ...segments),
  'utf8',
);

const churchContext = readSource('contexts', 'ChurchContext.tsx');
const churchScreen = readSource('app', '(tabs)', 'church.tsx');
const androidSchedule = readSource('app', '(tabs)', '(home)', 'index.tsx');
const iosSchedule = readSource('app', '(tabs)', '(home)', 'index.ios.tsx');
const androidProfile = readSource('app', '(tabs)', 'profile.tsx');
const iosProfile = readSource('app', '(tabs)', 'profile.ios.tsx');
const servicesHook = readSource('hooks', 'useServices.ts');

test('Church context exposes separate initialization and refresh state', () => {
  assert.match(churchContext, /initializing: boolean/);
  assert.match(churchContext, /refreshing: boolean/);
  assert.match(churchContext, /refreshError: string \| null/);
  assert.match(churchContext, /initializing: loading/);
  assert.match(churchContext, /runBackgroundRefresh/);
  assert.match(churchContext, /RefreshCoordinator/);
});

test('public church refresh uses discovery without restarting bootstrap', () => {
  const refreshStart = churchContext.indexOf('const refreshChurches = useCallback');
  const valueStart = churchContext.indexOf('const value = useMemo', refreshStart);
  const refreshSource = churchContext.slice(refreshStart, valueStart);

  assert.match(refreshSource, /fetchChurches\(accountId, 0, true\)/);
  assert.doesNotMatch(refreshSource, /bootstrapChurchSession/);
});

test('failed background reads retain the last good member and settings', () => {
  const currentMemberStart = churchContext.indexOf('const fetchCurrentMember');
  const unavailabilityStart = churchContext.indexOf(
    'const fetchMemberUnavailability',
    currentMemberStart,
  );
  const currentMemberSource = churchContext.slice(
    currentMemberStart,
    unavailabilityStart,
  );
  const settingsStart = churchContext.indexOf('const fetchNotificationSettings');
  const settingsEnd = churchContext.indexOf(
    'const updateNotificationSettings',
    settingsStart,
  );
  const settingsSource = churchContext.slice(settingsStart, settingsEnd);

  const currentMemberCatch = currentMemberSource.slice(
    currentMemberSource.indexOf('} catch (err)'),
  );
  const settingsCatch = settingsSource.slice(settingsSource.indexOf('} catch (err)'));

  assert.doesNotMatch(currentMemberCatch, /setCurrentMember\(null\)/);
  assert.doesNotMatch(settingsCatch, /setNotificationSettings\(null\)/);
  assert.match(currentMemberSource, /if \(throwOnError\) throw err/);
  assert.match(settingsSource, /if \(throwOnError\) throw err/);
});

test('refreshable tabs share nonblocking and deduplicated refresh behavior', () => {
  for (const source of [churchScreen, androidSchedule, iosSchedule]) {
    assert.match(source, /useRefreshController/);
    assert.match(source, /runRefreshBatch/);
    assert.match(source, /RefreshErrorNotice/);
    assert.match(source, /refreshing=\{refreshing\}/);
    assert.match(source, /shouldShowInitialLoader/);
  }
});

test('Profile loading guards preserve populated content during transitions', () => {
  for (const source of [androidProfile, iosProfile]) {
    assert.match(source, /initializing/);
    assert.match(source, /shouldShowInitialLoader/);
    assert.doesNotMatch(source, /if \(loading \|\| !user\)/);
  }
});

test('service refresh keeps cached data and deduplicates manual requests', () => {
  assert.match(
    servicesHook,
    /services\.length === 0\s*&& combinedServicesQuery\.isPending/,
  );
  assert.match(servicesHook, /refreshCoordinatorRef/);
  assert.match(servicesHook, /queryClient\.refetchQueries/);
});

test('Package 6 is client-only and adds no database migration', () => {
  const migrations = readdirSync(join(projectRoot, 'supabase', 'migrations'));
  assert.equal(
    migrations.some(name => /package[_-]?6|refresh[_-]?state/i.test(name)),
    false,
  );
});
