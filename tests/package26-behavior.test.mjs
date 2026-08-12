import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ROLE_SYMBOL_KEYS,
  normalizeRoleName,
  normalizeRoleSymbolKey,
  resolveRoleSymbol,
  resolveRoleSymbolForName,
} from '../lib/roles/role-symbols.ts';
import {
  deriveScheduleDateSummary,
  formatScheduleTodayText,
  formatScheduleDateSummary,
  getLocalDateParts,
  millisecondsUntilNextLocalDay,
  resolveSchedulePeriodText,
} from '../lib/schedules/schedule-range.ts';

test('role symbols accept only controlled keys and safely fall back to General', () => {
  for (const key of ROLE_SYMBOL_KEYS) {
    assert.equal(normalizeRoleSymbolKey(key.toUpperCase()), key);
    assert.equal(resolveRoleSymbol(key).key, key);
  }

  assert.equal(normalizeRoleSymbolKey(null), null);
  assert.equal(normalizeRoleSymbolKey('arbitrary-database-icon'), null);
  assert.equal(resolveRoleSymbol(null).label, 'General');
  assert.equal(resolveRoleSymbol('unknown').label, 'General');
});

test('role symbol lookup normalizes written role names without changing identity', () => {
  const roles = [
    { name: '  Worship   Leader ', icon_key: 'microphone' },
    { name: 'Worship Leader', icon_key: 'guitar' },
    { name: 'Very Long Translated Presentation Role Name', icon_key: null },
  ];

  assert.equal(normalizeRoleName(' Worship   Leader '), 'worship leader');
  assert.equal(
    resolveRoleSymbolForName(roles, 'worship leader').key,
    'microphone',
  );
  assert.equal(
    resolveRoleSymbolForName(roles, 'Very Long Translated Presentation Role Name').label,
    'General',
  );
  assert.equal(resolveRoleSymbolForName(roles, 'Missing Role').label, 'General');
});

test('schedule summaries cover empty, single-date, same-year, and cross-year data', () => {
  assert.equal(formatScheduleDateSummary(null), null);

  const oneDate = formatScheduleDateSummary({
    firstDate: '2026-08-12',
    lastDate: '2026-08-12',
  });
  assert.match(oneDate, /12/);
  assert.match(oneDate, /2026/);

  const sameYear = formatScheduleDateSummary({
    firstDate: '2026-08-12',
    lastDate: '2026-11-02',
  });
  assert.match(sameYear, /2026/);
  assert.match(sameYear, / - /);

  const crossYear = formatScheduleDateSummary({
    firstDate: '2026-12-20',
    lastDate: '2027-01-10',
  });
  assert.match(crossYear, /2026/);
  assert.match(crossYear, /2027/);
});

test('schedule period wording stays truthful while the complete summary is unavailable', () => {
  assert.match(resolveSchedulePeriodText({
    summary: { firstDate: '2026-08-12', lastDate: '2026-11-02' },
    summaryStatus: 'success',
    loadedServiceDates: ['2026-08-12'],
  }), /2026/);

  assert.doesNotMatch(resolveSchedulePeriodText({
    summary: null,
    summaryStatus: 'pending',
    loadedServiceDates: ['2026-08-12', '2026-09-30'],
  }), /Nov/);

  assert.match(resolveSchedulePeriodText({
    summary: null,
    summaryStatus: 'error',
    loadedServiceDates: ['2026-08-12', '2026-09-30'],
  }), /2026/);

  assert.equal(resolveSchedulePeriodText({
    summary: null,
    summaryStatus: 'pending',
    loadedServiceDates: [],
  }), 'Loading schedule');
  assert.equal(resolveSchedulePeriodText({
    summary: null,
    summaryStatus: 'success',
    loadedServiceDates: [],
  }), 'No upcoming services');

  assert.deepEqual(
    deriveScheduleDateSummary(['2026-09-30', 'invalid', '2026-08-12']),
    { firstDate: '2026-08-12', lastDate: '2026-09-30' },
  );
  assert.match(formatScheduleTodayText({ weekday: 'Wed', month: 'Aug', day: '12' }), /^Today - /);
});

test('Today marker date parts are local and the rollover delay is bounded', () => {
  const localDate = new Date(2026, 7, 12, 23, 59, 59, 500);
  const parts = getLocalDateParts(localDate);

  assert.equal(parts.dateKey, '2026-08-12');
  assert.equal(parts.day, '12');
  assert.ok(parts.weekday.length >= 2);
  assert.ok(parts.month.length >= 3);
  assert.equal(millisecondsUntilNextLocalDay(localDate), 1_500);
});
