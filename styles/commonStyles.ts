
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';

export const colors = {
  primary: '#1E3A8A',    // Navy Blue - spiritual/worship theme
  secondary: '#2563EB',  // Bright Blue - also exported as a named key for badge/role use
  accent: '#60A5FA',     // Light Blue
  background: '#FFFFFF', // Clean white background
  backgroundAlt: '#F0F9FF', // Very light blue background
  text: '#1A202C',       // Dark text
  textSecondary: '#64748B', // Gray text
  textTertiary: '#94A3B8', // Lighter gray text
  card: '#FFFFFF',       // White cards
  cardBackground: '#FFFFFF', // Card background
  border: '#DBEAFE',     // Light blue border
  highlight: '#3B82F6',  // Medium blue for highlights
  inputBackground: '#F0F9FF', // Input background
  error: '#DC2626',      // Error red
  navyDark: '#0F172A',   // Dark navy for accents
  navyLight: '#BFDBFE',  // Light navy for subtle backgrounds
  headerBackground: '#1E3A8A', // Navy blue header
  headerText: '#FFFFFF', // White header text
};

export const darkColors = {
  background: '#1C1C1E',
  card: '#2C2C2E',
  text: '#FFFFFF',
  subText: '#8E8E93',
  border: '#3A3A3C',
  primary: colors.primary,
  secondary: colors.secondary,
  accent: colors.accent,
  backgroundAlt: '#2C2C2E',
  textSecondary: '#8E8E93',
  textTertiary: '#636366',
  cardBackground: '#2C2C2E',
  highlight: colors.highlight,
  inputBackground: '#3A3A3C',
  error: colors.error,
  navyDark: colors.navyDark,
  navyLight: '#1C3A6E',
  headerBackground: colors.headerBackground,
  headerText: colors.headerText,
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
    boxShadow: '0px 2px 3px rgba(30, 58, 138, 0.1)',
    elevation: 2,
  },
  icon: {
    width: 60,
    height: 60,
    tintColor: "white",
  },
});
