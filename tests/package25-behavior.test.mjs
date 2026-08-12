import assert from 'node:assert/strict';
import test from 'node:test';

import {
  contrastRatio,
  futureDarkAppTheme,
  lightAppTheme,
} from '../lib/ui/app-theme.ts';
import {
  resolveSurfaceOpacity,
  resolveSurfaceStatusTokens,
} from '../lib/ui/surface-system.ts';

const themes = [lightAppTheme, futureDarkAppTheme];

test('surface layers remain visually distinct in light and future-dark themes', () => {
  for (const theme of themes) {
    assert.notEqual(theme.colors.canvas, theme.colors.surface);
    assert.notEqual(theme.colors.surfaceMuted, theme.colors.surface);
    assert.notEqual(theme.colors.borderSubtle, theme.colors.canvas);
    assert.ok(
      contrastRatio(theme.colors.textPrimary, theme.colors.canvas) >= 4.5,
    );
    assert.ok(
      contrastRatio(theme.colors.textSecondary, theme.colors.surface) >= 4.5,
    );
  }
});

test('semantic surface tones map consistently without color-only aliases', () => {
  for (const theme of themes) {
    assert.deepEqual(
      resolveSurfaceStatusTokens(theme, 'success'),
      theme.status.success,
    );
    assert.deepEqual(
      resolveSurfaceStatusTokens(theme, 'assigned'),
      theme.status.success,
    );
    assert.deepEqual(
      resolveSurfaceStatusTokens(theme, 'attention'),
      theme.status.warning,
    );
    assert.deepEqual(
      resolveSurfaceStatusTokens(theme, 'error'),
      theme.status.error,
    );
    assert.deepEqual(
      resolveSurfaceStatusTokens(theme, 'info'),
      theme.status.info,
    );
    assert.deepEqual(
      resolveSurfaceStatusTokens(theme, 'personal'),
      theme.status.info,
    );

    for (const tone of [
      'success',
      'attention',
      'error',
      'info',
      'personal',
      'assigned',
      'unassigned',
      'disabled',
    ]) {
      const tokens = resolveSurfaceStatusTokens(theme, tone);
      assert.ok(
        contrastRatio(tokens.foreground, tokens.surface) >= 4.5,
        `${theme.mode} ${tone} contrast`,
      );
    }
  }
});

test('pressed and disabled surface opacity follows the shared interaction contract', () => {
  for (const theme of themes) {
    assert.equal(resolveSurfaceOpacity({
      disabled: false,
      pressed: false,
      theme,
    }), 1);
    assert.equal(resolveSurfaceOpacity({
      disabled: false,
      pressed: true,
      theme,
    }), theme.interaction.pressedOpacity);
    assert.equal(resolveSurfaceOpacity({
      disabled: true,
      pressed: true,
      theme,
    }), theme.interaction.disabledOpacity);
  }
});
