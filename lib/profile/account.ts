export interface AccountDeletionImpact {
  membershipsRemoved: number;
  ownedChurchesDeleted: number;
  ownedChurchNames: string[];
  otherChurchMembersRemoved: number;
  ownedServicesDeleted: number;
  ownedWeeklyServicesDeleted: number;
  assignmentsCleared: number;
}

export interface AccountDeletionPreview {
  preview: true;
  impact: AccountDeletionImpact;
}

export interface PasswordChangeValidation {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  nonce?: string;
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

export function normalizeAccountDeletionPreview(
  value: unknown,
): AccountDeletionPreview {
  if (!value || typeof value !== 'object') {
    throw new Error('The account deletion preview was not available.');
  }

  const payload = value as {
    preview?: unknown;
    impact?: Record<string, unknown>;
    error?: unknown;
  };
  if (typeof payload.error === 'string' && payload.error) {
    throw new Error(payload.error);
  }
  if (payload.preview !== true || !payload.impact) {
    throw new Error('The account deletion preview was not available.');
  }

  return {
    preview: true,
    impact: {
      membershipsRemoved: nonNegativeInteger(
        payload.impact.memberships_removed,
      ),
      ownedChurchesDeleted: nonNegativeInteger(
        payload.impact.owned_churches_deleted,
      ),
      ownedChurchNames: Array.isArray(payload.impact.owned_church_names)
        ? Array.from(new Set(payload.impact.owned_church_names
          .filter((name): name is string => typeof name === 'string')
          .map(name => name.trim())
          .filter(Boolean)))
        : [],
      otherChurchMembersRemoved: nonNegativeInteger(
        payload.impact.other_church_members_removed,
      ),
      ownedServicesDeleted: nonNegativeInteger(
        payload.impact.owned_services_deleted,
      ),
      ownedWeeklyServicesDeleted: nonNegativeInteger(
        payload.impact.owned_weekly_services_deleted,
      ),
      assignmentsCleared: nonNegativeInteger(
        payload.impact.assignments_cleared,
      ),
    },
  };
}

export function validatePasswordChange({
  currentPassword = '',
  newPassword = '',
  confirmPassword = '',
  nonce = '',
}: PasswordChangeValidation): string | null {
  if (!currentPassword) return 'Enter your current password.';
  if (!newPassword) return 'Enter a new password.';
  if (newPassword.length < 6) {
    return 'Your new password must be at least 6 characters.';
  }
  if (newPassword === currentPassword) {
    return 'Choose a new password that is different from your current password.';
  }
  if (newPassword !== confirmPassword) return 'The new passwords do not match.';
  if (nonce && !/^\d{6}$/.test(nonce.trim())) {
    return 'Enter the 6-digit verification code.';
  }
  return null;
}

export function requiresPasswordReauthentication(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const authError = error as { code?: string; message?: string };
  return authError.code === 'reauthentication_needed'
    || authError.code === 'reauth_nonce_missing'
    || authError.code === 'reauthentication_not_valid'
    || Boolean(authError.message?.toLowerCase().includes('reauth'));
}

export function getAppReleaseInfo(
  config: {
    version?: string | null;
    ios?: { buildNumber?: string | null } | null;
    android?: { versionCode?: number | null } | null;
  } | null | undefined,
  platform: 'ios' | 'android' | 'web' | string,
): { version: string; build: string } {
  const version = config?.version?.trim() || 'Unknown';
  const build = platform === 'ios'
    ? config?.ios?.buildNumber?.trim() || 'Unknown'
    : platform === 'android'
      ? config?.android?.versionCode?.toString() || 'Unknown'
      : 'Web';
  return { version, build };
}
