import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...segments) => readFileSync(join(root, ...segments), 'utf8');
const hook = read('hooks', 'useServices.ts');
const schedule = read('components', 'schedules', 'schedule-screen.tsx');
const pagination = read('lib', 'schedules', 'service-pagination.ts');

test('pagination owns one scoped explicit operation state', () => {
  assert.match(hook, /useState<ServicePaginationOperation>/);
  assert.match(hook, /paginationOperationRef\.current\.status === 'loading'/);
  assert.match(hook, /serviceRequestScope = `\$\{accountId[\s\S]*startDate[\s\S]*windowDays/);
  assert.match(hook, /serviceRequestScopeRef\.current !== requestScope/);
  assert.doesNotMatch(hook, /pendingServiceRangeKey|failedServiceRange/);
});

test('one successful request appends once and empty results settle safely', () => {
  assert.match(hook, /const fetchedServices = await queryClient\.fetchQuery/);
  assert.match(hook, /current\.some\(range => getServiceRangeKey\(range\) === targetRangeKey\)/);
  assert.match(hook, /shouldCompleteAfterRange\(\{/);
  assert.match(pagination, /return fetchedServiceCount === 0/);
});

test('cached ranges do not become unavailable during background refetch errors', () => {
  assert.match(hook, /result\.data !== undefined \? index : lastIndex/);
  assert.match(hook, /results\.at\(-1\)\?\.error && results\.at\(-1\)\?\.data === undefined/);
});

test('footer keeps one component and fixed icon and label lanes for every state', () => {
  assert.match(schedule, /function SchedulePaginationFooter/);
  assert.match(schedule, /status === 'complete'/);
  assert.match(schedule, /status === 'loading'/);
  assert.match(schedule, /status === 'error'/);
  assert.match(schedule, /All scheduled services loaded/);
  assert.match(schedule, /loadMoreIconLane/);
  assert.match(schedule, /loadMoreLabelLane/);
  assert.match(schedule, /<SchedulePaginationFooter[\s\S]*status=\{servicePaginationStatus\}/);
});

test('Package 33 keeps existing service query keys and backend contracts', () => {
  assert.match(hook, /queryKeys\.services\(/);
  assert.match(hook, /fetchServicesForChurch/);
  assert.doesNotMatch(pagination, /supabase|rpc\(|from\('services'\)/);
});
