import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

function sourceFiles(relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return sourceFiles(relativePath);
    return /\.[jt]sx?$/.test(entry.name) ? [relativePath] : [];
  });
}

test('all application popups use the shared modal primitive', () => {
  const violations = [...sourceFiles('app'), ...sourceFiles('components')]
    .filter(file => file !== 'components/ui/app-modal.tsx')
    .filter(file => /<Modal\b/.test(read(file)));

  assert.deepEqual(violations, []);
  assert.match(read('components/admin/admin-form-modal.tsx'), /<AppModal/);
});

test('the shared shell owns sizing, safe areas, keyboard dismissal, and accessibility escape', () => {
  const modal = read('components/ui/app-modal.tsx');

  assert.match(modal, /useSafeAreaInsets/);
  assert.match(modal, /useWindowDimensions/);
  assert.match(modal, /getModalLayout/);
  assert.match(modal, /keyboardDismissMode/);
  assert.match(modal, /onAccessibilityEscape/);
  assert.match(modal, /onRequestClose/);
  assert.match(modal, /onDismiss=\{restoreFocus\}/);
  assert.match(modal, /accessibilityState=\{\{ busy: action\.loading, disabled \}\}/);
});

test('long list workflows keep one vertical scroll owner and fixed actions', () => {
  const church = read('app/(tabs)/church.tsx');
  const bulk = read('components/admin/bulk-service-delete-modal.tsx');
  const assignment = read('components/schedules/manual-assignment-modal.tsx');

  assert.match(church, /testID="auto-assign-preview-modal"/);
  assert.match(church, /bodyScroll=\{false\}[\s\S]+<SectionList/);
  assert.match(bulk, /bodyScroll=\{false\}[\s\S]+<FlatList/);
  assert.match(assignment, /bodyScroll=\{false\}[\s\S]+<SectionList/);
});

test('Schedule popup behavior remains aligned across Android and iOS', () => {
  for (const file of ['app/(tabs)/(home)/index.tsx', 'app/(tabs)/(home)/index.ios.tsx']) {
    assert.match(read(file), /schedule-screen/);
  }
  const source = read('components/schedules/schedule-screen.tsx');
  assert.match(source, /testID="service-song-modal"/);
  assert.match(source, /testID="fill-in-request-modal"/);
  assert.match(source, /onPress: handleAddServiceComment/);
  assert.match(source, /onPress: handleCreateFillInRequest/);
  assert.match(source, /onPress: handleDeleteService/);
  assert.match(source, /onPress: handleDeleteAssignment/);
});

test('date and time controls retain draft-and-confirm behavior', () => {
  const church = read('app/(tabs)/church.tsx');
  const bulk = read('components/admin/bulk-service-delete-modal.tsx');

  assert.match(church, /setDraftAutoAssignStartDate/);
  assert.match(church, /setAutoAssignStartDate\(draftAutoAssignStartDate\)/);
  assert.match(church, /setSpecialServiceDate\(draftSpecialServiceDate\)/);
  assert.match(church, /setSpecialServiceTime\(draftSpecialServiceTime\)/);
  assert.match(bulk, /setDraftDate/);
  assert.match(bulk, /commitDate\(activeDateField, draftDate\)/);
});

test('Package 20 is client-only and adds no backend migration', () => {
  const migrations = fs.readdirSync(path.join(root, 'supabase/migrations'));
  assert.equal(migrations.some(file => /package[_-]?20/i.test(file)), false);
});
