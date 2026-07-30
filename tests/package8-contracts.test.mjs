import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const readSource = (...segments) => readFileSync(
  join(projectRoot, ...segments),
  'utf8',
);

const wordSafeText = readSource(
  'components',
  'navigation',
  'word-safe-header-text.tsx',
);
const adaptiveText = readSource(
  'components',
  'navigation',
  'adaptive-header-text.tsx',
);
const responsiveHeader = readSource(
  'components',
  'navigation',
  'responsive-tab-header.tsx',
);
const churchSwitcher = readSource(
  'components',
  'profile',
  'ChurchSwitcher.tsx',
);
const churchScreen = readSource('app', '(tabs)', 'church.tsx');
const churchContext = readSource('contexts', 'ChurchContext.tsx');

test('WordSafeHeaderText disables platform hyphenation and owns truncation', () => {
  assert.match(wordSafeText, /android_hyphenationFrequency="none"/);
  assert.match(wordSafeText, /lineBreakStrategyIOS="none"/);
  assert.match(wordSafeText, /textBreakStrategy="simple"/);
  assert.match(wordSafeText, /ellipsizeMode="tail"/);
  assert.match(wordSafeText, /layout\.lines\.join\('\\n'\)/);
  assert.match(wordSafeText, /accessibilityLabel=\{accessibilityLabel \?\? text\}/);
});

test('AdaptiveHeaderText delegates visual wrapping to the shared layer', () => {
  assert.match(adaptiveText, /WordSafeHeaderText/);
  assert.match(adaptiveText, /createWordSafeHeaderLayout/);
  assert.match(adaptiveText, /availableWidth=\{availableWidth\}/);
  assert.match(adaptiveText, /text=\{text\}/);
  assert.doesNotMatch(adaptiveText, /<Text(?:\s|>)/);
});

test('all branded church-name headers inherit word-safe rendering', () => {
  assert.match(responsiveHeader, /<AdaptiveHeaderText/);
  assert.match(responsiveHeader, /text=\{title\}/);
  assert.match(responsiveHeader, /text=\{subtitle\}/);
});

test('Profile and Church selection rows reuse WordSafeHeaderText', () => {
  assert.match(churchSwitcher, /WordSafeHeaderText/);
  assert.match(churchSwitcher, /text=\{church\.name\}/);
  assert.match(churchScreen, /WordSafeHeaderText/);
  assert.match(churchScreen, /accessibilityLabel=\{church\.name\}/);
  assert.match(churchScreen, /text=\{church\.name\}/);
});

test('compact pills and metadata remain deliberately single-line', () => {
  const pillStart = responsiveHeader.indexOf('export function TabHeaderPill');
  const iconButtonStart = responsiveHeader.indexOf(
    'export function TabHeaderIconButton',
    pillStart,
  );
  const compactControls = responsiveHeader.slice(pillStart, iconButtonStart);

  assert.match(compactControls, /numberOfLines=\{1\}/);
  assert.doesNotMatch(compactControls, /WordSafeHeaderText/);
});

test('display normalization is never imported into database mutation code', () => {
  assert.doesNotMatch(
    churchContext,
    /normalizeHeaderDisplayText|createWordSafeHeaderLayout/,
  );
});

test('Package 8 is client-only and adds no database migration', () => {
  const migrations = readdirSync(join(projectRoot, 'supabase', 'migrations'));
  assert.equal(
    migrations.some(name => /package[_-]?8|word[_-]?safe/i.test(name)),
    false,
  );
});
