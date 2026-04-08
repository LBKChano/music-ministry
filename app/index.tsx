import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

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

  useEffect(() => {
    if (!initialized) return;

    if (session) {
      console.log('[Index] session found — navigating to /(tabs)');
      router.replace('/(tabs)');
    } else {
      console.log('[Index] no session — navigating to /onboarding');
      router.replace('/onboarding');
    }
  }, [initialized, session, router]);

  // Show a loading indicator while auth initializes.
  // The splash screen is still visible on top of this (controlled by AuthContext).
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a2332' }}>
      <ActivityIndicator size="large" color="#ffffff" />
    </View>
  );
}
