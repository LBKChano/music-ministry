import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAvailabilityEditorRange,
} from '../lib/profile/availability.ts';
import {
  applySchedulingAvailabilityChange,
  applySchedulingPreferenceToggle,
  createSchedulingPreferenceSummary,
  hasSchedulingAvoidance,
  isSchedulingOptionAvailable,
} from '../lib/scheduling/preferences.ts';
import {
  ELAPSED_QUARTER_MESSAGE,
  getQuarterDateRange,
  isQuarterElapsed,
} from '../lib/services/quarter.ts';

process.env.TZ = 'America/Chihuahua';

const identity = {
  church_id: 'church-a',
  member_id: 'member-a',
  recurring_service_id: 'service-a',
  role_id: 'role-a',
};

const groups = [{
  role: { role_id: 'role-a', role_name: 'Piano' },
  services: [{
    id: 'service-a',
    name: 'Sunday Service',
    day_of_week: 0,
    time: '09:00:00',
    roles: ['Piano'],
  }],
}];

test('availability defaults to six calendar months using local dates', () => {
  assert.deepEqual(
    createAvailabilityEditorRange(new Date(2026, 6, 29, 12)),
    { startDate: '2026-07-29', endDate: '2027-01-29' },
  );
  assert.deepEqual(
    createAvailabilityEditorRange(new Date(2026, 7, 31, 12)),
    { startDate: '2026-08-31', endDate: '2027-02-28' },
  );
  assert.deepEqual(
    createAvailabilityEditorRange(new Date(2027, 7, 31, 12)),
    { startDate: '2027-08-31', endDate: '2028-02-29' },
  );
});

test('the explicit legacy day horizon remains available to existing callers', () => {
  assert.deepEqual(
    createAvailabilityEditorRange(new Date(2026, 6, 29, 12), 90),
    { startDate: '2026-07-29', endDate: '2026-10-26' },
  );
});

test('availability switches default on and store only off combinations', () => {
  assert.equal(isSchedulingOptionAvailable([], 'service-a', 'role-a'), true);

  const avoided = applySchedulingAvailabilityChange([], identity, false);
  assert.equal(hasSchedulingAvoidance(avoided, 'service-a', 'role-a'), true);
  assert.equal(isSchedulingOptionAvailable(avoided, 'service-a', 'role-a'), false);

  const available = applySchedulingAvailabilityChange(avoided, identity, true);
  assert.deepEqual(available, []);
});

test('released preference helpers retain their original avoidance meaning', () => {
  const avoided = applySchedulingPreferenceToggle([], identity, true);
  assert.equal(hasSchedulingAvoidance(avoided, 'service-a', 'role-a'), true);
  assert.deepEqual(applySchedulingPreferenceToggle(avoided, identity, false), []);
});

test('preference summaries describe visible on and off states', () => {
  assert.deepEqual(createSchedulingPreferenceSummary([], groups), {
    count: 0,
    description: 'Available for every matching weekly service.',
    totalOptions: 1,
    value: 'All on',
  });

  const avoided = applySchedulingAvailabilityChange([], identity, false);
  assert.equal(createSchedulingPreferenceSummary(avoided, groups).value, '1 off');
});

test('quarter expiration uses the local end date and allows the boundary day', () => {
  assert.deepEqual(getQuarterDateRange(2, 2026), {
    startDate: new Date(2026, 3, 1),
    endDate: new Date(2026, 5, 30),
  });
  assert.equal(isQuarterElapsed(2, 2026, '2026-06-30'), false);
  assert.equal(isQuarterElapsed(2, 2026, '2026-07-01'), true);
  assert.equal(isQuarterElapsed(3, 2026, '2026-07-01'), false);
  assert.equal(ELAPSED_QUARTER_MESSAGE, 'This quarter has already ended.');
});
