import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createManualAssignmentSections,
  getManualAssignmentCandidateReason,
  normalizeManualAssignmentCandidates,
  normalizeManualAssignmentError,
} from '../lib/services/manual-assignment-model.ts';

const base = {
  assignment_id: 'assignment-1',
  service_id: 'service-1',
  church_id: 'church-1',
  service_date: '2026-08-09',
  role_id: 'role-keys',
  role_name: 'Keys',
  eligible: true,
  reason_code: null,
  unavailable_date: null,
};

test('eligible role members sort by display name and stable member id', () => {
  const candidates = normalizeManualAssignmentCandidates([
    { ...base, member_id: 'member-z', display_name: 'Zoey' },
    { ...base, member_id: 'member-b', display_name: 'Alex' },
    { ...base, member_id: 'member-a', display_name: 'Alex' },
    { ...base, member_id: 'member-empty', display_name: '   ' },
  ]);

  assert.deepEqual(
    candidates.map(candidate => candidate.memberId),
    ['member-a', 'member-b', 'member-empty', 'member-z'],
  );
  assert.equal(candidates[2]?.displayName, 'Unnamed member');
});

test('blocked role members follow eligible members in a separate section', () => {
  const candidates = normalizeManualAssignmentCandidates([
    {
      ...base,
      member_id: 'unavailable',
      display_name: 'Unavailable Member',
      eligible: false,
      reason_code: 'unavailable_date',
      unavailable_date: '2026-08-09',
    },
    { ...base, member_id: 'eligible', display_name: 'Eligible Member' },
    {
      ...base,
      member_id: 'conflict',
      display_name: 'Conflict Member',
      eligible: false,
      reason_code: 'same_service_conflict',
    },
  ]);
  const sections = createManualAssignmentSections(candidates);

  assert.deepEqual(sections.map(section => section.title), [
    'Available',
    'Unavailable',
  ]);
  assert.deepEqual(sections[0].data.map(row => row.memberId), ['eligible']);
  assert.deepEqual(
    sections[1].data.map(row => row.memberId),
    ['conflict', 'unavailable'],
  );
});

test('unavailable and same-service reasons are friendly and date specific', () => {
  const [unavailable, conflict] = normalizeManualAssignmentCandidates([
    {
      ...base,
      member_id: 'unavailable',
      display_name: 'Unavailable Member',
      eligible: false,
      reason_code: 'unavailable_date',
      unavailable_date: '2026-08-09',
    },
    {
      ...base,
      member_id: 'conflict',
      display_name: 'Conflict Member',
      eligible: false,
      reason_code: 'same_service_conflict',
    },
  ]).sort((left, right) => (
    left.memberId === 'unavailable' ? -1 : right.memberId === 'unavailable' ? 1 : 0
  ));

  assert.equal(
    getManualAssignmentCandidateReason(unavailable),
    'Unavailable on Sunday, August 9',
  );
  assert.equal(
    getManualAssignmentCandidateReason(conflict),
    'Already assigned in this service',
  );
});

test('server reason codes become safe errors and stale data requests a refresh', () => {
  const stale = normalizeManualAssignmentError({
    message: 'database details',
    details: 'stale_assignment',
  });
  assert.equal(stale.code, 'stale_assignment');
  assert.equal(stale.shouldRefresh, true);
  assert.match(stale.message, /refreshed/);

  const unavailable = normalizeManualAssignmentError({
    details: 'unavailable_date',
  });
  assert.equal(unavailable.code, 'unavailable_date');
  assert.match(unavailable.message, /unavailable/);

  const unknown = normalizeManualAssignmentError({
    message: 'Supabase PGRST secret details',
  });
  assert.equal(unknown.code, 'unknown');
  assert.doesNotMatch(unknown.message, /Supabase|PGRST/);
});
