import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { useCompletedOnboardingTransition } from '@/hooks/useCompletedOnboardingTransition';
import {
  clearPendingOnboardingIntent,
  loadPendingOnboardingIntent,
} from '@/lib/auth/onboarding-intent-storage';
import { completeOnboardingIntent } from '@/lib/auth/onboarding-service';
import { normalizeAccountEmail } from '@/lib/auth/onboarding-workflow';
import { supabase } from '@/lib/supabase/client';
import {
  establishSignupVerificationSession,
  SIGNUP_VERIFICATION_REDIRECT_URL,
} from '@/utils/signupVerificationLinks';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { session } = useAuth();
  const params = useLocalSearchParams<{
    email?: string;
    verificationUrl?: string;
  }>();
  const [email, setEmail] = useState(
    typeof params.email === 'string' ? params.email : '',
  );
  const [status, setStatus] = useState<
    'waiting' | 'verifying' | 'finishing' | 'error'
  >('waiting');
  const [message, setMessage] = useState(
    'Open the confirmation email on this device. We will finish your church setup after verification.',
  );
  const processedUrlsRef = useRef(new Set<string>());
  const completionInFlightRef = useRef(false);
  const completedSessionAttemptRef = useRef<string | null>(null);
  const handleTransitionError = useCallback((transitionError: string) => {
    setStatus('error');
    setMessage(transitionError);
  }, []);
  const {
    beginTransition: beginCompletedOnboardingTransition,
  } = useCompletedOnboardingTransition(handleTransitionError);

  const finishPendingAction = useCallback(async (
    verifiedSession?: Session | null,
  ) => {
    if (completionInFlightRef.current) return;
    completionInFlightRef.current = true;
    if (verifiedSession) {
      completedSessionAttemptRef.current = verifiedSession.user.id;
    }
    setStatus('finishing');
    setMessage('Email verified. Finishing your church setup...');

    try {
      const pendingIntent = await loadPendingOnboardingIntent();
      if (!pendingIntent) {
        if (verifiedSession || session) {
          router.replace('/');
          return;
        }
        setStatus('error');
        setMessage(
          'Your email is verified, but there is no pending church setup. Sign in to continue.',
        );
        return;
      }

      setEmail(pendingIntent.email);
      const completion = await completeOnboardingIntent(
        pendingIntent,
        verifiedSession ?? session,
      );

      if (completion.status === 'ready') {
        await clearPendingOnboardingIntent();
        await beginCompletedOnboardingTransition(completion);
        return;
      }

      if (completion.status === 'authentication-required') {
        setStatus('waiting');
        setMessage(
          'Your email may already be verified. Sign in to finish the pending church setup.',
        );
        return;
      }

      if (completion.status === 'account-mismatch') {
        setStatus('error');
        setMessage(
          `This setup belongs to ${completion.expectedEmail}. Sign in with that account.`,
        );
        return;
      }

      setStatus('error');
      setMessage(completion.message);
    } finally {
      completionInFlightRef.current = false;
    }
  }, [beginCompletedOnboardingTransition, router, session]);

  const handleVerificationUrl = useCallback(async (url: string | null) => {
    if (!url || processedUrlsRef.current.has(url)) return false;
    processedUrlsRef.current.add(url);
    setStatus('verifying');
    setMessage('Verifying your email...');

    const result = await establishSignupVerificationSession(
      supabase.auth,
      url,
    );
    if (result.status === 'ignored') {
      setStatus('waiting');
      return false;
    }
    if (result.status === 'error') {
      setStatus('error');
      setMessage(result.message);
      return true;
    }

    await finishPendingAction(result.session);
    return true;
  }, [finishPendingAction]);

  useEffect(() => {
    let mounted = true;

    const prepare = async () => {
      const pendingIntent = await loadPendingOnboardingIntent();
      if (!mounted) return;
      if (pendingIntent) setEmail(pendingIntent.email);

      const routedUrl = typeof params.verificationUrl === 'string'
        ? decodeURIComponent(params.verificationUrl)
        : null;
      if (await handleVerificationUrl(routedUrl)) return;

      const initialUrl = await Linking.getInitialURL().catch(error => {
        console.warn('[VerifyEmail] Could not read the initial URL:', error);
        return null;
      });
      await handleVerificationUrl(initialUrl);
    };

    void prepare();
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleVerificationUrl(url);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [handleVerificationUrl, params.verificationUrl]);

  useEffect(() => {
    if (!session || status === 'verifying' || status === 'finishing') return;
    if (completedSessionAttemptRef.current === session.user.id) return;
    completedSessionAttemptRef.current = session.user.id;
    void finishPendingAction(session);
  }, [finishPendingAction, session, status]);

  const handleResend = async () => {
    const targetEmail = normalizeAccountEmail(email);
    if (!targetEmail || status === 'verifying' || status === 'finishing') return;

    setStatus('verifying');
    setMessage('Sending another confirmation email...');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: targetEmail,
      options: {
        emailRedirectTo: SIGNUP_VERIFICATION_REDIRECT_URL,
      },
    });

    if (error) {
      setStatus('error');
      setMessage(error.message);
      return;
    }

    setStatus('waiting');
    setMessage('A new confirmation email was sent. Check your inbox and spam folder.');
  };

  const openSignIn = async () => {
    if (session) {
      await supabase.auth.signOut({ scope: 'local' }).catch(error => {
        console.warn('[VerifyEmail] Could not clear the local session:', error);
      });
    }
    router.replace({
      pathname: '/onboarding',
      params: {
        mode: 'signIn',
        ...(email ? { email } : {}),
      },
    });
  };

  const startOver = async () => {
    await clearPendingOnboardingIntent();
    if (session) {
      await supabase.auth.signOut({ scope: 'local' }).catch(error => {
        console.warn('[VerifyEmail] Could not clear the local session:', error);
      });
    }
    router.replace('/onboarding');
  };

  const busy = status === 'verifying' || status === 'finishing';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: theme.colors.accentSoft },
          ]}
          accessibilityElementsHidden
        >
          <IconSymbol
            ios_icon_name="envelope.badge.shield.half.filled"
            android_material_icon_name="mark-email-unread"
            size={38}
            color={theme.colors.accent}
          />
        </View>

        <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.textPrimary }]}>
          Verify Your Email
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {email ? `We sent a confirmation link to ${email}.` : 'Check your email for a confirmation link.'}
        </Text>

        <View
          accessibilityLiveRegion={status === 'error' ? 'assertive' : 'polite'}
          style={[
            styles.statusBox,
            {
              borderColor: status === 'error'
                ? theme.status.error.border
                : theme.colors.borderSubtle,
              backgroundColor: status === 'error'
                ? theme.status.error.surface
                : theme.colors.surface,
            },
          ]}
        >
          {busy ? <ActivityIndicator color={theme.colors.accent} /> : null}
          <Text selectable style={[
            styles.statusText,
            {
              color: status === 'error'
                ? theme.status.error.foreground
                : theme.colors.textPrimary,
            },
          ]}>
            {message}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy || !email}
            onPress={handleResend}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.button.primarySurface },
              (pressed || busy || !email) && styles.dimmed,
            ]}
          >
            <Text style={[
              styles.primaryButtonText,
              { color: theme.button.primaryForeground },
            ]}>Resend Verification Email</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={openSignIn}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                backgroundColor: theme.button.secondarySurface,
                borderColor: theme.button.secondaryBorder,
              },
              (pressed || busy) && styles.dimmed,
            ]}
          >
            <Text style={[
              styles.secondaryButtonText,
              { color: theme.button.secondaryForeground },
            ]}>
              Sign In to Continue
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={startOver}
            style={styles.linkButton}
          >
            <Text style={[styles.linkText, { color: theme.colors.accent }]}>
              Use a Different Email
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  iconContainer: {
    width: 76,
    height: 76,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  title: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 9,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    opacity: 0.72,
  },
  statusBox: {
    width: '100%',
    marginTop: 24,
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    gap: 10,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    marginTop: 20,
    gap: 10,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  linkButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  dimmed: {
    opacity: 0.58,
  },
});
