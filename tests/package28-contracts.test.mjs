import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const read = (...segments) => readFileSync(join(projectRoot, ...segments), 'utf8');

const appModal = read('components', 'ui', 'app-modal.tsx');
const modalPresentation = read('lib', 'ui', 'modal-presentation.ts');
const focusedHeader = read('components', 'navigation', 'focused-screen-header.tsx');
const assignmentModal = read('components', 'schedules', 'manual-assignment-modal.tsx');
const bulkDeleteModal = read('components', 'admin', 'bulk-service-delete-modal.tsx');
const filterModal = read('components', 'schedules', 'schedule-filter-modal.tsx');
const onboarding = read('app', 'onboarding.tsx');
const resetPassword = read('app', 'reset-password.tsx');
const account = read('components', 'profile', 'profile-account-screen.tsx');

test('shared modal contract owns adaptive sizing, semantic surfaces, and contextual headers', () => {
  assert.match(appModal, /theme\.modal\.backdrop/);
  assert.match(appModal, /theme\.modalHeader\.surface/);
  assert.match(appModal, /headerIcon/);
  assert.match(appModal, /theme\.modal\.footerSurface/);
  assert.match(appModal, /KeyboardAvoidingView/);
  assert.match(appModal, /onAccessibilityEscape/);
  assert.match(appModal, /keyboardDismissMode/);
  assert.doesNotMatch(appModal, /backgroundColor:\s*['"]#(?:fff|ffffff)['"]/i);
  assert.match(modalPresentation, /confirmation:\s*0\.58/);
  assert.match(modalPresentation, /form:\s*0\.88/);
  assert.match(modalPresentation, /'long-content':\s*0\.94/);
});

test('focused headers use one semantic contextual zone with a distinct back action', () => {
  assert.match(focusedHeader, /useAppTheme/);
  assert.match(focusedHeader, /theme\.modalHeader\.surface/);
  assert.match(focusedHeader, /contextIcon/);
  assert.match(focusedHeader, /accessibilityHint=.*previous screen/);
  assert.doesNotMatch(focusedHeader, /commonStyles/);
});

test('assignment and bulk previews have one long-content scroll owner', () => {
  assert.match(assignmentModal, /variant="long-content"/);
  assert.match(assignmentModal, /bodyScroll=\{false\}/);
  assert.match(assignmentModal, /<SectionList/);
  assert.match(assignmentModal, /shouldResetModalList/);
  assert.match(assignmentModal, /nestedScrollEnabled/);
  assert.match(bulkDeleteModal, /variant="long-content"/);
  assert.match(bulkDeleteModal, /bodyScroll=\{false\}/);
  assert.match(bulkDeleteModal, /<FlatList/);
  assert.match(bulkDeleteModal, /theme\.button\.destructiveSurface/);
  assert.doesNotMatch(bulkDeleteModal, /commonStyles/);
  assert.doesNotMatch(filterModal, /commonStyles/);
});

test('onboarding and recovery retain auth behavior while using branded semantic UI', () => {
  assert.match(onboarding, /assets\/splash-mark\.png/);
  assert.match(onboarding, /accessibilityLabel="Music Ministry app logo"/);
  assert.match(onboarding, /resizeMode="contain"/);
  assert.doesNotMatch(onboarding, /brandIcon/);
  assert.match(resetPassword, /establishPasswordRecoverySession/);
  assert.match(resetPassword, /credentialType="new-password"/);
  assert.match(resetPassword, /passwordRules=/);
  assert.match(resetPassword, /theme\.input\.surface/);
  assert.match(account, /getAppReleaseInfo/);
  assert.match(account, /release\.version/);
  assert.doesNotMatch(account, /release\.build/);
});

test('focused Profile screens resolve colors from both semantic palettes', () => {
  for (const file of [
    'profile-availability-screen.tsx',
    'profile-identity-screen.tsx',
    'profile-notification-preferences-screen.tsx',
    'profile-scheduling-preferences-screen.tsx',
    'profile-delete-account-screen.tsx',
    'ChurchSwitcher.tsx',
  ]) {
    const source = read('components', 'profile', file);
    assert.match(source, /useAppTheme/);
    assert.match(source, /createLegacyThemeColors/);
    assert.doesNotMatch(source, /styles\/commonStyles/);
  }
});

test('Package 28 is client-only and preserves released backend contracts', () => {
  const migrations = readdirSync(join(projectRoot, 'supabase', 'migrations'));
  const functions = readdirSync(join(projectRoot, 'supabase', 'functions'));
  assert.equal(migrations.some(name => /package[_-]?28|modal[_-]?parity/i.test(name)), false);
  assert.equal(functions.some(name => /package[_-]?28|modal[_-]?parity/i.test(name)), false);
});
