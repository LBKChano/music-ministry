import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChurchSwitcher } from '@/components/profile/ChurchSwitcher';
import { ProfileFocusedHeader } from '@/components/profile/profile-focused-header';
import { useChurch } from '@/hooks/useChurch';
import { useAppTheme } from '@/contexts/AppThemeContext';

export function ProfileChurchesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentChurch } = useChurch();
  const theme = useAppTheme();

  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.canvas }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ProfileFocusedHeader
        onBack={() => router.back()}
        subtitle={currentChurch?.name ?? 'Choose a church'}
        title="Churches"
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 32 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
      >
        <ChurchSwitcher />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    maxWidth: 720,
    paddingHorizontal: 16,
    paddingTop: 16,
    width: '100%',
  },
});
