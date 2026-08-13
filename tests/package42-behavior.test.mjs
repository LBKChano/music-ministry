import assert from 'node:assert/strict';
import test from 'node:test';

import {
  contrastRatio,
  futureDarkAppTheme,
  lightAppTheme,
} from '../lib/ui/app-theme.ts';

test('dark headers use the approved midnight palette instead of the light gradient', () => {
  assert.notDeepEqual(
    futureDarkAppTheme.header.gradient,
    lightAppTheme.header.gradient,
  );
  assert.equal(
    futureDarkAppTheme.header.gradient[0],
    futureDarkAppTheme.colors.surfaceStrong,
  );
  for (const stop of futureDarkAppTheme.header.gradient) {
    assert.ok(contrastRatio(futureDarkAppTheme.header.title, stop) >= 7);
  }
});

test('coordinated dark surfaces retain accessible foreground contrast', () => {
  const theme = futureDarkAppTheme;
  const pairs = [
    [theme.colors.textPrimary, theme.colors.surface],
    [theme.colors.textSecondary, theme.colors.canvas],
    [theme.colors.navigationSelectedForeground, theme.colors.navigationSelected],
    [theme.button.primaryForeground, theme.button.primarySurface],
    [theme.modalHeader.foreground, theme.modalHeader.surface],
    [theme.serviceMetadata.foreground, theme.serviceMetadata.surface],
  ];
  for (const [foreground, background] of pairs) {
    assert.ok(contrastRatio(foreground, background) >= 4.5);
  }
});
