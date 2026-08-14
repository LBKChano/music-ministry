import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppStatePanel } from '@/components/feedback/app-state-panel';
import { InlineStatus } from '@/components/feedback/inline-status';
import { FocusedScreenHeader } from '@/components/navigation/focused-screen-header';
import { ResponsiveText } from '@/components/ui/responsive-text';
import { useAppTheme } from '@/contexts/AppThemeContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useChurchSession } from '@/hooks/useChurch';
import {
  type MemberNotification,
  useMemberNotifications,
} from '@/hooks/useMemberNotifications';

export function ScheduleNotificationsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { currentChurch } = useChurchSession();
  const {
    hasPermission,
    isWeb,
    loading: permissionLoading,
    openNotificationSettings,
    permissionDenied,
    requestPermission,
  } = useNotifications();
  const {
    historyError,
    isHistoryFetching,
    isHistoryLoading,
    markNotificationsRead,
    notifications,
    refetchHistory,
    scopeReady,
    unreadCount,
  } = useMemberNotifications({
    enabled: !isWeb,
    history: true,
  });
  const [readError, setReadError] = useState<string | null>(null);
  const [updatingPermission, setUpdatingPermission] = useState(false);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/(home)');
    }
  }, [router]);

  useEffect(() => {
    if (!isFocused || notifications.length === 0) return;

    void markNotificationsRead(notifications).then(() => {
      setReadError(null);
    }).catch(error => {
      console.warn('[Notifications] Could not mark history read:', error);
      setReadError('Notifications loaded, but their read status could not be updated.');
    });
  }, [isFocused, markNotificationsRead, notifications]);

  const handlePermissionAction = async () => {
    if (updatingPermission) return;
    setUpdatingPermission(true);
    try {
      if (permissionDenied) {
        await openNotificationSettings();
      } else {
        await requestPermission();
      }
    } finally {
      setUpdatingPermission(false);
    }
  };

  const permissionNotice = !permissionLoading && !hasPermission && !isWeb ? (
    <View style={styles.permissionNotice}>
      <InlineStatus
        live={false}
        message={permissionDenied
          ? 'Push notifications are disabled on this device. Your saved history is still available.'
          : 'Enable push notifications to receive new schedule updates on this device.'}
      />
      <Pressable
        accessibilityHint={permissionDenied
          ? 'Opens this app in device notification settings'
          : 'Opens the operating-system notification permission prompt'}
        accessibilityLabel={permissionDenied ? 'Open notification settings' : 'Enable notifications'}
        accessibilityRole="button"
        accessibilityState={{ busy: updatingPermission, disabled: updatingPermission }}
        disabled={updatingPermission}
        onPress={() => void handlePermissionAction()}
        style={({ pressed }) => [
          styles.permissionButton,
          pressed && styles.pressed,
          updatingPermission && styles.disabled,
        ]}
      >
        <ResponsiveText
          accessible={false}
          style={styles.permissionButtonLabel}
          text={permissionDenied ? 'Open Settings' : 'Enable Notifications'}
          textStyle={[styles.permissionButtonText, { color: theme.colors.accent }]}
          variant="actionLabel"
        />
      </Pressable>
    </View>
  ) : null;

  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.canvas }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <FocusedScreenHeader
        backAccessibilityLabel="Back to Schedule"
        extendIntoTopSafeArea
        onBack={handleBack}
        subtitle={currentChurch?.name ?? 'Schedule updates'}
        title="Notifications"
        tone="surface"
        iosIcon="bell.badge.fill"
        androidIcon="notifications-active"
      />

      {!scopeReady ? (
        <AppStatePanel
          actions={[{
            label: 'Back to Schedule',
            onPress: handleBack,
          }]}
          androidIcon="notifications-off"
          iosIcon="bell.slash.fill"
          message="Select an active church membership to view its notification history."
          title="Notifications unavailable"
        />
      ) : (
        <FlatList
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 16) + 24 },
          ]}
          data={notifications}
          keyExtractor={notification => notification.id}
          ListEmptyComponent={(
            <AppStatePanel
              actions={historyError ? [{
                label: 'Try Again',
                onPress: () => {
                  void refetchHistory();
                },
              }] : []}
              androidIcon={historyError ? 'sync-problem' : 'notifications-none'}
              iosIcon={historyError ? 'exclamationmark.arrow.triangle.2.circlepath' : 'bell'}
              loading={isHistoryLoading}
              message={historyError
                ? 'Your notification history could not be loaded. Check your connection and try again.'
                : isHistoryLoading
                  ? 'Loading your latest schedule updates.'
                  : 'Service reminders, fill-in updates, and song notifications will appear here.'}
              title={historyError
                ? 'History unavailable'
                : isHistoryLoading
                  ? 'Loading notifications'
                  : 'No notifications yet'}
              tone={historyError ? 'error' : 'info'}
            />
          )}
          ListHeaderComponent={(
            <>
              {permissionNotice}
              <InlineStatus message={readError} tone="error" />
              {notifications.length > 0 ? (
                <View
                  accessibilityLabel={`Recent updates. ${unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}`}
                  accessibilityRole="header"
                  accessible
                  style={styles.listSummary}
                >
                  <Text accessible={false} style={[styles.listTitle, { color: theme.colors.textPrimary }]}>
                    Recent Updates
                  </Text>
                  <Text accessible={false} style={[styles.listCount, { color: theme.colors.textSecondary }]}>
                    {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                  </Text>
                </View>
              ) : null}
            </>
          )}
          refreshControl={(
            <RefreshControl
              colors={[theme.colors.accent]}
              onRefresh={() => {
                void refetchHistory();
              }}
              refreshing={isHistoryFetching && !isHistoryLoading}
              tintColor={theme.colors.accent}
            />
          )}
          renderItem={({ item }) => <NotificationHistoryRow notification={item} />}
          style={[styles.container, { backgroundColor: theme.colors.canvas }]}
        />
      )}
    </SafeAreaView>
  );
}

