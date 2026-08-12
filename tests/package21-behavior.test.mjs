import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildScheduleWidgetSnapshot,
  canBuildScheduleWidgetSnapshot,
  createEmptyScheduleWidgetSnapshot,
  createScheduleWidgetScopeFingerprint,
  isScheduleWidgetSnapshotStale,
  parseScheduleWidgetSnapshot,
} from '../lib/widgets/schedule-widget-model.ts';

const now = new Date(2026, 7, 1, 10, 0, 0);
const services = [
  {
    id: 'service-unassigned',
    date: '2026-08-02',
    time: '09:00:00',
    service_type: 'Sunday Morning',
    assignments: [{ member_id: 'other-member', role: 'Piano', person_name: 'Elly' }],
  },
  {
    id: 'service-assigned',
    date: '2026-08-09',
    time: '09:00:00',
    service_type: 'Sunday Morning',
    assignments: [
      { member_id: 'member-21', role: 'Vocals', person_name: 'Lisandro' },
      { member_id: 'member-21', role: 'Guitar', person_name: 'Lisandro' },
      { member_id: 'member-21', role: ' vocals ', person_name: ' Lisandro ' },
    ],
  },
];

test('the two widget projections select independent next services', () => {
  const snapshot = buildScheduleWidgetSnapshot({
    churchName: 'Grace Church',
    currentMemberId: 'member-21',
    scopeFingerprint: 'scope-a',
    services,
    now,
  });

  assert.equal(snapshot.churchServices[0].serviceId, 'service-unassigned');
  assert.equal(snapshot.memberServices[0].serviceId, 'service-assigned');
  assert.deepEqual(snapshot.memberServices[0].roles, ['Guitar', 'Vocals']);
  assert.deepEqual(snapshot.churchServices[0].roles, []);
  assert.deepEqual(snapshot.churchServices[0].team, [
    { role: 'Piano', memberName: 'Elly' },
  ]);
});

test('church team entries are sanitized, sorted by role, and exclude open slots', () => {
  const snapshot = buildScheduleWidgetSnapshot({
    churchName: 'Grace Church',
    currentMemberId: 'member-21',
    scopeFingerprint: 'scope-a',
    now,
    services: [{
      id: 'service-team',
      date: '2026-08-03',
      time: '09:00',
      service_type: 'Sunday Morning',
      assignments: [
        { member_id: null, role: 'Drums', person_name: '' },
        { member_id: 'member-2', role: ' Vocals ', person_name: '  Maria\nLopez ' },
        { member_id: 'member-1', role: 'Piano', person_name: 'Elly' },
        { member_id: 'member-2', role: 'vocals', person_name: 'Maria Lopez' },
      ],
    }],
  });

  assert.deepEqual(snapshot.churchServices[0].team, [
    { role: 'Piano', memberName: 'Elly' },
    { role: 'Vocals', memberName: 'Maria Lopez' },
  ]);
});

test('past and malformed services are removed using local date and time', () => {
  const snapshot = buildScheduleWidgetSnapshot({
    churchName: 'Grace Church',
    currentMemberId: 'member-21',
    scopeFingerprint: 'scope-a',
    now,
    services: [
      { id: 'past-day', date: '2026-07-31', time: '23:59', service_type: 'Past' },
      { id: 'past-time', date: '2026-08-01', time: '09:59', service_type: 'Past Today' },
      { id: 'untimed-today', date: '2026-08-01', time: null, service_type: 'Untimed' },
      { id: 'future-time', date: '2026-08-01', time: '10:30', service_type: 'Future' },
      { id: 'invalid', date: 'not-a-date', time: '11:00', service_type: 'Invalid' },
    ],
  });

  assert.deepEqual(
    snapshot.churchServices.map(service => service.serviceId),
    ['untimed-today', 'future-time'],
  );
});

test('ordering is deterministic and snapshots stay bounded', () => {
  const unordered = Array.from({ length: 12 }, (_, index) => ({
    id: `service-${String(11 - index).padStart(2, '0')}`,
    date: '2026-08-03',
    time: '09:00',
    service_type: `Service ${index}`,
  }));
  const snapshot = buildScheduleWidgetSnapshot({
    churchName: 'Grace Church',
    currentMemberId: 'member-21',
    scopeFingerprint: 'scope-a',
    services: unordered,
    now,
  });

  assert.equal(snapshot.churchServices.length, 5);
  assert.deepEqual(
    snapshot.churchServices.map(service => service.serviceId),
    ['service-00', 'service-01', 'service-02', 'service-03', 'service-04'],
  );
});

test('deletion, reassignment, and fill-in acceptance rebuild both projections', () => {
  const build = nextServices => buildScheduleWidgetSnapshot({
    churchName: 'Grace Church',
    currentMemberId: 'member-21',
    scopeFingerprint: 'scope-a',
    services: nextServices,
    now,
  });

  const initial = build(services);
  const afterDeletion = build(services.filter(service => service.id !== 'service-unassigned'));
  assert.equal(initial.churchServices[0].serviceId, 'service-unassigned');
  assert.equal(afterDeletion.churchServices[0].serviceId, 'service-assigned');

  const afterReassignment = build(services.map(service => (
    service.id === 'service-assigned'
      ? { ...service, assignments: [{ member_id: 'other-member', role: 'Vocals', person_name: 'Other Member' }] }
      : service
  )));
  assert.deepEqual(afterReassignment.memberServices, []);

  const afterFillInAcceptance = build(services.map(service => (
    service.id === 'service-unassigned'
      ? { ...service, assignments: [{ member_id: 'member-21', role: 'Piano', person_name: 'Lisandro' }] }
      : service
  )));
  assert.equal(afterFillInAcceptance.memberServices[0].serviceId, 'service-unassigned');
  assert.deepEqual(afterFillInAcceptance.memberServices[0].roles, ['Piano']);
  assert.deepEqual(afterFillInAcceptance.churchServices[0].team, [
    { role: 'Piano', memberName: 'Lisandro' },
  ]);
});

