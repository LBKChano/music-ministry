import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getModalDismissAction,
  getModalLayout,
} from '../lib/ui/modal-presentation.ts';

test('long content stays inside safe areas on a small Android phone', () => {
  const layout = getModalLayout({
    width: 320,
    restingHeight: 568,
    topInset: 24,
    bottomInset: 16,
    fontScale: 1,
    variant: 'long-content',
  });

  assert.equal(layout.maxWidth, 296);
  assert.equal(layout.maxHeight, 473.76);
  assert.equal(layout.minHeight, 400);
  assert.equal(layout.stackActions, true);
});

test('forms use a comfortable phone height and long content is capped on tablets', () => {
  const phone = getModalLayout({
    width: 390,
    restingHeight: 844,
    topInset: 47,
    bottomInset: 34,
    fontScale: 1,
    variant: 'form',
  });
  const tablet = getModalLayout({
    width: 1024,
    restingHeight: 1366,
    topInset: 24,
    bottomInset: 20,
    fontScale: 1,
    variant: 'long-content',
  });

  assert.equal(phone.maxWidth, 358);
  assert.equal(phone.minHeight, 360);
  assert.equal(tablet.maxWidth, 680);
  assert.equal(tablet.minHeight, 400);
});

test('requested dimensions never exceed the available viewport', () => {
  const layout = getModalLayout({
    width: 375,
    restingHeight: 600,
    topInset: 44,
    bottomInset: 34,
    fontScale: 1,
    variant: 'form',
    requestedMaxWidth: 900,
    requestedMaxHeight: 900,
  });

  assert.equal(layout.maxWidth, 351);
  assert.equal(layout.maxHeight, 498);
});

test('confirmations size to content and Larger Text stacks actions', () => {
  const layout = getModalLayout({
    width: 430,
    restingHeight: 932,
    topInset: 59,
    bottomInset: 34,
    fontScale: 1.5,
    variant: 'confirmation',
  });

  assert.equal(layout.minHeight, undefined);
  assert.equal(layout.stackActions, true);
});

test('landscape and split-screen layouts never resolve a minimum above the maximum', () => {
  const layout = getModalLayout({
    width: 740,
    restingHeight: 320,
    topInset: 0,
    bottomInset: 20,
    fontScale: 1,
    variant: 'long-content',
  });

  assert.ok(layout.minHeight !== undefined);
  assert.ok(layout.minHeight <= layout.maxHeight);
});

test('dismissal hides the keyboard before closing and loading locks the modal', () => {
  assert.equal(getModalDismissAction({
    busy: false,
    keyboardVisible: true,
    dismissAllowed: true,
  }), 'dismiss-keyboard');
  assert.equal(getModalDismissAction({
    busy: true,
    keyboardVisible: false,
    dismissAllowed: true,
  }), 'ignore');
  assert.equal(getModalDismissAction({
    busy: false,
    keyboardVisible: false,
    dismissAllowed: false,
  }), 'ignore');
  assert.equal(getModalDismissAction({
    busy: false,
    keyboardVisible: false,
    dismissAllowed: true,
  }), 'close');
});
