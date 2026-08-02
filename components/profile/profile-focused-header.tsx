import React, { type ReactNode } from 'react';
import { FocusedScreenHeader } from '@/components/navigation/focused-screen-header';

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
  return (
    <FocusedScreenHeader
      backAccessibilityLabel="Back to Profile"
      disabled={disabled}
      onBack={onBack}
      subtitle={subtitle}
      title={title}
      trailing={trailing}
    />
  );
}
