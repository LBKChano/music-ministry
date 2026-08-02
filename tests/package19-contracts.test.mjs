import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const migration = read('supabase/migrations/20260802013102_add_fill_in_escalation_queue.sql');
const cronMigration = read('supabase/migrations/20260802013806_schedule_fill_in_escalations.sql');
const edgeFunction = read('supabase/functions/send-fill-in-escalations/index.ts');
const escalationHelper = read('supabase/functions/_shared/fill-in-escalation.ts');
const config = read('supabase/config.toml');
const sqlBehavior = read('supabase/tests/fill_in_escalation_queue.sql');

test('Package 19 is additive to the released fill-in request contract', () => {
  assert.match(migration, /private\.fill_in_escalation_deliveries/);
  assert.match(migration, /references public\.fill_in_requests\(id\) on delete cascade/);
  assert.doesNotMatch(migration, /alter table public\.fill_in_requests\s+(drop|rename|alter column)/i);
  assert.doesNotMatch(migration, /create or replace function public\.accept_fill_in_request_atomic/i);
  assert.match(migration, /new\.created_at \+ interval '3 hours'/);
});

test('the queue uses a partial due index, leases, locks, and retryable completion', () => {
  assert.match(migration, /where state in \('pending', 'leased'\)/);
  assert.match(migration, /for update of delivery skip locked/);
  assert.match(migration, /lease_expires_at/);
  assert.match(migration, /attempt_count = delivery\.attempt_count \+ 1/);
  assert.match(migration, /public\.complete_fill_in_escalation/);
  assert.match(migration, /public\.release_fill_in_escalation/);
  assert.match(migration, /grant execute[\s\S]+to service_role/);
  assert.match(migration, /revoke all[\s\S]+from public, anon, authenticated/);
});

test('the cron function is custom-authenticated and accepts no request selector', () => {
  assert.match(config, /\[functions\.send-fill-in-escalations\]\s+verify_jwt = false/);
  assert.match(edgeFunction, /x-music-ministry-cron-secret/);
  assert.match(edgeFunction, /verify_fill_in_escalation_cron_secret/);
  assert.doesNotMatch(edgeFunction, /body\.fillInRequestId/);
  assert.match(migration, /vault\.create_secret/);
  assert.match(migration, /extensions\.digest/);
  assert.match(cronMigration, /'\*\/5 \* \* \* \*'/);
  assert.match(cronMigration, /vault\.decrypted_secrets/);
  assert.match(cronMigration, /x-music-ministry-cron-secret/);
});

test('delivery preserves navigation, preferences, multi-device targeting, and dedupe', () => {
  assert.match(edgeFunction, /'fill_in_requests'/);
  assert.match(edgeFunction, /resolveNotificationSubscriptions/);
  assert.match(edgeFunction, /buildNotificationTargets/);
  assert.match(edgeFunction, /sendOneSignalNotification/);
  assert.match(escalationHelper, /fill_in_request_reminder:/);
  assert.match(edgeFunction, /type: 'fill_in_request'/);
  assert.match(edgeFunction, /fillInRequestId: context\.fill_in_request_id/);
  assert.match(edgeFunction, /onConflict: 'member_id,event_key'/);
});

test('the final check blocks stale work and SQL tests cover timing and replay', () => {
  assert.match(edgeFunction, /recheck_fill_in_escalation/);
  assert.match(migration, /request\.status = 'pending'/);
  assert.match(migration, /assignment\.member_id = request\.requesting_member_id/);
  assert.match(migration, /service\.date::date > current_date/);
  assert.match(sqlBehavior, /2h59 request was claimed early/);
  assert.match(sqlBehavior, /Overlapping worker claimed an active lease/);
  assert.match(sqlBehavior, /Released delivery was not retried/);
  assert.match(sqlBehavior, /Successful delivery was finalized more than once/);
  assert.match(sqlBehavior, /rollback;/);
});
