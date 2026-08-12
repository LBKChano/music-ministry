import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...segments) => readFileSync(join(root, ...segments), 'utf8');
const schedule = read('components', 'schedules', 'schedule-screen.tsx');
const services = read('hooks', 'useServices.ts');
const range = read('lib', 'schedules', 'schedule-range.ts');

test('Today is the compact header eyebrow with no duplicate metadata row', () => {
  const headerStart = schedule.indexOf('<ResponsiveTabHeader');
  const headerEnd = schedule.indexOf('</ResponsiveTabHeader>', headerStart);
  const header = schedule.slice(headerStart, headerEnd);

  assert.match(schedule, /const todayHeaderText = formatScheduleTodayText\(currentLocalDate\)/);
  assert.match(header, /density="compact"/);
  assert.match(header, /eyebrow=\{todayHeaderText\}/);
  assert.doesNotMatch(schedule, /todayMarkerRow/);
  assert.doesNotMatch(header, /ScheduleTodayMarker|TabHeaderMetaText/);
});

test('service date summary stays data-only and is not rendered as header clutter', () => {
  assert.match(services, /fetchUpcomingServiceDateSummary/);
  assert.match(services, /scheduleDateSummaryStatus/);
  assert.doesNotMatch(schedule, /scheduleDateSummary|schedulePeriod|loadedServiceDates/);
  assert.doesNotMatch(range, /Loaded through/);
});

test('header summary follows the selected All or My Schedule view', () => {
  assert.match(schedule, /scheduleSummaryLabel = viewMode === 'mine' \? 'My services' : 'Upcoming'/);
  assert.match(schedule, /detail=\{upcomingText\}/);
  assert.match(schedule, /accessibilityLabel=\{`\$\{scheduleSummaryLabel\}, \$\{upcomingText\}`\}/);
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
