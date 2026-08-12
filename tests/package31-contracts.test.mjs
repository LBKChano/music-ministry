import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const read = (...segments) => readFileSync(join(projectRoot, ...segments), 'utf8');

const overview = read('components', 'church-admin', 'admin-hub-overview.tsx');
const summary = read('lib', 'church-admin', 'summary.ts');
const presentation = read('lib', 'church-admin', 'presentation.ts');
const church = read('app', '(tabs)', 'church.tsx');

test('returning admins receive one expandable Church Setup editor group', () => {
  assert.match(overview, /Edit Church Setup/);
  assert.match(overview, /accessibilityState=\{\{ expanded \}\}/);
  assert.match(presentation, /return expanded \? 'expanded' : 'compact'/);
  assert.match(overview, /setupPresentation === 'expanded'/);
  assert.match(overview, /rows=\{summary\.setupRows\}/);
  assert.match(church, /<AdminHubOverview[\s\S]*key=\{currentChurch\.id\}/);
});

test('guided readiness is limited to incomplete setup presentation', () => {
  assert.match(overview, /setupPresentation === 'guided'/);
  assert.match(overview, /showReadiness/);
  assert.match(overview, /showReadiness && row\.ready/);
  assert.match(overview, /recommendedNext=\{summary\.recommendedNext\}/);
  assert.match(presentation, /if \(!setupReady\) return 'guided'/);
});

test('all established Church editors and Schedule Management remain reachable', () => {
  for (const destination of [
    'details',
    'roles',
    'weekly_services',
    'members',
    'rules',
    'song_types',
    'reminders',
    'prepare_services',
    'assign_members',
  ]) {
    assert.match(summary + church, new RegExp(destination));
  }
  assert.match(overview, /title="Schedule Management"/);
});

test('Package 31 derives readiness without persistence or backend changes', () => {
  const migrations = readdirSync(join(projectRoot, 'supabase', 'migrations'));
  assert.match(summary, /const setupReady = detailsReady && rolesReady && weeklyServicesReady/);
  assert.doesNotMatch(overview + presentation, /supabase|AsyncStorage|SecureStore/);
  assert.equal(migrations.some(name => /package[_-]?31|setup[_-]?complete/i.test(name)), false);
});
