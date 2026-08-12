import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const read = (...segments) => readFileSync(join(projectRoot, ...segments), 'utf8');

const focusedHeader = read('components', 'navigation', 'focused-screen-header.tsx');
const tabHeader = read('components', 'navigation', 'responsive-tab-header.tsx');
const church = read('app', '(tabs)', 'church.tsx');
const profileHeader = read('components', 'profile', 'profile-focused-header.tsx');
const churchHeader = read('components', 'church-admin', 'admin-hub-editor-header.tsx');
const surfaces = read('components', 'ui', 'app-surface.tsx');
const theme = read('lib', 'ui', 'app-theme.ts');

test('focused headers render no placeholder when a trailing action is absent', () => {
  assert.match(focusedHeader, /\{trailing \? \([\s\S]*styles\.trailingAction/);
  assert.doesNotMatch(focusedHeader, /<View style=\{styles\.headerButton\}>\s*\{trailing\}/);
  assert.match(focusedHeader, /hasTrailingAction: Boolean\(trailing\)/);
  assert.match(focusedHeader, /AdaptiveHeaderText/);
});

test('all focused Church and Profile screens retain the shared header contract', () => {
  assert.match(profileHeader, /<FocusedScreenHeader/);
  assert.match(churchHeader, /<FocusedScreenHeader/);
  assert.match(profileHeader, /trailing=\{trailing\}/);
  assert.match(churchHeader, /trailing=\{action\}/);
});

test('the Church title uses the real single-action lane and word-safe tab header', () => {
  assert.match(church, /trailingWidth=\{HEADER_ACTION_LANE_WIDTHS\.churchActions\}/);
  assert.match(tabHeader, /AdaptiveHeaderText/);
  assert.match(tabHeader, /calculateHeaderTitleLaneWidth/);
});

test('section accents and strong navies come from shared semantic sources', () => {
  assert.match(surfaces, /height: 15/);
  assert.match(surfaces, /width: 2/);
  assert.match(surfaces, /accent === 'info'/);
  assert.match(theme, /surfaceStrong: lightBrand\.navy/);
  assert.match(theme, /gradient: \[lightBrand\.navy, lightBrand\.accent, lightBrand\.bright\]/);
});

test('Package 30 adds no backend object or persisted UI setting', () => {
  const migrations = readdirSync(join(projectRoot, 'supabase', 'migrations'));
  assert.equal(migrations.some(name => /package[_-]?30|header[_-]?correction/i.test(name)), false);
  assert.doesNotMatch(focusedHeader + tabHeader + surfaces, /supabase|AsyncStorage|SecureStore/);
});
