import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { supabase } from '@/lib/supabase/client';
import { getAuthParamsFromUrl } from '@/utils/passwordResetLinks';

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

  const handleRecoveryUrl = useCallback(async (url: string | null) => {
    if (!url) return false;

    const authParams = getAuthParamsFromUrl(url);
    const authError = authParams.get('error_description') ?? authParams.get('error');
    const accessToken = authParams.get('access_token');
    const refreshToken = authParams.get('refresh_token');
    const type = authParams.get('type');

    if (authError) {
      setError(authError.replace(/\+/g, ' '));
      setMessage(null);
      setCanResetPassword(false);
      return true;
    }

    if (type !== 'recovery' || !accessToken || !refreshToken) {
      return false;
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError) {
      console.error('Error setting password recovery session:', sessionError);
      setError('That reset link is invalid or expired. Please request a new one.');
      setMessage(null);
      setCanResetPassword(false);
      return true;
    }

    setError(null);
    setMessage('Enter a new password for your account.');
    setCanResetPassword(true);
    return true;
  }, []);

  useEffect(() => {
    let mounted = true;

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

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Error reading recovery session:', sessionError);
      }

      if (data.session) {
        setCanResetPassword(true);
        setMessage('Enter a new password for your account.');
      } else {
        setCanResetPassword(false);
        setMessage(null);
        setError('Open the password reset link from your email again, or request a new link.');
      }

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
        >
          <View style={styles.stepContainer}>
            <Text style={[styles.title, { color: colors.text }]}>Set New Password</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Choose a new password for your Music Ministry account.
            </Text>

            <View style={styles.formContainer}>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="New Password"
                placeholderTextColor={colors.textSecondary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading && !saving && canResetPassword}
              />

              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                placeholder="Confirm New Password"
                placeholderTextColor={colors.textSecondary}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading && !saving && canResetPassword}
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
                onPress={() => router.replace('/onboarding')}
                disabled={saving}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                  Back to Login
                </Text>
              </TouchableOpacity>
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
