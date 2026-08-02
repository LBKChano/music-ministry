import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const read = (...segments) => readFileSync(join(projectRoot, ...segments), 'utf8');

const tabLayout = read('app', '(tabs)', '_layout.tsx');
const iosTabLayout = read('app', '(tabs)', '_layout.ios.tsx');
const appTabs = read('components', 'navigation', 'app-tabs.tsx');
const floatingTabs = read('components', 'FloatingTabBar.tsx');
const focusedHeader = read('components', 'navigation', 'focused-screen-header.tsx');
const profileHeader = read('components', 'profile', 'profile-focused-header.tsx');
const adminHeader = read('components', 'church-admin', 'admin-hub-editor-header.tsx');
const profile = read('components', 'profile', 'profile-screen.tsx');
const profileChurches = read('components', 'profile', 'profile-churches-screen.tsx');
const churchSwitcher = read('components', 'profile', 'ChurchSwitcher.tsx');
const inlineStatus = read('components', 'feedback', 'inline-status.tsx');
const appState = read('components', 'feedback', 'app-state-screen.tsx');
const modal = read('components', 'admin', 'admin-form-modal.tsx');
const appModal = read('components', 'ui', 'app-modal.tsx');
const onboarding = read('app', 'onboarding.tsx');
const noMembership = read('app', 'no-membership.tsx');
const rootLayout = read('app', '_layout.tsx');
const androidSchedule = read('app', '(tabs)', '(home)', 'index.tsx');
const iosSchedule = read('app', '(tabs)', '(home)', 'index.ios.tsx');

test('Android and iOS tabs use one dynamic navigation contract', () => {
  for (const layout of [tabLayout, iosTabLayout]) {
    assert.match(layout, /import \{ AppTabs \}/);
    assert.match(layout, /<AppTabs \/>/);
  }
  assert.match(appTabs, /shouldDisplayAdminTab/);
  assert.match(appTabs, /shouldLeaveChurchTab/);
  assert.match(appTabs, /href: showAdminTab/);
  assert.match(appTabs, /router\.replace\('\/\(tabs\)\/\(home\)'\)/);
});

test('the floating tab bar switches tabs accessibly without stacking routes', () => {
  assert.match(floatingTabs, /router\.navigate\(route\)/);
  assert.doesNotMatch(floatingTabs, /router\.push\(route\)/);
  assert.match(floatingTabs, /accessibilityRole="tab"/);
  assert.match(floatingTabs, /accessibilityState=\{\{ selected: isActive \}\}/);
  assert.match(floatingTabs, /useReducedMotion/);
  assert.match(floatingTabs, /minHeight: 56/);
  assert.match(floatingTabs, /fontSize: 12/);
});

test('Profile and Church focused editors share one responsive header', () => {
  assert.match(profileHeader, /<FocusedScreenHeader/);
  assert.match(adminHeader, /<FocusedScreenHeader/);
  assert.match(focusedHeader, /accessibilityRole="header"/);
  assert.match(focusedHeader, /accessibilityState=\{\{ disabled \}\}/);
  assert.match(focusedHeader, /WordSafeHeaderText/);
  assert.match(focusedHeader, /minHeight: 76/);
});

test('church switching moved to a focused route without changing its owner', () => {
  assert.match(profile, /title="Switch Church"/);
  assert.match(profile, /router\.push\('\/profile-churches'\)/);
  assert.match(profileChurches, /<ChurchSwitcher \/>/);
  assert.match(churchSwitcher, /switchChurch\(churchId\)/);
  assert.match(churchSwitcher, /Owner|roleLabel/);
  assert.match(churchSwitcher, /Join Another Church/);
  assert.match(rootLayout, /name="profile-churches"/);
});

test('shared feedback and recovery states sanitize and announce messages', () => {
  assert.match(inlineStatus, /sanitizeUserFacingMessage/);
  assert.match(inlineStatus, /accessibilityLiveRegion=/);
  assert.match(inlineStatus, /accessibilityRole=\{live && isError \? 'alert'/);
  assert.match(appState, /sanitizeUserFacingMessage/);
  assert.match(appState, /accessibilityRole="header"/);
  assert.match(onboarding, /<InlineStatus/);
  assert.match(noMembership, /<AppStateScreen/);
});

test('the shared admin form remains keyboard-safe, closable, and accessible', () => {
  assert.match(modal, /<AppModal/);
  assert.match(modal, /onClose=\{onClose\}/);
  assert.match(appModal, /onRequestClose=\{\(\) => requestDismiss\(true\)\}/);
  assert.match(appModal, /onAccessibilityEscape=\{\(\) => requestDismiss\(true\)\}/);
  assert.match(appModal, /accessibilityViewIsModal/);
  assert.match(appModal, /accessibilityLabel=\{`Close \$\{title\}`\}/);
  assert.match(appModal, /keyboardDismissMode=/);
  assert.match(appModal, /keyboardShouldPersistTaps="handled"/);
  assert.match(appModal, /maxHeight: layout\.maxHeight/);
});

test('Package 16 leaves Schedule behavior and the backend untouched', () => {
  for (const schedule of [androidSchedule, iosSchedule]) {
    assert.doesNotMatch(
      schedule,
      /package16|FocusedScreenHeader|InlineStatus|AppStateScreen|AppTabs/,
    );
  }
  const migrations = readdirSync(join(projectRoot, 'supabase', 'migrations'));
  assert.equal(
    migrations.some(name => /package[_-]?16|cross[_-]?app[_-]?ui/i.test(name)),
    false,
  );
});
