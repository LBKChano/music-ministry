import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(testsDirectory);
const readSource = (...segments) => readFileSync(
  join(projectRoot, ...segments),
  'utf8',
);

const authContext = readSource('contexts', 'AuthContext.tsx');
const churchContext = readSource('contexts', 'ChurchContext.tsx');
const onboarding = readSource('app', 'onboarding.tsx');
const rootLayout = readSource('app', '_layout.tsx');
const rootIndex = readSource('app', 'index.tsx');
const churchScreen = readSource('app', '(tabs)', 'church.tsx');
const noMembership = readSource('app', 'no-membership.tsx');
const sessionStorage = readSource('lib', 'church', 'session-storage.ts');
const completedOnboardingTransition = readSource(
  'hooks',
  'useCompletedOnboardingTransition.ts',
);

test('Auth bootstrap uses the persisted session and a recoverable error without a blind timeout', () => {
  assert.match(authContext, /supabase\.auth\.getSession\(\)/);
  assert.match(authContext, /initializationError/);
  assert.match(authContext, /retryInitialization/);
  assert.doesNotMatch(authContext, /setTimeout\s*\(/);
  assert.doesNotMatch(authContext, /INITIAL_SESSION_TIMEOUT/i);
});

test('Church bootstrap exposes every explicit session state', () => {
  for (const status of [
    'restoring',
    'signed-out',
    'loading-memberships',
    'selecting-church',
    'ready',
    'no-membership',
    'error',
  ]) {
    assert.match(
      readSource('lib', 'church', 'startup-coordinator.ts'),
      new RegExp(`'${status}'`),
      `Missing startup state ${status}`,
    );
  }
});

test('one atomic church transition validates membership and rejects stale work', () => {
  assert.match(churchContext, /const transitionChurchSession = useCallback/);
  assert.match(churchContext, /if \(!nextCurrentMember\)/);
  assert.match(churchContext, /transitionGenerationRef\.current !== transitionGeneration/);
  assert.match(churchContext, /activeUserIdRef\.current !== targetAccountId/);
  assert.match(churchContext, /switchChurch: transitionChurchSession/);
  assert.doesNotMatch(churchContext, /CHURCH_LOAD_MAX_RETRIES/);
});

test('manual church selection and onboarding use the shared transition path', () => {
  assert.match(churchScreen, /switchChurch\(church\.id\)/);
  assert.doesNotMatch(
    churchScreen,
    /User selected church:[\s\S]{0,160}setCurrentChurch\(church\)/,
  );
  assert.match(onboarding, /beginCompletedOnboardingTransition/);
  assert.match(completedOnboardingTransition, /refreshChurches\(target\.churchId\)/);
  assert.match(completedOnboardingTransition, /saveLastSelectedChurchId/);
  assert.match(completedOnboardingTransition, /session\?\.user\.id !== target\.accountId/);
  assert.doesNotMatch(onboarding, /setCurrentChurch/);
  assert.doesNotMatch(onboarding, /ONBOARDING_MEMBERSHIP_MAX_RETRIES/);
  assert.doesNotMatch(onboarding, /MEMBERSHIP_RETRY_DELAY/);
});

test('new Church-tab creation is atomic and retry-idempotent', () => {
  assert.match(churchContext, /churchCreationRequestIdsRef/);
  assert.match(churchContext, /\.rpc\(\s*'create_church_with_owner_membership'/);
  assert.match(churchContext, /target_request_id: requestId/);
  assert.match(churchScreen, /await switchChurch\(result\.id\)/);
  assert.match(onboarding, /completeOnboardingIntent/);
});

test('last-selected church storage is scoped to the authenticated account', () => {
  assert.match(sessionStorage, /music-ministry:last-church:/);
  assert.match(sessionStorage, /lastChurchKey\(accountId\)/);
  assert.match(churchContext, /getLastSelectedChurchId\(targetAccountId\)/);
  assert.match(churchContext, /saveLastSelectedChurchId\(targetAccountId, targetChurch\.id\)/);
});

test('root routing shares one decision table and preserves password recovery', () => {
  assert.match(rootLayout, /resolveStartupDestination/);
  assert.match(rootIndex, /resolveStartupDestination/);
  assert.match(rootLayout, /rootSegment === 'reset-password'/);
  assert.match(rootIndex, /isPasswordRecoveryUrl/);
  assert.match(rootLayout, /name="no-membership"/);
});

test('no-membership recovery offers deterministic retry and sign out', () => {
  assert.match(noMembership, /retryChurchSession/);
  assert.match(noMembership, /await signOut\(\)/);
  assert.match(noMembership, /sessionStatus === 'ready'/);
});

test('Package 2 is client-only and keeps released backend paths intact', () => {
  const releasedChurchPolicies = readSource(
    'supabase',
    'migrations',
    '20260723000001_optimize_rls_policy_performance.sql',
  );
  const releasedMemberPolicies = readSource(
    'supabase',
    'migrations',
    '20260708004000_allow_scheduling_admins.sql',
  );
  assert.match(releasedChurchPolicies, /create policy "Users create churches"/i);
  assert.match(releasedMemberPolicies, /create policy "Users can join church as member"/i);
  assert.match(
    readSource('supabase', 'functions', 'send-service-reminders', 'index.ts'),
    /resolveNotificationSubscriptions/,
  );
  assert.match(
    readSource('supabase', 'migrations', '20260729182446_add_multi_church_account_device_foundation.sql'),
    /create_church_with_owner_membership/,
  );
});
