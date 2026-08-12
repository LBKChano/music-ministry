import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getSplashExitDelay,
  getSplashMarkSize,
  SPLASH_BACKGROUND_COLOR,
  SPLASH_TIMING,
} from '../lib/ui/splash-screen.ts';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('splash artwork remains prominent without growing excessively on tablets', () => {
  assert.equal(getSplashMarkSize(320, 568), 218);
  assert.equal(getSplashMarkSize(390, 844), 250);
  assert.equal(getSplashMarkSize(430, 932), 275);
  assert.equal(getSplashMarkSize(1024, 1366), 276);
});

test('ordinary motion completes a short intro while Reduced Motion exits immediately', () => {
  const mountedAt = 1_000;

  assert.equal(
    getSplashExitDelay(mountedAt, mountedAt + 200, false),
    SPLASH_TIMING.minimumVisible - 200,
  );
  assert.equal(
    getSplashExitDelay(mountedAt, mountedAt + 2_000, false),
    0,
  );
  assert.equal(
    getSplashExitDelay(mountedAt, mountedAt + 200, true),
    0,
  );
});

test('native and React splash layers share one background and brand source', () => {
  const appConfig = JSON.parse(read('app.json')).expo;
  const splashPlugin = appConfig.plugins.find(plugin => (
    Array.isArray(plugin) && plugin[0] === 'expo-splash-screen'
  ));

  assert.ok(splashPlugin);
  assert.equal(splashPlugin[1].backgroundColor, SPLASH_BACKGROUND_COLOR);
  assert.equal(splashPlugin[1].android.backgroundColor, SPLASH_BACKGROUND_COLOR);
  assert.equal(splashPlugin[1].ios.backgroundColor, SPLASH_BACKGROUND_COLOR);
  assert.equal(splashPlugin[1].image, './assets/splash-mark.png');
  assert.equal(splashPlugin[1].android.image, './assets/splash-mark.png');
  assert.equal(splashPlugin[1].ios.image, './assets/splash-mark.png');
});

test('root layout owns the native handoff and Auth remains presentation-free', () => {
  const layout = read('app/_layout.tsx');
  const authContext = read('contexts/AuthContext.tsx');
  const customSplash = read('components/CustomSplashScreen.tsx');

  assert.match(layout, /<CustomSplashScreen[\s\S]*onReady=\{handleSplashReady\}/);
  assert.match(layout, /SplashScreen\.hideAsync\(\)/);
  assert.doesNotMatch(authContext, /expo-splash-screen|hideSplash/);
  assert.match(customSplash, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(customSplash, /reduceMotionChanged/);
});

test('the delayed loading message does not compete with the intro animation', () => {
  assert.ok(SPLASH_TIMING.statusDelay > SPLASH_TIMING.minimumVisible);
  assert.ok(SPLASH_TIMING.exit <= 300);
});
