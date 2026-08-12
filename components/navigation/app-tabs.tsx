import React, { useEffect, useMemo } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import FloatingTabBar, { type TabBarItem } from '@/components/FloatingTabBar';
import { useChurchSession } from '@/hooks/useChurch';
import {
  shouldDisplayAdminTab,
  shouldLeaveChurchTab,
} from '@/lib/ui/package16';
import { useAppTheme } from '@/contexts/AppThemeContext';

const baseTabs: TabBarItem[] = [
  {
    name: '(home)',
    route: '/(tabs)/(home)',
    icon: 'calendar-today',
    iosIcon: 'calendar',
    label: 'Schedule',
  },
  {
    name: 'profile',
    route: '/(tabs)/profile',
    icon: 'person',
    iosIcon: 'person.fill',
    label: 'Profile',
  },
];

const adminTab: TabBarItem = {
  name: 'church',
  route: '/(tabs)/church',
  icon: 'home',
  iosIcon: 'building.2',
  label: 'Church',
};

export function AppTabs() {
  const theme = useAppTheme();
  const { isAdmin, sessionStatus } = useChurchSession();
  const pathname = usePathname();
  const router = useRouter();
  const showAdminTab = shouldDisplayAdminTab(sessionStatus, isAdmin);
  const tabs = useMemo(
    () => showAdminTab
      ? [baseTabs[0], adminTab, baseTabs[1]]
      : baseTabs,
    [showAdminTab],
  );

  useEffect(() => {
    if (shouldLeaveChurchTab({ pathname, sessionStatus, isAdmin })) {
      router.replace('/(tabs)/(home)');
    }
  }, [isAdmin, pathname, router, sessionStatus]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.navigationSelectedForeground,
        tabBarHideOnKeyboard: true,
      }}
      tabBar={() => <FloatingTabBar tabs={tabs} />}
    >
      <Tabs.Screen name="(home)" options={{ title: 'Schedule' }} />
      <Tabs.Screen
        name="church"
        options={{
          href: showAdminTab ? '/(tabs)/church' : null,
          title: 'Church',
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