function NotificationHistoryRow({
  notification,
}: {
  notification: MemberNotification;
}) {
  const theme = useAppTheme();
  return (
    <View
      accessibilityLabel={[
        notification.title,
        notification.body,
        formatNotificationTime(notification.created_at),
      ].join('. ')}
      accessibilityRole="text"
      accessible
      style={[
        styles.notificationRow,
        { borderTopColor: theme.divider.color },
        !notification.read_at && [
          styles.unreadNotificationRow,
          { backgroundColor: theme.colors.accentSoft },
        ],
      ]}
    >
      <View style={styles.notificationMarker}>
        <View style={[
          styles.notificationDot,
          { backgroundColor: theme.colors.accent },
          notification.read_at && [
            styles.readNotificationDot,
            { backgroundColor: theme.colors.borderStrong },
          ],
        ]} />
      </View>
      <View style={styles.notificationCopy}>
        <ResponsiveText
          accessible={false}
          text={notification.title}
          textStyle={[styles.notificationTitle, { color: theme.colors.textPrimary }]}
          variant="notificationTitle"
        />
        <ResponsiveText
          accessible={false}
          text={notification.body}
          textStyle={[styles.notificationBody, { color: theme.colors.textSecondary }]}
          variant="supportingCopy"
        />
        <Text style={[styles.notificationTime, { color: theme.colors.textTertiary }]}>
          {formatNotificationTime(notification.created_at)}
        </Text>
      </View>
    </View>
  );
}

function formatNotificationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: 720,
    paddingHorizontal: 16,
    paddingTop: 14,
    width: '100%',
  },
  permissionNotice: {
    gap: 8,
    marginBottom: 14,
  },
  permissionButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 8,
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  permissionButtonLabel: {
    minWidth: 128,
  },
  listSummary: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingBottom: 8,
    paddingTop: 14,
  },
  listTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
  },
  listCount: {
    fontSize: 13,
    fontWeight: '700',
  },
  notificationRow: {
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 88,
    paddingVertical: 14,
  },
  unreadNotificationRow: {
  },
  notificationMarker: {
    alignItems: 'center',
    paddingTop: 5,
    width: 28,
  },
  notificationDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  readNotificationDot: {
  },
  notificationCopy: {
    flex: 1,
    gap: 5,
    minWidth: 0,
    paddingRight: 6,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  notificationBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.68,
  },
  disabled: {
    opacity: 0.5,
  },
});
