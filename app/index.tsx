import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { session, initialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;
    if (session) {
      console.log('[Index] session found — navigating to tabs');
      router.replace('/(tabs)');
    } else {
      console.log('[Index] no session — navigating to onboarding');
      router.replace('/onboarding');
    }
  }, [initialized, session]);

  // Always show loading spinner — navigation happens in useEffect
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator size="large" color="#ffffff" />
    </View>
  );
}
