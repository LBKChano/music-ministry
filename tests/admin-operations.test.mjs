import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient } from '@tanstack/react-query';

import {
  createAutoAssignPreviewKey,
  isMissingRpcFunctionError,
} from '../lib/admin/operations.ts';
import {
  buildNotificationTargets,
  resolveNotificationSubscriptions,
  sendOneSignalNotification,
  successfulSubscriptionMembers,
} from '../supabase/functions/_shared/onesignal.ts';
import {
  applyAssignmentRealtimePayload,
  applyNotificationRealtimePayload,
  applyServiceCommentRealtimePayload,
  applyServiceRealtimePayload,
  upsertFillInRequest,
} from '../lib/realtime/cache-updates.ts';
import { queryKeys } from '../lib/query/keys.ts';

const baseInput = {
  churchId: 'church-1',
  mode: 'fill_empty',
  range: {
    target_start_date: '2026-08-01',
    target_end_date: '2026-08-31',
    target_service_ids: null,
  },
  allowMultipleRolesSameService: false,
  services: [
    {
      id: 'service-2',
      date: '2026-08-09',
      time: '09:00',
      updated_at: '2026-07-26T12:00:00Z',
      assignments: [
        {
          id: 'assignment-2',
          role: 'Piano',
          member_id: null,
          person_name: '',
        },
      ],
    },
    {
      id: 'service-1',
      date: '2026-08-02',
      time: '09:00',
      updated_at: '2026-07-26T12:00:00Z',
      assignments: [],
    },
  ],
  members: [
    {
      id: 'member-2',
      name: 'Second',
      email: 'second@example.com',
      is_admin: false,
      memberRoles: [{ role_id: 'role-2', role_name: 'Piano' }],
    },
    {
      id: 'member-1',
      name: 'First',
      email: 'first@example.com',
      is_admin: true,
      memberRoles: [{ role_id: 'role-1', role_name: 'Song Leader' }],
    },
  ],
};

test('auto-assign preview key is stable when collection order changes', () => {
  const first = createAutoAssignPreviewKey(baseInput);
  const reordered = createAutoAssignPreviewKey({
    ...baseInput,
    services: [...baseInput.services].reverse(),
    members: [...baseInput.members].reverse(),
  });

  assert.equal(reordered, first);
});

test('auto-assign preview key changes when an assignment changes', () => {
  const first = createAutoAssignPreviewKey(baseInput);
  const changed = createAutoAssignPreviewKey({
    ...baseInput,
    services: baseInput.services.map(service => (
      service.id === 'service-2'
        ? {
          ...service,
          assignments: service.assignments.map(assignment => ({
            ...assignment,
            member_id: 'member-2',
            person_name: 'Second',
          })),
        }
        : service
    )),
  });

  assert.notEqual(changed, first);
});

test('auto-assign preview key changes when range or church settings change', () => {
  const first = createAutoAssignPreviewKey(baseInput);
  const changedRange = createAutoAssignPreviewKey({
    ...baseInput,
    range: {
      ...baseInput.range,
      target_end_date: '2026-09-30',
    },
  });
  const changedSetting = createAutoAssignPreviewKey({
    ...baseInput,
    allowMultipleRolesSameService: true,
  });

  assert.notEqual(changedRange, first);
  assert.notEqual(changedSetting, first);
});

test('auto-assign preview key changes when a service source template changes', () => {
  const first = createAutoAssignPreviewKey(baseInput);
  const changed = createAutoAssignPreviewKey({
    ...baseInput,
    services: baseInput.services.map(service => (
      service.id === 'service-2'
        ? { ...service, recurring_service_id: 'weekly-service-1' }
        : service
    )),
  });

  assert.notEqual(changed, first);
});

