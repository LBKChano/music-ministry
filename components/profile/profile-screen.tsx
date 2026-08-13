
import React, { useEffect, useMemo, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { AppStateScreen } from '@/components/feedback/app-state-screen';
import {
  ResponsiveTabHeader,
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
import { shouldShowInitialLoader } from "@/lib/query/refresh-coordinator";
import { HEADER_ACTION_LANE_WIDTHS } from "@/lib/ui/header-typography";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  ProfileOverviewList,
  ProfileRow,
  ProfileRowGroup,
  ProfileStatus,
  type ProfileOverviewSection,
} from "@/components/profile/profile-primitives";
import {
  useAppAppearance,
  useAppTheme,
} from '@/contexts/AppThemeContext';
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
    churches,
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
  const theme = useAppTheme();
  const { preference: appearancePreference } = useAppAppearance();
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
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <AppStateScreen
          title="No church connected"
          message="Join or create a church before opening your church profile."
          iosIcon="building.2.crop.circle"
          androidIcon="domain-disabled"
          actions={[{
            label: 'Continue',
            accessibilityHint: 'Opens account recovery options for joining or creating a church.',
            onPress: () => router.replace('/no-membership'),
          }]}
        />
      </>
    );
  }

  if (user && sessionStatus === 'error' && !currentMember) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <AppStateScreen
          title="Profile unavailable"
          message={sessionError || 'Your church profile could not be loaded.'}
          iosIcon="exclamationmark.circle.fill"
          androidIcon="error"
          iconTone="error"
          actions={[{
            label: 'Retry',
            accessibilityHint: 'Retries loading your church profile.',
            onPress: () => {
              void retryChurchSession();
            },
          }]}
        />
      </>
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
      <>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <AppStateScreen
          title="Loading Profile"
          message="Getting your church membership and preferences ready."
          loading
        />
      </>
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
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
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
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.identityMark}
          >
            <IconSymbol
              ios_icon_name="person.crop.circle.fill"
              android_material_icon_name="account-circle"
              size={50}
              color={theme.strongSurface.foreground}
            />
          </View>
        )}
      >
        <TabHeaderPill
          icon={<IconSymbol ios_icon_name="person.badge.key.fill" android_material_icon_name="verified-user" size={16} color={theme.strongSurface.foreground} />}
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
              <ProfileRowGroup>
                <ProfileRow
                  title="Appearance"
                  summary="Choose whether this device follows the system appearance or uses light or dark mode."
                  value={appearancePreference === 'system'
                    ? 'System'
                    : appearancePreference === 'dark'
                      ? 'Dark'
                      : 'Light'}
                  valueTone="info"
                  iosIcon="circle.lefthalf.filled"
                  androidIcon="contrast"
                  accessibilityHint="Opens appearance settings for this device."
                  onPress={() => {
                    router.push('/profile-appearance');
                  }}
                />
                <ProfileRow
                  title="Church Profile"
                  summary={`${currentChurch?.name ?? 'Selected church'} | ${roleSummary}`}
                  value={userRole}
                  valueTone={userRole === 'Member' ? 'info' : 'success'}
                  iosIcon="person.text.rectangle"
                  androidIcon="badge"
                  accessibilityHint="Shows your church-scoped name, access, assigned roles, and account email."
                  onPress={() => {
                    router.push('/profile-identity');
                  }}
                />
                <ProfileRow
                  title="Switch Church"
                  summary={currentChurch?.name ?? 'Choose the church you want to use.'}
                  value={`${churches.length} connected`}
                  valueTone="info"
                  iosIcon="building.2"
                  androidIcon="business"
                  accessibilityHint="Opens your connected churches and lets you switch or join another church."
                  onPress={() => {
                    router.push('/profile-churches');
                  }}
                />
              </ProfileRowGroup>
            ),
          },
          {
            id: 'scheduling',
            title: 'My Scheduling',
            description: 'Dates and weekly-service preferences used by auto-assign.',
            content: (
              <ProfileRowGroup>
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
                    valueTone={availabilityLoadFailed ? 'error' : availabilitySummary.count > 0 ? 'attention' : 'success'}
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
                    valueTone={schedulingPreferencesLoadFailed ? 'error' : schedulingPreferenceSummary.count > 0 ? 'attention' : 'success'}
                    accessibilityHint="Opens weekly-service scheduling preferences."
                    busy={schedulingPreferencesQuery.isLoading}
                    onPress={() => {
                      router.push('/profile-scheduling-preferences');
                    }}
                  />
              </ProfileRowGroup>
            ),
          },
          {
            id: 'notifications',
            title: 'Notifications',
            description: 'Permission for reminders, fill-in requests, and service updates.',
            content: (
              <ProfileRowGroup>
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
                  valueTone={notificationPreferencesLoadFailed ? 'error' : hasPermission ? 'success' : 'attention'}
                  accessibilityHint="Opens device permission and church notification delivery settings."
                  busy={notificationPreferencesQuery.isLoading}
                  onPress={() => {
                    router.push('/notification-preferences');
                  }}
                />
              </ProfileRowGroup>
            ),
          },
          {
            id: 'account',
            title: 'Account',
            description: 'Actions for this signed-in account and device.',
            content: (
              <ProfileRowGroup>
                <ProfileRow
                  title="Account and Security"
                  summary={user.email ?? 'Password, sign-out, app information, and account management.'}
                  value="Open"
                  valueTone="info"
                  iosIcon="person.crop.circle.badge.checkmark"
                  androidIcon="manage-accounts"
                  accessibilityHint="Opens password, app information, sign-out, and account-management controls."
                  onPress={() => {
                    router.push('/profile-account');
                  }}
                />
              </ProfileRowGroup>
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
  identityMark: {
    alignItems: 'center',
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
});
