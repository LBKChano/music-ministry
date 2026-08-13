import React, {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';
import {
  futureDarkAppTheme,
  lightAppTheme,
  type AppTheme,
} from '@/lib/ui/app-theme';
import {
  DEFAULT_APPEARANCE_PREFERENCE,
  resolveAppearanceMode,
  resolveDevelopmentAppearanceOverride,
  type AppearancePreference,
  type ResolvedAppearanceMode,
} from '@/lib/ui/appearance-preference';
import {
  readAppearancePreference,
  saveAppearancePreference,
} from '@/lib/ui/appearance-preference-storage';

const AppThemeContext = createContext<AppTheme>(lightAppTheme);

type AppAppearanceContextValue = {
  preference: AppearancePreference;
  resolvedMode: ResolvedAppearanceMode;
  ready: boolean;
  setPreference: (preference: AppearancePreference) => Promise<boolean>;
};

const AppAppearanceContext = createContext<AppAppearanceContextValue>({
  preference: DEFAULT_APPEARANCE_PREFERENCE,
  resolvedMode: 'light',
  ready: false,
  setPreference: async () => false,
});

export function AppThemeProvider({
  children,
  theme,
  developmentPreferenceOverride,
}: {
  children: React.ReactNode;
  theme?: AppTheme;
  developmentPreferenceOverride?: AppearancePreference | null;
}) {
  const systemColorScheme = useColorScheme();
  const [storedPreference, setStoredPreference] = useState<AppearancePreference>(
    DEFAULT_APPEARANCE_PREFERENCE,
  );
  const [preferenceReady, setPreferenceReady] = useState(Boolean(theme));
  const environmentOverride = resolveDevelopmentAppearanceOverride(
    process.env.EXPO_PUBLIC_APP_APPEARANCE_PREVIEW,
    __DEV__,
  );
  const activeOverride = developmentPreferenceOverride ?? environmentOverride;

  useEffect(() => {
    let active = true;

    if (theme || activeOverride) {
      setPreferenceReady(true);
      return () => {
        active = false;
      };
    }

    setPreferenceReady(false);
    void readAppearancePreference().then(preference => {
      if (!active) return;
      setStoredPreference(preference);
      setPreferenceReady(true);
    });

    return () => {
      active = false;
    };
  }, [activeOverride, theme]);

  const preference = activeOverride ?? storedPreference;
  const resolvedMode = theme?.mode ?? resolveAppearanceMode(
    preference,
    systemColorScheme,
  );
  const activeTheme = theme ?? (
    resolvedMode === 'dark' ? futureDarkAppTheme : lightAppTheme
  );
  const setPreference = useCallback(async (
    nextPreference: AppearancePreference,
  ) => {
    const previousPreference = storedPreference;
    setStoredPreference(nextPreference);
    const saved = await saveAppearancePreference(nextPreference);
    if (!saved) {
      setStoredPreference(current => (
        current === nextPreference ? previousPreference : current
      ));
    }
    return saved;
  }, [storedPreference]);

  useEffect(() => {
    if (typeof Appearance.setColorScheme !== 'function') return;
    const nativePreference = theme?.mode ?? preference;
    Appearance.setColorScheme(
      nativePreference === 'system' ? null : nativePreference,
    );
  }, [preference, theme?.mode]);

  const appearanceValue = useMemo<AppAppearanceContextValue>(() => ({
    preference,
    resolvedMode,
    ready: Boolean(theme) || Boolean(activeOverride) || preferenceReady,
    setPreference,
  }), [
    activeOverride,
    preference,
    preferenceReady,
    resolvedMode,
    setPreference,
    theme,
  ]);

  return (
    <AppAppearanceContext value={appearanceValue}>
      <AppThemeContext value={activeTheme}>
        {children}
      </AppThemeContext>
    </AppAppearanceContext>
  );
}

export function useAppTheme(): AppTheme {
  return use(AppThemeContext);
}

export function useAppAppearance(): AppAppearanceContextValue {
  return use(AppAppearanceContext);
}
