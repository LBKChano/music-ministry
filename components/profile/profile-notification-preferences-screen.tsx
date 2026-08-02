import React, { useEffect, useRef, useState } from 'react';
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
  usePreventRemove,
} from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { ProfileFocusedHeader } from '@/components/profile/profile-focused-header';
import { ProfileStatus } from '@/components/profile/profile-primitives';
import { useChurch } from '@/hooks/useChurch';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useNotifications } from '@/contexts/NotificationContext';
import { NOTIFICATION_PREFERENCE_OPTIONS } from '@/lib/notifications/preferences';
import { getNotificationPermissionSummary } from '@/lib/profile/overview';
import { colors } from '@/styles/commonStyles';

type StatusTone = 'success' | 'error' | 'info';

export function ProfileNotificationPreferencesScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { currentChurch, currentMember, sessionStatus, user } = useChurch();
  const {
    canRequestPermission,
    hasPermission,
    isWeb,
    loading: permissionLoading,
    openNotificationSettings,
    permissionDenied,
    requestPermission,
  } = useNotifications();
  const accountId = user?.id ?? null;
  const churchId = currentChurch?.id ?? null;
  const memberId = currentMember?.id ?? null;
  const identityKey = accountId && churchId && memberId
    ? `${accountId}:${churchId}:${memberId}`
    : null;
  const {
    failedChange,
    hasSnapshot,
    isLoading,
    isRefetching,
    isSaving,
    loadError,
    pendingCategory,
    preferences,
    retry,
    retryFailedChange,
    saveError,
    setPreference,
  } = useNotificationPreferences({
    accountId,
    active: isFocused,
    churchId,
    memberId,
  });
  const permissionSummary = getNotificationPermissionSummary({
    hasPermission,
    permissionDenied,
    canRequestPermission,
    loading: permissionLoading,
    isWeb,
  });
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<StatusTone>('info');
  const previousIdentityRef = useRef(identityKey);
  const activeIdentityRef = useRef(identityKey);
  activeIdentityRef.current = identityKey;

  useEffect(() => {
    const previousIdentity = previousIdentityRef.current;
    if (previousIdentity !== identityKey) {
      previousIdentityRef.current = identityKey;
      setStatus(null);
      if (previousIdentity && identityKey) {
        Alert.alert(
          'Church Changed',
          'Notification delivery now shows the selected church membership.',
        );
      }
    }
  }, [identityKey]);

  usePreventRemove(isSaving, () => {
    Alert.alert(
      'Change in Progress',
      'Wait for the notification setting to finish saving before leaving.',
    );
  });

  const handleDevicePermission = async () => {
    if (permissionSummary.action === 'unavailable') return;

    try {
      if (permissionSummary.action === 'settings') {
        await openNotificationSettings();
        return;
      }

      const granted = await requestPermission();
      setStatus(
        granted
          ? 'Notifications are enabled on this device.'
          : 'Notification permission was not enabled.',
      );
      setStatusTone(granted ? 'success' : 'info');
    } catch (error) {
      console.warn('[NotificationPreferences] device permission failed', error);
      setStatus('Device notification settings could not be opened.');
      setStatusTone('error');
    }
  };

  const handlePreferenceChange = async (
    category: (typeof NOTIFICATION_PREFERENCE_OPTIONS)[number]['key'],
    enabled: boolean,
  ) => {
    if (!identityKey) return;

    const saveIdentity = identityKey;
    setStatus(null);
    const saved = await setPreference(category, enabled);
    if (activeIdentityRef.current !== saveIdentity) return;

    setStatus(
      saved
        ? 'Notification delivery updated.'
        : 'Notification delivery was restored because the change could not be saved.',
    );
    setStatusTone(saved ? 'success' : 'error');
  };

  const handleRetryChange = async () => {
    setStatus(null);
    const saved = await retryFailedChange();
    setStatus(
      saved
        ? 'Notification delivery updated.'
        : 'The change still could not be saved. Your previous setting remains active.',
    );
    setStatusTone(saved ? 'success' : 'error');
  };

  if (!user || !currentChurch || !currentMember) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <Stack.Screen options={{ headerShown: false }} />
        {sessionStatus === 'ready' ? (
          <>
            <IconSymbol
              ios_icon_name="bell.slash.fill"
              android_material_icon_name="notifications-off"
              size={40}
              color={colors.primary}
            />
            <Text accessibilityRole="header" style={styles.stateTitle}>
              Notification settings unavailable
            </Text>
            <Text style={styles.stateCopy}>
              Return to Profile and select a church membership.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.stateButton}
            >
              <Text style={styles.stateButtonText}>Back to Profile</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.stateCopy}>Loading notification settings...</Text>
          </>
        )}
      </SafeAreaView>
    );
  }

  const visibleStatus = saveError ?? status;
  const visibleTone: StatusTone = saveError ? 'error' : statusTone;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ProfileFocusedHeader
        disabled={isSaving}
        onBack={() => router.back()}
        subtitle={currentChurch.name}
        title="Notifications"
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 104 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
      >
        <ProfileStatus message={visibleStatus} tone={visibleTone} />

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            This Device
          </Text>
          <View style={styles.permissionRow}>
            <View style={styles.iconFrame}>
              <IconSymbol
                ios_icon_name={hasPermission ? 'bell.badge.fill' : 'bell.slash.fill'}
                android_material_icon_name={hasPermission ? 'notifications-active' : 'notifications-off'}
                size={23}
                color={colors.primary}
              />
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{permissionSummary.value}</Text>
              <Text style={styles.rowDescription}>
                {permissionSummary.description}
              </Text>
            </View>
            {permissionLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : permissionSummary.action !== 'unavailable' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  permissionSummary.action === 'request'
                    ? 'Enable notifications on this device'
                    : 'Open device notification settings'
                }
                onPress={() => {
                  void handleDevicePermission();
                }}
                style={({ pressed }) => [
                  styles.deviceButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.deviceButtonText}>
                  {permissionSummary.action === 'request' ? 'Enable' : 'Settings'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Delivery for This Church
          </Text>
          <Text style={styles.sectionDescription}>
            Choose which push alerts you receive from {currentChurch.name}.
          </Text>

          {isLoading && !hasSnapshot ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Loading delivery settings...</Text>
            </View>
          ) : loadError && !hasSnapshot ? (
            <View style={styles.errorState}>
              <Text accessibilityRole="alert" style={styles.errorText}>
                Delivery settings could not be loaded.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void retry();
                }}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.preferenceList}>
              {NOTIFICATION_PREFERENCE_OPTIONS.map(option => (
                <View key={option.key} style={styles.preferenceRow}>
                  <View style={styles.iconFrame}>
                    <IconSymbol
                      ios_icon_name={option.iosIcon}
                      android_material_icon_name={option.androidIcon}
                      size={22}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{option.title}</Text>
                    <Text style={styles.rowDescription}>
                      {option.description}
                    </Text>
                    {failedChange?.category === option.key ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          void handleRetryChange();
                        }}
                        style={styles.inlineRetry}
                      >
                        <Text style={styles.inlineRetryText}>Retry change</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {isSaving && pendingCategory === option.key ? (
                    <ActivityIndicator
                      accessibilityLabel="Saving notification preference"
                      size="small"
                      color={colors.primary}
                      style={styles.switchFrame}
                    />
                  ) : (
                    <Switch
                      accessibilityLabel={option.title}
                      accessibilityHint={`Controls ${option.title.toLowerCase()} push delivery for ${currentChurch.name}.`}
                      accessibilityState={{
                        checked: preferences[option.key],
                        disabled: isSaving,
                      }}
                      disabled={isSaving}
                      ios_backgroundColor="#A6ADB7"
                      onValueChange={nextValue => {
                        void handlePreferenceChange(option.key, nextValue);
                      }}
                      thumbColor="#FFFFFF"
                      trackColor={{ false: '#A6ADB7', true: colors.primary }}
                      value={preferences[option.key]}
                    />
                  )}
                </View>
              ))}
            </View>
          )}

          {isRefetching && hasSnapshot && !isSaving ? (
            <View style={styles.refreshingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.refreshingText}>Checking for updates...</Text>
            </View>
          ) : null}
        </View>
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
    gap: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    paddingHorizontal: 4,
  },
  sectionDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  permissionRow: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 76,
    padding: 14,
  },
  preferenceList: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  preferenceRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 78,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconFrame: {
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  rowDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  deviceButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 72,
    paddingHorizontal: 12,
  },
  deviceButtonText: {
    color: colors.headerText,
    fontSize: 14,
    fontWeight: '700',
  },
  switchFrame: {
    width: 51,
  },
  loadingState: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 72,
    padding: 16,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  errorState: {
    alignItems: 'center',
    backgroundColor: colors.errorBackground,
    borderColor: colors.errorBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    padding: 14,
  },
  errorText: {
    color: colors.error,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  retryButton: {
    borderColor: colors.error,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  retryButtonText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '700',
  },
  inlineRetry: {
    alignSelf: 'flex-start',
    minHeight: 32,
    justifyContent: 'center',
  },
  inlineRetryText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '700',
  },
  refreshingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 36,
  },
  refreshingText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.5,
  },
  stateScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 28,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateCopy: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  stateButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 44,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  stateButtonText: {
    color: colors.headerText,
    fontSize: 15,
    fontWeight: '700',
  },
});
