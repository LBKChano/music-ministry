import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveChurchAdminSummary } from '../lib/church-admin/summary.ts';
import { resolveChurchSetupPresentation } from '../lib/church-admin/presentation.ts';

const church = {
  id: 'church-a',
  admin_id: 'owner-a',
  created_at: '2026-08-12T00:00:00Z',
  updated_at: '2026-08-12T00:00:00Z',
  invitation_code: 'ABC123',
  name: 'Grace Church',
  allow_member_multiple_roles_same_service: false,
  song_type_options: [],
};

function summary(roleCount, weeklyServiceCount) {
  return deriveChurchAdminSummary({
    church,
    memberCount: 1,
    roleCount,
    weeklyServiceCount,
    notificationSettings: null,
  });
}

test('incomplete churches always use the guided setup presentation', () => {
  const incomplete = summary(0, 0);
  assert.equal(incomplete.setupReady, false);
  assert.equal(resolveChurchSetupPresentation({
    setupReady: incomplete.setupReady,
    expanded: false,
  }), 'guided');
  assert.equal(resolveChurchSetupPresentation({
    setupReady: incomplete.setupReady,
    expanded: true,
  }), 'guided');
});

test('complete churches default compact and can expose every editor', () => {
  const complete = summary(3, 2);
  assert.equal(complete.setupReady, true);
  assert.equal(complete.setupRows.length, 7);
  assert.equal(resolveChurchSetupPresentation({
    setupReady: true,
    expanded: false,
  }), 'compact');
  assert.equal(resolveChurchSetupPresentation({
    setupReady: true,
    expanded: true,
  }), 'expanded');
});

test('readiness is derived from current church data and can return to guided', () => {
  const complete = summary(2, 1);
  const laterBroken = summary(2, 0);

  assert.equal(complete.setupReady, true);
  assert.equal(laterBroken.setupReady, false);
  assert.equal(laterBroken.recommendedNext, 'weekly_services');
  assert.equal(resolveChurchSetupPresentation({
    setupReady: laterBroken.setupReady,
    expanded: false,
  }), 'guided');
});
