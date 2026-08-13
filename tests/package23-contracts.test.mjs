import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
const tabHeader = read('components', 'navigation', 'responsive-tab-header.tsx');
const churchContext = read('contexts', 'ChurchContext.tsx');
const churchScreen = read('app', '(tabs)', 'church.tsx');

test('Package 23 surfaces remain compatible with activated native appearance', () => {
  assert.equal(appConfig.userInterfaceStyle, 'automatic');
  assert.match(rootLayout, /<AppThemeProvider>/);
  assert.match(rootLayout, /useAppTheme\(\)/);
  assert.match(rootLayout, /createNavigationThemeColors\(appTheme\)/);
  assert.doesNotMatch(rootLayout, /CustomDarkTheme/);
  assert.match(themeContext, /useColorScheme/);
  assert.match(themeContext, /futureDarkAppTheme/);
});

test('semantic themes remain authoritative after legacy color removal', () => {
  assert.equal(existsSync(join(projectRoot, 'styles', 'commonStyles.ts')), false);
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

test('Package 23 and the later client runtime add no backend theme object', () => {
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
