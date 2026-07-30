import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWordSafeHeaderLayout,
  HEADER_TYPOGRAPHY,
  selectAdaptiveHeaderTypography,
} from '../lib/ui/header-typography.ts';

function layout(text, availableWidth, fontSize = 28, fontScale = 1) {
  return createWordSafeHeaderLayout({
    text,
    availableWidth,
    fontSize,
    fontScale,
  });
}

function assertOnlyTokenBoundaryBreaks(result) {
  assert.equal(
    result.lines.join(' '),
    result.displayText,
    'line reconstruction must preserve every complete visual token',
  );
}

test('two-word church names stay whole and break only between words', () => {
  const wide = layout('Grace Church', 216);
  const narrow = layout('Grace Church', 128);

  assert.deepEqual(wide.lines, ['Grace Church']);
  assert.deepEqual(narrow.lines, ['Grace', 'Church']);
  assertOnlyTokenBoundaryBreaks(narrow);
});

test('many short words produce at most two intentional lines', () => {
  const result = layout(
    'Iglesia de la Comunidad Internacional',
    216,
    22,
  );

  assert.deepEqual(result.lines, [
    'Iglesia de la',
    'Comunidad Internacional',
  ]);
  assert.equal(result.lines.length, 2);
  assertOnlyTokenBoundaryBreaks(result);
});

test('punctuation, accents, apostrophes, hyphens, and emoji stay attached', () => {
  const fixtures = [
    "St. John's Worship-Center",
    "Église de l'Espérance 🙏",
    'São José Music-Ministry',
  ];

  for (const text of fixtures) {
    const result = layout(text, 216);
    assertOnlyTokenBoundaryBreaks(result);

    for (const token of result.displayText.split(' ')) {
      assert.equal(
        result.lines.some(line => line.split(' ').includes(token)),
        true,
        `expected intact token: ${token}`,
      );
    }
  }
});

test('visual whitespace normalization retains the exact source value', () => {
  const sourceText = '  New   Life\n Church  ';
  const result = layout(sourceText, 128);

  assert.equal(result.sourceText, sourceText);
  assert.equal(result.displayText, 'New Life Church');
  assert.deepEqual(result.lines, ['New Life', 'Church']);
});

test('an overlong single token reaches the readable floor then ellipsizes', () => {
  const text = 'SupercalifragilisticexpialidociousCommunityChurch';
  const typography = selectAdaptiveHeaderTypography({
    text,
    variant: 'primaryTitle',
    availableWidth: 128,
    fontScale: 1,
  });
  const result = layout(text, 128, typography.fontSize);

  assert.equal(
    typography.fontSize,
    HEADER_TYPOGRAPHY.primaryTitle.minimumSize,
  );
  assert.deepEqual(result.lines, [text]);
  assert.equal(result.singleTokenOverflow, true);
  assert.equal(result.truncated, true);
});

test('right-to-left token order and exact source value are preserved', () => {
  const sourceText = 'קהילת תקווה חדשה';
  const result = layout(sourceText, 216);

  assert.equal(result.sourceText, sourceText);
  assert.deepEqual(result.lines, ['קהילת', 'תקווה חדשה']);
  assertOnlyTokenBoundaryBreaks(result);
});

test('Larger Text uses the same token boundaries and no more than two lines', () => {
  const text = "Église de l'Espérance 🙏";
  const defaultText = layout(text, 216, 28, 1);
  const largerText = layout(text, 216, 24, 1.35);

  assert.ok(defaultText.lines.length <= 2);
  assert.ok(largerText.lines.length <= 2);
  assertOnlyTokenBoundaryBreaks(defaultText);
  assertOnlyTokenBoundaryBreaks(largerText);
});

test('live church-name updates produce fresh layouts without stale source data', () => {
  const first = layout('Grace Church', 216);
  const updated = layout('New Hope Community Church', 216);

  assert.equal(first.sourceText, 'Grace Church');
  assert.equal(updated.sourceText, 'New Hope Community Church');
  assert.notDeepEqual(first.lines, updated.lines);
  assertOnlyTokenBoundaryBreaks(updated);
});
