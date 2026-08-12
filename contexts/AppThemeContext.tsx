import React, { createContext, use } from 'react';
import {
  lightAppTheme,
  type AppTheme,
} from '@/lib/ui/app-theme';

const AppThemeContext = createContext<AppTheme>(lightAppTheme);

export function AppThemeProvider({
  children,
  theme = lightAppTheme,
}: {
  children: React.ReactNode;
  theme?: AppTheme;
}) {
  return (
    <AppThemeContext value={theme}>
      {children}
    </AppThemeContext>
  );
}

export function useAppTheme(): AppTheme {
  return use(AppThemeContext);
}
