import assert from 'node:assert/strict';
import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);

function readProjectFile(path) {
  return readFileSync(join(projectRoot, path), 'utf8');
}

function readJson(path) {
  return JSON.parse(readProjectFile(path));
}

function readMigrationSql() {
  const migrationsDirectory = join(projectRoot, 'supabase', 'migrations');
  return readdirSync(migrationsDirectory)
    .filter(file => file.endsWith('.sql'))
    .sort()
    .map(file => readFileSync(join(migrationsDirectory, file), 'utf8'))
    .join('\n');
}

function parseFunctionJwtSettings(config) {
  const settings = new Map();
  let currentFunction = null;

  for (const rawLine of config.split(/\r?\n/)) {
    const line = rawLine.trim();
    const section = line.match(/^\[functions\.([^\]]+)\]$/);
    if (section) {
      currentFunction = section[1];
      continue;
    }

    const verifyJwt = line.match(/^verify_jwt\s*=\s*(true|false)$/);
    if (currentFunction && verifyJwt) {
      settings.set(currentFunction, verifyJwt[1] === 'true');
    }
  }

  return settings;
}

const baseline = readJson('docs/compatibility-baseline.json');
const appConfig = readJson('app.json').expo;

test('mobile identifiers and source versions match the recorded baseline', () => {
  assert.equal(appConfig.version, baseline.mobileSource.version);
  assert.equal(
    appConfig.ios.bundleIdentifier,
    baseline.mobileSource.iosBundleIdentifier,
  );
  assert.equal(
    appConfig.ios.buildNumber,
    baseline.mobileSource.iosSourceBuildNumber,
  );
  assert.equal(
    appConfig.android.package,
    baseline.mobileSource.androidPackage,
  );
  assert.equal(
    appConfig.android.versionCode,
    baseline.mobileSource.androidSourceVersionCode,
  );
  assert.equal(appConfig.scheme, baseline.mobileSource.urlScheme);

  const buildProperties = appConfig.plugins
    .find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-build-properties');
  assert.ok(buildProperties, 'expo-build-properties must remain configured');
  assert.equal(
    buildProperties[1].android.targetSdkVersion,
    baseline.mobileSource.androidTargetSdkVersion,
  );
});

test('legacy route entry points remain available', () => {
  for (const route of baseline.routes) {
    assert.equal(
      existsSync(join(projectRoot, route)),
      true,
      `Missing compatibility route: ${route}`,
    );
  }
});

test('Auth persistence and routing retain the released-client contract', () => {
  const supabaseClient = readProjectFile('lib/supabase/client.ts');
  const rootLayout = readProjectFile('app/_layout.tsx');
  const passwordResetLinks = readProjectFile('utils/passwordResetLinks.ts');

  assert.match(
    supabaseClient,
    new RegExp(`storageKey:\\s*['"]${baseline.auth.storageKey}['"]`),
  );
  assert.match(
    supabaseClient,
    new RegExp(`flowType:\\s*['"]${baseline.auth.flowType}['"]`),
  );

  for (const option of [
    'persistSession',
    'autoRefreshToken',
    'detectSessionInUrl',
  ]) {
    assert.match(
      supabaseClient,
      new RegExp(`${option}:\\s*${baseline.auth[option]}`),
      `Auth option ${option} changed`,
    );
  }

  assert.match(
    passwordResetLinks,
    new RegExp(`createURL\\(['"]${baseline.auth.passwordResetRoute}['"]\\)`),
  );
  assert.match(
    rootLayout,
    new RegExp(`router\\.replace\\(['"]${baseline.auth.signedOutRoute}['"]\\)`),
  );
});

test('recorded client tables remain in generated Supabase types', () => {
  const generatedTypes = readProjectFile('lib/supabase/types.ts');

  for (const table of baseline.supabase.clientTables) {
    assert.match(
      generatedTypes,
      new RegExp(`\\n\\s{6}${table}: \\{`),
      `Missing generated type for public.${table}`,
    );
  }
});

test('generated subscription relationship supports multiple devices per member', () => {
  const generatedTypes = readProjectFile('lib/supabase/types.ts');
  const relationshipStart = generatedTypes.indexOf(
    'foreignKeyName: "onesignal_subscriptions_member_id_fkey"',
  );

  assert.notEqual(
    relationshipStart,
    -1,
    'Missing OneSignal member relationship',
  );
  assert.match(
    generatedTypes.slice(relationshipStart, relationshipStart + 240),
    new RegExp(
      `isOneToOne:\\s*${baseline.supabase.liveAudit.oneSignalMemberRelationshipIsOneToOne}`,
    ),
  );
});

test('public RPC names used by released clients remain declared', () => {
  const migrationSql = readMigrationSql();
  const generatedTypes = readProjectFile('lib/supabase/types.ts');

  for (const rpc of baseline.supabase.publicRpcs) {
    assert.match(
      migrationSql,
      new RegExp(`function\\s+public\\.${rpc}\\s*\\(`, 'i'),
      `Missing migration declaration for public.${rpc}`,
    );
    assert.match(
      generatedTypes,
      new RegExp(`\\n\\s{6}${rpc}: \\{`),
      `Missing generated RPC type for public.${rpc}`,
    );
  }
});

test('Edge Function entry points and JWT contracts remain stable', () => {
  const functionSettings = parseFunctionJwtSettings(
    readProjectFile('supabase/config.toml'),
  );

  for (const edgeFunction of baseline.supabase.edgeFunctions) {
    const entryPoint = join(
      projectRoot,
      'supabase',
      'functions',
      edgeFunction.name,
      'index.ts',
    );
    assert.equal(
      existsSync(entryPoint),
      true,
      `Missing Edge Function: ${edgeFunction.name}`,
    );
    assert.equal(
      functionSettings.get(edgeFunction.name),
      edgeFunction.verifyJwt,
      `verify_jwt changed for ${edgeFunction.name}`,
    );
  }
});

test('notification event names remain supported by backend senders', () => {
  const functionSource = baseline.supabase.edgeFunctions
    .filter(edgeFunction => edgeFunction.name !== 'delete-account')
    .map(edgeFunction => readProjectFile(
      `supabase/functions/${edgeFunction.name}/index.ts`,
    ))
    .join('\n');

  for (const notificationType of baseline.supabase.notificationTypes) {
    assert.match(
      functionSource,
      new RegExp(`notification_type:\\s*['"]${notificationType}['"]`),
      `Missing notification type: ${notificationType}`,
    );
  }
});

test('Supabase project reference remains explicit in local configuration', () => {
  assert.match(
    readProjectFile('supabase/config.toml'),
    new RegExp(`project_id\\s*=\\s*["']${baseline.supabase.projectRef}["']`),
  );
});
