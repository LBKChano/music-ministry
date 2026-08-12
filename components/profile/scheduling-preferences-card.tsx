import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import type {
  ChurchMemberWithRoles,
  RecurringServiceWithRoles,
} from '@/contexts/ChurchContext';
import { useSchedulingPreferences } from '@/hooks/useSchedulingPreferences';
import {
  buildSchedulingPreferenceGroups,
  isSchedulingOptionAvailable,
  schedulingPreferenceKey,
} from '@/lib/scheduling/preferences';
import { colors } from '@/styles/commonStyles';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function formatWeeklyTime(time: string): string {
  const [hoursValue, minutesValue] = time.split(':');
  const hours = Number(hoursValue);
  const minutes = Number(minutesValue);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

interface SchedulingPreferencesCardProps {
  accountId: string;
  churchId: string;
  member: ChurchMemberWithRoles;
  recurringServices: RecurringServiceWithRoles[];
}

export function SchedulingPreferencesCard({
  accountId,
  churchId,
  member,
  recurringServices,
}: SchedulingPreferencesCardProps) {
  const {
    preferences,
    isLoading,
    isRefetching,
    loadError,
    saveError,
    pendingKeys,
    setAvailability,
    retry,
  } = useSchedulingPreferences({
    accountId,
    churchId,
    memberId: member.id,
  });
  const groups = useMemo(
    () => buildSchedulingPreferenceGroups(
      member.memberRoles,
      recurringServices
    ),
    [member.memberRoles, recurringServices]
  );
  const visiblePreferenceCount = groups.reduce(
    (count, group) => count + group.services.length,
    0
  );

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <IconSymbol
          ios_icon_name="slider.horizontal.3"
          android_material_icon_name="tune"
          size={24}
          color={colors.primary}
        />
        <Text style={[styles.title, { color: colors.text }]}>
          Scheduling Preferences
        </Text>
        {isRefetching && !isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : null}
      </View>

      <Text style={[styles.description, { color: colors.textSecondary }]}>
        Keep a switch on to be scheduled when needed. Turn it off to ask
        auto-assign to avoid that service and role when possible. Unavailable
        dates always remain a hard block.
      </Text>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : loadError ? (
        <View style={styles.messagePanel}>
          <Text style={[styles.errorText, { color: '#B42318' }]}>
            Scheduling preferences could not be loaded.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              void retry();
            }}
            style={[styles.retryButton, { borderColor: colors.primary }]}
          >
            <IconSymbol
              ios_icon_name="arrow.clockwise"
              android_material_icon_name="refresh"
              size={17}
              color={colors.primary}
            />
            <Text style={[styles.retryText, { color: colors.primary }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      ) : groups.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No roles are assigned to your profile yet.
        </Text>
      ) : visiblePreferenceCount === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Your assigned roles are not currently used by a weekly service.
        </Text>
      ) : (
        <View style={styles.groups}>
          {groups.map(group => (
            group.services.length > 0 ? (
              <View key={group.role.role_id} style={styles.group}>
                <Text style={[styles.roleName, { color: colors.text }]}>
                  {group.role.role_name}
                </Text>
                {group.services.map(service => {
                  const key = schedulingPreferenceKey(
                    service.id,
                    group.role.role_id
                  );
                  const isAvailable = isSchedulingOptionAvailable(
                    preferences,
                    service.id,
                    group.role.role_id
                  );
                  const isSaving = pendingKeys.has(key);

                  return (
                    <View
                      key={key}
                      style={[
                        styles.serviceRow,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.inputBackground,
                        },
                      ]}
                    >
                      <View style={styles.serviceText}>
                        <Text
                          style={[styles.serviceName, { color: colors.text }]}
                          numberOfLines={2}
                        >
                          {service.name}
                        </Text>
                        <Text
                          style={[
                            styles.serviceMeta,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {DAY_NAMES[service.day_of_week] ?? 'Weekly'}
                          {' at '}
                          {formatWeeklyTime(service.time)}
                        </Text>
                        <Text
                          style={[
                            styles.preferenceLabel,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {isAvailable
                            ? 'Schedule me here when needed'
                            : 'Prefer not to be scheduled'}
                        </Text>
                      </View>
                      {isSaving ? (
                        <View style={styles.switchFrame}>
                          <ActivityIndicator
                            size="small"
                            color={colors.primary}
                          />
                        </View>
                      ) : (
                        <Switch
                          accessibilityLabel={`Schedule me for ${group.role.role_name} at ${service.name}`}
                          accessibilityHint="On means you can be scheduled when needed. Off asks auto-assign to avoid this combination when possible."
                          value={isAvailable}
                          onValueChange={nextIsAvailable => {
                            void setAvailability(
                              service.id,
                              group.role.role_id,
                              nextIsAvailable
                            );
                          }}
                          trackColor={{
                            false: '#A6ADB7',
                            true: colors.primary,
                          }}
                          thumbColor="#FFFFFF"
                          ios_backgroundColor="#A6ADB7"
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            ) : null
          ))}
        </View>
      )}

      {saveError ? (
        <Text
          accessibilityRole="alert"
          style={[styles.errorText, styles.saveError, { color: '#B42318' }]}
        >
          Your last change was not saved and has been restored. Try again.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  loading: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groups: {
    gap: 18,
  },
  group: {
    gap: 8,
  },
  roleName: {
    fontSize: 16,
    fontWeight: '700',
  },
  serviceRow: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serviceText: {
    flex: 1,
    minWidth: 0,
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  serviceMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  preferenceLabel: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  switchFrame: {
    width: 52,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagePanel: {
    alignItems: 'flex-start',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
  },
  saveError: {
    marginTop: 12,
  },
  retryButton: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
