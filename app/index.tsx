import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { session, initialized } = useAuth();

  // Wait for auth to initialize before redirecting
  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (session) {
    console.log('[Index] session found — redirecting to tabs');
    return <Redirect href="/(tabs)" />;
  }

  console.log('[Index] no session — redirecting to onboarding');
  return <Redirect href="/onboarding" />;
}