test('snapshot text is sanitized without storing account identity', () => {
  const accountId = 'account-private';
  const fingerprint = createScheduleWidgetScopeFingerprint(
    accountId,
    'church-private',
    'member-private',
  );
  const snapshot = buildScheduleWidgetSnapshot({
    churchName: '  Grace\nChurch  ',
    currentMemberId: 'member-private',
    scopeFingerprint: fingerprint,
    services,
    now,
  });
  const serialized = JSON.stringify(snapshot);

  assert.equal(snapshot.churchName, 'Grace Church');
  assert.match(fingerprint, /^scope-[a-f0-9]{8}$/);
  assert.equal(serialized.includes(accountId), false);
  assert.equal(serialized.includes('church-private'), false);
  assert.equal(serialized.includes('member-private'), false);
});

test('widget timestamps remain readable by old and new native extensions', () => {
  const snapshot = buildScheduleWidgetSnapshot({
    churchName: 'Grace Church',
    currentMemberId: 'member-21',
    scopeFingerprint: 'scope-a',
    services,
    now: new Date('2026-08-12T22:37:39.123Z'),
  });

  assert.equal(snapshot.generatedAt, '2026-08-12T22:37:39Z');
  assert.equal(Number.isFinite(new Date(snapshot.generatedAt).getTime()), true);
});

test('cached services can refresh a widget even when background refresh fails', () => {
  assert.equal(canBuildScheduleWidgetSnapshot({
    servicesCount: 2,
    servicesError: 'Network unavailable',
    servicesLoading: false,
  }), true);
  assert.equal(canBuildScheduleWidgetSnapshot({
    servicesCount: 0,
    servicesError: 'Network unavailable',
    servicesLoading: false,
  }), false);
  assert.equal(canBuildScheduleWidgetSnapshot({
    servicesCount: 0,
    servicesError: null,
    servicesLoading: true,
  }), false);
  assert.equal(canBuildScheduleWidgetSnapshot({
    servicesCount: 0,
    servicesError: null,
    servicesLoading: false,
  }), true);
});

test('account and church scope fingerprints isolate widget generations', () => {
  const first = createScheduleWidgetScopeFingerprint('account-a', 'church-a', 'member-a');
  const accountSwitch = createScheduleWidgetScopeFingerprint('account-b', 'church-a', 'member-a');
  const churchSwitch = createScheduleWidgetScopeFingerprint('account-a', 'church-b', 'member-b');

  assert.notEqual(first, accountSwitch);
  assert.notEqual(first, churchSwitch);
  assert.equal(first, createScheduleWidgetScopeFingerprint('account-a', 'church-a', 'member-a'));
});

test('empty states contain no church or service data', () => {
  for (const state of ['signed_out', 'no_church', 'unavailable']) {
    const snapshot = createEmptyScheduleWidgetSnapshot(state, now);
    assert.equal(snapshot.state, state);
    assert.equal(snapshot.churchName, null);
    assert.equal(snapshot.scopeFingerprint, null);
    assert.deepEqual(snapshot.churchServices, []);
    assert.deepEqual(snapshot.memberServices, []);
  }
});

test('snapshot parsing rejects malformed or unsupported data', () => {
  const ready = buildScheduleWidgetSnapshot({
    churchName: 'Grace Church',
    currentMemberId: 'member-21',
    scopeFingerprint: 'scope-a',
    services,
    now,
  });

  assert.deepEqual(parseScheduleWidgetSnapshot(JSON.stringify(ready)), ready);
  const oldReady = {
    ...ready,
    churchServices: ready.churchServices.map(({ team: _team, ...service }) => service),
    memberServices: ready.memberServices.map(({ team: _team, ...service }) => service),
  };
  assert.deepEqual(parseScheduleWidgetSnapshot(JSON.stringify(oldReady)), oldReady);
  assert.equal(parseScheduleWidgetSnapshot('{bad json'), null);
  assert.equal(parseScheduleWidgetSnapshot(JSON.stringify({ ...ready, schemaVersion: 2 })), null);
  assert.equal(parseScheduleWidgetSnapshot(JSON.stringify({ ...ready, scopeFingerprint: null })), null);
});

test('staleness is based on the generated timestamp', () => {
  const snapshot = buildScheduleWidgetSnapshot({
    churchName: 'Grace Church',
    currentMemberId: 'member-21',
    scopeFingerprint: 'scope-a',
    services,
    now,
  });

  assert.equal(isScheduleWidgetSnapshotStale(snapshot, new Date(2026, 7, 2, 9, 59)), false);
  assert.equal(isScheduleWidgetSnapshotStale(snapshot, new Date(2026, 7, 2, 10, 1)), true);
});
