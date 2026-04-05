
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';
import { useChurch } from '@/hooks/useChurch';

export default function TabLayout() {
  const { currentMember, loading } = useChurch();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    console.log('Current member admin status:', currentMember?.is_admin);
    setIsAdmin(currentMember?.is_admin || false);
  }, [currentMember]);

  // Don't render the tab bar until admin status is resolved to prevent flicker
  if (loading) {
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
      tabBar={(props) => <FloatingTabBar tabs={tabs} />}
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
