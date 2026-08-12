import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getModalLayout,
  shouldResetModalScroll,
} from '../lib/ui/modal-presentation.ts';

const phone = {
  width: 390,
  restingHeight: 844,
  topInset: 47,
  bottomInset: 34,
  fontScale: 1,
};

test('modal families use progressively more safe vertical space', () => {
  const confirmation = getModalLayout({ ...phone, variant: 'confirmation' });
  const form = getModalLayout({ ...phone, variant: 'form' });
  const tallForm = getModalLayout({ ...phone, variant: 'tall-form' });
  const longContent = getModalLayout({ ...phone, variant: 'long-content' });

  assert.equal(confirmation.maxHeight, 423.97999999999996);
  assert.equal(form.maxHeight, 687.14);
  assert.equal(tallForm.maxHeight, 716.38);
  assert.equal(longContent.maxHeight, 731);
  assert.equal(tallForm.minHeight, 657.9);
  assert.ok(confirmation.maxHeight < form.maxHeight);
  assert.ok(form.maxHeight < tallForm.maxHeight);
  assert.ok(tallForm.maxHeight < longContent.maxHeight);
});

test('safe margins and minimum heights adapt to narrow and landscape devices', () => {
  const narrow = getModalLayout({
    width: 320,
    restingHeight: 568,
    topInset: 24,
    bottomInset: 16,
    fontScale: 1,
    variant: 'tall-form',
  });
  const landscape = getModalLayout({
    width: 740,
    restingHeight: 320,
    topInset: 0,
    bottomInset: 20,
    fontScale: 1.5,
    variant: 'long-content',
  });

  assert.equal(narrow.horizontalMargin, 12);
  assert.equal(narrow.verticalMargin, 12);
  assert.equal(narrow.maxWidth, 296);
  assert.equal(narrow.maxHeight, 493.92);
  assert.equal(narrow.minHeight, 453.6);
  assert.equal(landscape.maxHeight, 280);
  assert.equal(landscape.minHeight, 280);
  assert.equal(landscape.stackActions, true);
});

test('scroll position resets on open, reopen, or workflow change only', () => {
  assert.equal(shouldResetModalScroll({
    visible: true,
    previousVisible: false,
    previousContentKey: 'form',
    nextContentKey: 'form',
  }), true);
  assert.equal(shouldResetModalScroll({
    visible: true,
    previousVisible: true,
    previousContentKey: 'form',
    nextContentKey: 'form',
  }), false);
  assert.equal(shouldResetModalScroll({
    visible: true,
    previousVisible: true,
    previousContentKey: 'step-1',
    nextContentKey: 'step-2',
  }), true);
  assert.equal(shouldResetModalScroll({
    visible: false,
    previousVisible: true,
    previousContentKey: 'step-1',
    nextContentKey: 'step-2',
  }), false);
});

test('requested dimensions remain subordinate to the safe viewport', () => {
  const layout = getModalLayout({
    ...phone,
    variant: 'tall-form',
    requestedMaxHeight: 900,
    requestedMaxWidth: 900,
  });

  assert.equal(layout.maxHeight, 731);
  assert.equal(layout.maxWidth, 358);
});
