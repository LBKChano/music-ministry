import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applySchedulingPreferenceToggle,
  buildSchedulingPreferenceGroups,
  createSchedulingPreferenceSummary,
  findSchedulingPreferenceOption,
  formatSchedulingPreferenceTime,
} from '../lib/scheduling/preferences.ts';

const roles = [
  { role_id: 'role-piano', role_name: 'Piano' },
  { role_id: 'role-sound', role_name: 'Sound' },
];

const services = [
  {
    id: 'service-sunday',
    name: 'Sunday Service',
    day_of_week: 0,
    time: '09:00:00',
    roles: ['Piano', 'Sound'],
  },
  {
    id: 'service-wednesday',
    name: 'Midweek',
    day_of_week: 3,
    time: '19:30:00',
    roles: ['Sound'],
  },
];

const groups = buildSchedulingPreferenceGroups(roles, services);

function preference({
  id,
  memberId = 'member-a',
  recurringServiceId,
  roleId,
}) {
  return {
    church_id: 'church-a',
    created_at: '2026-07-29T00:00:00Z',
    id,
    member_id: memberId,
    recurring_service_id: recurringServiceId,
    role_id: roleId,
    updated_at: '2026-07-29T00:00:00Z',
  };
}

test('summary reports no selected preference without hiding available options', () => {
  assert.deepEqual(createSchedulingPreferenceSummary([], groups), {
    count: 0,
    description: 'No weekly-service preferences selected.',
    totalOptions: 3,
    value: 'None',
  });
});

test('summary names a single weekly-service and role preference', () => {
  const summary = createSchedulingPreferenceSummary([
    preference({
      id: 'preference-a',
      recurringServiceId: 'service-sunday',
      roleId: 'role-piano',
    }),
  ], groups);

  assert.equal(summary.count, 1);
  assert.equal(summary.value, '1 selected');
  assert.equal(
    summary.description,
    'Avoid Sunday Service for Piano when possible.',
  );
});

test('summary aggregates several selections across distinct roles', () => {
  const summary = createSchedulingPreferenceSummary([
    preference({
      id: 'preference-a',
      recurringServiceId: 'service-sunday',
      roleId: 'role-piano',
    }),
    preference({
      id: 'preference-b',
      recurringServiceId: 'service-wednesday',
      roleId: 'role-sound',
    }),
  ], groups);

  assert.equal(summary.count, 2);
  assert.equal(summary.description, '2 preferences across 2 roles.');
  assert.equal(summary.totalOptions, 3);
});

test('rows cleaned up after role or recurring-service deletion are not displayed', () => {
  const orphanedRole = preference({
    id: 'preference-orphan-role',
    recurringServiceId: 'service-sunday',
    roleId: 'role-removed',
  });
  const orphanedService = preference({
    id: 'preference-orphan-service',
    recurringServiceId: 'service-removed',
    roleId: 'role-piano',
  });

  assert.equal(
    createSchedulingPreferenceSummary(
      [orphanedRole, orphanedService],
      groups,
    ).count,
    0,
  );
});

test('a member with no meaningful service-role combination gets an explicit state', () => {
  assert.deepEqual(createSchedulingPreferenceSummary([], [
    { role: roles[0], services: [] },
  ]), {
    count: 0,
    description: 'No weekly services currently use your assigned roles.',
    totalOptions: 0,
    value: 'Not available',
  });
});

test('option lookup keeps recurring-service identity paired with its role', () => {
  assert.deepEqual(
    findSchedulingPreferenceOption(
      groups,
      'service-wednesday',
      'role-sound',
    ),
    {
      role: roles[1],
      service: services[1],
    },
  );
  assert.equal(
    findSchedulingPreferenceOption(
      groups,
      'service-wednesday',
      'role-piano',
    ),
    null,
  );
});

test('weekly-service times format without date or timezone conversion', () => {
  assert.equal(formatSchedulingPreferenceTime('00:05:00'), '12:05 AM');
  assert.equal(formatSchedulingPreferenceTime('12:00:00'), '12:00 PM');
  assert.equal(formatSchedulingPreferenceTime('19:30:00'), '7:30 PM');
  assert.equal(formatSchedulingPreferenceTime('invalid'), 'invalid');
});

test('optimistic rollback can restore the exact previous membership set', () => {
  const existing = preference({
    id: 'preference-existing',
    recurringServiceId: 'service-wednesday',
    roleId: 'role-sound',
  });
  const identity = {
    church_id: 'church-a',
    member_id: 'member-a',
    recurring_service_id: 'service-sunday',
    role_id: 'role-piano',
  };
  const previous = [existing];
  const optimistic = applySchedulingPreferenceToggle(
    previous,
    identity,
    true,
  );

  assert.equal(optimistic.length, 2);
  assert.deepEqual(previous, [existing]);
  assert.deepEqual(
    applySchedulingPreferenceToggle(optimistic, identity, false),
    [existing],
  );
});
