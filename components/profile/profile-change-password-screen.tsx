import { usePreventRemove } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthTextInput } from '@/components/auth/AuthTextInput';
import { IconSymbol } from '@/components/IconSymbol';
import { ProfileFocusedHeader } from '@/components/profile/profile-focused-header';
import { ProfileStatus } from '@/components/profile/profile-primitives';
import { useChurch } from '@/hooks/useChurch';
import {
  changeAccountPassword,
  requestPasswordReauthentication,
  sendSignedInPasswordReset,
} from '@/lib/profile/account-actions';
import {
  requiresPasswordReauthentication,
  validatePasswordChange,
} from '@/lib/profile/account';
import { colors } from '@/styles/commonStyles';

type StatusTone = 'success' | 'error' | 'info';

export function ProfileChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useChurch();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nonce, setNonce] = useState('');
  const [needsNonce, setNeedsNonce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<StatusTone>('info');
  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const nonceRef = useRef<TextInput>(null);

  usePreventRemove(saving || sendingReset, () => {});

  const showError = (error: unknown, fallback: string) => {
    setStatus(error instanceof Error && error.message ? error.message : fallback);
    setStatusTone('error');
  };

  const sendReauthenticationCode = async () => {
    try {
      await requestPasswordReauthentication();
      setNeedsNonce(true);
      setNonce('');
      setStatus('A 6-digit verification code was sent to your email.');
      setStatusTone('info');
      requestAnimationFrame(() => nonceRef.current?.focus());
    } catch (error) {
      showError(error, 'Unable to send the verification code.');
    }
  };

  const handleSave = async () => {
    if (saving || sendingReset) return;
    const validationError = validatePasswordChange({
      currentPassword,
      newPassword,
      confirmPassword,
      nonce: needsNonce ? nonce : '',
    });
    if (validationError) {
      setStatus(validationError);
      setStatusTone('error');
      return;
    }

    Keyboard.dismiss();
    setSaving(true);
    setStatus(null);
    try {
      await changeAccountPassword({
        currentPassword,
        newPassword,
        nonce: needsNonce ? nonce.trim() : undefined,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNonce('');
      setNeedsNonce(false);
      setStatus('Your password was updated.');
      setStatusTone('success');
    } catch (error) {
      if (requiresPasswordReauthentication(error) && !needsNonce) {
        await sendReauthenticationCode();
      } else {
        showError(error, 'Unable to update your password.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleResetEmail = async () => {
    if (!user?.email || saving || sendingReset) return;
    Keyboard.dismiss();
    setSendingReset(true);
    setStatus(null);
    try {
      await sendSignedInPasswordReset(user.email);
      setStatus(`A password reset link was sent to ${user.email}.`);
      setStatusTone('success');
    } catch (error) {
      showError(error, 'Unable to send a password reset email.');
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ProfileFocusedHeader
        disabled={saving || sendingReset}
        onBack={() => router.back()}
        subtitle={user?.email ?? 'Signed-in account'}
        title="Change Password"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 16) + 40 },
          ]}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
        >
          <ProfileStatus message={status} tone={statusTone} />

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <IconSymbol
                ios_icon_name="lock.shield.fill"
                android_material_icon_name="security"
                size={24}
                color={colors.primary}
              />
              <View style={styles.headingCopy}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>Choose a New Password</Text>
                <Text style={styles.sectionDescription}>
                  Password managers can fill and save these fields securely.
                </Text>
              </View>
            </View>

            <Text style={styles.label}>Current password</Text>
            <AuthTextInput
              autoCapitalize="none"
              credentialType="current-password"
              editable={!saving}
              onChangeText={setCurrentPassword}
              onSubmitEditing={() => newPasswordRef.current?.focus()}
              placeholder="Enter current password"
              placeholderTextColor={colors.textTertiary}
              returnKeyType="next"
              secureTextEntry
              style={styles.input}
              value={currentPassword}
            />

            <Text style={styles.label}>New password</Text>
            <AuthTextInput
              ref={newPasswordRef}
              autoCapitalize="none"
              credentialType="new-password"
              editable={!saving}
              onChangeText={setNewPassword}
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.textTertiary}
              returnKeyType="next"
              secureTextEntry
              style={styles.input}
              value={newPassword}
            />

            <Text style={styles.label}>Confirm new password</Text>
            <AuthTextInput
              ref={confirmPasswordRef}
              autoCapitalize="none"
              credentialType="new-password"
              editable={!saving}
              onChangeText={setConfirmPassword}
              onSubmitEditing={() => {
                if (needsNonce) nonceRef.current?.focus();
                else void handleSave();
              }}
              placeholder="Enter new password again"
              placeholderTextColor={colors.textTertiary}
              returnKeyType={needsNonce ? 'next' : 'done'}
              secureTextEntry
              style={styles.input}
              value={confirmPassword}
            />

            {needsNonce ? (
              <>
                <Text style={styles.label}>Verification code</Text>
                <TextInput
                  ref={nonceRef}
                  accessibilityLabel="6-digit verification code"
                  autoComplete="one-time-code"
                  editable={!saving}
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={value => setNonce(value.replace(/\D/g, ''))}
                  onSubmitEditing={() => void handleSave()}
                  placeholder="000000"
                  placeholderTextColor={colors.textTertiary}
                  returnKeyType="done"
                  style={styles.input}
                  textContentType="oneTimeCode"
                  value={nonce}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => void sendReauthenticationCode()}
                  style={({ pressed }) => [styles.inlineButton, pressed && styles.pressed]}
                >
                  <Text style={styles.inlineButtonText}>Send another code</Text>
                </Pressable>
              </>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: saving, disabled: saving || sendingReset }}
              disabled={saving || sendingReset}
              onPress={() => void handleSave()}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                (saving || sendingReset) && styles.disabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.headerText} />
              ) : (
                <Text style={styles.primaryButtonText}>Update Password</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.recoverySection}>
            <View style={styles.headingCopy}>
              <Text accessibilityRole="header" style={styles.recoveryTitle}>Forgot your current password?</Text>
              <Text style={styles.sectionDescription}>
                Send a secure reset link to the email shown above.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: sendingReset, disabled: sendingReset || saving || !user?.email }}
              disabled={sendingReset || saving || !user?.email}
              onPress={() => void handleResetEmail()}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              {sendingReset ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.secondaryButtonText}>Send Reset Email</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { backgroundColor: colors.background, flex: 1 },
  content: { alignSelf: 'center', gap: 18, maxWidth: 720, paddingHorizontal: 16, paddingTop: 16, width: '100%' },
  section: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 8, borderWidth: 1, padding: 16 },
  sectionHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: 11 },
  headingCopy: { flex: 1, gap: 4, minWidth: 0 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', lineHeight: 23 },
  sectionDescription: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700', lineHeight: 19, marginBottom: 7, marginTop: 16 },
  input: { backgroundColor: colors.inputBackground, borderColor: colors.border, borderRadius: 8, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 52, paddingHorizontal: 13, paddingVertical: 11 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 8, justifyContent: 'center', marginTop: 20, minHeight: 50, paddingHorizontal: 18 },
  primaryButtonText: { color: colors.headerText, fontSize: 16, fontWeight: '800' },
  inlineButton: { alignSelf: 'flex-start', minHeight: 40, paddingVertical: 10 },
  inlineButtonText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  recoverySection: { alignItems: 'flex-start', backgroundColor: colors.backgroundAlt, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 13, padding: 16 },
  recoveryTitle: { color: colors.text, fontSize: 16, fontWeight: '800', lineHeight: 21 },
  secondaryButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: colors.card, borderColor: colors.primary, borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 16 },
  secondaryButtonText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
});
