import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...segments) => readFileSync(join(root, ...segments), 'utf8');

test('semantic color audit blocks unapproved source literals', () => {
  const result = spawnSync(
    process.execPath,
    [join(root, 'scripts', 'audit-semantic-colors.mjs')],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Semantic color audit passed/);
});

test('appearance control is production-visible and native activation is complete', () => {
  const profile = read('components', 'profile', 'profile-screen.tsx');
  const appearance = read('components', 'profile', 'profile-appearance-screen.tsx');
  const layout = read('app', '_layout.tsx');
  const appConfig = JSON.parse(read('app.json')).expo;
  assert.match(profile, /title="Appearance"/);
  assert.match(appearance, /System/);
  assert.match(appearance, /Light/);
  assert.match(appearance, /Dark/);
  assert.match(layout, /name="profile-appearance"/);
  assert.equal(appConfig.userInterfaceStyle, 'automatic');
});

test('release gate documents checks that cannot be claimed from source alone', () => {
  const gate = read('docs', 'DARK_MODE_RELEASE_GATE.md');
  assert.match(gate, /Physical Device Gate/);
  assert.match(gate, /Dynamic Island/);
  assert.match(gate, /TalkBack/);
  assert.match(gate, /VoiceOver/);
  assert.match(gate, /widget modes/);
  assert.match(gate, /snapshot payload/);
});

test('Package 42 remains client-only and keeps released backend contracts intact', () => {
  const migrations = readdirSync(join(root, 'supabase', 'migrations'));
  const functions = readdirSync(join(root, 'supabase', 'functions'));
  assert.equal(migrations.some(name => /package[_-]?42|dark[_-]?release/i.test(name)), false);
  assert.equal(functions.some(name => /package[_-]?42|dark[_-]?release/i.test(name)), false);
});
