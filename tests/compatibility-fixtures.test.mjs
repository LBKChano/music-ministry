import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  hasChurchAdminAccess,
  mergeVisibleChurches,
} from '../lib/church/session-baseline.ts';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(
  join(testsDirectory, 'fixtures', 'compatibility-scenarios.json'),
  'utf8',
));

function byId(rows, id) {
  return rows.find(row => row.id === id);
}

test('compatibility fixture IDs are unique within each entity collection', () => {
  for (const [name, rows] of Object.entries(fixture)) {
    if (!Array.isArray(rows) || rows.length === 0 || !('id' in rows[0])) continue;
    const ids = rows.map(row => row.id);
    assert.equal(
      new Set(ids).size,
      ids.length,
      `Duplicate IDs in fixture collection ${name}`,
    );
  }
});

test('one account is a member in church A and an admin in church B', () => {
  const accountId = fixture.expected.multiChurchAccount.account_id;
  const churchA = byId(fixture.churches, 'church-a');
  const churchB = byId(fixture.churches, 'church-b');
  const membershipA = byId(fixture.memberships, 'member-multi-a');
  const membershipB = byId(fixture.memberships, 'member-multi-b');

  assert.equal(hasChurchAdminAccess(churchA, membershipA, accountId), false);
  assert.equal(hasChurchAdminAccess(churchB, membershipB, accountId), true);
  assert.deepEqual(
    mergeVisibleChurches([churchB], [churchA, churchB]).map(church => church.id),
    ['church-b', 'church-a'],
  );
});

test('unclaimed invitation keeps identity and roles separate from an Auth user', () => {
  const invitedMembership = byId(
    fixture.memberships,
    fixture.expected.unclaimedInvitation,
  );

  assert.equal(invitedMembership.member_id, null);
  assert.equal(invitedMembership.email, 'invited@example.test');
  assert.equal(invitedMembership.name, 'Invited Singer');
});

test('hard unavailability and soft preference fixtures target the same membership', () => {
  const hardBlock = fixture.unavailability[0];
  const softPreference = fixture.schedulingPreferences[0];

  assert.equal(hardBlock.member_id, 'member-multi-a');
  assert.equal(softPreference.member_id, hardBlock.member_id);
  assert.equal(softPreference.church_id, 'church-a');
});

test('multi-device fixture contains two unique subscriptions for one member', () => {
  const memberId = fixture.expected.memberWithTwoDevices;
  const subscriptions = fixture.subscriptions
    .filter(subscription => subscription.member_id === memberId);

  assert.equal(subscriptions.length, 2);
  assert.equal(
    new Set(subscriptions.map(subscription => subscription.subscription_id)).size,
    2,
  );
});
