
import { Tabs, Redirect } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { colors } from '@/styles/commonStyles';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';
import { useAuth } from '@/contexts/AuthContext';

export default function TabLayout() {
  const { session, initialized } = useAuth();

  if (!initialized) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }
  if (!session) return <Redirect href="/onboarding" />;

  const tabs: TabBarItem[] = [
    {
      name: '(home)',
      route: '/(tabs)/(home)' as any,
      icon: 'calendar-today',
      iosIcon: 'calendar',
      label: 'Schedule',
    },
    {
      name: 'church',
      route: '/(tabs)/church' as any,
      icon: 'home',
      iosIcon: 'building.2',
      label: 'Church',
    },
    {
      name: 'profile',
      route: '/(tabs)/profile' as any,
      icon: 'person',
      iosIcon: 'person.fill',
      label: 'Profile',
    },
  ];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
      }}
      tabBar={() => <FloatingTabBar tabs={tabs} />}
    >
      <Tabs.Screen name="(home)" options={{ title: 'Schedule' }} />
      <Tabs.Screen name="church" options={{ title: 'Church' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
