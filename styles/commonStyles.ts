
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import {
  futureDarkAppTheme,
  lightAppTheme,
} from '@/lib/ui/app-theme';

// Compatibility bridge for screens migrating during Packages 24-28. The
// semantic themes above are the authoritative color source.
export const colors = {
  primary: lightAppTheme.colors.accent,
  secondary: lightAppTheme.header.gradient[2],
  accent: lightAppTheme.header.accentLine,
  // Legacy screens stay white until Package 25 deliberately adopts canvas.
  background: lightAppTheme.colors.surface,
  backgroundAlt: '#F0F9FF',
  text: lightAppTheme.colors.textPrimary,
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  card: lightAppTheme.colors.surface,
  cardBackground: lightAppTheme.colors.surface,
  border: '#DBEAFE',
  highlight: '#3B82F6',
  inputBackground: '#F0F9FF',
  error: '#DC2626',
  errorBackground: '#FEF2F2',
  errorBorder: '#FECACA',
  navyDark: lightAppTheme.header.gradient[0],
  navyLight: '#BFDBFE',
  headerBackground: lightAppTheme.header.gradient[1],
  headerText: lightAppTheme.header.title,
};

export const darkColors = {
  background: futureDarkAppTheme.colors.canvas,
  card: futureDarkAppTheme.colors.surface,
  text: futureDarkAppTheme.colors.textPrimary,
  subText: futureDarkAppTheme.colors.textSecondary,
  border: futureDarkAppTheme.colors.borderSubtle,
  primary: futureDarkAppTheme.colors.accent,
  secondary: futureDarkAppTheme.header.gradient[2],
  accent: futureDarkAppTheme.header.accentLine,
  backgroundAlt: futureDarkAppTheme.colors.surfaceMuted,
  textSecondary: futureDarkAppTheme.colors.textSecondary,
  textTertiary: futureDarkAppTheme.colors.textTertiary,
  cardBackground: futureDarkAppTheme.colors.surface,
  highlight: futureDarkAppTheme.inputHighlight.border,
  inputBackground: futureDarkAppTheme.colors.surfaceMuted,
  error: futureDarkAppTheme.status.error.foreground,
  errorBackground: futureDarkAppTheme.status.error.surface,
  errorBorder: futureDarkAppTheme.status.error.border,
  navyDark: futureDarkAppTheme.header.gradient[0],
  navyLight: futureDarkAppTheme.colors.accentSoft,
  headerBackground: futureDarkAppTheme.header.gradient[1],
  headerText: futureDarkAppTheme.header.title,
};

export const buttonStyles = StyleSheet.create({
  instructionsButton: {
    backgroundColor: colors.primary,
    alignSelf: 'center',
    width: '100%',
  },
  backButton: {
    backgroundColor: colors.backgroundAlt,
    alignSelf: 'center',
    width: '100%',
  },
});

export const commonStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.background,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 800,
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.text,
    marginBottom: 10
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
    lineHeight: 24,
    textAlign: 'center',
  },
  section: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginVertical: 8,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  icon: {
    width: 60,
    height: 60,
    tintColor: "white",
  },
});
