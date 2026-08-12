import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...segments) => readFileSync(join(root, ...segments), 'utf8');
const schedule = read('components', 'schedules', 'schedule-screen.tsx');
const today = read('components', 'schedules', 'schedule-today-marker.tsx');
const services = read('hooks', 'useServices.ts');
const range = read('lib', 'schedules', 'schedule-range.ts');

test('Today is compact header metadata with no standalone date tile', () => {
  const headerStart = schedule.indexOf('<ResponsiveTabHeader');
  const headerEnd = schedule.indexOf('</ResponsiveTabHeader>', headerStart);
  const marker = schedule.indexOf('<ScheduleTodayMarker', headerStart);

  assert.ok(marker > headerStart && marker < headerEnd);
  assert.doesNotMatch(schedule, /todayMarkerRow/);
  assert.match(today, /TabHeaderMetaText/);
  assert.match(today, /accessibilityLabel=\{`Today,/);
  assert.doesNotMatch(today, /Touchable|Pressable|onPress|height: 70/);
});

test('header range uses authoritative summary or actual service dates only', () => {
  assert.match(services, /fetchUpcomingServiceDateSummary/);
  assert.match(schedule, /loadedServiceDates = useMemo/);
  assert.match(schedule, /summaryStatus: scheduleDateSummaryStatus/);
  assert.doesNotMatch(range, /Loaded through/);
  assert.doesNotMatch(schedule, /summaryPending:[\s\S]{0,100}loadedThrough/);
});

test('duplicate visible results heading is removed but list context remains accessible', () => {
  assert.doesNotMatch(schedule, /ListHeaderComponent/);
  assert.match(schedule, /<SectionList[\s\S]*accessibilityLabel=\{`\$\{viewMode/);
  assert.doesNotMatch(schedule, /text=\{viewMode === 'mine' \? 'My Upcoming Services'/);
});

test('Package 32 changes no backend or released query contract', () => {
  assert.match(services, /queryKeys\.services\(/);
  assert.match(services, /queryKeys\.serviceDateSummary\(/);
  assert.match(range, /deriveScheduleDateSummary/);
  assert.doesNotMatch(range, /supabase|fetch\(|rpc\(/);
});
