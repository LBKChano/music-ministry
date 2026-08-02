import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const read = (...segments) => readFileSync(join(projectRoot, ...segments), 'utf8');

const overview = read('components', 'profile', 'profile-screen.tsx');
const editor = read('components', 'profile', 'profile-availability-screen.tsx');
const availability = read('lib', 'profile', 'availability.ts');
const availabilityHook = read('hooks', 'useMemberAvailability.ts');
const context = read('contexts', 'ChurchContext.tsx');
const layout = read('app', '_layout.tsx');
const route = read('app', 'profile-availability.tsx');
const latestAutoAssign = read(
  'supabase',
  'migrations',
  '20260714000004_auto_assign_settings_and_skipped_report.sql',
);

test('Profile replaces the inline calendar with one availability summary row', () => {
  assert.match(overview, /title="Unavailable Dates"/);
  assert.match(overview, /availabilitySummary\.description/);
  assert.match(overview, /availabilitySummary\.value/);
  assert.match(overview, /router\.push\('\/profile-availability'\)/);
  assert.doesNotMatch(overview, /<Calendar|markedDates|pendingDates/);
});

test('the focused editor uses local dates and the shared scheduling horizon', () => {
  assert.match(availability, /DEFAULT_SERVICE_WINDOW_DAYS/);
  assert.match(availability, /formatLocalDate\(now\)/);
  assert.match(availability, /addDaysToDate/);
  assert.doesNotMatch(availability, /toISOString/);
  assert.match(editor, /minDate=\{range\.startDate\}/);
  assert.match(editor, /maxDate=\{range\.endDate\}/);
});

test('one keyed React Query source prevents cross-membership data reuse', () => {
  assert.match(
    availabilityHook,
    /queryKeys\.memberUnavailability\(accountId!, churchId!, memberId!\)/,
  );
  assert.match(availabilityHook, /fetchUnavailability\(memberId!, signal\)/);
  assert.doesNotMatch(availabilityHook, /placeholderData|keepPreviousData/);
  assert.match(editor, /activeIdentityRef\.current !== saveIdentity/);
  assert.match(editor, /initializedIdentityRef\.current !== identityKey/);
});

test('the editor keeps a complete local draft until one verified save', () => {
  assert.match(editor, /new Set\(normalizeAvailabilityDates\(availabilityQuery\.data \?\? \[\]\)\)/);
  assert.match(editor, /const datesToSave = \[\.\.\.draftDates\]\.sort\(\)/);
  assert.equal(
    (editor.match(/saveUnavailableDates\(memberId, datesToSave\)/g) ?? []).length,
    1,
  );
  assert.match(editor, /const verifiedResult = await availabilityQuery\.refetch\(\)/);
  assert.match(editor, /areAvailabilityDateSetsEqual\(verifiedDates, draftDates\)/);
  assert.match(editor, /verifiedDates\.size === 0/);
  assert.match(editor, /retainedOutsideRangeCount/);
});

test('dirty drafts and active saves cannot be dismissed silently', () => {
  assert.match(editor, /usePreventRemove\(hasChanges \|\| saving/);
  assert.match(editor, /Discard Changes\?/);
  assert.match(editor, /Save in Progress/);
  assert.match(editor, /Church Changed/);
  assert.match(editor, /Your local draft was kept/);
  assert.match(editor, /finally/);
});

test('selected dates are announced and differentiated without color alone', () => {
  assert.match(editor, /accessibilityRole="checkbox"/);
  assert.match(editor, /accessibilityState=\{\{ checked: selected, disabled \}\}/);
  assert.match(editor, /hard scheduling exclusion/);
  assert.match(editor, /ios_icon_name="checkmark"/);
});

test('released storage and auto-assignment contracts remain unchanged', () => {
  assert.match(context, /const saveUnavailableDates = useCallback/);
  assert.match(context, /\.from\('member_unavailability'\)\.delete\(\)/);
  assert.match(context, /\.from\('member_unavailability'\)\.insert\(inserts\)/);
  assert.match(
    latestAutoAssign,
    /from public\.member_unavailability mu[\s\S]*mu\.unavailable_date = service_rec\.date/,
  );

  const migrations = readdirSync(join(projectRoot, 'supabase', 'migrations'));
  assert.equal(
    migrations.some(name => (
      /package[_-]?12|profile[_-]?availability|availability[_-]editor/i.test(name)
    )),
    false,
  );
});

test('the availability route is registered without a platform fork', () => {
  assert.match(route, /<ProfileAvailabilityScreen \/>/);
  assert.match(layout, /name="profile-availability"/);
  assert.equal(
    readdirSync(join(projectRoot, 'app'))
      .filter(name => name.startsWith('profile-availability.')).length,
    1,
  );
});
