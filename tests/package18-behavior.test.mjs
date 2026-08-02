import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAutoAssignPreviewKey,
  isMissingAutoAssignRoleError,
  isStaleAutoAssignPreviewError,
} from '../lib/admin/operations.ts';

const baseInput = {
  churchId: 'church-18',
  mode: 'fill_empty',
  targetRoleId: null,
  range: {
    target_start_date: '2026-08-01',
    target_end_date: '2026-08-31',
    target_service_ids: null,
  },
  allowMultipleRolesSameService: false,
  services: [{
    id: 'service-18',
    date: '2026-08-16',
    time: '09:00',
    assignments: [{
      id: 'assignment-18',
      role: 'Keys',
      member_id: null,
      person_name: '',
    }],
  }],
  members: [{
    id: 'member-18',
    name: 'Member 18',
    memberRoles: [{ role_id: 'keys-role', role_name: 'Keys' }],
  }],
};

test('role scope is part of auto-assignment preview identity', () => {
  const allRoles = createAutoAssignPreviewKey(baseInput);
  const keysOnly = createAutoAssignPreviewKey({
    ...baseInput,
    targetRoleId: 'keys-role',
  });
  const vocalsOnly = createAutoAssignPreviewKey({
    ...baseInput,
    targetRoleId: 'vocals-role',
  });

  assert.notEqual(keysOnly, allRoles);
  assert.notEqual(vocalsOnly, keysOnly);
  assert.equal(
    createAutoAssignPreviewKey({ ...baseInput, targetRoleId: undefined }),
    allRoles,
  );
});

test('stale server previews are recognized without matching unrelated errors', () => {
  assert.equal(
    isStaleAutoAssignPreviewError({ code: '40001', details: 'stale_preview' }),
    true,
  );
  assert.equal(
    isStaleAutoAssignPreviewError({ message: 'The schedule changed after preview.' }),
    true,
  );
  assert.equal(
    isStaleAutoAssignPreviewError({ details: 'preview_apply_diverged' }),
    true,
  );
  assert.equal(
    isStaleAutoAssignPreviewError({ code: '42501', message: 'Forbidden' }),
    false,
  );
});

test('a deleted role is recognized without exposing a database error', () => {
  assert.equal(isMissingAutoAssignRoleError({ details: 'role_not_found' }), true);
  assert.equal(
    isMissingAutoAssignRoleError({ message: 'The selected role is no longer available.' }),
    true,
  );
  assert.equal(isMissingAutoAssignRoleError({ message: 'Network error' }), false);
});
