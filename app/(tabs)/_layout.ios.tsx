
import { Tabs } from 'expo-router';
import React from 'react';
import { colors } from '@/styles/commonStyles';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';
import { useChurch } from '@/hooks/useChurch';

export default function TabLayout() {
  const { isAdmin } = useChurch();

  // Build tabs array based on admin status.
  // No redirect logic here — navigation is owned exclusively by _layout.tsx.
  const tabs: TabBarItem[] = [
    {
      name: '(home)',
      route: '/(tabs)/(home)' as any,
      icon: 'calendar-today',
      label: 'Schedule',
    },
    ...(isAdmin ? [{
      name: 'church',
      route: '/(tabs)/church' as any,
      icon: 'home',
      label: 'Church',
    }] : []),
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
          href: isAdmin ? undefined : null,
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
