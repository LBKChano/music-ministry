import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...segments) => readFileSync(join(root, ...segments), 'utf8');

const context = read('contexts', 'AppThemeContext.tsx');
const layout = read('app', '_layout.tsx');
const preference = read('lib', 'ui', 'appearance-preference.ts');
const storage = read('lib', 'ui', 'appearance-preference-storage.ts');
const appConfig = JSON.parse(read('app.json')).expo;

test('runtime resolves one semantic theme without remounting app providers', () => {
  assert.match(context, /useColorScheme/);
  assert.match(context, /resolveAppearanceMode/);
  assert.match(context, /futureDarkAppTheme/);
  assert.match(context, /lightAppTheme/);
  assert.match(context, /useAppAppearance/);
  assert.match(layout, /appearanceReady/);
  assert.match(layout, /<AppThemeProvider>[\s\S]*<AuthProvider>/);
  assert.match(layout, /createNavigationThemeColors\(appTheme\)/);
});

test('preference is versioned, device-local, and resilient to storage failure', () => {
  assert.match(preference, /APPEARANCE_PREFERENCE_SCHEMA_VERSION = 1/);
  assert.match(storage, /AsyncStorage\.getItem/);
  assert.match(storage, /AsyncStorage\.setItem/);
  assert.match(storage, /return DEFAULT_APPEARANCE_PREFERENCE/);
  assert.match(storage, /return false/);
  assert.doesNotMatch(storage, /supabase|SecureStore|accountId|churchId|memberId/);
});

test('native appearance integration activates after the staged runtime', () => {
  assert.equal(appConfig.userInterfaceStyle, 'automatic');
  assert.match(context, /Appearance\.setColorScheme/);
  assert.match(context, /EXPO_PUBLIC_APP_APPEARANCE_PREVIEW/);
  assert.match(context, /__DEV__/);
});

test('Package 36 introduces no backend object', () => {
  const migrations = readdirSync(join(root, 'supabase', 'migrations'));
  const functions = readdirSync(join(root, 'supabase', 'functions'));

  assert.equal(
    migrations.some(name => /package[_-]?36|appearance|dark[_-]?mode/i.test(name)),
    false,
  );
  assert.equal(
    functions.some(name => /package[_-]?36|appearance|dark[_-]?mode/i.test(name)),
    false,
  );
});
