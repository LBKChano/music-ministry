import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FLOATING_DOCK_HEIGHT,
  FLOATING_DOCK_MAX_WIDTH,
  clampFloatingDockIndex,
  getFloatingDockCapsuleOffset,
  getFloatingDockLayout,
} from '../lib/ui/floating-navigation.ts';
import {
  findActiveTabIndex,
  shouldLeaveChurchTab,
} from '../lib/ui/package16.ts';
import {
  contrastRatio,
  futureDarkAppTheme,
  lightAppTheme,
} from '../lib/ui/app-theme.ts';

const memberTabs = [
  { name: '(home)', route: '/(tabs)/(home)' },
  { name: 'profile', route: '/(tabs)/profile' },
];
const adminTabs = [
  memberTabs[0],
  { name: 'church', route: '/(tabs)/church' },
  memberTabs[1],
];

test('two- and three-tab docks keep one stable shell at every viewport', () => {
  for (const viewportWidth of [320, 360, 390, 430, 768, 1024]) {
    const member = getFloatingDockLayout({
      safeAreaBottom: 0,
      tabCount: 2,
      viewportWidth,
    });
    const admin = getFloatingDockLayout({
      safeAreaBottom: 0,
      tabCount: 3,
      viewportWidth,
    });

    assert.equal(member.shellWidth, admin.shellWidth);
    assert.equal(member.shellHeight, FLOATING_DOCK_HEIGHT);
    assert.ok(member.shellWidth <= FLOATING_DOCK_MAX_WIDTH);
    assert.equal(member.tabWidth * 2, member.trackWidth);
    assert.equal(admin.tabWidth * 3, admin.trackWidth);
  }
});

test('safe-area and custom bottom gaps produce deterministic content clearance', () => {
  const layout = getFloatingDockLayout({
    requestedBottomGap: 20,
    safeAreaBottom: 34,
    tabCount: 3,
    viewportWidth: 430,
  });

  assert.equal(layout.bottomOffset, 54);
  assert.equal(layout.contentClearance, 134);
  assert.equal(layout.shellWidth, 390);

  const defaultPhoneLayout = getFloatingDockLayout({
    safeAreaBottom: 34,
    tabCount: 3,
    viewportWidth: 390,
  });
  assert.ok(defaultPhoneLayout.contentClearance <= 140);
});

test('capsule targets clamp across permission-driven tab-count changes', () => {
  const member = getFloatingDockLayout({
    safeAreaBottom: 0,
    tabCount: 2,
    viewportWidth: 390,
  });
  const admin = getFloatingDockLayout({
    safeAreaBottom: 0,
    tabCount: 3,
    viewportWidth: 390,
  });

  assert.equal(getFloatingDockCapsuleOffset({
    index: 2,
    tabCount: 3,
    tabWidth: admin.tabWidth,
  }), admin.tabWidth * 2);
  assert.equal(getFloatingDockCapsuleOffset({
    index: 2,
    tabCount: 2,
    tabWidth: member.tabWidth,
  }), member.tabWidth);
  assert.equal(clampFloatingDockIndex(-3, 3), 0);
  assert.equal(clampFloatingDockIndex(4, 0), 0);
});

test('active route resolution stays synchronized for member and admin tabs', () => {
  assert.equal(findActiveTabIndex('/(tabs)/profile', memberTabs), 1);
  assert.equal(findActiveTabIndex('/(tabs)/profile', memberTabs), 1);
  assert.equal(findActiveTabIndex('/(tabs)/profile', adminTabs), 2);
  assert.equal(findActiveTabIndex('/(tabs)/church', adminTabs), 1);
  assert.equal(findActiveTabIndex('/(tabs)/church', memberTabs), 0);
  assert.equal(shouldLeaveChurchTab({
    pathname: '/(tabs)/church',
    sessionStatus: 'ready',
    isAdmin: false,
  }), true);
});

test('active and inactive dock labels meet normal-text contrast', () => {
  for (const theme of [lightAppTheme, futureDarkAppTheme]) {
    assert.ok(contrastRatio(
      theme.colors.navigationSelectedForeground,
      theme.colors.navigationSelected,
    ) >= 4.5);
    assert.ok(contrastRatio(
      theme.colors.navigationInactive,
      theme.colors.navigationOpaqueSurface,
    ) >= 4.5);
  }
});
