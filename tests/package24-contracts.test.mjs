import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const read = (...segments) => readFileSync(join(projectRoot, ...segments), 'utf8');

const floatingTabs = read('components', 'FloatingTabBar.tsx');
const appTabs = read('components', 'navigation', 'app-tabs.tsx');
const theme = read('lib', 'ui', 'app-theme.ts');
const schedule = read('components', 'schedules', 'schedule-screen.tsx');
const church = read('app', '(tabs)', 'church.tsx');
const profile = read('components', 'profile', 'profile-primitives.tsx');

test('the dock uses semantic surfaces with an intentional native fallback', () => {
  assert.match(floatingTabs, /useAppTheme\(\)/);
  assert.match(floatingTabs, /process\.env\.EXPO_OS === 'ios'/);
  assert.match(floatingTabs, /<BlurView/);
  assert.match(floatingTabs, /navigationSurface/);
  assert.match(floatingTabs, /navigationOpaqueSurface/);
  assert.match(floatingTabs, /navigationSelectedForeground/);
  assert.match(floatingTabs, /navigationAccent/);
  assert.doesNotMatch(floatingTabs, /commonStyles|#[0-9A-Fa-f]{3,8}|rgba?\(/);
  assert.match(theme, /navigationBorder/);
});

test('the selected capsule springs and Reduced Motion updates immediately', () => {
  assert.match(floatingTabs, /useReducedMotion\(\)/);
  assert.match(floatingTabs, /reduceMotion\s*\? activeTabIndex\s*:\s*withSpring/);
  assert.match(floatingTabs, /overshootClamping: true/);
  assert.match(floatingTabs, /pointerEvents: 'none'/);
});

test('tab behavior and permission-driven Church visibility remain unchanged', () => {
  assert.match(floatingTabs, /router\.navigate\(route\)/);
  assert.doesNotMatch(floatingTabs, /router\.(?:push|replace)\(route\)/);
  assert.match(floatingTabs, /accessibilityRole="tab"/);
  assert.match(floatingTabs, /accessibilityState=\{\{ selected: isActive \}\}/);
  assert.match(floatingTabs, /maxFontSizeMultiplier=\{1\.3\}/);
  assert.match(floatingTabs, /minHeight: 56/);
  assert.match(floatingTabs, /minWidth: FLOATING_DOCK_MIN_TARGET/);
  assert.match(appTabs, /shouldDisplayAdminTab/);
  assert.match(appTabs, /shouldLeaveChurchTab/);
  assert.match(appTabs, /\[baseTabs\[0\], adminTab, baseTabs\[1\]\]/);
});

test('keyboard, safe-area, tablet, and content-clearance safeguards stay connected', () => {
  assert.match(floatingTabs, /Keyboard\.addListener\('keyboardDidShow'/);
  assert.match(floatingTabs, /if \(keyboardVisible\) return null/);
  assert.match(floatingTabs, /useSafeAreaInsets\(\)/);
  assert.match(floatingTabs, /getFloatingDockLayout/);
  assert.match(appTabs, /tabBarHideOnKeyboard: true/);
  assert.match(schedule, /paddingBottom: 140/);
  assert.match(church, /paddingBottom: 140/);
  assert.match(profile, /paddingBottom: 144/);
});

test('Package 24 remains client-only and adds no backend object', () => {
  const migrations = readdirSync(join(projectRoot, 'supabase', 'migrations'));
  const functions = readdirSync(join(projectRoot, 'supabase', 'functions'));

  assert.equal(migrations.some(name => /package[_-]?24|floating[_-]?dock/i.test(name)), false);
  assert.equal(functions.some(name => /package[_-]?24|floating[_-]?dock/i.test(name)), false);
  assert.doesNotMatch(floatingTabs, /supabase|AsyncStorage|SecureStore/);
});
