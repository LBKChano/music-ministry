import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...segments) => readFileSync(join(root, ...segments), 'utf8');

const church = read('app', '(tabs)', 'church.tsx');
const adminOverview = read('components', 'church-admin', 'admin-hub-overview.tsx');
const bulkDelete = read('components', 'admin', 'bulk-service-delete-modal.tsx');

test('Church and admin surfaces resolve the active semantic palette', () => {
  assert.match(church, /useAppTheme/);
  assert.match(church, /createLegacyThemeColors\(theme\)/);
  assert.match(church, /createStyles\(colors, theme\)/);
  assert.doesNotMatch(church, /styles\/commonStyles/);
  assert.equal(existsSync(join(root, 'styles', 'commonStyles.ts')), false);
  assert.match(adminOverview, /useAppTheme/);
  assert.match(bulkDelete, /useAppTheme/);
});

test('all Church native date and time pickers follow the runtime appearance', () => {
  const pickerCount = (church.match(/<DateTimePicker/g) ?? []).length;
  assert.ok(pickerCount >= 6);
  assert.equal(
    (church.match(/themeVariant=\{theme\.mode\}/g) ?? []).length,
    pickerCount,
  );
  assert.equal(
    (church.match(/textColor=\{theme\.input\.foreground\}/g) ?? []).length,
    pickerCount,
  );
  assert.doesNotMatch(church, /themeVariant=["']light["']/);
  assert.doesNotMatch(church, /textColor=["'](?:#000000|black)["']/i);
});

test('Church scheduling and administration behavior remains connected', () => {
  for (const contract of [
    'createServiceFromTemplate',
    'createServicesBatch',
    'previewBulkServiceDeletion',
    'applyBulkServiceDeletion',
    'updateChurchAutoAssignSettings',
    'saveMemberAdmin',
    'updateNotificationSettings',
    'updateChurchSongTypes',
    'LatestStateSaveQueue',
  ]) {
    assert.match(church, new RegExp(contract));
  }
});

test('Package 39 is client-only', () => {
  const migrations = readdirSync(join(root, 'supabase', 'migrations'));
  const functions = readdirSync(join(root, 'supabase', 'functions'));
  assert.equal(migrations.some(name => /package[_-]?39|church[_-]?dark/i.test(name)), false);
  assert.equal(functions.some(name => /package[_-]?39|church[_-]?dark/i.test(name)), false);
});
