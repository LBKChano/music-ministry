import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyNotificationRealtimePayload,
  applyNotificationUnreadCountRealtimePayload,
} from '../lib/realtime/cache-updates.ts';

const notification = (overrides = {}) => ({
  id: 'notification-1',
  church_id: 'church-1',
  member_id: 'member-1',
  event_key: 'event-1',
  notification_type: 'service_reminder',
  title: 'Reminder',
  body: 'Service soon',
  data: {},
  read_at: null,
  created_at: '2026-08-12T12:00:00.000Z',
  ...overrides,
});

const payload = (eventType, row, old = {}) => ({
  commit_timestamp: '2026-08-12T12:00:00.000Z',
  errors: null,
  eventType,
  new: eventType === 'DELETE' ? {} : row,
  old: eventType === 'DELETE' ? { id: row.id, ...old } : old,
  schema: 'public',
  table: 'member_notifications',
});

test('retention DELETE removes only its cached notification', () => {
  const retained = notification({ id: 'retained', read_at: '2026-08-01T12:00:00.000Z' });
  const pruned = notification({ id: 'pruned', read_at: '2026-05-01T12:00:00.000Z' });
  const rows = applyNotificationRealtimePayload(
    [retained, pruned],
    payload('DELETE', pruned),
  );

  assert.deepEqual(rows.map(row => row.id), ['retained']);
});

test('known read retention deletes leave unread count unchanged without a refetch', () => {
  const pruned = notification({ read_at: '2026-05-01T12:00:00.000Z' });
  assert.deepEqual(
    applyNotificationUnreadCountRealtimePayload(
      4,
      payload('DELETE', pruned),
      [pruned],
    ),
    { count: 4, needsRefresh: false },
  );
});

test('known unread deletes never make the bell count negative', () => {
  const unread = notification();
  assert.deepEqual(
    applyNotificationUnreadCountRealtimePayload(
      0,
      payload('DELETE', unread),
      [unread],
    ),
    { count: 0, needsRefresh: false },
  );
});

test('unknown DELETE payloads request only an exact count refresh', () => {
  const result = applyNotificationUnreadCountRealtimePayload(
    3,
    payload('DELETE', notification()),
    [],
  );
  assert.deepEqual(result, { count: 3, needsRefresh: true });
});

test('inserts and read transitions update a known count locally', () => {
  const unread = notification();
  assert.deepEqual(
    applyNotificationUnreadCountRealtimePayload(
      2,
      payload('INSERT', unread),
      [],
    ),
    { count: 3, needsRefresh: false },
  );

  assert.deepEqual(
    applyNotificationUnreadCountRealtimePayload(
      3,
      payload('INSERT', unread),
      [unread],
    ),
    { count: 3, needsRefresh: false },
  );

  const markedRead = notification({ read_at: '2026-08-12T12:05:00.000Z' });
  assert.deepEqual(
    applyNotificationUnreadCountRealtimePayload(
      3,
      payload('UPDATE', markedRead),
      [unread],
    ),
    { count: 2, needsRefresh: false },
  );
});

test('an insert without cached history is reconciled by the count-only query', () => {
  assert.deepEqual(
    applyNotificationUnreadCountRealtimePayload(
      2,
      payload('INSERT', notification()),
      undefined,
    ),
    { count: 3, needsRefresh: true },
  );
});
