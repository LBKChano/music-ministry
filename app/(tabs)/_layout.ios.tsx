
import { Tabs } from 'expo-router';
import React from 'react';
import { colors } from '@/styles/commonStyles';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';
import { ChurchProvider } from '@/contexts/ChurchContext';

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

export default function TabLayout() {
  return (
    <ChurchProvider>
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
    </ChurchProvider>
  );
}
