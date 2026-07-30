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

const onboarding = readSource('app', 'onboarding.tsx');
const verification = readSource('app', 'verify-email.tsx');
const storage = readSource('lib', 'auth', 'onboarding-intent-storage.ts');
const workflow = readSource('lib', 'auth', 'onboarding-workflow.ts');
const rootLayout = readSource('app', '_layout.tsx');
const authInput = readSource('components', 'auth', 'AuthTextInput.tsx');
const verificationLinks = readSource(
  'utils',
  'signupVerificationLinks.ts',
);
const releasedPolicies = readSource(
  'supabase',
  'migrations',
  '20260708004000_allow_scheduling_admins.sql',
);

test('new onboarding uses account-level paths and keeps legacy mode aliases valid', () => {
  for (const label of ['Sign In', 'Join a Church', 'Create a Church']) {
    assert.match(onboarding, new RegExp(`title="${label}"`));
  }
  for (const alias of ['adminLogin', 'member', 'memberSignup', 'church', 'admin']) {
    assert.match(onboarding, new RegExp(`case '${alias}'`));
  }
  assert.doesNotMatch(onboarding, /Login as Admin/);
  assert.doesNotMatch(onboarding, /Login as Member/);
});

test('new-client create and join are atomic RPC operations', () => {
  const service = readSource('lib', 'auth', 'onboarding-service.ts');
  assert.match(service, /\.rpc\(\s*'create_church_with_owner_membership'/);
  assert.match(service, /\.rpc\(\s*'join_church_by_invitation'/);
  assert.doesNotMatch(onboarding, /\.from\('churches'\)\s*\.insert/);
  assert.doesNotMatch(onboarding, /\.from\('church_members'\)\s*\.insert/);
});

test('confirmation-required signup stores no password and resumes on a dedicated route', () => {
  assert.match(onboarding, /status === 'verification-required'/);
  assert.match(onboarding, /pathname: '\/verify-email'/);
  assert.match(verification, /completeOnboardingIntent/);
  assert.match(verification, /supabase\.auth\.resend/);
  assert.doesNotMatch(storage, /\bpassword\b/i);
  assert.doesNotMatch(workflow, /\bpassword\s*:/i);
});

test('existing accounts are guided to sign in before the pending action completes', () => {
  assert.match(onboarding, /status === 'existing-account'/);
  assert.match(onboarding, /setStep\('signIn'\)/);
  assert.match(onboarding, /loadPendingOnboardingIntent/);
  assert.match(onboarding, /pendingIntent\?\.email === normalizedEmail/);
});

test('forms have persistent labels, password-manager metadata, and one submit lock', () => {
  assert.match(onboarding, /<LabeledTextInput/);
  assert.match(onboarding, /credentialType="username"/);
  assert.match(onboarding, /credentialType="current-password"/);
  assert.match(onboarding, /credentialType="new-password"/);
  assert.match(onboarding, /submissionInFlightRef/);
  assert.match(authInput, /importantForAutofill: 'yes'/);
  assert.match(authInput, /textContentType: 'newPassword'/);
});

test('verification and password reset remain separate public callback routes', () => {
  assert.match(rootLayout, /isPasswordRecoveryUrl/);
  assert.match(rootLayout, /isSignupVerificationUrl/);
  assert.match(rootLayout, /name="reset-password"/);
  assert.match(rootLayout, /name="verify-email"/);
  assert.match(
    verificationLinks,
    /Linking\.createURL\('verify-email'\)/,
  );
});

test('Package 3 does not tighten the policies released clients still use', () => {
  assert.match(releasedPolicies, /create policy "Users can join church as member"/i);
  assert.match(
    readSource(
      'supabase',
      'migrations',
      '20260723000001_optimize_rls_policy_performance.sql',
    ),
    /create policy "Users create churches"/i,
  );
  assert.doesNotMatch(
    readSource(
      'supabase',
      'migrations',
      '20260729182446_add_multi_church_account_device_foundation.sql',
    ),
    /drop policy "Users create churches"/i,
  );
});
