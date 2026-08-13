import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...segments) => readFileSync(join(root, ...segments), 'utf8');

const appConfig = JSON.parse(read('app.json')).expo;
const context = read('contexts', 'AppThemeContext.tsx');
const layout = read('app', '_layout.tsx');
const tabs = read('components', 'FloatingTabBar.tsx');
const splash = read('components', 'CustomSplashScreen.tsx');
const onboarding = read('app', 'onboarding.tsx');
const widget = read('targets', 'ScheduleWidgets', 'ScheduleWidgets.swift');

test('native appearance follows the selected app preference', () => {
  assert.equal(appConfig.userInterfaceStyle, 'automatic');
  assert.match(context, /typeof Appearance\.setColorScheme !== 'function'/);
  assert.match(context, /Appearance\.setColorScheme/);
  assert.match(context, /nativePreference === 'system' \? null : nativePreference/);
  assert.match(layout, /SystemUI\.setBackgroundColorAsync\(appTheme\.colors\.canvas\)/);
  assert.match(layout, /<StatusBar animated style=\{statusBarStyle\}/);
  assert.match(layout, /navigationBar: navigationBarStyle/);
  assert.match(layout, /statusBar: statusBarStyle/);
  assert.match(layout, /createNavigationThemeColors\(appTheme\)/);
});

test('dock, splash, artwork, and widget retain intentional branded behavior', () => {
  assert.match(tabs, /navigationSurface/);
  assert.match(tabs, /navigationOpaqueSurface/);
  assert.match(tabs, /systemMaterialDark/);
  assert.match(tabs, /navigationAccent/);
  assert.match(splash, /SPLASH_BACKGROUND_COLOR/);
  assert.match(splash, /accessibilityIgnoresInvertColors/);
  assert.match(onboarding, /accessibilityIgnoresInvertColors/);
  assert.match(widget, /ScheduleWidgetPalette/);
  assert.match(widget, /widgetAccentable\(\)/);
  assert.match(widget, /musicMinistry\.scheduleWidget\.snapshot\.v1/);
  assert.match(widget, /snapshotSchemaVersion = 1/);
  assert.match(widget, /ScheduleWidgetMode/);
});

test('Package 41 introduces no backend object or payload migration', () => {
  const migrations = readdirSync(join(root, 'supabase', 'migrations'));
  const functions = readdirSync(join(root, 'supabase', 'functions'));
  assert.equal(migrations.some(name => /package[_-]?41|native[_-]?appearance/i.test(name)), false);
  assert.equal(functions.some(name => /package[_-]?41|native[_-]?appearance/i.test(name)), false);
});
