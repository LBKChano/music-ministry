import { Tabs } from 'expo-router';
import React from 'react';
import { colors } from '@/styles/commonStyles';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';

// NOTE: Do NOT call useChurch() here — it triggers a Supabase getSession() call
// that races with AuthContext on cold launch and can cause a crash before the
// navigator is mounted. Tab visibility based on admin status is handled inside
// each screen instead.
export default function TabLayout() {
  const tabs: TabBarItem[] = [
    {
      name: '(home)',
      route: '/(tabs)/(home)' as any,
      icon: 'calendar-today',
      label: 'Schedule',
    },
    {
      name: 'church',
      route: '/(tabs)/church' as any,
      icon: 'home',
      label: 'Church',
    },
    {
      name: 'profile',
      route: '/(tabs)/profile' as any,
      icon: 'person',
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
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Schedule',
        }}
      />
      <Tabs.Screen
        name="church"
        options={{
          title: 'Church',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}
