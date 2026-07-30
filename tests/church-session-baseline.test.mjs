import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hasChurchAdminAccess,
  membershipMatchesChurchSession,
  mergeVisibleChurches,
  resolveCurrentChurch,
} from '../lib/church/session-baseline.ts';

const churchA = {
  id: 'church-a',
  admin_id: 'account-owner',
  name: 'Church A',
};

const churchB = {
  id: 'church-b',
  admin_id: 'another-owner',
  name: 'Church B',
};

test('visible churches preserve first position while the later duplicate value wins', () => {
  const duplicateChurchA = { ...churchA, name: 'Membership query value' };
  const result = mergeVisibleChurches(
    [churchA],
    [duplicateChurchA, churchB],
  );

  assert.deepEqual(result, [duplicateChurchA, churchB]);
});

test('current church remains selected while access still exists', () => {
  assert.equal(
    resolveCurrentChurch([churchA, churchB], churchB.id),
    churchB,
  );
});

test('removed selection falls back deterministically and empty access returns null', () => {
  assert.equal(
    resolveCurrentChurch([churchA, churchB], 'removed-church'),
    churchA,
  );
  assert.equal(resolveCurrentChurch([], churchA.id), null);
});

test('membership identity must match both church and authenticated account', () => {
  const membership = {
    church_id: churchB.id,
    member_id: 'account-member',
    is_admin: true,
  };

  assert.equal(
    membershipMatchesChurchSession(
      membership,
      churchB.id,
      'account-member',
    ),
    true,
  );
  assert.equal(
    membershipMatchesChurchSession(
      membership,
      churchA.id,
      'account-member',
    ),
    false,
  );
  assert.equal(
    membershipMatchesChurchSession(
      membership,
      churchB.id,
      'different-account',
    ),
    false,
  );
});

test('church owner remains admin without relying on a loaded membership', () => {
  assert.equal(
    hasChurchAdminAccess(churchA, null, 'account-owner'),
    true,
  );
});

test('scheduling admin access is scoped to the matching church membership', () => {
  const adminMembership = {
    church_id: churchB.id,
    member_id: 'account-admin',
    is_admin: true,
  };

  assert.equal(
    hasChurchAdminAccess(churchB, adminMembership, 'account-admin'),
    true,
  );
  assert.equal(
    hasChurchAdminAccess(churchA, adminMembership, 'account-admin'),
    false,
  );
  assert.equal(
    hasChurchAdminAccess(churchB, adminMembership, 'different-account'),
    false,
  );
});

test('regular membership never grants admin access', () => {
  assert.equal(
    hasChurchAdminAccess(
      churchB,
      {
        church_id: churchB.id,
        member_id: 'account-member',
        is_admin: false,
      },
      'account-member',
    ),
    false,
  );
});