test('missing RPC detection permits compatibility fallback only for missing functions', () => {
  assert.equal(isMissingRpcFunctionError({ code: 'PGRST202' }), true);
  assert.equal(isMissingRpcFunctionError({ code: '42883' }), true);
  assert.equal(
    isMissingRpcFunctionError({ message: 'Could not find the function public.example' }),
    true,
  );
  assert.equal(isMissingRpcFunctionError({ code: '42501', message: 'Forbidden' }), false);
  assert.equal(isMissingRpcFunctionError(null), false);
});

test('notification targeting retains every unique device for the same member', () => {
  const targets = buildNotificationTargets(
    ['member-1', 'member-2'],
    [
      {
        member_id: 'member-1',
        subscription_id: 'device-b',
        updated_at: '2026-07-26T12:00:00Z',
      },
      {
        member_id: 'member-1',
        subscription_id: 'device-a',
        updated_at: '2026-07-26T11:00:00Z',
      },
      {
        member_id: 'member-1',
        subscription_id: 'device-a',
        updated_at: '2026-07-26T10:00:00Z',
      },
    ],
  );

  assert.deepEqual(targets.subscriptionIds, ['device-a', 'device-b']);
  assert.deepEqual(targets.externalIds, ['member-2']);
  assert.deepEqual(
    targets.subscriptionRows.map((row) => row.member_id),
    ['member-1', 'member-1'],
  );
});

test('one account device covers multiple memberships without alias duplication', () => {
  const targets = buildNotificationTargets(
    ['member-church-a', 'member-church-b'],
    [
      {
        member_id: 'member-church-a',
        subscription_id: 'shared-device',
      },
      {
        member_id: 'member-church-b',
        subscription_id: 'shared-device',
      },
    ],
  );

  assert.deepEqual(targets.subscriptionIds, ['shared-device']);
  assert.deepEqual(targets.externalIds, []);
  assert.deepEqual(targets.subscriptionRows, [
    {
      member_id: 'member-church-a',
      subscription_id: 'shared-device',
    },
    {
      member_id: 'member-church-b',
      subscription_id: 'shared-device',
    },
  ]);
  assert.deepEqual(
    Array.from(successfulSubscriptionMembers(targets.subscriptionRows, [])),
    ['member-church-a', 'member-church-b'],
  );
});

test('notification subscription resolver normalizes service-role RPC rows', async () => {
  const calls = [];
  const rows = await resolveNotificationSubscriptions({
    rpc: async (functionName, args) => {
      calls.push({ functionName, args });
      return {
        data: [
          {
            member_id: 'member-1',
            subscription_id: ' device-1 ',
          },
          {
            member_id: null,
            subscription_id: 'ignored',
          },
        ],
        error: null,
      };
    },
  }, ['member-1', 'member-1']);

  assert.deepEqual(calls, [{
    functionName: 'resolve_notification_recipient_subscriptions',
    args: { target_member_ids: ['member-1'] },
  }]);
  assert.deepEqual(rows, [{
    member_id: 'member-1',
    subscription_id: ' device-1 ',
  }]);
});

