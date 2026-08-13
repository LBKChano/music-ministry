export const APPEARANCE_PREFERENCE_SCHEMA_VERSION = 1;
export const DEFAULT_APPEARANCE_PREFERENCE = 'system' as const;

export type AppearancePreference = 'system' | 'light' | 'dark';
export type ResolvedAppearanceMode = 'light' | 'dark';

export type StoredAppearancePreference = {
  schemaVersion: typeof APPEARANCE_PREFERENCE_SCHEMA_VERSION;
  preference: AppearancePreference;
  updatedAt: string;
};

export function isAppearancePreference(
  value: unknown,
): value is AppearancePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function createStoredAppearancePreference(
  preference: AppearancePreference,
  updatedAt = new Date().toISOString(),
): StoredAppearancePreference {
  return {
    schemaVersion: APPEARANCE_PREFERENCE_SCHEMA_VERSION,
    preference,
    updatedAt,
  };
}

export function parseStoredAppearancePreference(
  rawValue: string | null | undefined,
): AppearancePreference {
  if (!rawValue) return DEFAULT_APPEARANCE_PREFERENCE;

  try {
    const parsed: unknown = JSON.parse(rawValue);

    // Accept a previously stored bare value if a development build wrote one.
    if (isAppearancePreference(parsed)) return parsed;

    if (
      parsed
      && typeof parsed === 'object'
      && 'schemaVersion' in parsed
      && parsed.schemaVersion === APPEARANCE_PREFERENCE_SCHEMA_VERSION
      && 'preference' in parsed
      && isAppearancePreference(parsed.preference)
    ) {
      return parsed.preference;
    }
  } catch {
    // A bare unquoted value is also accepted as a legacy development value.
    if (isAppearancePreference(rawValue)) return rawValue;
  }

  return DEFAULT_APPEARANCE_PREFERENCE;
}

export function serializeAppearancePreference(
  preference: AppearancePreference,
  updatedAt?: string,
): string {
  return JSON.stringify(createStoredAppearancePreference(preference, updatedAt));
}

export function resolveAppearanceMode(
  preference: AppearancePreference,
  systemColorScheme: string | null | undefined,
): ResolvedAppearanceMode {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemColorScheme === 'dark' ? 'dark' : 'light';
}

export function resolveDevelopmentAppearanceOverride(
  rawValue: string | null | undefined,
  enabled: boolean,
): AppearancePreference | null {
  if (!enabled) return null;
  const normalized = rawValue?.trim().toLowerCase();
  return isAppearancePreference(normalized) ? normalized : null;
}
