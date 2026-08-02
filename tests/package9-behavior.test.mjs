import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveChurchAdminSummary,
} from '../lib/church-admin/summary.ts';

const church = {
  id: 'church-a',
  admin_id: 'owner-a',
  created_at: '2026-07-29T00:00:00Z',
  updated_at: '2026-07-29T00:00:00Z',
  invitation_code: 'ABC123',
  name: 'Grace Church',
  allow_member_multiple_roles_same_service: false,
  song_type_options: ['Opening', 'Worship'],
};

test('a new church recommends roles after valid church details', () => {
  const summary = deriveChurchAdminSummary({
    church,
    memberCount: 1,
    roleCount: 0,
    weeklyServiceCount: 0,
    notificationSettings: null,
  });

  assert.equal(summary.setupReady, false);
  assert.equal(summary.recommendedNext, 'roles');
  assert.equal(summary.setupRows.find(row => row.id === 'members')?.required, false);
});

test('weekly services follow roles in the guided dependency order', () => {
  const summary = deriveChurchAdminSummary({
    church,
    memberCount: 1,
    roleCount: 4,
    weeklyServiceCount: 0,
    notificationSettings: null,
  });

  assert.equal(summary.recommendedNext, 'weekly_services');
  assert.equal(summary.setupReady, false);
});

test('core setup readiness is derived without a persisted completion flag', () => {
  const summary = deriveChurchAdminSummary({
    church,
    memberCount: 1,
    roleCount: 4,
    weeklyServiceCount: 2,
    notificationSettings: null,
  });

  assert.equal(summary.setupReady, true);
  assert.equal(summary.recommendedNext, 'members');
  assert.equal(summary.scheduleRows.every(row => row.ready), true);
});

test('optional sections report useful live summaries', () => {
  const summary = deriveChurchAdminSummary({
    church: {
      ...church,
      allow_member_multiple_roles_same_service: true,
    },
    memberCount: 14,
    roleCount: 6,
    weeklyServiceCount: 2,
    notificationSettings: {
      id: 'settings-a',
      church_id: church.id,
      enabled: true,
      notification_hours: [24, 6],
      created_at: '2026-07-29T00:00:00Z',
      updated_at: '2026-07-29T00:00:00Z',
    },
  });

  assert.equal(summary.setupRows.find(row => row.id === 'members')?.summary, '14 members');
  assert.equal(summary.setupRows.find(row => row.id === 'rules')?.summary, 'Multiple roles: On');
  assert.equal(summary.setupRows.find(row => row.id === 'reminders')?.summary, 'Active: 6 hours, 1 day');
});

test('paused reminders never imply delivery is active', () => {
  const summary = deriveChurchAdminSummary({
    church,
    memberCount: 3,
    roleCount: 2,
    weeklyServiceCount: 1,
    notificationSettings: {
      id: 'settings-a',
      church_id: church.id,
      enabled: false,
      notification_hours: [24],
      created_at: '2026-07-29T00:00:00Z',
      updated_at: '2026-07-29T00:00:00Z',
    },
  });

  assert.equal(summary.setupRows.find(row => row.id === 'reminders')?.summary, 'Paused');
});
