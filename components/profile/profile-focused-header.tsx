import React, { type ReactNode } from 'react';
import { FocusedScreenHeader } from '@/components/navigation/focused-screen-header';
import { IconSymbol } from '@/components/IconSymbol';

const PROFILE_HEADER_ICONS: Record<string, {
  ios: string;
  android: React.ComponentProps<typeof IconSymbol>['android_material_icon_name'];
}> = {
  Account: { ios: 'person.crop.circle.badge.checkmark', android: 'manage-accounts' },
  'Change Password': { ios: 'key.fill', android: 'password' },
  'Church Profile': { ios: 'person.text.rectangle', android: 'badge' },
  Churches: { ios: 'building.2', android: 'business' },
  'Delete Account': { ios: 'trash.fill', android: 'delete' },
  'Notification Delivery': { ios: 'bell.badge.fill', android: 'notifications-active' },
  'Scheduling Preferences': { ios: 'slider.horizontal.3', android: 'tune' },
  'Unavailable Dates': { ios: 'calendar.badge.exclamationmark', android: 'event-busy' },
};

export function ProfileFocusedHeader({
  title,
  subtitle,
  disabled = false,
  onBack,
  trailing,
}: {
  title: string;
  subtitle?: string;
  disabled?: boolean;
  onBack: () => void;
  trailing?: ReactNode;
}) {
  const icon = PROFILE_HEADER_ICONS[title]
    ?? { ios: 'person.crop.circle', android: 'person' as const };
  return (
    <FocusedScreenHeader
      backAccessibilityLabel="Back to Profile"
      disabled={disabled}
      extendIntoTopSafeArea
      onBack={onBack}
      subtitle={subtitle}
      title={title}
      trailing={trailing}
      tone="surface"
      iosIcon={icon.ios}
      androidIcon={icon.android}
    />
  );
}
