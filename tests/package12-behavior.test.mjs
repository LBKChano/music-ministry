import assert from 'node:assert/strict';
import test from 'node:test';
import {
  areAvailabilityDateSetsEqual,
  countAvailabilityDatesInRange,
  createAvailabilityEditorRange,
  createAvailabilitySummary,
  normalizeAvailabilityDates,
  toggleAvailabilityDate,
} from '../lib/profile/availability.ts';
import { formatLocalDate } from '../lib/services/ranges.ts';

process.env.TZ = 'America/Chihuahua';

const row = unavailable_date => ({ unavailable_date });

test('local calendar boundaries do not shift through UTC conversion', () => {
  assert.equal(
    formatLocalDate(new Date(2026, 6, 29, 23, 59, 59)),
    '2026-07-29',
  );
  assert.equal(
    formatLocalDate(new Date(2026, 6, 30, 0, 0, 1)),
    '2026-07-30',
  );
});

test('the editor range follows the six-calendar-month availability horizon', () => {
  assert.deepEqual(
    createAvailabilityEditorRange(new Date(2026, 6, 29, 12, 0, 0)),
    {
      startDate: '2026-07-29',
      endDate: '2027-01-29',
    },
  );
});

test('local date arithmetic remains stable across leap day and seasonal clocks', () => {
  assert.deepEqual(
    createAvailabilityEditorRange(new Date(2028, 1, 29, 12, 0, 0), 2),
    {
      startDate: '2028-02-29',
      endDate: '2028-03-01',
    },
  );
  assert.deepEqual(
    createAvailabilityEditorRange(new Date(2026, 2, 7, 23, 30, 0), 4),
    {
      startDate: '2026-03-07',
      endDate: '2026-03-10',
    },
  );
});

test('availability summary shows future count and the next three dates', () => {
  const summary = createAvailabilitySummary(
    [
      row('2026-07-28'),
      row('2026-08-30'),
      row('2026-07-30'),
      row('2026-08-02'),
      row('2026-08-15'),
      row('2026-07-30'),
    ],
    new Date(2026, 6, 29, 12, 0, 0),
  );

  assert.equal(summary.count, 4);
  assert.equal(summary.value, '4 blocked');
  assert.deepEqual(summary.nextDates, [
    '2026-07-30',
    '2026-08-02',
    '2026-08-15',
  ]);
  assert.match(summary.description, /and 1 more/);
});

test('empty future availability has an explicit summary', () => {
  assert.deepEqual(
    createAvailabilitySummary(
      [row('2026-07-28')],
      new Date(2026, 6, 29, 12, 0, 0),
    ),
    {
      count: 0,
      value: 'None',
      description: 'No unavailable dates',
      nextDates: [],
    },
  );
});

test('rapid date taps are deterministic and can produce an empty draft', () => {
  const initial = new Set(['2026-08-02']);
  const removed = toggleAvailabilityDate(initial, '2026-08-02');
  assert.equal(removed.size, 0);
  assert.equal(areAvailabilityDateSetsEqual(removed, new Set()), true);

  const added = toggleAvailabilityDate(removed, '2026-08-02');
  const removedAgain = toggleAvailabilityDate(added, '2026-08-02');
  assert.equal(areAvailabilityDateSetsEqual(removedAgain, removed), true);
});

test('editing the visible horizon retains every date outside it', () => {
  const savedRows = [
    row('2026-06-01'),
    row('2026-08-02'),
    row('2027-02-10'),
  ];
  const draft = new Set(normalizeAvailabilityDates(savedRows));
  const range = createAvailabilityEditorRange(
    new Date(2026, 6, 29, 12, 0, 0),
  );
  const edited = toggleAvailabilityDate(draft, '2026-08-02');

  assert.deepEqual([...edited].sort(), ['2026-06-01', '2027-02-10']);
  assert.equal(countAvailabilityDatesInRange(edited, range), 0);
  assert.equal(edited.size - countAvailabilityDatesInRange(edited, range), 2);
});
