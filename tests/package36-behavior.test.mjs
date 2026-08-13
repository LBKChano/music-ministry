import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createStoredAppearancePreference,
  DEFAULT_APPEARANCE_PREFERENCE,
  parseStoredAppearancePreference,
  resolveAppearanceMode,
  resolveDevelopmentAppearanceOverride,
  serializeAppearancePreference,
} from '../lib/ui/appearance-preference.ts';

test('appearance preferences use a versioned local representation', () => {
  const stored = createStoredAppearancePreference(
    'dark',
    '2026-08-13T12:00:00.000Z',
  );

  assert.deepEqual(stored, {
    schemaVersion: 1,
    preference: 'dark',
    updatedAt: '2026-08-13T12:00:00.000Z',
  });
  assert.equal(
    parseStoredAppearancePreference(serializeAppearancePreference(
      'light',
      '2026-08-13T12:00:00.000Z',
    )),
    'light',
  );
});

test('missing and invalid preferences fall back safely to system', () => {
  for (const value of [
    null,
    '',
    'sepia',
    '{broken-json',
    JSON.stringify({ schemaVersion: 1, preference: 'blue' }),
    JSON.stringify({ schemaVersion: 2, preference: 'dark' }),
  ]) {
    assert.equal(
      parseStoredAppearancePreference(value),
      DEFAULT_APPEARANCE_PREFERENCE,
    );
  }
});

test('legacy development values migrate without changing their meaning', () => {
  for (const preference of ['system', 'light', 'dark']) {
    assert.equal(parseStoredAppearancePreference(preference), preference);
    assert.equal(
      parseStoredAppearancePreference(JSON.stringify(preference)),
      preference,
    );
  }
});

test('system follows live OS appearance while explicit choices remain fixed', () => {
  assert.equal(resolveAppearanceMode('system', 'dark'), 'dark');
  assert.equal(resolveAppearanceMode('system', 'light'), 'light');
  assert.equal(resolveAppearanceMode('system', null), 'light');
  assert.equal(resolveAppearanceMode('dark', 'light'), 'dark');
  assert.equal(resolveAppearanceMode('light', 'dark'), 'light');
});

test('development override is constrained and unavailable in production', () => {
  assert.equal(resolveDevelopmentAppearanceOverride('dark', true), 'dark');
  assert.equal(resolveDevelopmentAppearanceOverride(' LIGHT ', true), 'light');
  assert.equal(resolveDevelopmentAppearanceOverride('sepia', true), null);
  assert.equal(resolveDevelopmentAppearanceOverride('dark', false), null);
});
