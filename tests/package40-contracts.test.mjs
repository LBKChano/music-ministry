import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...segments) => readFileSync(join(root, ...segments), 'utf8');

const profile = read('components', 'profile', 'profile-screen.tsx');
const appearance = read('components', 'profile', 'profile-appearance-screen.tsx');
const appearanceRoute = read('app', 'profile-appearance.tsx');
const context = read('contexts', 'AppThemeContext.tsx');
const verifyEmail = read('app', 'verify-email.tsx');

test('Profile exposes one focused device-local appearance setting', () => {
  assert.match(profile, /title="Appearance"/);
  assert.match(profile, /router\.push\('\/profile-appearance'\)/);
  assert.match(appearanceRoute, /ProfileAppearanceScreen/);
  assert.match(appearance, /useAppAppearance/);
  assert.match(appearance, /'system'/);
  assert.match(appearance, /'light'/);
  assert.match(appearance, /'dark'/);
  assert.match(appearance, /accessibilityRole="radiogroup"/);
  assert.match(appearance, /accessibilityRole="radio"/);
  assert.doesNotMatch(appearance, /supabase|accountId|churchId|memberId/);
});

test('appearance changes immediately and restores the previous value if storage fails', () => {
  assert.match(context, /setStoredPreference\(nextPreference\)/);
  assert.match(context, /saveAppearancePreference\(nextPreference\)/);
  assert.match(context, /current === nextPreference \? previousPreference : current/);
  assert.match(appearance, /setPreference\(nextPreference\)/);
  assert.match(appearance, /previous setting was restored/);
});

test('Profile and authentication recovery surfaces use semantic runtime colors', () => {
  const sources = [
    verifyEmail,
    read('app', 'onboarding.tsx'),
    read('app', 'reset-password.tsx'),
    read('components', 'profile', 'profile-notification-preferences-screen.tsx'),
    read('components', 'profile', 'profile-scheduling-preferences-screen.tsx'),
    read('components', 'profile', 'profile-availability-screen.tsx'),
    read('components', 'profile', 'profile-identity-screen.tsx'),
  ];
  for (const source of sources) {
    assert.match(source, /useAppTheme/);
    assert.doesNotMatch(source, /styles\/commonStyles/);
  }
  assert.doesNotMatch(verifyEmail, /useTheme\(/);
});

test('Package 40 is client-only and requires no account migration', () => {
  const migrations = readdirSync(join(root, 'supabase', 'migrations'));
  const functions = readdirSync(join(root, 'supabase', 'functions'));
  assert.equal(migrations.some(name => /package[_-]?40|appearance[_-]?profile/i.test(name)), false);
  assert.equal(functions.some(name => /package[_-]?40|appearance[_-]?profile/i.test(name)), false);
});
