
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useChurch } from '@/hooks/useChurch';
import { colors } from '@/styles/commonStyles';

export default function TabLayout() {
  const { currentMember, loading } = useChurch();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    console.log('Current member admin status (iOS):', currentMember?.is_admin);
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

  return (
    <NativeTabs
      tabBarActiveTintColor={colors.primary}
      tabBarInactiveTintColor={colors.textSecondary}
    >
      <NativeTabs.Trigger name="(home)">
        <Label>Schedule</Label>
        <Icon 
          sf={{ default: 'calendar', selected: 'calendar.badge.checkmark' }} 
          drawable="calendar-today"
        />
      </NativeTabs.Trigger>
      {isAdmin && (
        <NativeTabs.Trigger name="church">
          <Label>Church</Label>
          <Icon 
            sf={{ default: 'house', selected: 'house.fill' }} 
            drawable="home"
          />
        </NativeTabs.Trigger>
      )}
      <NativeTabs.Trigger name="profile">
        <Label>Profile</Label>
        <Icon 
          sf={{ default: 'person', selected: 'person.fill' }} 
          drawable="person"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
