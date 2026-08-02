import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  useIsFocused,
  useNavigation,
  usePreventRemove,
} from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { ProfileFocusedHeader } from '@/components/profile/profile-focused-header';
import { ProfileStatus } from '@/components/profile/profile-primitives';
import { useChurch } from '@/hooks/useChurch';
import { useSchedulingPreferences } from '@/hooks/useSchedulingPreferences';
import {
  buildSchedulingPreferenceGroups,
  findSchedulingPreferenceOption,
  formatSchedulingPreferenceTime,
  hasSchedulingPreference,
  SCHEDULING_WEEKDAY_NAMES,
  schedulingPreferenceKey,
} from '@/lib/scheduling/preferences';
import { colors } from '@/styles/commonStyles';

type StatusTone = 'success' | 'error' | 'info';

export function ProfileSchedulingPreferencesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const {
    currentChurch,
    currentMember,
    recurringServices,
    sessionStatus,
    user,
  } = useChurch();
  const accountId = user?.id ?? null;
  const churchId = currentChurch?.id ?? null;
  const memberId = currentMember?.id ?? null;
  const identityKey = accountId && churchId && memberId
    ? `${accountId}:${churchId}:${memberId}`
    : null;
  const {
    failedPreference,
    hasSnapshot,
    isLoading,
    isRefetching,
    loadError,
    pendingKeys,
    preferences,
    retry,
    retryFailedPreference,
    saveError,
    setPreference,
  } = useSchedulingPreferences({
    accountId,
    active: isFocused,
    churchId,
    memberId,
  });
  const groups = useMemo(
    () => buildSchedulingPreferenceGroups(
      currentMember?.memberRoles ?? [],
      recurringServices
    ),
    [currentMember?.memberRoles, recurringServices]
  );
  const visibleGroups = useMemo(
    () => groups.filter(group => group.services.length > 0),
    [groups]
  );
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<StatusTone>('info');
  const activeIdentityRef = useRef(identityKey);
  const previousIdentityRef = useRef(identityKey);
  activeIdentityRef.current = identityKey;

  useEffect(() => {
    const previousIdentity = previousIdentityRef.current;
    if (previousIdentity !== identityKey) {
      previousIdentityRef.current = identityKey;
      setStatus(null);
      if (previousIdentity && identityKey) {
        Alert.alert(
          'Church Changed',
          'Scheduling preferences now show the selected church membership.',
        );
      }
    }
  }, [identityKey]);

  usePreventRemove(pendingKeys.size > 0, () => {
    Alert.alert(
      'Change in Progress',
      'Wait for your scheduling preference to finish saving before leaving.',
    );
  });

  const handlePreferenceChange = async (
    recurringServiceId: string,
    roleId: string,
    shouldAvoid: boolean,
  ) => {
    if (!identityKey) return;

    const saveIdentity = identityKey;
    const option = findSchedulingPreferenceOption(
      groups,
      recurringServiceId,
      roleId
    );
    setStatus(
      `Saving ${option?.service.name ?? 'weekly service'} preference...`
    );
    setStatusTone('info');

    const saved = await setPreference(
      recurringServiceId,
      roleId,
      shouldAvoid
    );
    if (activeIdentityRef.current !== saveIdentity) return;

    if (saved) {
      setStatus(
        shouldAvoid
          ? `Preference saved for ${option?.service.name ?? 'weekly service'}.`
          : `Preference removed for ${option?.service.name ?? 'weekly service'}.`
      );
      setStatusTone('success');
    } else {
      setStatus(null);
    }
  };

  const handleRetrySave = async () => {
    if (!identityKey || !failedPreference) return;

    const saveIdentity = identityKey;
    const option = findSchedulingPreferenceOption(
      groups,
      failedPreference.recurring_service_id,
      failedPreference.role_id
    );
    setStatus(
      `Retrying ${option?.service.name ?? 'weekly service'} preference...`
    );
    setStatusTone('info');

    const saved = await retryFailedPreference();
    if (activeIdentityRef.current !== saveIdentity) return;

    if (saved) {
      setStatus(
        `Preference saved for ${option?.service.name ?? 'weekly service'}.`
      );
      setStatusTone('success');
    } else {
      setStatus(null);
    }
  };

  if (!user || !currentChurch || !currentMember) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <Stack.Screen options={{ headerShown: false }} />
        {sessionStatus === 'ready' ? (
          <>
            <IconSymbol
              ios_icon_name="slider.horizontal.3"
              android_material_icon_name="tune"
              size={42}
              color={colors.primary}
            />
            <Text accessibilityRole="header" style={styles.stateTitle}>
              Preferences unavailable
            </Text>
            <Text style={styles.stateCopy}>
              Return to Profile and select a church membership.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Back to Profile</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.stateCopy}>Loading preferences...</Text>
          </>
        )}
      </SafeAreaView>
    );
  }

  const loadFailed = Boolean(loadError && !hasSnapshot);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ProfileFocusedHeader
        disabled={pendingKeys.size > 0}
        onBack={() => router.back()}
        subtitle={currentChurch.name}
        title="Scheduling Preferences"
        trailing={isRefetching && !isLoading ? (
            <ActivityIndicator size="small" color={colors.headerText} />
          ) : null}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 20) + 28 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
      >
        {isLoading && !hasSnapshot ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.stateCopy}>Loading scheduling preferences...</Text>
          </View>
        ) : loadFailed ? (
          <View style={styles.loadingPanel}>
            <IconSymbol
              ios_icon_name="exclamationmark.circle.fill"
              android_material_icon_name="error"
              size={36}
              color={colors.error}
            />
            <Text accessibilityRole="alert" style={styles.stateTitle}>
              Preferences could not be loaded
            </Text>
            <Text style={styles.stateCopy}>
              Check your connection and try again.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void retry();
              }}
              style={styles.primaryButton}
            >
              <IconSymbol
                ios_icon_name="arrow.clockwise"
                android_material_icon_name="refresh"
                size={18}
                color={colors.headerText}
              />
              <Text style={styles.primaryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {loadError ? (
              <ProfileStatus
                message="The latest refresh failed. Your last loaded preferences are still shown."
                tone="error"
              />
            ) : null}
            <ProfileStatus message={status} tone={statusTone} />

            <View style={styles.explainer}>
              <View style={styles.explainerIcon}>
                <IconSymbol
                  ios_icon_name="slider.horizontal.3"
                  android_material_icon_name="tune"
                  size={24}
                  color={colors.primary}
                />
              </View>
              <View style={styles.explainerCopy}>
                <Text style={styles.explainerTitle}>
                  Preferences, not hard blocks
                </Text>
                <Text style={styles.explainerText}>
                  Auto-assign avoids these combinations when another eligible
                  member is available. Unavailable dates always remain blocked.
                </Text>
              </View>
            </View>

            {saveError && failedPreference ? (
              <View
                accessibilityRole="alert"
                style={styles.saveErrorPanel}
              >
                <View style={styles.saveErrorCopy}>
                  <Text style={styles.saveErrorTitle}>
                    Last change was not saved
                  </Text>
                  <Text selectable style={styles.saveErrorText}>
                    The previous setting was restored. You can retry this
                    change without leaving the editor.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint="Retries the last scheduling preference change."
                  onPress={() => {
                    void handleRetrySave();
                  }}
                  style={styles.retrySaveButton}
                >
                  <IconSymbol
                    ios_icon_name="arrow.clockwise"
                    android_material_icon_name="refresh"
                    size={17}
                    color={colors.error}
                  />
                  <Text style={styles.retrySaveText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}

            {currentMember.memberRoles.length === 0 ? (
              <View style={styles.emptyPanel}>
                <IconSymbol
                  ios_icon_name="person.crop.circle.badge.questionmark"
                  android_material_icon_name="person-search"
                  size={34}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyTitle}>No roles assigned</Text>
                <Text style={styles.emptyText}>
                  An admin must assign a ministry role before weekly-service
                  preferences are available.
                </Text>
              </View>
            ) : visibleGroups.length === 0 ? (
              <View style={styles.emptyPanel}>
                <IconSymbol
                  ios_icon_name="calendar.badge.exclamationmark"
                  android_material_icon_name="event-busy"
                  size={34}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyTitle}>No matching weekly services</Text>
                <Text style={styles.emptyText}>
                  Your assigned roles are not currently used by a weekly
                  service.
                </Text>
              </View>
            ) : (
              <View style={styles.groups}>
                {visibleGroups.map(group => (
                  <View key={group.role.role_id} style={styles.group}>
                    <View style={styles.groupHeader}>
                      <Text accessibilityRole="header" style={styles.roleName}>
                        {group.role.role_name}
                      </Text>
                      <Text style={styles.roleMeta}>
                        {group.services.length} weekly service
                        {group.services.length === 1 ? '' : 's'}
                      </Text>
                    </View>

                    <View style={styles.serviceList}>
                      {group.services.map(service => {
                        const key = schedulingPreferenceKey(
                          service.id,
                          group.role.role_id
                        );
                        const enabled = hasSchedulingPreference(
                          preferences,
                          service.id,
                          group.role.role_id
                        );
                        const isSaving = pendingKeys.has(key);
                        const anotherPreferenceIsSaving = (
                          pendingKeys.size > 0 && !isSaving
                        );
                        const switchDisabled = (
                          isSaving || anotherPreferenceIsSaving
                        );

                        return (
                          <View
                            key={key}
                            style={styles.serviceRow}
                          >
                            <View style={styles.serviceCopy}>
                              <Text
                                maxFontSizeMultiplier={1.4}
                                numberOfLines={2}
                                style={styles.serviceName}
                              >
                                {service.name}
                              </Text>
                              <Text
                                maxFontSizeMultiplier={1.45}
                                style={styles.serviceMeta}
                              >
                                {SCHEDULING_WEEKDAY_NAMES[service.day_of_week]
                                  ?? 'Weekly'}
                                {' at '}
                                {formatSchedulingPreferenceTime(service.time)}
                              </Text>
                              <Text
                                maxFontSizeMultiplier={1.45}
                                style={[
                                  styles.preferenceState,
                                  enabled && styles.preferenceStateEnabled,
                                ]}
                              >
                                {enabled
                                  ? 'Prefer not to be scheduled'
                                  : 'No scheduling preference'}
                              </Text>
                            </View>
                            <View style={styles.switchFrame}>
                              {isSaving ? (
                                <ActivityIndicator
                                  accessibilityLabel={`Saving ${service.name} preference`}
                                  size="small"
                                  color={colors.primary}
                                />
                              ) : null}
                              <Switch
                                accessibilityLabel={`Prefer not to be scheduled for ${group.role.role_name} at ${service.name}`}
                                accessibilityHint="This is a preference, not a guaranteed block."
                                accessibilityState={{
                                  busy: isSaving,
                                  checked: enabled,
                                  disabled: switchDisabled,
                                }}
                                disabled={switchDisabled}
                                ios_backgroundColor="#A6ADB7"
                                onValueChange={nextValue => {
                                  void handlePreferenceChange(
                                    service.id,
                                    group.role.role_id,
                                    nextValue
                                  );
                                }}
                                thumbColor="#FFFFFF"
                                trackColor={{
                                  false: '#A6ADB7',
                                  true: colors.primary,
                                }}
                                value={enabled}
                              />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.headerBackground,
    flexDirection: 'row',
    minHeight: 76,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerButtonSpacer: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerCopy: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  headerTitle: {
    color: colors.headerText,
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
  },
  headerSubtitle: {
    color: '#DBEAFE',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 1,
    maxWidth: '100%',
    textAlign: 'center',
  },
  content: {
    alignSelf: 'center',
    gap: 14,
    maxWidth: 720,
    paddingHorizontal: 16,
    paddingTop: 16,
    width: '100%',
  },
  explainer: {
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 14,
  },
  explainerIcon: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  explainerCopy: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 10,
  },
  explainerTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  explainerText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  groups: {
    gap: 20,
  },
  group: {
    gap: 8,
  },
  groupHeader: {
    gap: 2,
    paddingHorizontal: 4,
  },
  roleName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  roleMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  serviceList: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  serviceRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 86,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  serviceCopy: {
    flex: 1,
    minWidth: 0,
  },
  serviceName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  serviceMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  preferenceState: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 3,
  },
  preferenceStateEnabled: {
    color: colors.primary,
  },
  switchFrame: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'flex-end',
    minWidth: 52,
  },
  saveErrorPanel: {
    alignItems: 'center',
    backgroundColor: colors.errorBackground,
    borderColor: colors.errorBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  saveErrorCopy: {
    flex: 1,
    minWidth: 0,
  },
  saveErrorTitle: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  saveErrorText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  retrySaveButton: {
    alignItems: 'center',
    borderColor: colors.errorBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  retrySaveText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '800',
  },
  loadingPanel: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    justifyContent: 'center',
    minHeight: 240,
    padding: 24,
  },
  emptyPanel: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    padding: 24,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  stateScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
  },
  stateCopy: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: colors.headerText,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.5,
  },
});
