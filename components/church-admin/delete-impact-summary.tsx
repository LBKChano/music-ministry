import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAppTheme } from '@/contexts/AppThemeContext';

const impactLabels: Record<string, string> = {
  assignments: 'scheduled assignments',
  fill_in_requests: 'fill-in requests',
  member_roles: 'member role links',
  scheduling_preferences: 'scheduling preferences',
  unavailable_dates: 'unavailable dates',
  weekly_services: 'weekly-service role links',
};

export function DeleteImpactSummary({
  impact,
  loading,
}: {
  impact: Record<string, unknown> | null;
  loading: boolean;
}) {
  const theme = useAppTheme();
  if (loading) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.loading}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Checking affected records...</Text>
      </View>
    );
  }

  if (!impact) {
    return (
      <Text style={[styles.unavailable, { color: theme.colors.textSecondary }]}>
        Impact details are temporarily unavailable. Nothing is deleted until you confirm.
      </Text>
    );
  }

  const affected = Object.entries(impact)
    .filter(([key, value]) => impactLabels[key] && typeof value === 'number' && value > 0)
    .map(([key, value]) => ({
      label: impactLabels[key],
      count: value as number,
    }));

  if (affected.length === 0) {
    return <Text style={[styles.unavailable, { color: theme.colors.textSecondary }]}>No related schedule records were found.</Text>;
  }

  return (
    <View accessibilityLiveRegion="polite" style={[
      styles.container,
      {
        backgroundColor: theme.status.warning.surface,
        borderColor: theme.status.warning.border,
      },
    ]}>
      <Text style={[styles.title, { color: theme.status.warning.foreground }]}>This also affects:</Text>
      {affected.map(item => (
        <Text key={item.label} style={[styles.item, { color: theme.status.warning.foreground }]}>
          {item.count} {item.label}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  unavailable: {
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: 8,
  },
  container: {
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  item: {
    fontSize: 13,
    lineHeight: 18,
  },
});
