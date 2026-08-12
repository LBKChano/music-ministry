import React from 'react';
import { FocusedScreenHeader } from '@/components/navigation/focused-screen-header';
import { IconSymbol } from '@/components/IconSymbol';

function resolveAdminIcon(title: string): {
  ios: string;
  android: React.ComponentProps<typeof IconSymbol>['android_material_icon_name'];
} {
  const normalized = title.toLowerCase();
  if (normalized.includes('role')) return { ios: 'person.badge.shield.checkmark', android: 'badge' };
  if (normalized.includes('member')) return { ios: 'person.2.fill', android: 'group' };
  if (normalized.includes('weekly')) return { ios: 'calendar.badge.clock', android: 'event-repeat' };
  if (normalized.includes('song')) return { ios: 'music.note.list', android: 'queue-music' };
  if (normalized.includes('reminder')) return { ios: 'bell.badge.fill', android: 'notifications-active' };
  if (normalized.includes('assign')) return { ios: 'person.2.badge.gearshape', android: 'group-add' };
  if (normalized.includes('service')) return { ios: 'calendar.badge.plus', android: 'event' };
  if (normalized.includes('rule')) return { ios: 'slider.horizontal.3', android: 'tune' };
  return { ios: 'building.2.fill', android: 'business' };
}

export function AdminHubEditorHeader({
  title,
  summary,
  onBack,
  action,
}: {
  title: string;
  summary: string;
  onBack: () => void;
  action?: React.ReactNode;
}) {
  const icon = resolveAdminIcon(title);
  return (
    <FocusedScreenHeader
      backAccessibilityLabel="Back to Church Admin Hub"
      onBack={onBack}
      subtitle={summary}
      title={title}
      tone="surface"
      trailing={action}
      iosIcon={icon.ios}
      androidIcon={icon.android}
    />
  );
}
