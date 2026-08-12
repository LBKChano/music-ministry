import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deriveScheduleDateSummary,
  formatScheduleTodayText,
  resolveSchedulePeriodText,
} from '../lib/schedules/schedule-range.ts';

test('authoritative service dates win over a shorter loaded cache', () => {
  const text = resolveSchedulePeriodText({
    summary: { firstDate: '2026-08-12', lastDate: '2026-12-24' },
    summaryStatus: 'success',
    loadedServiceDates: ['2026-08-12', '2026-09-30'],
  });

  assert.match(text, /Dec/);
  assert.doesNotMatch(text, /Loaded through/i);
});

test('cached and offline fallbacks describe actual loaded services only', () => {
  const dates = ['2026-09-30', '2026-08-12'];
  const pending = resolveSchedulePeriodText({
    summary: undefined,
    summaryStatus: 'pending',
    loadedServiceDates: dates,
  });
  const offline = resolveSchedulePeriodText({
    summary: undefined,
    summaryStatus: 'error',
    loadedServiceDates: dates,
    isOffline: true,
  });

  assert.equal(pending, offline);
  assert.match(pending, /Sep/);
  assert.doesNotMatch(pending, /Nov|Loaded through/i);
});

test('empty, loading, failure, and one-service copy are deterministic', () => {
  assert.equal(resolveSchedulePeriodText({
    summary: null,
    summaryStatus: 'success',
    loadedServiceDates: [],
  }), 'No upcoming services');
  assert.equal(resolveSchedulePeriodText({
    summary: undefined,
    summaryStatus: 'pending',
    loadedServiceDates: [],
  }), 'Loading schedule');
  assert.equal(resolveSchedulePeriodText({
    summary: undefined,
    summaryStatus: 'error',
    loadedServiceDates: [],
  }), 'Schedule range unavailable');
  assert.equal(resolveSchedulePeriodText({
    summary: undefined,
    summaryStatus: 'error',
    loadedServiceDates: [],
    isOffline: true,
  }), 'Schedule unavailable offline');

  const single = resolveSchedulePeriodText({
    summary: { firstDate: '2026-09-30', lastDate: '2026-09-30' },
    summaryStatus: 'success',
    loadedServiceDates: [],
  });
  assert.match(single, /30/);
  assert.match(single, /2026/);
  assert.doesNotMatch(single, / - /);
});

test('loaded summary filters invalid dates and does not mutate input order', () => {
  const dates = ['2026-09-30', 'invalid', '2026-08-12'];
  assert.deepEqual(deriveScheduleDateSummary(dates), {
    firstDate: '2026-08-12',
    lastDate: '2026-09-30',
  });
  assert.deepEqual(dates, ['2026-09-30', 'invalid', '2026-08-12']);
});

test('Today copy remains local-date based and compact', () => {
  assert.equal(
    formatScheduleTodayText({ weekday: 'Wed', month: 'Aug', day: '12' }),
    'Today - Wed, Aug 12',
  );
});
