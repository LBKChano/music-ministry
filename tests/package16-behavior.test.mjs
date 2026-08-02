import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findActiveTabIndex,
  sanitizeUserFacingMessage,
  shouldDisplayAdminTab,
  shouldLeaveChurchTab,
} from '../lib/ui/package16.ts';

const memberTabs = [
  { name: '(home)', route: '/(tabs)/(home)' },
  { name: 'profile', route: '/(tabs)/profile' },
];

const adminTabs = [
  memberTabs[0],
  { name: 'church', route: '/(tabs)/church' },
  memberTabs[1],
];

test('tab selection handles exact routes, nested paths, and normalized Expo paths', () => {
  assert.equal(findActiveTabIndex('/(tabs)/profile', memberTabs), 1);
  assert.equal(findActiveTabIndex('/(tabs)/church/members', adminTabs), 1);
  assert.equal(findActiveTabIndex('/profile', memberTabs), 1);
  assert.equal(findActiveTabIndex('/', memberTabs), 0);
});

test('the Church tab is visible only for a ready admin membership', () => {
  assert.equal(shouldDisplayAdminTab('ready', true), true);
  assert.equal(shouldDisplayAdminTab('ready', false), false);
  assert.equal(shouldDisplayAdminTab('selecting-church', true), false);
  assert.equal(shouldDisplayAdminTab('error', true), false);
  assert.equal(shouldDisplayAdminTab('no-membership', true), false);
});

test('a ready member is moved away from an unauthorized Church route', () => {
  assert.equal(shouldLeaveChurchTab({
    pathname: '/(tabs)/church',
    sessionStatus: 'ready',
    isAdmin: false,
  }), true);
  assert.equal(shouldLeaveChurchTab({
    pathname: '/(tabs)/church',
    sessionStatus: 'selecting-church',
    isAdmin: false,
  }), false);
  assert.equal(shouldLeaveChurchTab({
    pathname: '/(tabs)/profile',
    sessionStatus: 'ready',
    isAdmin: false,
  }), false);
});

test('technical backend errors are replaced while ordinary feedback is retained', () => {
  assert.equal(
    sanitizeUserFacingMessage('Supabase RPC failed with PGRST116', 'error'),
    'We could not complete that action. Check your connection and try again.',
  );
  assert.equal(
    sanitizeUserFacingMessage(
      'Member 5f10aa8e-2e01-4e2d-b6a5-1ce2d3601d0f was not found',
      'error',
    ),
    'We could not complete that action. Check your connection and try again.',
  );
  assert.equal(
    sanitizeUserFacingMessage('Church details saved.', 'success'),
    'Church details saved.',
  );
  assert.equal(
    sanitizeUserFacingMessage('Check your connection and try again.', 'error'),
    'Check your connection and try again.',
  );
});
