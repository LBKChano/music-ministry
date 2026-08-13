import React from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { useNotifications } from '@/contexts/NotificationContext';
import { useMemberNotifications } from '@/hooks/useMemberNotifications';
import {
  saveNotificationPermissionDecision,
} from '@/lib/notifications/permission-onboarding-storage';
import { useAppTheme } from '@/contexts/AppThemeContext';

interface NotificationBellProps {
  variant?: 'default' | 'compact';
  size?: number;
}

export function NotificationBell({
  variant = 'default',
  size = 24,
}: NotificationBellProps) {
  const theme = useAppTheme();
  const router = useRouter();
  const {
    hasPermission,
    permissionDenied,
    loading,
    isWeb,
    openNotificationSettings,
    requestPermission,
  } = useNotifications();
  const { unreadCount } = useMemberNotifications({
    enabled: !loading && !isWeb,
  });

  if (loading || isWeb) return null;

  const handlePress = () => {
    if (hasPermission) {
      router.push('/schedule-notifications');
      return;
    }

    if (permissionDenied) {
      Alert.alert(
        'Notifications Disabled',
        'To receive notifications, please enable them in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              void openNotificationSettings();
            },
          },
        ],
      );
      return;
    }

    Alert.alert(
      'Enable Notifications',
      'Receive service reminders and fill-in requests that affect your schedule.',
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: () => {
            void saveNotificationPermissionDecision('not_now');
          },
        },
        {
          text: 'Enable Notifications',
          onPress: () => {
            void requestPermission().catch(() => {
              Alert.alert(
                'Notifications Unavailable',
                'Notification permission could not be opened. Please try again.',
              );
            });
          },
        },
      ],
    );
  };

  const compact = variant === 'compact';

  return (
    <TouchableOpacity
      accessibilityHint={hasPermission
        ? 'Opens notification history'
        : 'Opens notification permission options'}
      accessibilityLabel={unreadCount > 0
        ? `Notifications, ${unreadCount} unread`
        : hasPermission
          ? 'Notifications'
          : 'Notifications disabled'}
      accessibilityRole="button"
      activeOpacity={0.72}
      onPress={handlePress}
      style={[
        compact ? styles.compactButton : styles.button,
        {
          backgroundColor: theme.header.controlSurface,
          borderColor: theme.header.controlBorder,
        },
      ]}
      testID="notification-bell"
    >
      <View style={styles.bellContainer}>
        <IconSymbol
          ios_icon_name={hasPermission ? 'bell.fill' : 'bell.slash.fill'}
          android_material_icon_name={hasPermission ? 'notifications' : 'notifications-off'}
          size={compact ? Math.round(size * 0.82) : size}
          color={theme.header.title}
        />
        {hasPermission && unreadCount > 0 ? (
          <NotificationBadge count={unreadCount} />
        ) : !hasPermission && !compact ? (
          <View style={[
            styles.badge,
            {
              backgroundColor: theme.status.error.foreground,
              borderColor: theme.header.title,
            },
          ]}>
            <Text style={[
              styles.badgeText,
              { color: theme.button.destructiveForeground },
            ]}>
              !
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function NotificationBadge({ count }: { count: number }) {
  const theme = useAppTheme();
  return (
    <View style={[
      styles.badge,
      {
        backgroundColor: theme.status.error.foreground,
        borderColor: theme.header.title,
      },
    ]}>
      <Text style={[
        styles.badgeText,
        { color: theme.button.destructiveForeground },
      ]}>
        {count > 9 ? '9+' : String(count)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  compactButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  bellContainer: {
    position: 'relative',
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -7,
    right: -8,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default NotificationBell;
