import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { ProfileFocusedHeader } from '@/components/profile/profile-focused-header';
import { ProfileRow, ProfileStatus } from '@/components/profile/profile-primitives';
import { useChurch } from '@/hooks/useChurch';
import { getAppReleaseInfo } from '@/lib/profile/account';
import { colors } from '@/styles/commonStyles';

export function ProfileAccountScreen() {
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
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ProfileFocusedHeader
        disabled={signingOut}
        onBack={() => router.back()}
        subtitle="Security and app information"
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
              color={colors.headerText}
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
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Build</Text>
              <Text selectable style={styles.infoValue}>{release.build}</Text>
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
            color={colors.primary}
          />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => !signingOut && setShowSignOut(false)}
        transparent
        visible={showSignOut}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text accessibilityRole="header" style={styles.modalTitle}>Sign Out?</Text>
            <Text style={styles.modalMessage}>
              This device will stop receiving notifications for this account. Your account and church data will remain available.
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                accessibilityRole="button"
                disabled={signingOut}
                onPress={() => setShowSignOut(false)}
                style={({ pressed }) => [styles.modalButton, styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: signingOut }}
                disabled={signingOut}
                onPress={() => void handleSignOut()}
                style={({ pressed }) => [styles.modalButton, styles.confirmButton, pressed && styles.pressed]}
              >
                {signingOut ? (
                  <ActivityIndicator color={colors.headerText} />
                ) : (
                  <Text style={styles.confirmText}>Sign Out</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
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
    backgroundColor: colors.navyDark,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 13,
    padding: 16,
  },
  identityIcon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  identityCopy: { flex: 1, gap: 3, minWidth: 0 },
  eyebrow: { color: '#BFDBFE', fontSize: 11, fontWeight: '800', lineHeight: 15 },
  email: { color: colors.headerText, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  section: { gap: 8 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800', lineHeight: 22, paddingHorizontal: 4 },
  rowGroup: { borderColor: colors.border, borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  infoGroup: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  infoRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 15 },
  infoLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  infoValue: { color: colors.textSecondary, fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '700' },
  signOutButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: colors.backgroundAlt, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 50, paddingHorizontal: 18 },
  signOutText: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  modalOverlay: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.52)', flex: 1, justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: colors.card, borderRadius: 8, maxWidth: 420, padding: 22, width: '100%' },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '800', lineHeight: 26, textAlign: 'center' },
  modalMessage: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, paddingVertical: 15, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalButton: { alignItems: 'center', borderRadius: 8, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 14 },
  cancelButton: { backgroundColor: colors.backgroundAlt, borderColor: colors.border, borderWidth: 1 },
  confirmButton: { backgroundColor: colors.primary },
  cancelText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  confirmText: { color: colors.headerText, fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
});
