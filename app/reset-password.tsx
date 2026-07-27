import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { AuthTextInput } from '@/components/auth/AuthTextInput';
import { supabase } from '@/lib/supabase/client';
import { establishPasswordRecoverySession } from '@/utils/passwordResetLinks';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ recoveryUrl?: string }>();
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>('Verifying your reset link...');
  const [canResetPassword, setCanResetPassword] = useState(false);
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const processedRecoveryUrlsRef = useRef(new Set<string>());
  const abandonedRecoveryRef = useRef(false);

  const handleRecoveryUrl = useCallback(async (url: string | null) => {
    if (!url) return false;

    if (processedRecoveryUrlsRef.current.has(url)) {
      return true;
    }
    processedRecoveryUrlsRef.current.add(url);
    abandonedRecoveryRef.current = false;

    const result = await establishPasswordRecoverySession(supabase.auth, url);

    if (abandonedRecoveryRef.current) {
      if (
        result.status === 'ready'
        || (result.status === 'error' && result.clearSession)
      ) {
        await supabase.auth.signOut({ scope: 'local' }).catch((signOutError) => {
          console.warn('Could not clear abandoned password recovery session:', signOutError);
        });
      }
      return true;
    }

    if (result.status === 'ignored') {
      return false;
    }

    if (result.status === 'error') {
      if (result.clearSession) {
        await supabase.auth.signOut({ scope: 'local' }).catch((signOutError) => {
          console.warn('Could not clear rejected auth callback session:', signOutError);
        });
      }
      setError(result.message);
      setMessage(null);
      setCanResetPassword(false);
      setRecoveryUserId(null);
      return true;
    }

    setError(null);
    setMessage('Enter a new password for your account.');
    setCanResetPassword(true);
    setRecoveryUserId(result.session.user.id);
    return true;
  }, []);

  useEffect(() => () => {
    abandonedRecoveryRef.current = true;
  }, []);

  useEffect(() => {
    let mounted = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted || event !== 'PASSWORD_RECOVERY' || !session) return;

      setError(null);
      setMessage('Enter a new password for your account.');
      setCanResetPassword(true);
      setRecoveryUserId(session.user.id);
      setLoading(false);
    });

    const prepare = async () => {
      setLoading(true);
      setError(null);

      const routedRecoveryUrl = typeof params.recoveryUrl === 'string'
        ? decodeURIComponent(params.recoveryUrl)
        : null;

      const handledRoutedUrl = await handleRecoveryUrl(routedRecoveryUrl);
      if (handledRoutedUrl) {
        if (mounted) setLoading(false);
        return;
      }

      const initialUrl = await Linking.getInitialURL().catch((err) => {
        console.error('Error reading reset password initial URL:', err);
        return null;
      });

      const handledInitialUrl = await handleRecoveryUrl(initialUrl);
      if (handledInitialUrl) {
        if (mounted) setLoading(false);
        return;
      }

      setCanResetPassword(false);
      setRecoveryUserId(null);
      setMessage(null);
      setError('Open the password reset link from your email again, or request a new link.');

      if (mounted) setLoading(false);
    };

    prepare().catch((err) => {
      console.error('Unexpected reset password preparation error:', err);
      if (mounted) {
        setError(err instanceof Error ? err.message : 'Unable to open reset password link.');
        setMessage(null);
        setCanResetPassword(false);
        setLoading(false);
      }
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      setLoading(true);
      handleRecoveryUrl(url)
        .catch((err) => {
          console.error('Error handling reset password URL:', err);
          setError(err instanceof Error ? err.message : 'Unable to open reset password link.');
          setMessage(null);
          setCanResetPassword(false);
        })
        .finally(() => setLoading(false));
    });

    return () => {
      mounted = false;
      subscription.remove();
      authListener.subscription.unsubscribe();
    };
  }, [handleRecoveryUrl, params.recoveryUrl]);

  const handleUpdatePassword = async () => {
    if (!canResetPassword) {
      setError('Open the password reset link from your email again, or request a new link.');
      return;
    }

    if (!newPassword.trim() || !confirmNewPassword.trim()) {
      setError('Please enter and confirm your new password');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (
        sessionError
        || !sessionData.session
        || !recoveryUserId
        || sessionData.session.user.id !== recoveryUserId
      ) {
        setCanResetPassword(false);
        setRecoveryUserId(null);
        setError('Your reset session is no longer valid. Please request a new link.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.error('Error updating password:', updateError);
        setError(updateError.message);
        return;
      }

      await supabase.auth.signOut();
      setNewPassword('');
      setConfirmNewPassword('');
      router.replace({
        pathname: '/onboarding',
        params: { passwordReset: 'complete' },
      });
    } catch (err) {
      console.error('Unexpected update password error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const leaveRecovery = async (requestNewLink = false) => {
    abandonedRecoveryRef.current = true;
    Keyboard.dismiss();
    if (recoveryUserId) {
      await supabase.auth.signOut({ scope: 'local' }).catch((signOutError) => {
        console.warn('Could not clear local password recovery session:', signOutError);
      });
    }

    router.replace({
      pathname: '/onboarding',
      params: requestNewLink ? { passwordReset: 'request' } : {},
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.text }]}>Set New Password</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Choose a new password for your Music Ministry account.
            </Text>

            <View style={styles.formContainer}>
              <AuthTextInput
                credentialType="new-password"
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="New Password"
                placeholderTextColor={colors.textSecondary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading && !saving && canResetPassword}
                passwordRules="minlength: 6;"
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
              />

              <AuthTextInput
                ref={confirmPasswordInputRef}
                credentialType="new-password"
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Confirm New Password"
                placeholderTextColor={colors.textSecondary}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading && !saving && canResetPassword}
                passwordRules="minlength: 6;"
                returnKeyType="done"
                onSubmitEditing={handleUpdatePassword}
              />

              {message && (
                <View style={styles.messageContainer}>
                  <Text style={styles.messageText}>{message}</Text>
                </View>
              )}

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: canResetPassword ? colors.primary : colors.textSecondary },
                ]}
                onPress={handleUpdatePassword}
                disabled={loading || saving || !canResetPassword}
              >
                {loading || saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Update Password</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border }]}
                onPress={() => leaveRecovery(false)}
                disabled={saving}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                  Back to Login
                </Text>
              </TouchableOpacity>

              {!canResetPassword && !loading ? (
                <TouchableOpacity
                  style={styles.requestLinkButton}
                  onPress={() => leaveRecovery(true)}
                  disabled={saving}
                >
                  <Text style={[styles.requestLinkButtonText, { color: colors.primary }]}>
                    Request New Reset Link
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  stepContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  primaryButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  requestLinkButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  requestLinkButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  messageContainer: {
    padding: 12,
    backgroundColor: '#E6F7FF',
    borderRadius: 8,
    marginBottom: 16,
  },
  messageText: {
    color: '#007AFF',
    textAlign: 'center',
    fontSize: 14,
  },
  errorContainer: {
    padding: 12,
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
    fontSize: 14,
  },
});
