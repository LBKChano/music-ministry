import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { AppModal } from '@/components/ui/app-modal';
import { ProfileFocusedHeader } from '@/components/profile/profile-focused-header';
import {
  ProfileDangerRow,
  ProfileRow,
  ProfileStatus,
} from '@/components/profile/profile-primitives';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { useChurch } from '@/hooks/useChurch';
import { getAppReleaseInfo } from '@/lib/profile/account';
import type { AppTheme } from '@/lib/ui/app-theme';

export function ProfileAccountScreen() {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useChurch();
  const [showSignOut, setShowSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const release = getAppReleaseInfo(Constants.expoConfig, Platform.OS);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
      setShowSignOut(false);
      router.replace('/onboarding');
    } catch (signOutError) {
      setShowSignOut(false);
      setError(
        signOutError instanceof Error
          ? signOutError.message
          : 'Unable to sign out. Please try again.',
      );
      setSigningOut(false);
    }
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ProfileFocusedHeader
        disabled={signingOut}
        onBack={() => router.back()}
        subtitle="Security, app information, and account management"
        title="Account"
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 32 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
      >
        <ProfileStatus message={error} tone="error" />

        <View style={styles.identityPanel}>
          <View style={styles.identityIcon}>
            <IconSymbol
              ios_icon_name="person.crop.circle.fill"
              android_material_icon_name="account-circle"
              size={30}
              color={theme.strongSurface.foreground}
            />
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.eyebrow}>SIGNED IN AS</Text>
            <Text selectable style={styles.email}>
              {user?.email ?? 'Email unavailable'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Security</Text>
          <View style={styles.rowGroup}>
            <ProfileRow
              accessibilityHint="Opens the secure password change form."
              androidIcon="password"
              iosIcon="key.fill"
              onPress={() => router.push('/change-password')}
              summary="Update your password or request a reset email."
              title="Change Password"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>App Information</Text>
          <View style={styles.infoGroup}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text selectable style={styles.infoValue}>{release.version}</Text>
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityHint="Signs this account out on this device only."
          accessibilityState={{ busy: signingOut, disabled: signingOut }}
          disabled={signingOut}
          onPress={() => setShowSignOut(true)}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.pressed,
            signingOut && styles.disabled,
          ]}
        >
          <IconSymbol
            ios_icon_name="rectangle.portrait.and.arrow.right"
            android_material_icon_name="logout"
            size={21}
            color={theme.colors.accent}
          />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        <View style={styles.dangerSection}>
          <View style={styles.dangerHeading}>
            <Text accessibilityRole="header" style={styles.dangerTitle}>
              Account Management
            </Text>
            <Text style={styles.dangerDescription}>
              Permanent actions affecting your account and stored data.
            </Text>
          </View>
          <View style={styles.dangerGroup}>
            <ProfileDangerRow
              accessibilityHint="Opens a deletion impact preview and permanent confirmation."
              androidIcon="delete"
              iosIcon="trash.fill"
              onPress={() => router.push('/delete-account')}
              summary="Permanently delete your account and associated data."
              title="Delete Account"
            />
          </View>
        </View>
      </ScrollView>

      <AppModal
        busy={signingOut}
        onClose={() => setShowSignOut(false)}
        primaryAction={{
          label: 'Sign Out',
          loading: signingOut,
          onPress: () => void handleSignOut(),
        }}
        secondaryAction={{
          label: 'Cancel',
          onPress: () => setShowSignOut(false),
        }}
        title="Sign Out?"
        variant="confirmation"
        visible={showSignOut}
      >
        <Text style={styles.modalMessage}>
          This device will stop receiving notifications for this account. Your account and church data will remain available.
        </Text>
      </AppModal>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: { backgroundColor: theme.colors.canvas, flex: 1 },
  content: {
    alignSelf: 'center',
    gap: 20,
    maxWidth: 720,
    paddingHorizontal: 16,
    paddingTop: 16,
    width: '100%',
  },
  identityPanel: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceStrong,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 13,
    padding: 16,
  },
  identityIcon: {
    alignItems: 'center',
    backgroundColor: theme.header.controlSurface,
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  identityCopy: { flex: 1, gap: 3, minWidth: 0 },
  eyebrow: { color: theme.strongSurface.mutedForeground, fontSize: 11, fontWeight: '800', lineHeight: 15 },
  email: { color: theme.strongSurface.foreground, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  section: { gap: 8 },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: 17, fontWeight: '800', lineHeight: 22, paddingHorizontal: 4 },
  rowGroup: { borderColor: theme.colors.borderSubtle, borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  infoGroup: { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSubtle, borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  infoRow: { alignItems: 'center', borderBottomColor: theme.divider.color, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 15 },
  infoLabel: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600' },
  infoValue: { color: theme.colors.textSecondary, fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '700' },
  signOutButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: theme.button.secondarySurface, borderColor: theme.button.secondaryBorder, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 50, paddingHorizontal: 18 },
  signOutText: { color: theme.colors.accent, fontSize: 16, fontWeight: '800' },
  dangerSection: { gap: 9, paddingTop: 4 },
  dangerHeading: { gap: 3, paddingHorizontal: 4 },
  dangerTitle: { color: theme.status.error.foreground, fontSize: 17, fontWeight: '800', lineHeight: 22 },
  dangerDescription: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19 },
  dangerGroup: { borderColor: theme.status.error.border, borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  modalMessage: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21, paddingVertical: 15, textAlign: 'center' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
});
