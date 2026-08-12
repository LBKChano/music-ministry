import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/contexts/AppThemeContext';

export function ScheduleTodayMarker({
  today,
}: {
  today: { weekday: string; day: string; month: string };
}) {
  const theme = useAppTheme();

  return (
    <View
      accessibilityLabel={`Today, ${today.weekday}, ${today.month} ${today.day}`}
      accessibilityRole="text"
      style={styles.wrapper}
    >
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Today</Text>
      <View
        style={[
          styles.dateTile,
          {
            backgroundColor: theme.colors.surfaceStrong,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <Text style={[styles.weekday, { color: theme.strongSurface.mutedForeground }]}>
          {today.weekday}
        </Text>
        <Text style={[styles.day, { color: theme.strongSurface.foreground }]}>
          {today.day}
        </Text>
        <Text style={[styles.month, { color: theme.strongSurface.mutedForeground }]}>
          {today.month}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 4,
    width: 62,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  dateTile: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 70,
    justifyContent: 'center',
    width: 58,
  },
  weekday: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  day: {
    fontSize: 23,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    lineHeight: 26,
  },
  month: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
