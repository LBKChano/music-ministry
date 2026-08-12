import type { AppTheme } from '@/lib/ui/app-theme';

// Transitional adapter for focused screens whose layout styles still use the
// pre-token vocabulary. Every value comes from the active semantic theme.
export function createLegacyThemeColors(theme: AppTheme) {
  return {
    primary: theme.colors.accent,
    secondary: theme.header.gradient[2],
    accent: theme.header.accentLine,
    background: theme.colors.canvas,
    backgroundAlt: theme.colors.surfaceMuted,
    text: theme.colors.textPrimary,
    textSecondary: theme.colors.textSecondary,
    textTertiary: theme.colors.textTertiary,
    card: theme.colors.surface,
    cardBackground: theme.colors.surface,
    border: theme.colors.borderSubtle,
    highlight: theme.inputHighlight.border,
    inputBackground: theme.input.surface,
    error: theme.status.error.foreground,
    errorBackground: theme.status.error.surface,
    errorBorder: theme.status.error.border,
    navyDark: theme.colors.surfaceStrong,
    navyLight: theme.colors.accentSoft,
    headerBackground: theme.colors.surfaceStrong,
    headerText: theme.strongSurface.foreground,
  };
}

export type LegacyThemeColors = ReturnType<typeof createLegacyThemeColors>;
