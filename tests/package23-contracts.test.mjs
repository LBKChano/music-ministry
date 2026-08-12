import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const read = (...segments) => readFileSync(join(projectRoot, ...segments), 'utf8');

const rootLayout = read('app', '_layout.tsx');
const appConfig = JSON.parse(read('app.json')).expo;
const themeContext = read('contexts', 'AppThemeContext.tsx');
const themeTokens = read('lib', 'ui', 'app-theme.ts');
const legacyColors = read('styles', 'commonStyles.ts');
const tabHeader = read('components', 'navigation', 'responsive-tab-header.tsx');
const churchContext = read('contexts', 'ChurchContext.tsx');
const churchScreen = read('app', '(tabs)', 'church.tsx');

test('Package 23 activates only the light semantic theme', () => {
  assert.equal(appConfig.userInterfaceStyle, 'light');
  assert.match(rootLayout, /<AppThemeProvider>/);
  assert.match(rootLayout, /useAppTheme\(\)/);
  assert.match(rootLayout, /createNavigationThemeColors\(appTheme\)/);
  assert.doesNotMatch(rootLayout, /useColorScheme|CustomDarkTheme/);
  assert.match(themeContext, /theme = lightAppTheme/);
  assert.doesNotMatch(themeContext, /useColorScheme/);
});

test('legacy colors remain a documented adapter to the authoritative theme', () => {
  assert.match(legacyColors, /Compatibility bridge/);
  assert.match(legacyColors, /lightAppTheme/);
  assert.match(legacyColors, /futureDarkAppTheme/);
  assert.match(themeTokens, /export const lightAppTheme/);
  assert.match(themeTokens, /export const futureDarkAppTheme/);
});

test('the branded tab header consumes semantic header tokens', () => {
  assert.match(tabHeader, /useAppTheme\(\)/);
  assert.match(tabHeader, /colors=\{theme\.header\.gradient\}/);
  assert.match(tabHeader, /theme\.header\.accentPanel/);
  assert.match(tabHeader, /theme\.header\.accentLine/);
  assert.match(tabHeader, /theme\.header\.controlSurface/);
  assert.match(tabHeader, /theme\.header\.controlBorder/);
  assert.match(tabHeader, /useSafeAreaInsets/);
  assert.match(tabHeader, /calculateHeaderTitleLaneWidth/);
  assert.match(tabHeader, /trailingWidth/);
  assert.doesNotMatch(tabHeader, /#[0-9A-Fa-f]{3,8}|rgba?\(/);
});

test('selected Church identity converges after refresh and rename', () => {
  assert.match(churchContext, /refreshedSelectedChurch/);
  assert.match(churchContext, /currentChurchRef\.current = refreshedSelectedChurch/);
  assert.match(churchContext, /applyChurchRecordLocally\(data\)/);
  assert.match(churchContext, /queryKeys\.churchDiscovery\(activeAccountId\)/);
  assert.match(churchContext, /queryKeys\.churches\(activeAccountId\)/);
  assert.match(churchScreen, /resolveSelectedChurchHeaderTitle/);
  assert.match(churchScreen, /membership: currentMember/);
});

test('Package 23 adds no backend object or persisted theme setting', () => {
  const migrations = readdirSync(join(projectRoot, 'supabase', 'migrations'));
  const functions = readdirSync(join(projectRoot, 'supabase', 'functions'));

  assert.equal(
    migrations.some(name => /package[_-]?23|semantic[_-]?theme/i.test(name)),
    false,
  );
  assert.equal(
    functions.some(name => /package[_-]?23|semantic[_-]?theme/i.test(name)),
    false,
  );
  assert.doesNotMatch(themeContext, /AsyncStorage|SecureStore|supabase/);
});