test('partial OneSignal validation errors do not retry healthy devices', async () => {
  const originalFetch = globalThis.fetch;
  const requestBodies = [];
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({
      id: '00000000-0000-4000-8000-000000000001',
      recipients: 1,
      errors: { invalid_player_ids: ['device-b'] },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const result = await sendOneSignalNotification({
      appId: 'app-id',
      apiKey: 'api-key',
      eventKey: 'service_reminder:service-1:member-1:24',
      externalIds: [],
      subscriptionIds: ['device-b', 'device-a', 'device-a'],
      title: 'Reminder',
      body: 'Body',
      data: { type: 'service_reminder' },
    });

    assert.equal(requestBodies.length, 1);
    assert.deepEqual(
      requestBodies[0].include_subscription_ids,
      ['device-a', 'device-b'],
    );
    assert.match(
      requestBodies[0].idempotency_key,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    assert.equal(result.sent, 1);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.invalidSubscriptionIds, ['device-b']);
    assert.deepEqual(result.successfulTargetLabels, ['subscription_ids']);
    assert.deepEqual(
      Array.from(successfulSubscriptionMembers([
        { member_id: 'member-1', subscription_id: 'device-a' },
        { member_id: 'member-1', subscription_id: 'device-b' },
      ], result.invalidSubscriptionIds)),
      ['member-1'],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const service = {
  id: 'service-1',
  church_id: 'church-1',
  date: '2026-08-02',
  time: '09:00:00',
  service_type: 'Sunday Service',
  notes: null,
  created_at: '2026-07-26T12:00:00Z',
  updated_at: '2026-07-26T12:00:00Z',
  assignments: [
    {
      id: 'assignment-1',
      service_id: 'service-1',
      member_id: null,
      role: 'Piano',
      person_name: '',
      created_at: '2026-07-26T12:00:00Z',
    },
  ],
  service_comments: [],
};

const realtimePayload = (eventType, next, old = {}) => ({
  schema: 'public',
  table: 'test',
  commit_timestamp: '2026-07-26T12:05:00Z',
  errors: [],
  eventType,
  new: next,
  old,
});

test('service deletion removes the service from every cached date window', () => {
  const client = new QueryClient();
  const root = queryKeys.servicesRoot('account-1', 'church-1');
  const firstWindow = queryKeys.services('account-1', 'church-1', '2026-07-26:2026-10-23');
  const secondWindow = queryKeys.services('account-1', 'church-1', 'all');
  client.setQueryData(firstWindow, [service]);
  client.setQueryData(secondWindow, [service]);

  applyServiceRealtimePayload(
    client,
    root,
    realtimePayload('DELETE', {}, { id: service.id }),
  );

  assert.deepEqual(client.getQueryData(firstWindow), []);
  assert.deepEqual(client.getQueryData(secondWindow), []);
});

test('manual reassignment updates one cached assignment without duplication', () => {
  const client = new QueryClient();
  const root = queryKeys.servicesRoot('account-1', 'church-1');
  const windowKey = queryKeys.services('account-1', 'church-1', 'all');
  client.setQueryData(windowKey, [service]);
  const updatedAssignment = {
    ...service.assignments[0],
    member_id: 'member-1',
    person_name: 'Assigned Member',
  };

  applyAssignmentRealtimePayload(
    client,
    root,
    realtimePayload('UPDATE', updatedAssignment),
  );
  applyAssignmentRealtimePayload(
    client,
    root,
    realtimePayload('UPDATE', updatedAssignment),
  );

  const rows = client.getQueryData(windowKey);
  assert.equal(rows[0].assignments.length, 1);
  assert.equal(rows[0].assignments[0].member_id, 'member-1');
  assert.equal(rows[0].assignments[0].person_name, 'Assigned Member');
});

test('fill-in acceptance updates status and resolves the accepting member name', () => {
  const members = [
    {
      id: 'requester-1',
      church_id: 'church-1',
      member_id: 'account-1',
      email: 'requester@example.com',
      name: 'Requester',
      role: null,
      is_admin: false,
      created_at: '2026-07-01T00:00:00Z',
    },
    {
      id: 'member-1',
      church_id: 'church-1',
      member_id: 'account-2',
      email: 'filler@example.com',
      name: 'Filler',
      role: null,
      is_admin: false,
      created_at: '2026-07-01T00:00:00Z',
    },
  ];
  const pendingRequest = {
    id: 'request-1',
    assignment_id: 'assignment-1',
    service_id: 'service-1',
    church_id: 'church-1',
    requesting_member_id: 'requester-1',
    role_name: 'Piano',
    reason: null,
    status: 'pending',
    filled_by_member_id: null,
    created_at: '2026-07-26T12:00:00Z',
    updated_at: '2026-07-26T12:00:00Z',
  };
  const filledRequest = {
    ...pendingRequest,
    status: 'filled',
    filled_by_member_id: 'member-1',
    updated_at: '2026-07-26T12:05:00Z',
  };

  const pendingRows = upsertFillInRequest([], pendingRequest, members);
  const filledRows = upsertFillInRequest(pendingRows, filledRequest, members);

  assert.equal(filledRows.length, 1);
  assert.equal(filledRows[0].status, 'filled');
  assert.equal(filledRows[0].requesting_member_name, 'Requester');
  assert.equal(filledRows[0].filled_by_member_name, 'Filler');
});

test('duplicate song and notification realtime events remain idempotent', () => {
  const client = new QueryClient();
  const root = queryKeys.servicesRoot('account-1', 'church-1');
  const windowKey = queryKeys.services('account-1', 'church-1', 'all');
  client.setQueryData(windowKey, [service]);
  const comment = {
    id: 'comment-1',
    church_id: 'church-1',
    service_id: 'service-1',
    member_id: 'member-1',
    comment_text: 'Amazing Grace',
    display_order: 0,
    song_type: 'Opening',
    song_number: '1',
    created_at: '2026-07-26T12:00:00Z',
    updated_at: '2026-07-26T12:00:00Z',
  };
  const commentPayload = realtimePayload('INSERT', comment);
  applyServiceCommentRealtimePayload(client, root, commentPayload, {
    name: 'Member',
    email: 'member@example.com',
  });
  applyServiceCommentRealtimePayload(client, root, commentPayload, {
    name: 'Member',
    email: 'member@example.com',
  });

  const cachedServices = client.getQueryData(windowKey);
  assert.equal(cachedServices[0].service_comments.length, 1);

  const notification = {
    id: 'notification-1',
    church_id: 'church-1',
    member_id: 'member-1',
    notification_type: 'service_comment',
    title: 'Song added',
    body: 'Amazing Grace',
    data: {},
    read_at: null,
    created_at: '2026-07-26T12:00:00Z',
  };
  const notificationPayload = realtimePayload('INSERT', notification);
  let notifications = applyNotificationRealtimePayload([], notificationPayload);
  notifications = applyNotificationRealtimePayload(notifications, notificationPayload);

  assert.equal(notifications.length, 1);
});

test('song realtime updates converge on persisted display order', () => {
  const client = new QueryClient();
  const root = queryKeys.servicesRoot('account-1', 'church-1');
  const windowKey = queryKeys.services('account-1', 'church-1', 'all');
  const first = {
    id: 'comment-first',
    church_id: 'church-1',
    service_id: 'service-1',
    member_id: 'member-1',
    comment_text: 'First',
    display_order: 0,
    song_type: 'Opening',
    song_number: null,
    created_at: '2026-07-26T12:00:00Z',
    updated_at: '2026-07-26T12:00:00Z',
  };
  const second = {
    ...first,
    id: 'comment-second',
    comment_text: 'Second',
    display_order: 1,
    created_at: '2026-07-26T12:01:00Z',
  };
  client.setQueryData(windowKey, [{
    ...service,
    service_comments: [first, second],
  }]);

  applyServiceCommentRealtimePayload(
    client,
    root,
    realtimePayload('UPDATE', {
      ...second,
      display_order: 0,
      updated_at: '2026-07-26T12:05:00Z',
    })
  );
  applyServiceCommentRealtimePayload(
    client,
    root,
    realtimePayload('UPDATE', {
      ...first,
      display_order: 1,
      updated_at: '2026-07-26T12:05:00Z',
    })
  );

  const cachedServices = client.getQueryData(windowKey);
  assert.deepEqual(
    cachedServices[0].service_comments.map(comment => comment.id),
    ['comment-second', 'comment-first']
  );
});

test('account-scoped cache removal cannot remove another account', () => {
  const client = new QueryClient();
  const firstAccountKey = queryKeys.services('account-1', 'church-1', 'all');
  const secondAccountKey = queryKeys.services('account-2', 'church-1', 'all');
  client.setQueryData(firstAccountKey, [service]);
  client.setQueryData(secondAccountKey, [service]);

  client.removeQueries({ queryKey: queryKeys.account('account-1') });

  assert.equal(client.getQueryData(firstAccountKey), undefined);
  assert.deepEqual(client.getQueryData(secondAccountKey), [service]);
});
