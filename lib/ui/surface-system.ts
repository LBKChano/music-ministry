import type { AppTheme, AppThemeStatusTokens } from '@/lib/ui/app-theme';

export type AppSurfaceStatusTone =
  | 'success'
  | 'attention'
  | 'error'
  | 'info'
  | 'personal'
  | 'assigned'
  | 'unassigned'
  | 'disabled';

export function resolveSurfaceStatusTokens(
  theme: AppTheme,
  tone: AppSurfaceStatusTone,
): AppThemeStatusTokens {
  switch (tone) {
    case 'success':
    case 'assigned':
      return theme.status.success;
    case 'attention':
      return theme.status.warning;
    case 'error':
      return theme.status.error;
    case 'info':
    case 'personal':
      return theme.status.info;
    case 'unassigned':
      return {
        surface: theme.colors.surfaceMuted,
        foreground: theme.colors.textSecondary,
        border: theme.colors.borderStrong,
      };
    case 'disabled':
      return {
        surface: theme.colors.surfaceMuted,
        foreground: theme.colors.textSecondary,
        border: theme.colors.borderSubtle,
      };
  }
}

export function resolveSurfaceOpacity({
  disabled,
  pressed,
  theme,
}: {
  disabled: boolean;
  pressed: boolean;
  theme: AppTheme;
}): number {
  if (disabled) return theme.interaction.disabledOpacity;
  if (pressed) return theme.interaction.pressedOpacity;
  return 1;
}
