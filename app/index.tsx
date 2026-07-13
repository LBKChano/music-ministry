import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useRef } from 'react';
import { isPasswordRecoveryUrl } from '@/utils/passwordResetLinks';

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
  const { session, initialized } = useAuth();
  const router = useRouter();
  const checkedInitialUrlRef = useRef(false);

  useEffect(() => {
    if (!initialized) return;

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
      }

      if (session) {
        console.log('[Index] session found — navigating to /(tabs)');
        router.replace('/(tabs)');
      } else {
        console.log('[Index] no session — navigating to /onboarding');
        router.replace('/onboarding');
      }
    };

    routeAfterInitialUrlCheck().catch((err) => {
      console.error('[Index] route check failed:', err);
      router.replace(session ? '/(tabs)' : '/onboarding');
    });
  }, [initialized, session, router]);

  // Show a loading indicator while auth initializes.
  // The splash screen is still visible on top of this (controlled by AuthContext).
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a2332' }}>
      <ActivityIndicator size="large" color="#ffffff" />
    </View>
  );
}
