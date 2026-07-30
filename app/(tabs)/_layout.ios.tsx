
import { Tabs } from 'expo-router';
import React from 'react';
import { colors } from '@/styles/commonStyles';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';
import { useChurchSession } from '@/hooks/useChurch';

const baseTabs: TabBarItem[] = [
  { name: '(home)', route: '/(tabs)/(home)' as any, icon: 'calendar-today', iosIcon: 'calendar', label: 'Schedule' },
  { name: 'profile', route: '/(tabs)/profile' as any, icon: 'person', iosIcon: 'person.fill', label: 'Profile' },
];

const adminTab: TabBarItem = { name: 'church', route: '/(tabs)/church' as any, icon: 'home', iosIcon: 'building.2', label: 'Church' };

export default function TabLayout() {
  const { isAdmin, sessionStatus } = useChurchSession();
  const showAdminTab = sessionStatus === 'ready' && isAdmin;

  console.log('[TabLayout] admin access:', { isAdmin, sessionStatus });

  const tabs = showAdminTab
    ? [baseTabs[0], adminTab, baseTabs[1]]
    : baseTabs;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
      }}
      tabBar={() => <FloatingTabBar tabs={tabs} />}
    >
      <Tabs.Screen name="(home)" options={{ title: 'Schedule' }} />
      {showAdminTab && <Tabs.Screen name="church" options={{ title: 'Church' }} />}
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
