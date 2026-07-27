import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applySchedulingPreferenceToggle,
  buildSchedulingPreferenceGroups,
  hasSchedulingPreference,
  serviceUsesSchedulingRole,
} from '../lib/scheduling/preferences.ts';

const identity = {
  church_id: 'church-1',
  member_id: 'member-1',
  recurring_service_id: 'service-1',
  role_id: 'role-1',
};

test('weekly services match member roles with normalized spelling', () => {
  const service = {
    id: 'service-1',
    name: 'Sunday Service',
    day_of_week: 0,
    time: '09:00:00',
    roles: [' Song   Leader ', 'Piano'],
  };

  assert.equal(serviceUsesSchedulingRole(service, 'song leader'), true);
  assert.equal(serviceUsesSchedulingRole(service, 'Sound'), false);
});

test('preference groups include only meaningful service-role combinations', () => {
  const groups = buildSchedulingPreferenceGroups(
    [
      { role_id: 'role-piano', role_name: 'Piano' },
      { role_id: 'role-sound', role_name: 'Sound' },
    ],
    [
      {
        id: 'service-wednesday',
        name: 'Midweek',
        day_of_week: 3,
        time: '19:00:00',
        roles: ['Sound'],
      },
      {
        id: 'service-sunday',
        name: 'Sunday Service',
        day_of_week: 0,
        time: '09:00:00',
        roles: ['Piano', 'Sound'],
      },
    ],
  );

  assert.deepEqual(
    groups.map(group => ({
      role: group.role.role_name,
      services: group.services.map(service => service.id),
    })),
    [
      { role: 'Piano', services: ['service-sunday'] },
      {
        role: 'Sound',
        services: ['service-sunday', 'service-wednesday'],
      },
    ],
  );
});

test('optimistic preference toggles add, replace, and remove one identity', () => {
  const optimistic = applySchedulingPreferenceToggle([], identity, true);
  assert.equal(
    hasSchedulingPreference(optimistic, 'service-1', 'role-1'),
    true,
  );
  assert.match(optimistic[0].id, /^optimistic:/);

  const persisted = {
    ...identity,
    id: 'preference-1',
    created_at: '2026-07-27T00:00:00Z',
    updated_at: '2026-07-27T00:00:00Z',
  };
  const confirmed = applySchedulingPreferenceToggle(
    optimistic,
    identity,
    true,
    persisted,
  );
  assert.deepEqual(confirmed, [persisted]);

  assert.deepEqual(
    applySchedulingPreferenceToggle(confirmed, identity, false),
    [],
  );
});
