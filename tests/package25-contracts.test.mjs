import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const read = (...segments) => readFileSync(join(projectRoot, ...segments), 'utf8');

const primitives = read('components', 'ui', 'app-surface.tsx');
const surfaceSystem = read('lib', 'ui', 'surface-system.ts');
const profilePrimitives = read('components', 'profile', 'profile-primitives.tsx');
const profile = read('components', 'profile', 'profile-screen.tsx');
const churchOverview = read('components', 'church-admin', 'admin-hub-overview.tsx');
const church = read('app', '(tabs)', 'church.tsx');
const schedule = read('components', 'schedules', 'schedule-screen.tsx');
const scheduleCard = read('components', 'schedules', 'schedule-service-card.tsx');
const scheduleControls = read('components', 'schedules', 'schedule-view-controls.tsx');

test('shared surface primitives cover the approved cross-app vocabulary', () => {
  for (const name of [
    'AppSectionHeader',
    'AppGroupedSurface',
    'AppDivider',
    'AppIconTile',
    'AppValueChip',
    'AppMetadataChip',
    'AppStatusBadge',
  ]) {
    assert.match(primitives, new RegExp(`export function ${name}`));
  }
  assert.match(primitives, /useAppTheme\(\)/);
  assert.match(primitives, /resolveSurfaceStatusTokens/);
  assert.doesNotMatch(primitives, /commonStyles|#[0-9A-Fa-f]{3,8}|rgba?\(/);
  assert.match(surfaceSystem, /'assigned'/);
  assert.match(surfaceSystem, /'unassigned'/);
  assert.match(surfaceSystem, /'disabled'/);
});

test('Profile and Church overview share grouped surfaces and labeled statuses', () => {
  assert.match(profilePrimitives, /AppGroupedSurface/);
  assert.match(profilePrimitives, /AppSectionHeader/);
  assert.match(profilePrimitives, /AppIconTile/);
  assert.match(profilePrimitives, /AppValueChip/);
  assert.match(profile, /ProfileRowGroup/);
  assert.match(profile, /theme\.colors\.canvas/);
  assert.match(churchOverview, /AppGroupedSurface/);
  assert.match(churchOverview, /AppSectionHeader/);
  assert.match(churchOverview, /label="Ready"[\s\S]*tone="success"/);
  assert.match(churchOverview, /AppStatusBadge label="Next" tone="personal"/);
  assert.match(church, /theme\.colors\.canvas/);
});

test('Schedule uses semantic canvas, controls, cards, and labeled attention bands', () => {
  assert.match(schedule, /themedScheduleCardStyles/);
  assert.match(schedule, /theme\.colors\.canvas/);
  assert.match(schedule, /theme\.colors\.surface/);
  assert.match(schedule, /theme\.colors\.borderSubtle/);
  assert.match(scheduleControls, /theme\.colors\.surfaceMuted/);
  assert.match(scheduleControls, /resolveSurfaceOpacity/);
  assert.match(scheduleCard, /resolveSurfaceStatusTokens/);
  assert.match(scheduleCard, /theme\.status\.warning\.surface/);
  assert.match(scheduleCard, /theme\.status\.info\.surface/);
  assert.match(scheduleCard, /theme\.colors\.surfaceMuted/);
  assert.match(scheduleCard, /statusLabel/);
  assert.match(scheduleCard, /Your Assignment/);
  assert.match(scheduleCard, /Fill-in open/);
});

test('responsive names, tablet widths, routes, and main workflows remain intact', () => {
  assert.match(schedule, /title=\{churchName\}/);
  assert.match(church, /resolveSelectedChurchHeaderTitle/);
  assert.match(profile, /title=\{displayName\}/);
  assert.match(profile, /router\.push\('\/profile-identity'\)/);
  assert.match(profile, /router\.push\('\/profile-availability'\)/);
  assert.match(profilePrimitives, /maxWidth: 760/);
  assert.match(churchOverview, /maxWidth: 760/);
  assert.match(schedule, /maxWidth: 760/);
  assert.match(scheduleCard, /onAssignMember/);
  assert.match(scheduleCard, /onRequestFillIn/);
  assert.match(scheduleCard, /onAddSong/);
});

test('Package 25 remains client-only and adds no persisted setting', () => {
  const migrations = readdirSync(join(projectRoot, 'supabase', 'migrations'));
  const functions = readdirSync(join(projectRoot, 'supabase', 'functions'));

  assert.equal(
    migrations.some(name => /package[_-]?25|surface[_-]?hierarchy/i.test(name)),
    false,
  );
  assert.equal(
    functions.some(name => /package[_-]?25|surface[_-]?hierarchy/i.test(name)),
    false,
  );
  assert.doesNotMatch(surfaceSystem, /supabase|AsyncStorage|SecureStore/);
  assert.doesNotMatch(primitives, /supabase|AsyncStorage|SecureStore/);
});
