import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFillInEscalationRecipients,
  fillInEscalationEventKey,
  normalizeRoleName,
} from '../supabase/functions/_shared/fill-in-escalation.ts';

const churchMembers = [
  { id: 'requester', member_id: 'account-requester', is_admin: false, role: 'Keys' },
  { id: 'role-member', member_id: 'account-role', is_admin: false, role: null },
  { id: 'legacy-role', member_id: 'account-legacy', is_admin: false, role: '  keys  ' },
  { id: 'admin', member_id: 'account-admin', is_admin: true, role: 'Vocals' },
  { id: 'owner', member_id: 'account-owner', is_admin: false, role: null },
  { id: 'unrelated', member_id: 'account-unrelated', is_admin: false, role: 'Drums' },
];

test('fill-in escalation recipients include role members and admins exactly once', () => {
  const result = buildFillInEscalationRecipients({
    requestingMemberId: 'requester',
    requestedRoleName: ' Keys ',
    churchOwnerUserId: 'account-owner',
    churchMembers,
    memberRoleMemberIds: ['role-member', 'admin', 'role-member'],
  });

  assert.deepEqual(result.eligibleMemberIds, ['admin', 'legacy-role', 'role-member']);
  assert.deepEqual(result.adminMemberIds, ['admin', 'owner']);
  assert.deepEqual(result.recipientMemberIds, ['admin', 'legacy-role', 'owner', 'role-member']);
  assert.equal(result.recipientMemberIds.includes('requester'), false);
});

test('legacy role matching is normalized and does not broaden to other roles', () => {
  assert.equal(normalizeRoleName('  Worship   Leader '), 'worship leader');
  assert.equal(normalizeRoleName(''), '');

  const result = buildFillInEscalationRecipients({
    requestingMemberId: 'requester',
    requestedRoleName: 'Keys',
    churchOwnerUserId: null,
    churchMembers,
    memberRoleMemberIds: [],
  });
  assert.deepEqual(result.recipientMemberIds, ['admin', 'legacy-role']);
  assert.equal(result.recipientMemberIds.includes('unrelated'), false);
});

test('reminders use a distinct deterministic event key', () => {
  assert.equal(
    fillInEscalationEventKey('request-19'),
    'fill_in_request_reminder:request-19',
  );
  assert.notEqual(
    fillInEscalationEventKey('request-19'),
    'fill_in_request:request-19',
  );
});
