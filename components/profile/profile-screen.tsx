
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/styles/commonStyles";
import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import {
  ResponsiveTabHeader,
  TabHeaderIconSurface,
  TabHeaderMetaText,
  TabHeaderPill,
} from "@/components/navigation/responsive-tab-header";
import { Stack, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useChurch } from "@/hooks/useChurch";
import { usePerformanceBaselineScreen } from "@/hooks/usePerformanceBaselineScreen";
import { performanceBaselineEnabled } from "@/lib/performance/baseline";
import { useMemberAvailability } from "@/hooks/useMemberAvailability";
import { useSchedulingPreferences } from "@/hooks/useSchedulingPreferences";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { ChurchSwitcher } from "@/components/profile/ChurchSwitcher";
import { shouldShowInitialLoader } from "@/lib/query/refresh-coordinator";
import { HEADER_ACTION_LANE_WIDTHS } from "@/lib/ui/header-typography";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  ProfileDangerRow,
  ProfileOverviewList,
  ProfileRow,
  ProfileStatus,
  type ProfileOverviewSection,
} from "@/components/profile/profile-primitives";
import {
  createAvailabilitySummary,
} from "@/lib/profile/availability";
import {
  buildSchedulingPreferenceGroups,
  createSchedulingPreferenceSummary,
} from "@/lib/scheduling/preferences";
import {
  getMembershipAccessLabel,
  getNotificationPermissionSummary,
} from "@/lib/profile/overview";
import { createNotificationPreferenceSummary } from "@/lib/notifications/preferences";

