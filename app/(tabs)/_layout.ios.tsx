
import React, { useEffect, useState } from 'react';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useChurch } from '@/hooks/useChurch';

export default function TabLayout() {
  const { currentMember, loading } = useChurch();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    console.log('Current member admin status (iOS):', currentMember?.is_admin);
    setIsAdmin(currentMember?.is_admin || false);
  }, [currentMember]);

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(home)">
        <Label>Schedule</Label>
        <Icon sf={{ default: 'calendar', selected: 'calendar.badge.checkmark' }} drawable="calendar-today" />
      </NativeTabs.Trigger>
      {isAdmin && (
        <NativeTabs.Trigger name="church">
          <Label>Church</Label>
          <Icon sf={{ default: 'house', selected: 'house.fill' }} drawable="home" />
        </NativeTabs.Trigger>
      )}
      <NativeTabs.Trigger name="profile">
        <Label>Profile</Label>
        <Icon sf={{ default: 'person', selected: 'person.fill' }} drawable="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
