import assert from 'node:assert/strict';
import test from 'node:test';

import {
  contrastRatio,
  futureDarkAppTheme,
  lightAppTheme,
} from '../lib/ui/app-theme.ts';
import { createLegacyThemeColors } from '../lib/ui/legacy-theme-colors.ts';
import {
  getModalLayout,
  shouldResetModalList,
} from '../lib/ui/modal-presentation.ts';

const themes = [lightAppTheme, futureDarkAppTheme];

test('modal, input, button, and contextual-header tokens pass contrast in both palettes', () => {
  for (const theme of themes) {
    const pairs = [
      [theme.colors.textPrimary, theme.modal.surface, 'modal body'],
      [theme.modalHeader.foreground, theme.modalHeader.surface, 'modal header'],
      [theme.input.foreground, theme.input.surface, 'input'],
      [theme.button.primaryForeground, theme.button.primarySurface, 'primary button'],
      [theme.button.secondaryForeground, theme.button.secondarySurface, 'secondary button'],
      [theme.button.destructiveForeground, theme.button.destructiveSurface, 'destructive button'],
    ];

    for (const [foreground, surface, label] of pairs) {
      assert.ok(
        contrastRatio(foreground, surface) >= 4.5,
        `${theme.mode} ${label} contrast`,
      );
    }
  }
});

test('focused-screen compatibility colors follow the selected palette', () => {
  for (const theme of themes) {
    const colors = createLegacyThemeColors(theme);
    assert.equal(colors.background, theme.colors.canvas);
    assert.equal(colors.card, theme.colors.surface);
    assert.equal(colors.inputBackground, theme.input.surface);
    assert.equal(colors.errorBackground, theme.status.error.surface);
    assert.equal(colors.error, theme.status.error.foreground);
    assert.ok(contrastRatio(colors.text, colors.background) >= 4.5);
    assert.ok(contrastRatio(colors.textSecondary, colors.card) >= 4.5);
  }
});

test('modal families stay distinct and safe across phone, tablet, and landscape layouts', () => {
  const phoneBase = {
    width: 390,
    restingHeight: 844,
    topInset: 47,
    bottomInset: 34,
    fontScale: 1,
  };
  const confirmation = getModalLayout({ ...phoneBase, variant: 'confirmation' });
  const form = getModalLayout({ ...phoneBase, variant: 'form' });
  const preview = getModalLayout({ ...phoneBase, variant: 'long-content' });

  assert.equal(confirmation.minHeight, undefined);
  assert.ok(form.maxHeight > confirmation.maxHeight);
  assert.ok(preview.maxHeight > form.maxHeight);
  assert.ok(preview.maxHeight <= 731);

  const smallLandscape = getModalLayout({
    width: 667,
    restingHeight: 375,
    topInset: 0,
    bottomInset: 21,
    fontScale: 1.45,
    variant: 'long-content',
  });
  assert.ok(smallLandscape.maxHeight <= 330);
  assert.ok(smallLandscape.minHeight <= smallLandscape.maxHeight);
  assert.equal(smallLandscape.stackActions, true);

  const tablet = getModalLayout({
    width: 1024,
    restingHeight: 1366,
    topInset: 24,
    bottomInset: 20,
    fontScale: 1,
    variant: 'long-content',
  });
  assert.equal(tablet.maxWidth, 680);
  assert.ok(tablet.maxHeight < 1300);
});

test('assignment list resets only for a newly visible target or role', () => {
  assert.equal(shouldResetModalList({
    visible: true,
    previousTargetKey: null,
    nextTargetKey: 'assignment-1:Leader',
  }), true);
  assert.equal(shouldResetModalList({
    visible: true,
    previousTargetKey: 'assignment-1:Leader',
    nextTargetKey: 'assignment-1:Leader',
  }), false);
  assert.equal(shouldResetModalList({
    visible: true,
    previousTargetKey: 'assignment-1:Leader',
    nextTargetKey: 'assignment-2:Piano',
  }), true);
  assert.equal(shouldResetModalList({
    visible: false,
    previousTargetKey: 'assignment-1:Leader',
    nextTargetKey: 'assignment-2:Piano',
  }), false);
});
