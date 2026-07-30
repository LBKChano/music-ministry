import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChurchAccessSummaries,
} from '../lib/church/access.ts';
import {
  deactivateCurrentNotificationDevice,
  NotificationDeviceOperationQueue,
  registerCurrentNotificationDevice,
} from '../lib/notifications/device-registration.ts';

const churches = [
  {
    id: 'church-admin',
    admin_id: 'account-1',
  },
  {
    id: 'church-member',
    admin_id: 'account-2',
  },
  {
    id: 'church-scheduling-admin',
    admin_id: 'account-3',
  },
];

test('church access is calculated independently for every membership', () => {
  const access = buildChurchAccessSummaries(
    churches,
    [
      {
        id: 'membership-member',
        church_id: 'church-member',
        member_id: 'account-1',
        is_admin: false,
      },
      {
        id: 'membership-scheduling-admin',
        church_id: 'church-scheduling-admin',
        member_id: 'account-1',
        is_admin: true,
      },
    ],
    'account-1',
  );

  assert.deepEqual(access, [
    {
      churchId: 'church-admin',
      membershipId: null,
      isOwner: true,
      isAdmin: true,
      roleLabel: 'Admin',
    },
    {
      churchId: 'church-member',
      membershipId: 'membership-member',
      isOwner: false,
      isAdmin: false,
      roleLabel: 'Member',
    },
    {
      churchId: 'church-scheduling-admin',
      membershipId: 'membership-scheduling-admin',
      isOwner: false,
      isAdmin: true,
      roleLabel: 'Admin',
    },
  ]);
});

test('church access ignores membership rows linked to another account', () => {
  const access = buildChurchAccessSummaries(
    [churches[1]],
    [{
      id: 'other-membership',
      church_id: 'church-member',
      member_id: 'account-else',
      is_admin: true,
    }],
    'account-1',
  );

  assert.deepEqual(access, [{
    churchId: 'church-member',
    membershipId: null,
    isOwner: false,
    isAdmin: false,
    roleLabel: 'Member',
  }]);
});

test('notification device operations serialize per physical subscription', async () => {
  const queue = new NotificationDeviceOperationQueue();
  const events = [];
  let releaseFirst;
  let markFirstStarted;
  const firstGate = new Promise(resolve => {
    releaseFirst = resolve;
  });
  const firstStarted = new Promise(resolve => {
    markFirstStarted = resolve;
  });

  const first = queue.run('device-1', async () => {
    events.push('register-start');
    markFirstStarted();
    await firstGate;
    events.push('register-end');
  });
  const second = queue.run('device-1', async () => {
    events.push('deactivate');
  });

  await firstStarted;
  assert.deepEqual(events, ['register-start']);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, [
    'register-start',
    'register-end',
    'deactivate',
  ]);
});

test('device registration writes the account record before the legacy member bridge', async () => {
  const calls = [];
  const client = {
    rpc: async (functionName, args) => {
      calls.push({ functionName, args });
      if (functionName === 'register_account_notification_device') {
        return {
          data: {
            account_id: 'account-1',
            subscription_id: 'device-1',
          },
          error: null,
        };
      }
      return { data: { id: 'legacy-row' }, error: null };
    },
    from: () => {
      throw new Error('Unexpected table operation');
    },
  };

  const result = await registerCurrentNotificationDevice({
    accountId: 'account-1',
    memberId: 'membership-1',
    subscriptionId: ' device-1 ',
    platform: 'android',
  }, client);

  assert.deepEqual(calls, [
    {
      functionName: 'register_account_notification_device',
      args: {
        target_subscription_id: 'device-1',
        target_platform: 'android',
      },
    },
    {
      functionName: 'claim_onesignal_subscription',
      args: {
        target_member_id: 'membership-1',
        target_subscription_id: 'device-1',
      },
    },
  ]);
  assert.deepEqual(result, {
    accountId: 'account-1',
    memberId: 'membership-1',
    subscriptionId: 'device-1',
  });
});

test('device registration rejects a response for a different account', async () => {
  const client = {
    rpc: async () => ({
      data: {
        account_id: 'account-else',
        subscription_id: 'device-1',
      },
      error: null,
    }),
    from: () => {
      throw new Error('Unexpected table operation');
    },
  };

  await assert.rejects(
    registerCurrentNotificationDevice({
      accountId: 'account-1',
      memberId: 'membership-1',
      subscriptionId: 'device-1',
      platform: 'ios',
    }, client),
    /did not match the active account/,
  );
});

test('sign-out deactivates only the current subscription and legacy membership row', async () => {
  const calls = [];
  const filters = [];
  const deleteRequest = {
    eq(column, value) {
      filters.push([column, value]);
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    },
  };
  const client = {
    rpc: async (functionName, args) => {
      calls.push({ functionName, args });
      return { data: true, error: null };
    },
    from: (tableName) => {
      assert.equal(tableName, 'onesignal_subscriptions');
      return {
        delete: () => deleteRequest,
      };
    },
  };

  const result = await deactivateCurrentNotificationDevice({
    memberId: 'membership-1',
    subscriptionId: 'device-1',
  }, client);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(calls, [{
    functionName: 'deactivate_account_notification_device',
    args: { target_subscription_id: 'device-1' },
  }]);
  assert.deepEqual(filters, [
    ['member_id', 'membership-1'],
    ['subscription_id', 'device-1'],
  ]);
});
