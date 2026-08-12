import React from 'react';
import { TabHeaderMetaText } from '@/components/navigation/responsive-tab-header';
import { formatScheduleTodayText } from '@/lib/schedules/schedule-range';

export function ScheduleTodayMarker({
  today,
}: {
  today: { weekday: string; day: string; month: string };
}) {
  const text = formatScheduleTodayText(today);

  return (
    <TabHeaderMetaText
      accessibilityLabel={`Today, ${today.weekday}, ${today.month} ${today.day}`}
    >
      {text}
    </TabHeaderMetaText>
  );
}
