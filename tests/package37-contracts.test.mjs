import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...segments) => readFileSync(join(root, ...segments), 'utf8');

const sharedThemeConsumers = [
  ['components', 'feedback', 'app-state-panel.tsx'],
  ['components', 'feedback', 'app-state-screen.tsx'],
  ['components', 'feedback', 'inline-status.tsx'],
  ['components', 'notifications', 'NotificationPermissionOnboarding.tsx'],
  ['components', 'church-admin', 'delete-impact-summary.tsx'],
  ['components', 'profile', 'scheduling-preferences-card.tsx'],
  ['components', 'button.tsx'],
  ['components', 'ListItem.tsx'],
  ['components', 'LoadingButton.tsx'],
  ['components', 'Map.tsx'],
  ['app', '+not-found.tsx'],
];

test('shared surfaces resolve runtime semantic colors instead of a light snapshot', () => {
  for (const path of sharedThemeConsumers) {
    const source = read(...path);
    assert.match(source, /useAppTheme/);
    assert.doesNotMatch(source, /styles\/commonStyles/);
  }
});

test('status, control, and modal primitives retain semantic state contracts', () => {
  const inlineStatus = read('components', 'feedback', 'inline-status.tsx');
  const statePanel = read('components', 'feedback', 'app-state-panel.tsx');
  const permission = read('components', 'notifications', 'NotificationPermissionOnboarding.tsx');
  const appModal = read('components', 'ui', 'app-modal.tsx');

  assert.match(inlineStatus, /theme\.status\[tone\]/);
  assert.match(statePanel, /theme\.button\.primarySurface/);
  assert.match(statePanel, /theme\.button\.secondarySurface/);
  assert.match(permission, /theme\.button\.primaryForeground/);
  assert.match(appModal, /theme\.modal\.backdrop/);
  assert.match(appModal, /theme\.modalHeader\.surface/);
});

test('the duplicate standalone palette is gone and Package 37 is client-only', () => {
  const migrations = readdirSync(join(root, 'supabase', 'migrations'));
  const functions = readdirSync(join(root, 'supabase', 'functions'));

  assert.equal(existsSync(join(root, 'styles', 'commonStyles.ts')), false);
  assert.equal(migrations.some(name => /package[_-]?37|shared[_-]?dark/i.test(name)), false);
  assert.equal(functions.some(name => /package[_-]?37|shared[_-]?dark/i.test(name)), false);
});