export function ProfileScreen({
  implementation = 'default',
}: {
  implementation?: 'default' | 'ios';
}) {
  const {
    user,
    initializing,
    refreshing,
    refreshError,
    sessionStatus,
    sessionError,
    currentMember,
    currentChurch,
    recurringServices,
    isAdmin,
    refreshChurches,
    retryChurchSession,
  } = useChurch();
  const {
    hasPermission,
    permissionDenied,
    canRequestPermission,
    loading: notificationLoading,
    isWeb,
  } = useNotifications();
  const router = useRouter();
  const isFocused = useIsFocused();
  const currentMemberIdRef = useRef<string | null>(currentMember?.id ?? null);
  const availabilityQuery = useMemberAvailability({
    accountId: user?.id,
    churchId: currentChurch?.id,
    memberId: currentMember?.id,
  });
  const availabilitySummary = useMemo(
    () => createAvailabilitySummary(availabilityQuery.data ?? []),
    [availabilityQuery.data],
  );
  const availabilityLoadFailed = (
    availabilityQuery.isError
    && availabilityQuery.data === undefined
  );
  const schedulingPreferencesQuery = useSchedulingPreferences({
    accountId: user?.id,
    active: isFocused,
    churchId: currentChurch?.id,
    memberId: currentMember?.id,
  });
  const schedulingPreferenceGroups = useMemo(
    () => buildSchedulingPreferenceGroups(
      currentMember?.memberRoles ?? [],
      recurringServices
    ),
    [currentMember?.memberRoles, recurringServices]
  );
  const schedulingPreferenceSummary = useMemo(
    () => createSchedulingPreferenceSummary(
      schedulingPreferencesQuery.preferences,
      schedulingPreferenceGroups
    ),
    [schedulingPreferenceGroups, schedulingPreferencesQuery.preferences]
  );
  const schedulingPreferencesLoadFailed = (
    Boolean(schedulingPreferencesQuery.loadError)
    && !schedulingPreferencesQuery.hasSnapshot
  );
  const notificationPreferencesQuery = useNotificationPreferences({
    accountId: user?.id,
    active: isFocused,
    churchId: currentChurch?.id,
    memberId: currentMember?.id,
  });
  const notificationPreferencesLoadFailed = (
    Boolean(notificationPreferencesQuery.loadError)
    && !notificationPreferencesQuery.hasSnapshot
  );

  useEffect(() => {
    currentMemberIdRef.current = currentMember?.id ?? null;
  }, [currentMember?.id]);

  usePerformanceBaselineScreen(
    'Profile',
    !initializing &&
      !!user &&
      !!currentMember &&
      (!performanceBaselineEnabled || availabilityQuery.isFetched),
    {
      implementation,
      unavailableDates: availabilitySummary.count,
      hasChurch: !!currentChurch,
      isAdmin,
    }
  );

  const handleRefresh = async () => {
    const memberId = currentMember?.id;
    await refreshChurches(currentChurch?.id);
    if (!memberId || memberId !== currentMemberIdRef.current) return;

    try {
      await Promise.all([
        availabilityQuery.refetch(),
        schedulingPreferencesQuery.retry(),
        notificationPreferencesQuery.retry(),
      ]);
    } catch (refreshDatesError) {
      console.warn('[ProfileScreen] Could not refresh scheduling data:', refreshDatesError);
    }
  };

  if (user && sessionStatus === 'no-membership') {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <Stack.Screen options={{ headerShown: false }} />
        <IconSymbol
          ios_icon_name="building.2.crop.circle"
          android_material_icon_name="domain-disabled"
          size={44}
          color={colors.primary}
        />
        <Text accessibilityRole="header" style={styles.stateTitle}>
          No church connected
        </Text>
        <Text style={styles.stateMessage}>
          Join or create a church before opening your church profile.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityHint="Opens account recovery options for joining or creating a church."
          style={styles.stateButton}
          onPress={() => router.replace('/no-membership')}
        >
          <Text style={styles.stateButtonText}>Continue</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (user && sessionStatus === 'error' && !currentMember) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <Stack.Screen options={{ headerShown: false }} />
        <IconSymbol
          ios_icon_name="exclamationmark.circle.fill"
          android_material_icon_name="error"
          size={44}
          color={colors.error}
        />
        <Text accessibilityRole="header" style={styles.stateTitle}>
          Profile unavailable
        </Text>
        <Text accessibilityRole="alert" style={styles.stateMessage}>
          {sessionError || 'Your church profile could not be loaded.'}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityHint="Retries loading your church profile."
          style={styles.stateButton}
          onPress={() => {
            void retryChurchSession();
          }}
        >
          <Text style={styles.stateButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (
    !user
    || shouldShowInitialLoader(
      initializing,
      Boolean(currentChurch && currentMember),
    )
  ) {
    console.log(`[ProfileScreen.${implementation}] Showing initial loading state`);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, fontSize: 16, color: colors.textSecondary }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  const displayName = currentMember?.name || user?.email?.split('@')[0] || 'User';
  const displayEmail = currentMember?.email || user?.email || '';
  const userRole = getMembershipAccessLabel({
    isOwner: currentChurch?.admin_id === user.id,
    isAdmin,
  });
  const profileSubtitle = userRole;
  const roleNames = currentMember?.memberRoles
    ?.map(role => role.role_name)
    .filter(Boolean) ?? [];
  const roleSummary = roleNames.length > 0
    ? roleNames.join(', ')
    : 'No ministry roles assigned';
  const notificationSummary = getNotificationPermissionSummary({
    hasPermission,
    permissionDenied,
    canRequestPermission,
    loading: notificationLoading,
    isWeb,
  });
  const notificationDeliverySummary = createNotificationPreferenceSummary(
    notificationPreferencesQuery.preferences,
    notificationSummary.description,
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <ResponsiveTabHeader
        eyebrow="Profile"
        title={displayName}
        titleVariant="profileName"
        subtitle={currentChurch?.name}
        subtitleVariant="secondaryChurchName"
        trailingWidth={HEADER_ACTION_LANE_WIDTHS.profile}
        accessibilityTitle={`Profile for ${displayName}`}
        trailing={(
          <TabHeaderIconSurface>
            <IconSymbol
              ios_icon_name="person.fill"
              android_material_icon_name="person"
              size={30}
              color="#FFFFFF"
            />
          </TabHeaderIconSurface>
        )}
      >
        <TabHeaderPill
          icon={<IconSymbol ios_icon_name="person.badge.key.fill" android_material_icon_name="verified-user" size={16} color="#FFFFFF" />}
          label={profileSubtitle}
        />
        <TabHeaderMetaText>{displayEmail}</TabHeaderMetaText>
      </ResponsiveTabHeader>
      <ProfileOverviewList
        refreshing={refreshing}
        onRefresh={() => {
          void handleRefresh();
        }}
        status={(
          <ProfileStatus
            message={
              refreshError
              ?? (availabilityQuery.isError
                ? 'Unavailable dates could not be refreshed.'
                : schedulingPreferencesQuery.loadError
                  ? 'Scheduling preferences could not be refreshed.'
                  : notificationPreferencesQuery.loadError
                    ? 'Notification delivery settings could not be refreshed.'
                    : null)
            }
            tone={
              refreshError
              || availabilityQuery.isError
              || schedulingPreferencesQuery.loadError
              || notificationPreferencesQuery.loadError
                ? 'error'
                : 'info'
            }
          />
        )}
        sections={[
          {
            id: 'church',
            title: 'Church and Roles',
            description: 'Your access and ministry identity in the selected church.',
            content: (
              <View style={styles.sectionContent}>
                <ProfileRow
                  title="Church Profile"
                  summary={`${currentChurch?.name ?? 'Selected church'} | ${roleSummary}`}
                  value={userRole}
                  iosIcon="person.text.rectangle"
                  androidIcon="badge"
                  accessibilityHint="Shows your church-scoped name, access, assigned roles, and account email."
                  onPress={() => {
                    router.push('/profile-identity');
                  }}
                />
                <ChurchSwitcher />
              </View>
            ),
          },
          {
            id: 'scheduling',
            title: 'My Scheduling',
            description: 'Dates and weekly-service preferences used by auto-assign.',
            content: (
              <View style={styles.sectionContent}>
                <View style={styles.rowGroup}>
                  <ProfileRow
                    title="Unavailable Dates"
                    summary={
                      availabilityQuery.isLoading
                        ? 'Loading your hard scheduling exclusions...'
                        : availabilityLoadFailed
                          ? 'Unavailable dates could not be loaded. Open to retry.'
                          : availabilitySummary.description
                    }
                    value={
                      availabilityQuery.isLoading
                        ? 'Loading'
                        : availabilityLoadFailed
                          ? 'Retry'
                          : availabilitySummary.value
                    }
                    iosIcon="calendar.badge.exclamationmark"
                    androidIcon="event-busy"
                    accessibilityHint="Opens the unavailable-date calendar editor."
                    busy={availabilityQuery.isLoading}
                    onPress={() => {
                      router.push('/profile-availability');
                    }}
                  />
                  <ProfileRow
                    title="Scheduling Preferences"
                    summary={
                      schedulingPreferencesQuery.isLoading
                        ? 'Loading your weekly-service preferences...'
                        : schedulingPreferencesLoadFailed
                          ? 'Preferences could not be loaded. Open to retry.'
                          : schedulingPreferenceSummary.description
                    }
                    value={
                      schedulingPreferencesQuery.isLoading
                        ? 'Loading'
                        : schedulingPreferencesLoadFailed
                          ? 'Retry'
                          : schedulingPreferenceSummary.value
                    }
                    iosIcon="slider.horizontal.3"
                    androidIcon="tune"
                    accessibilityHint="Opens weekly-service scheduling preferences."
                    busy={schedulingPreferencesQuery.isLoading}
                    onPress={() => {
                      router.push('/profile-scheduling-preferences');
                    }}
                  />
                </View>
              </View>
            ),
          },
          {
            id: 'notifications',
            title: 'Notifications',
            description: 'Permission for reminders, fill-in requests, and service updates.',
            content: (
              <View style={styles.rowGroup}>
                <ProfileRow
                  title="Notification Delivery"
                  summary={
                    notificationPreferencesQuery.isLoading
                      ? 'Loading church delivery settings...'
                      : notificationPreferencesLoadFailed
                        ? 'Delivery settings could not be loaded. Open to retry.'
                        : notificationDeliverySummary.description
                  }
                  value={
                    notificationPreferencesQuery.isLoading
                      ? 'Loading'
                      : notificationPreferencesLoadFailed
                        ? 'Retry'
                        : notificationDeliverySummary.value
                  }
                  iosIcon={hasPermission ? 'bell.badge.fill' : 'bell.slash.fill'}
                  androidIcon={hasPermission ? 'notifications-active' : 'notifications-off'}
                  accessibilityHint="Opens device permission and church notification delivery settings."
                  busy={notificationPreferencesQuery.isLoading}
                  onPress={() => {
                    router.push('/notification-preferences');
                  }}
                />
              </View>
            ),
          },
          {
            id: 'account',
            title: 'Account',
            description: 'Actions for this signed-in account and device.',
            content: (
              <View style={styles.rowGroup}>
                <ProfileRow
                  title="Account and Security"
                  summary={user.email ?? 'Password, sign-out, and app information.'}
                  value="Open"
                  iosIcon="person.crop.circle.badge.checkmark"
                  androidIcon="manage-accounts"
                  accessibilityHint="Opens account identity, password, app information, and sign-out controls."
                  onPress={() => {
                    router.push('/profile-account');
                  }}
                />
              </View>
            ),
          },
          {
            id: 'danger',
            title: 'Danger Zone',
            description: 'Permanent actions that affect your account and stored data.',
            content: (
              <View style={styles.rowGroup}>
                <ProfileDangerRow
                  title="Delete Account"
                  summary="Permanently delete your account and associated data."
                  iosIcon="trash"
                  androidIcon="delete"
                  accessibilityHint="Opens a deletion impact preview and permanent confirmation."
                  onPress={() => {
                    router.push('/delete-account');
                  }}
                />
              </View>
            ),
          },
        ] satisfies ProfileOverviewSection[]}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stateScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    textAlign: 'center',
  },
  stateMessage: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 420,
    textAlign: 'center',
  },
  stateButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 48,
    minWidth: 144,
    paddingHorizontal: 20,
  },
  stateButtonText: {
    color: colors.headerText,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionContent: {
    gap: 12,
  },
  rowGroup: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
