import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuth } from '@/contexts/AuthContext';
import { useChurchSession } from '@/hooks/useChurch';
import { useEffect, useRef } from 'react';
import { isPasswordRecoveryUrl } from '@/utils/passwordResetLinks';
import { resolveStartupDestination } from '@/lib/church/startup-coordinator';
import { isSignupVerificationUrl } from '@/utils/signupVerificationLinks';
import { useAppTheme } from '@/contexts/AppThemeContext';

/**
 * Root index screen — the sole place that decides where to navigate.
 *
 * Rules:
 * - Wait for auth to initialize (splash is still visible during this time,
 *   controlled by AuthContext which calls SplashScreen.hideAsync).
 * - Once initialized: session → /(tabs), no session → /onboarding.
 * - Use router.replace so the index screen is removed from the history stack.
 */
export default function Index() {
  const theme = useAppTheme();
  const { session, initialized, initializationError } = useAuth();
  const { sessionStatus } = useChurchSession();
  const router = useRouter();
  const checkedInitialUrlRef = useRef(false);

  useEffect(() => {
    const destination = resolveStartupDestination({
      authInitialized: initialized,
      hasSession: Boolean(session),
      authError: initializationError,
      churchStatus: sessionStatus,
    });
    if (destination === 'wait') return;

    const routeAfterInitialUrlCheck = async () => {
      if (!checkedInitialUrlRef.current) {
        checkedInitialUrlRef.current = true;
        const initialUrl = await Linking.getInitialURL().catch((err) => {
          console.error('[Index] Error reading initial URL:', err);
          return null;
        });

        if (isPasswordRecoveryUrl(initialUrl)) {
          console.log('[Index] password recovery link found - navigating to reset password');
          router.replace({
            pathname: '/reset-password',
            params: { recoveryUrl: encodeURIComponent(initialUrl ?? '') },
          });
          return;
        }

        if (isSignupVerificationUrl(initialUrl)) {
          console.log('[Index] signup verification link found');
          router.replace({
            pathname: '/verify-email',
            params: { verificationUrl: encodeURIComponent(initialUrl ?? '') },
          });
          return;
        }
      }

      const route = destination === 'tabs'
        ? '/(tabs)/(home)'
        : destination === 'no-membership'
          ? '/no-membership'
          : '/onboarding';
      console.log('[Index] startup destination:', destination);
      router.replace(route);
    };

    routeAfterInitialUrlCheck().catch((err) => {
      console.error('[Index] route check failed:', err);
      router.replace(destination === 'tabs' ? '/(tabs)/(home)' : '/onboarding');
    });
  }, [
    initializationError,
    initialized,
    router,
    session,
    sessionStatus,
  ]);

  // Show a loading indicator while auth initializes.
  // The splash screen is still visible on top of this (controlled by AuthContext).
  return (
    <View style={{
      alignItems: 'center',
      backgroundColor: theme.colors.canvas,
      flex: 1,
      justifyContent: 'center',
    }}>
      <ActivityIndicator size="large" color={theme.colors.accent} />
    </View>
  );
}
