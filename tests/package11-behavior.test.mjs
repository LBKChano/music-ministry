import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_CHURCH_DISPLAY_NAME_LENGTH,
  updateMatchingMembershipName,
  updateMatchingMembershipNameInList,
  validateChurchDisplayName,
} from '../lib/profile/identity.ts';

const accountId = 'account-a';
const churchA = {
  id: 'membership-a',
  church_id: 'church-a',
  member_id: accountId,
  name: 'Church A Name',
  email: 'person@example.com',
  is_admin: true,
};
const churchB = {
  id: 'membership-b',
  church_id: 'church-b',
  member_id: accountId,
  name: 'Church B Name',
  email: 'person@example.com',
  is_admin: false,
};
const otherAccount = {
  id: 'membership-c',
  church_id: 'church-b',
  member_id: 'account-b',
  name: 'Other Account',
  email: 'other@example.com',
  is_admin: false,
};

test('church display names are trimmed and length-limited', () => {
  assert.deepEqual(validateChurchDisplayName('  Lisandro Braun  '), {
    normalizedName: 'Lisandro Braun',
    error: null,
  });
  assert.equal(
    validateChurchDisplayName('x'.repeat(MAX_CHURCH_DISPLAY_NAME_LENGTH)).error,
    null,
  );
  assert.match(
    validateChurchDisplayName(
      'x'.repeat(MAX_CHURCH_DISPLAY_NAME_LENGTH + 1),
    ).error,
    /120 characters or fewer/,
  );
});

test('empty and control-character display names are rejected', () => {
  assert.match(validateChurchDisplayName('   ').error, /Enter the name/);
  assert.match(validateChurchDisplayName('Bad\nName').error, /control characters/);
  assert.match(validateChurchDisplayName('Bad\u007fName').error, /control characters/);
});

test('an optimistic name update touches only one account and church membership', () => {
  const result = updateMatchingMembershipNameInList(
    [churchA, churchB, otherAccount],
    {
      accountId,
      churchId: churchB.church_id,
      membershipId: churchB.id,
      name: 'Updated Church B',
    },
  );

  assert.equal(result[0], churchA);
  assert.deepEqual(result[1], {
    ...churchB,
    name: 'Updated Church B',
  });
  assert.equal(result[2], otherAccount);
  assert.equal(result[1].is_admin, false);
  assert.equal(result[1].email, churchB.email);
});

test('rollback is conditional and cannot overwrite a newer Realtime name', () => {
  const optimistic = updateMatchingMembershipName(churchB, {
    accountId,
    churchId: churchB.church_id,
    membershipId: churchB.id,
    name: 'Optimistic Name',
  });
  const rolledBack = updateMatchingMembershipName(optimistic, {
    accountId,
    churchId: churchB.church_id,
    membershipId: churchB.id,
    expectedName: 'Optimistic Name',
    name: churchB.name,
  });
  assert.equal(rolledBack.name, churchB.name);

  const newerRealtimeValue = { ...optimistic, name: 'Newer Device Name' };
  const preserved = updateMatchingMembershipName(newerRealtimeValue, {
    accountId,
    churchId: churchB.church_id,
    membershipId: churchB.id,
    expectedName: 'Optimistic Name',
    name: churchB.name,
  });
  assert.equal(preserved, newerRealtimeValue);
});

test('mismatched membership identifiers never update', () => {
  for (const override of [
    { accountId: 'account-b' },
    { churchId: 'church-a' },
    { membershipId: 'membership-a' },
  ]) {
    const result = updateMatchingMembershipName(churchB, {
      accountId,
      churchId: churchB.church_id,
      membershipId: churchB.id,
      name: 'Forbidden',
      ...override,
    });
    assert.equal(result, churchB);
  }
});
