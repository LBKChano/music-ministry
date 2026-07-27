import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeBulkServiceDeleteResult,
  removeDeletedServices,
} from '../lib/admin/bulk-service-deletion.ts';

test('normalizes a bulk service deletion preview defensively', () => {
  const result = normalizeBulkServiceDeleteResult({
    operation: 'preview',
    service_count: 2,
    service_ids: ['service-1', 'service-2'],
    services: [
      {
        id: 'service-1',
        date: '2026-08-02',
        time: '09:00:00',
        service_type: 'Sunday Morning',
        assignment_count: 4,
        fill_in_request_count: 1,
        song_count: 3,
        sent_reminder_count: 2,
        member_notification_count: 2,
        notification_log_count: 1,
      },
      {
        id: 'service-2',
        date: '2026-08-09',
        time: null,
        service_type: 'Sunday Morning',
      },
    ],
    dependent_counts: {
      assignments: 4,
      fill_in_requests: 1,
      songs: 3,
      sent_reminders: 2,
      member_notifications: 2,
      notification_logs: 1,
    },
    deleted_service_ids: [],
  });

  assert.equal(result.operation, 'preview');
  assert.deepEqual(result.service_ids, ['service-1', 'service-2']);
  assert.equal(result.services[0].assignment_count, 4);
  assert.equal(result.services[1].assignment_count, 0);
  assert.equal(result.dependent_counts.notification_logs, 1);
});

test('removes every deleted service from an independent cache window', () => {
  const deletedIds = new Set(['service-2', 'service-4']);
  const firstWindow = [
    { id: 'service-1', date: '2026-08-02' },
    { id: 'service-2', date: '2026-08-09' },
  ];
  const secondWindow = [
    { id: 'service-3', date: '2026-09-06' },
    { id: 'service-4', date: '2026-09-13' },
  ];

  assert.deepEqual(
    removeDeletedServices(firstWindow, deletedIds).map(service => service.id),
    ['service-1']
  );
  assert.deepEqual(
    removeDeletedServices(secondWindow, deletedIds).map(service => service.id),
    ['service-3']
  );
});
