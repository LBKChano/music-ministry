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

const responsiveHeader = readSource(
  'components',
  'navigation',
  'responsive-tab-header.tsx',
);
const adaptiveText = readSource(
  'components',
  'navigation',
  'adaptive-header-text.tsx',
);
const androidSchedule = readSource('app', '(tabs)', '(home)', 'index.tsx');
const iosSchedule = readSource('app', '(tabs)', '(home)', 'index.ios.tsx');
const church = readSource('app', '(tabs)', 'church.tsx');
const androidProfile = readSource('app', '(tabs)', 'profile.tsx');
const iosProfile = readSource('app', '(tabs)', 'profile.ios.tsx');
const sharedProfile = readSource('components', 'profile', 'profile-screen.tsx');

test('ResponsiveTabHeader keeps its existing API and adds explicit variants', () => {
  for (const prop of [
    'eyebrow: string',
    'title: string',
    'subtitle?: string | null',
    'trailing?: ReactNode',
    'children?: ReactNode',
    'accessibilityTitle?: string',
  ]) {
    assert.match(responsiveHeader, new RegExp(prop.replace(/[?]/g, '\\?')));
  }

  assert.match(responsiveHeader, /titleVariant\?: HeaderTypographyVariant/);
  assert.match(responsiveHeader, /subtitleVariant\?: HeaderTypographyVariant/);
  assert.match(responsiveHeader, /trailingWidth\?: number/);
});

test('header names use one deterministic sizing system', () => {
  const headerComponentEnd = responsiveHeader.indexOf(
    'export function TabHeaderPill',
  );
  const headerComponent = responsiveHeader.slice(0, headerComponentEnd);

  assert.match(headerComponent, /AdaptiveHeaderText/);
  assert.match(headerComponent, /useWindowDimensions/);
  assert.match(headerComponent, /calculateHeaderTitleLaneWidth/);
  assert.doesNotMatch(headerComponent, /useState|onLayout|LayoutChangeEvent/);
  assert.doesNotMatch(headerComponent, /adjustsFontSizeToFit|minimumFontScale/);
});

test('AdaptiveHeaderText supports Larger Text and full-name accessibility', () => {
  assert.match(adaptiveText, /maxFontSizeMultiplier/);
  assert.match(adaptiveText, /maxLines=\{2\}/);
  assert.match(adaptiveText, /accessibilityLabel=\{accessibilityLabel \?\? text\}/);
  assert.match(adaptiveText, /EXPO_PUBLIC_HEADER_LAYOUT_DIAGNOSTICS/);
  assert.doesNotMatch(adaptiveText, /adjustsFontSizeToFit|minimumFontScale/);
});

test('Schedule and Church reserve stable action lanes explicitly', () => {
  for (const schedule of [androidSchedule, iosSchedule]) {
    assert.match(schedule, /titleVariant="primaryTitle"/);
    assert.match(
      schedule,
      /trailingWidth=\{HEADER_ACTION_LANE_WIDTHS\.bell\}/,
    );
  }

  assert.match(church, /titleVariant="primaryTitle"/);
  assert.match(
    church,
    /trailingWidth=\{HEADER_ACTION_LANE_WIDTHS\.churchActions\}/,
  );
});

test('both Profile implementations keep member and church typography separate', () => {
  for (const profile of [androidProfile, iosProfile]) {
    assert.match(profile, /ProfileScreen/);
  }
  assert.match(sharedProfile, /title=\{displayName\}/);
  assert.match(sharedProfile, /titleVariant="profileName"/);
  assert.match(sharedProfile, /subtitle=\{currentChurch\?\.name\}/);
  assert.match(sharedProfile, /subtitleVariant="secondaryChurchName"/);
  assert.match(
    sharedProfile,
    /trailingWidth=\{HEADER_ACTION_LANE_WIDTHS\.profile\}/,
  );
});

test('Package 7 is client-only and adds no database migration', () => {
  const migrations = readdirSync(join(projectRoot, 'supabase', 'migrations'));
  assert.equal(
    migrations.some(name => /package[_-]?7|header[_-]?typography/i.test(name)),
    false,
  );
});
