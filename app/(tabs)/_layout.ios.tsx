
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/styles/commonStyles';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';
import { useChurch } from '@/hooks/useChurch';

// Safety timeout: if loading takes longer than this, render tabs anyway
const LOADING_TIMEOUT_MS = 4000;

export default function TabLayout() {
  const { isAdmin, loading } = useChurch();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      console.warn('[TabLayout iOS] Loading timed out — rendering tabs anyway');
      setTimedOut(true);
    }, LOADING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  // Don't render the tab bar until admin status is resolved to prevent flicker,
  // but never block longer than LOADING_TIMEOUT_MS.
  if (loading && !timedOut) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Build tabs array based on admin status
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
