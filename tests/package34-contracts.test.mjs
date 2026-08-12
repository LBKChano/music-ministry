import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...segments) => readFileSync(join(root, ...segments), 'utf8');
const appModal = read('components', 'ui', 'app-modal.tsx');
const presentation = read('lib', 'ui', 'modal-presentation.ts');
const church = read('app', '(tabs)', 'church.tsx');
const schedule = read('components', 'schedules', 'schedule-screen.tsx');
const filter = read('components', 'schedules', 'schedule-filter-modal.tsx');
const assignment = read('components', 'schedules', 'manual-assignment-modal.tsx');
const bulkDelete = read('components', 'admin', 'bulk-service-delete-modal.tsx');

test('shared modal shell owns safe geometry, pinned chrome, and form scrolling', () => {
  assert.match(presentation, /'tall-form'/);
  assert.match(presentation, /horizontalMargin/);
  assert.match(presentation, /verticalMargin/);
  assert.match(appModal, /paddingBottom: insets\.bottom \+ layout\.verticalMargin/);
  assert.match(appModal, /paddingTop: insets\.top \+ layout\.verticalMargin/);
  assert.match(appModal, /variant !== 'confirmation' && styles\.flexBody/);
  assert.match(appModal, /bodyContent: \{ flexGrow: 1/);
  assert.match(appModal, /header:[\s\S]*flexShrink: 0/);
  assert.match(appModal, /footer:[\s\S]*flexShrink: 0/);
  assert.match(appModal, /keyboardDismissMode=/);
  assert.match(appModal, /automaticallyAdjustKeyboardInsets=/);
  assert.match(appModal, /nestedScrollEnabled/);
  assert.match(appModal, /contentInsetAdjustmentBehavior="never"/);
});

test('content-rich modal height yields to the software keyboard', () => {
  assert.match(appModal, /minHeight: keyboardVisible \? undefined : layout\.minHeight/);
  assert.match(appModal, /automaticallyAdjustKeyboardInsets=\{Platform\.OS === 'ios'\}/);
  assert.match(appModal, /keyboardDismissMode=\{Platform\.OS === 'ios' \? 'interactive' : 'on-drag'\}/);
});

test('form-heavy workflows use the tall family without legacy height caps', () => {
  assert.match(church, /title="Edit Member"[\s\S]{0,180}variant="tall-form"/);
  assert.match(church, /title=\{serviceToEdit \? 'Edit Weekly Service' : 'Add Weekly Service'\}[\s\S]{0,180}variant="tall-form"/);
  assert.match(church, /title=\{roleToEdit \? 'Edit Church Role' : 'Add Church Role'\}[\s\S]{0,180}variant="tall-form"/);
  assert.match(church, /title="Add Single Service"[\s\S]{0,180}variant="tall-form"/);
  assert.match(church, /title=\{prepareQuarterStep[\s\S]{0,500}variant="tall-form"/);
  assert.match(church, /scrollResetKey=\{`\$\{prepareQuarterStep\}/);
  assert.match(schedule, /title=\{editingServiceCommentId[\s\S]{0,250}variant="tall-form"/);
  assert.match(filter, /title="Filter Schedule"[\s\S]{0,100}variant="tall-form"/);
  assert.doesNotMatch(church, /maxRestingHeight=\{(?:600|620)\}/);
  assert.doesNotMatch(read('components', 'admin', 'admin-form-modal.tsx'), /maxRestingHeight/);
  assert.doesNotMatch(filter, /maxHeight=\{720\}/);
});

test('virtualized previews keep exactly one vertical scroll owner', () => {
  assert.match(church, /testID="auto-assign-preview-modal"[\s\S]*?<SectionList/);
  assert.match(church, /variant="long-content"[\s\S]{0,100}bodyScroll=\{false\}/);
  assert.match(church, /autoAssignListRef[\s\S]*shouldResetModalList/);
  assert.match(church, /autoAssignModalBody: \{[\s\S]*flex: 1,[\s\S]*minHeight: 0/);

  for (const source of [assignment, bulkDelete]) {
    assert.match(source, /bodyScroll=\{false\}/);
    assert.match(source, /variant="long-content"/);
    assert.match(source, /shouldResetModalList/);
    assert.match(source, /list: \{[\s\S]*flex: 1,[\s\S]*minHeight: 0/);
    assert.match(source, /contentInsetAdjustmentBehavior="never"/);
  }
  assert.match(assignment, /<SectionList/);
  assert.match(bulkDelete, /<FlatList/);
});

test('scroll resets are lifecycle scoped and preserve modal interaction protections', () => {
  assert.match(appModal, /scrollResetKey/);
  assert.match(appModal, /shouldResetModalScroll/);
  assert.match(appModal, /bodyScrollRef\.current\?\.scrollTo/);
  assert.match(appModal, /requestDismiss/);
  assert.match(appModal, /getModalDismissAction/);
  assert.match(appModal, /onAccessibilityEscape/);
  assert.match(appModal, /onDismiss=\{restoreFocus\}/);
});

test('Package 34 is client-only and preserves backend contracts', () => {
  const migrations = readdirSync(join(root, 'supabase', 'migrations'));
  const functions = readdirSync(join(root, 'supabase', 'functions'));

  assert.equal(migrations.some(name => /package[_-]?34|modal[_-]?geometry/i.test(name)), false);
  assert.equal(functions.some(name => /package[_-]?34|modal[_-]?geometry/i.test(name)), false);
});
