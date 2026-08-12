import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateFocusedHeaderTitleLaneWidth,
  calculateHeaderTitleLaneWidth,
  createWordSafeHeaderLayout,
  HEADER_ACTION_LANE_WIDTHS,
  HEADER_TYPOGRAPHY,
  selectAdaptiveHeaderTypography,
} from '../lib/ui/header-typography.ts';
import {
  futureDarkAppTheme,
  lightAppTheme,
} from '../lib/ui/app-theme.ts';

test('one Church header action reserves only its actual lane', () => {
  assert.equal(HEADER_ACTION_LANE_WIDTHS.churchActions, 52);
  assert.equal(calculateHeaderTitleLaneWidth({
    windowWidth: 320,
    trailingWidth: HEADER_ACTION_LANE_WIDTHS.churchActions,
  }), 216);
});

test('focused headers reclaim the trailing lane when no action exists', () => {
  const withoutAction = calculateFocusedHeaderTitleLaneWidth({
    windowWidth: 320,
    hasTrailingAction: false,
  });
  const withAction = calculateFocusedHeaderTitleLaneWidth({
    windowWidth: 320,
    hasTrailingAction: true,
  });

  assert.equal(withoutAction, 188);
  assert.equal(withAction, 134);
  assert.equal(withoutAction - withAction, 54);
});

test('church titles size for the longest word and wrap only between words', () => {
  const availableWidth = 216;
  const text = 'Mennonitengemeinde Km 5';
  const typography = selectAdaptiveHeaderTypography({
    text,
    variant: 'primaryTitle',
    availableWidth,
    fontScale: 1,
  });
  const layout = createWordSafeHeaderLayout({
    text,
    availableWidth,
    fontSize: typography.fontSize,
    fontScale: 1,
  });

  assert.ok(typography.fontSize >= HEADER_TYPOGRAPHY.primaryTitle.minimumSize);
  assert.equal(layout.singleTokenOverflow, false);
  assert.equal(layout.lines.join(' '), text);
  assert.ok(layout.lines.some(line => line.includes('Mennonitengemeinde')));
});

test('an unbreakable title uses the documented minimum and reports overflow', () => {
  const text = 'ExtraordinarilyLongUnbreakableChurchIdentity';
  const typography = selectAdaptiveHeaderTypography({
    text,
    variant: 'primaryTitle',
    availableWidth: 120,
    fontScale: 1,
  });
  const layout = createWordSafeHeaderLayout({
    text,
    availableWidth: 120,
    fontSize: typography.fontSize,
    fontScale: 1,
  });

  assert.equal(typography.fontSize, HEADER_TYPOGRAPHY.primaryTitle.minimumSize);
  assert.equal(layout.singleTokenOverflow, true);
  assert.equal(layout.lines.length, 1);
});

test('strong brand surfaces share the header navy in both theme contracts', () => {
  for (const theme of [lightAppTheme, futureDarkAppTheme]) {
    assert.equal(theme.colors.surfaceStrong, theme.header.gradient[0]);
    assert.equal(theme.serviceMetadata.surface, theme.header.gradient[0]);
    assert.equal(theme.brandMark.surface, theme.header.gradient[0]);
  }
});
