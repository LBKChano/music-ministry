import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/styles/commonStyles';

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
  if (loading) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.loading}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Checking affected records...</Text>
      </View>
    );
  }

  if (!impact) {
    return (
      <Text style={styles.unavailable}>
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
    return <Text style={styles.unavailable}>No related schedule records were found.</Text>;
  }

  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      <Text style={styles.title}>This also affects:</Text>
      {affected.map(item => (
        <Text key={item.label} style={styles.item}>
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
    color: colors.textSecondary,
    fontSize: 13,
  },
  unavailable: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: 8,
  },
  container: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  title: {
    color: '#9A3412',
    fontSize: 14,
    fontWeight: '800',
  },
  item: {
    color: '#7C2D12',
    fontSize: 13,
    lineHeight: 18,
  },
});
