import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { initialized } = useAuth();

  // Navigation is handled centrally in app/_layout.tsx's RootLayoutNav.
  // This screen just shows a loading indicator while auth initializes.
  void initialized;
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator size="large" color="#ffffff" />
    </View>
  );
}
