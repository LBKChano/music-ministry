import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateHeaderTitleLaneWidth,
  HEADER_ACTION_LANE_WIDTHS,
  HEADER_TYPOGRAPHY,
  normalizeHeaderDisplayText,
  selectAdaptiveHeaderTypography,
} from '../lib/ui/header-typography.ts';

const deviceWidths = {
  smallAndroid: 320,
  splitScreen: 360,
  currentIPhone: 390,
  largePhone: 430,
  tablet: 768,
  landscape: 844,
};

test('visual header text normalizes whitespace without mutating the source value', () => {
  const source = '  Grace   Community\n Church  ';
  assert.equal(normalizeHeaderDisplayText(source), 'Grace Community Church');
  assert.equal(source, '  Grace   Community\n Church  ');
});

test('short church names stay at the preferred size on every named viewport', () => {
  for (const windowWidth of Object.values(deviceWidths)) {
    const availableWidth = calculateHeaderTitleLaneWidth({
      windowWidth,
      trailingWidth: HEADER_ACTION_LANE_WIDTHS.bell,
    });
    const selection = selectAdaptiveHeaderTypography({
      text: 'Grace Church',
      variant: 'primaryTitle',
      availableWidth,
      fontScale: 1,
    });

    assert.equal(
      selection.fontSize,
      HEADER_TYPOGRAPHY.primaryTitle.preferredSize,
    );
  }
});

test('a short church title remains prominent beside the Church action', () => {
  const availableWidth = calculateHeaderTitleLaneWidth({
    windowWidth: deviceWidths.smallAndroid,
    trailingWidth: HEADER_ACTION_LANE_WIDTHS.churchActions,
  });
  const selection = selectAdaptiveHeaderTypography({
    text: 'Nueva Esperanza',
    variant: 'primaryTitle',
    availableWidth,
    fontScale: 1,
  });

  assert.equal(availableWidth, 216);
  assert.equal(selection.fontSize, 28);
});

test('long names step down deterministically but never below their floor', () => {
  const text = 'International Community Worship Center';
  const narrowWidth = calculateHeaderTitleLaneWidth({
    windowWidth: deviceWidths.smallAndroid,
    trailingWidth: HEADER_ACTION_LANE_WIDTHS.bell,
  });
  const wideWidth = calculateHeaderTitleLaneWidth({
    windowWidth: deviceWidths.largePhone,
    trailingWidth: HEADER_ACTION_LANE_WIDTHS.bell,
  });

  const narrow = selectAdaptiveHeaderTypography({
    text,
    variant: 'primaryTitle',
    availableWidth: narrowWidth,
    fontScale: 1,
  });
  const wide = selectAdaptiveHeaderTypography({
    text,
    variant: 'primaryTitle',
    availableWidth: wideWidth,
    fontScale: 1,
  });

  assert.equal(narrow.fontSize, HEADER_TYPOGRAPHY.primaryTitle.minimumSize);
  assert.ok(wide.fontSize > narrow.fontSize);
  assert.ok(wide.fontSize <= HEADER_TYPOGRAPHY.primaryTitle.preferredSize);
});

test('Profile names and secondary church names use independent contracts', () => {
  const availableWidth = calculateHeaderTitleLaneWidth({
    windowWidth: deviceWidths.currentIPhone,
    trailingWidth: HEADER_ACTION_LANE_WIDTHS.profile,
  });
  const profile = selectAdaptiveHeaderTypography({
    text: 'Lisandro Braun Krahn',
    variant: 'profileName',
    availableWidth,
    fontScale: 1,
  });
  const church = selectAdaptiveHeaderTypography({
    text: 'Grace Community Church',
    variant: 'secondaryChurchName',
    availableWidth,
    fontScale: 1,
  });

  assert.equal(profile.fontSize, 32);
  assert.equal(church.fontSize, 18);
  assert.ok(profile.lineHeight > church.lineHeight);
});

test('Larger Text is bounded deliberately and remains deterministic', () => {
  const input = {
    text: 'International Community Worship Center',
    variant: 'primaryTitle',
    availableWidth: 260,
  };
  const largerText = selectAdaptiveHeaderTypography({
    ...input,
    fontScale: 1.3,
  });
  const extremeText = selectAdaptiveHeaderTypography({
    ...input,
    fontScale: 2,
  });

  assert.equal(
    largerText.maxFontSizeMultiplier,
    HEADER_TYPOGRAPHY.primaryTitle.maxFontSizeMultiplier,
  );
  assert.deepEqual(
    extremeText,
    selectAdaptiveHeaderTypography({
      ...input,
      fontScale: HEADER_TYPOGRAPHY.primaryTitle.maxFontSizeMultiplier,
    }),
  );
});

test('reserved action lanes and orientation changes have stable widths', () => {
  assert.equal(
    calculateHeaderTitleLaneWidth({ windowWidth: 320 }),
    280,
  );
  assert.equal(
    calculateHeaderTitleLaneWidth({
      windowWidth: 320,
      trailingWidth: HEADER_ACTION_LANE_WIDTHS.bell,
    }),
    216,
  );
  assert.equal(
    calculateHeaderTitleLaneWidth({
      windowWidth: 320,
      trailingWidth: HEADER_ACTION_LANE_WIDTHS.profile,
    }),
    214,
  );
  assert.equal(
    calculateHeaderTitleLaneWidth({
      windowWidth: 320,
      trailingWidth: HEADER_ACTION_LANE_WIDTHS.churchActions,
    }),
    216,
  );
  assert.ok(
    calculateHeaderTitleLaneWidth({
      windowWidth: 844,
      trailingWidth: HEADER_ACTION_LANE_WIDTHS.bell,
    })
      > calculateHeaderTitleLaneWidth({
        windowWidth: 390,
        trailingWidth: HEADER_ACTION_LANE_WIDTHS.bell,
      }),
  );
});
