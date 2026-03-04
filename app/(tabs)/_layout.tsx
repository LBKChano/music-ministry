
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import FloatingTabBar from '@/components/FloatingTabBar';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
      }}
      tabBar={(props) => <FloatingTabBar {...props} tabs={[
        {
          name: '(home)/index',
          title: 'Schedule',
          icon: (color: string) => (
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today"
              size={24}
              color={color}
            />
          ),
        },
        {
          name: 'church',
          title: 'Church',
          icon: (color: string) => (
            <IconSymbol
              ios_icon_name="building.2"
              android_material_icon_name="home"
              size={24}
              color={color}
            />
          ),
        },
        {
          name: 'profile',
          title: 'Profile',
          icon: (color: string) => (
            <IconSymbol
              ios_icon_name="person.circle"
              android_material_icon_name="account-circle"
              size={24}
              color={color}
            />
          ),
        },
      ]} />}
    >
      <Tabs.Screen
        name="(home)/index"
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
