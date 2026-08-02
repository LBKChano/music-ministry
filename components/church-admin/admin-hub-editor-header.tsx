import React from 'react';
import { FocusedScreenHeader } from '@/components/navigation/focused-screen-header';

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
  return (
    <FocusedScreenHeader
      backAccessibilityLabel="Back to Church Admin Hub"
      onBack={onBack}
      subtitle={summary}
      title={title}
      tone="surface"
      trailing={action}
    />
  );
}
