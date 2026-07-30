import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const migrationPath = join(
  projectRoot,
  'supabase',
  'migrations',
  '20260729182446_add_multi_church_account_device_foundation.sql',
);
const behaviorTestPath = join(
  projectRoot,
  'supabase',
  'tests',
  'multi_church_account_device_foundation.sql',
);

const migration = readFileSync(migrationPath, 'utf8');
const behaviorTest = readFileSync(behaviorTestPath, 'utf8');
const generatedTypes = readFileSync(
  join(projectRoot, 'lib', 'supabase', 'types.ts'),
  'utf8',
);
const deleteAccountFunction = readFileSync(
  join(
    projectRoot,
    'supabase',
    'functions',
    'delete-account',
    'index.ts',
  ),
  'utf8',
);
const notificationFunctionNames = [
  'send-service-reminders',
  'send-fill-in-notifications',
  'send-service-comment-notifications',
  'send-fill-in-accepted-notification',
];

test('Package 1 does not remove a released table, column, or public RPC', () => {
  assert.doesNotMatch(migration, /\bdrop\s+table\b/i);
  assert.doesNotMatch(migration, /\bdrop\s+column\b/i);
  assert.doesNotMatch(
    migration,
    /\bdrop\s+function\s+(?:if\s+exists\s+)?public\./i,
  );
  assert.doesNotMatch(
    migration,
    /create\s+or\s+replace\s+function\s+public\.claim_onesignal_subscription/i,
  );
});

test('one account membership per church is protected without blocking invitations', () => {
  assert.match(
    migration,
    /create\s+unique\s+index\s+if\s+not\s+exists\s+church_members_church_account_key/i,
  );
  assert.match(
    migration,
    /on\s+public\.church_members\s*\(church_id,\s*member_id\)\s*where\s+member_id\s+is\s+not\s+null/i,
  );
  assert.match(migration, /Package 1 blocked: % duplicate non-null/i);
});

test('atomic create and join RPCs derive identity and restrict execution', () => {
  for (const rpc of [
    'create_church_with_owner_membership',
    'join_church_by_invitation',
  ]) {
    assert.match(
      migration,
      new RegExp(`function\\s+public\\.${rpc}\\s*\\(`, 'i'),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.${rpc}[\\s\\S]*?from anon`,
        'i',
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `grant execute on function public\\.${rpc}[\\s\\S]*?to authenticated`,
        'i',
      ),
    );
  }

  assert.match(migration, /caller_id uuid := \(select auth\.uid\(\)\)/i);
  assert.match(
    migration,
    /set search_path = ''/i,
  );
  assert.match(
    migration,
    /primary key \(account_id, request_id\)/i,
  );
});

test('account-device registry preserves and extends the legacy subscription path', () => {
  assert.match(
    migration,
    /create table if not exists public\.account_notification_devices/i,
  );
  assert.match(
    migration,
    /create trigger sync_legacy_onesignal_subscription_device_upsert/i,
  );
  assert.match(
    migration,
    /create trigger sync_legacy_onesignal_subscription_device_delete/i,
  );
  assert.match(
    migration,
    /create trigger preserve_account_subscription_on_membership_delete/i,
  );
  assert.match(
    migration,
    /create constraint trigger cleanup_account_subscription_membership_delete[\s\S]*?deferrable initially deferred/i,
  );
  assert.match(
    migration,
    /function public\.resolve_notification_recipient_subscriptions\s*\(/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.resolve_notification_recipient_subscriptions\(uuid\[\]\) to service_role/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.resolve_notification_recipient_subscriptions\(uuid\[\]\) from authenticated/i,
  );
});

test('delete-account deactivates the account device registry before cleanup', () => {
  assert.match(
    deleteAccountFunction,
    /\.from\('account_notification_devices'\)/,
  );
  assert.match(
    deleteAccountFunction,
    /\.eq\('account_id', userId\)/,
  );
  assert.match(
    deleteAccountFunction,
    /deactivatedNotificationDevices/,
  );
});

test('every notification sender uses account-aware recipient resolution', () => {
  for (const functionName of notificationFunctionNames) {
    const source = readFileSync(
      join(
        projectRoot,
        'supabase',
        'functions',
        functionName,
        'index.ts',
      ),
      'utf8',
    );

    assert.match(
      source,
      /resolveNotificationSubscriptions\s*\(/,
      `${functionName} does not use account-aware resolution`,
    );
    assert.doesNotMatch(
      source,
      /\.from\('onesignal_subscriptions'\)\s*\.select\(/,
      `${functionName} still reads only member-scoped legacy subscriptions`,
    );
  }
});

test('generated public types include every Package 1 client contract', () => {
  for (const objectName of [
    'account_notification_devices',
    'create_church_with_owner_membership',
    'join_church_by_invitation',
    'register_account_notification_device',
    'deactivate_account_notification_device',
    'resolve_notification_recipient_subscriptions',
  ]) {
    assert.match(
      generatedTypes,
      new RegExp(`\\n\\s{6}${objectName}: \\{`),
      `Missing generated-shape type for ${objectName}`,
    );
  }
});

test('SQL behavior suite is rollback-safe and covers Package 1 gates', () => {
  assert.match(behaviorTest, /^\s*--[\s\S]*?\bbegin;/i);
  assert.match(behaviorTest, /\brollback;\s*$/i);

  for (const gate of [
    'create_church_tests',
    'owner_protection_test',
    'join_tests',
    'cross_church_rls_test',
    'legacy_device_bridge_test',
    'recipient_resolution_test',
    'membership_removal_bridge_test',
    'post_removal_resolution_test',
    'legacy_delete_test',
    'invalid_invitation_test',
  ]) {
    assert.match(
      behaviorTest,
      new RegExp(`\\$${gate}\\$`),
      `Missing SQL behavior gate ${gate}`,
    );
  }
});
