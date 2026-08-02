import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyNotificationPreferenceChange,
  countEnabledNotificationPreferences,
  createDefaultNotificationPreferences,
  createNotificationPreferenceSummary,
  normalizeNotificationPreferences,
} from '../lib/notifications/preferences.ts';
import { applyNotificationPreferenceRows } from '../supabase/functions/_shared/notification-preferences.ts';

test('a missing preference row keeps every legacy notification enabled', () => {
  const preferences = normalizeNotificationPreferences(
    null,
    'church-a',
    'member-a',
  );

  assert.deepEqual(
    preferences,
    createDefaultNotificationPreferences('church-a', 'member-a'),
  );
  assert.equal(countEnabledNotificationPreferences(preferences), 4);
});

test('only an explicit false suppresses a sender recipient', () => {
  assert.deepEqual(
    applyNotificationPreferenceRows(
      ['member-c', 'member-a', 'member-b', 'member-a'],
      'fill_in_requests',
      [
        { member_id: 'member-a', fill_in_requests: false },
        { member_id: 'member-b', fill_in_requests: null },
      ],
    ),
    {
      enabledMemberIds: ['member-b', 'member-c'],
      optedOutMemberIds: ['member-a'],
    },
  );
});

test('normalization preserves explicit opt-outs and rejects nullable ambiguity', () => {
  const preferences = normalizeNotificationPreferences({
    church_id: 'church-a',
    member_id: 'member-a',
    service_reminders: false,
    fill_in_requests: true,
    fill_in_updates: null,
    service_comments: false,
    has_explicit_preferences: true,
    updated_at: '2026-08-01T00:00:00Z',
  }, 'fallback-church', 'fallback-member');

  assert.equal(preferences.service_reminders, false);
  assert.equal(preferences.fill_in_requests, true);
  assert.equal(preferences.fill_in_updates, true);
  assert.equal(preferences.service_comments, false);
  assert.equal(preferences.has_explicit_preferences, true);
});

test('optimistic updates are immutable and can roll back exactly', () => {
  const previous = createDefaultNotificationPreferences(
    'church-a',
    'member-a',
  );
  const optimistic = applyNotificationPreferenceChange(
    previous,
    'service_comments',
    false,
  );

  assert.equal(previous.service_comments, true);
  assert.equal(optimistic.service_comments, false);
  assert.equal(optimistic.has_explicit_preferences, true);
  assert.deepEqual(previous, createDefaultNotificationPreferences(
    'church-a',
    'member-a',
  ));
});

test('Profile summary combines church delivery count with device status', () => {
  const preferences = {
    ...createDefaultNotificationPreferences('church-a', 'member-a'),
    service_reminders: false,
    fill_in_updates: false,
  };

  assert.deepEqual(
    createNotificationPreferenceSummary(
      preferences,
      'Notifications are disabled on this device.',
    ),
    {
      description: '2 of 4 delivery types are enabled for this church. Notifications are disabled on this device.',
      value: '2 of 4',
    },
  );
});
