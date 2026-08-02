import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { ResponsiveText } from '@/components/ui/responsive-text';
import { useNotifications } from '@/contexts/NotificationContext';
import { useChurchSession } from '@/contexts/ChurchContext';
import {
  shouldPresentNotificationPermissionOnboarding,
  type NotificationPermissionDecision,
} from '@/lib/notifications/permission-onboarding';
import {
  readNotificationPermissionOnboardingState,
  saveNotificationPermissionDecision,
} from '@/lib/notifications/permission-onboarding-storage';
import { colors } from '@/styles/commonStyles';

interface NotificationPermissionOnboardingProps {
  scheduleReady: boolean;
}

type LoadedDecision = NotificationPermissionDecision | null | 'loading';

export function NotificationPermissionOnboarding({
  scheduleReady,
}: NotificationPermissionOnboardingProps) {
  const {
    hasPermission,
    permissionDenied,
    loading,
    linkedIdentity,
    requestPermission,
  } = useNotifications();
  const {
    currentChurch,
    currentMember,
    sessionStatus,
  } = useChurchSession();
  const [decision, setDecision] = useState<LoadedDecision>('loading');
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const identityReady = Boolean(
    sessionStatus === 'ready'
    && currentChurch?.id
    && currentMember?.id
    && linkedIdentity?.churchId === currentChurch.id
    && linkedIdentity.memberId === currentMember.id,
  );

  useEffect(() => {
    let active = true;

    void readNotificationPermissionOnboardingState().then(state => {
      if (active) {
        setDecision(state?.decision ?? null);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (decision === 'loading') return;

    if (hasPermission && decision !== 'enabled') {
      setDecision('enabled');
      void saveNotificationPermissionDecision('enabled');
      setVisible(false);
      return;
    }

    if (permissionDenied && decision !== 'denied') {
      setDecision('denied');
      void saveNotificationPermissionDecision('denied');
      setVisible(false);
      return;
    }

    setVisible(shouldPresentNotificationPermissionOnboarding({
      scheduleReady,
      identityReady,
      permissionLoading: loading,
      hasPermission,
      permissionDenied,
      storedDecision: decision,
    }));
  }, [
    decision,
    hasPermission,
    identityReady,
    loading,
    permissionDenied,
    scheduleReady,
  ]);

  const chooseNotNow = async () => {
    setVisible(false);
    setDecision('not_now');
    await saveNotificationPermissionDecision('not_now');
  };

  const enableNotifications = async () => {
    if (requesting) return;

    setRequesting(true);
    setRequestError(null);

    try {
      const granted = await requestPermission();
      const nextDecision: NotificationPermissionDecision = granted
        ? 'enabled'
        : 'denied';
      setDecision(nextDecision);
      await saveNotificationPermissionDecision(nextDecision);
      setVisible(false);
    } catch {
      setRequestError(
        'Notification permission could not be opened. Please try again.',
      );
    } finally {
      setRequesting(false);
    }
  };

  if (!visible) return null;

  return (
    <View
      accessibilityLabel="Notification permission options"
      style={styles.container}
    >
      <View style={styles.headerRow}>
        <View style={styles.iconContainer} accessibilityElementsHidden>
          <IconSymbol
            ios_icon_name="bell.badge.fill"
            android_material_icon_name="notifications-active"
            size={25}
            color={colors.headerText}
          />
        </View>
        <View style={styles.copy}>
          <ResponsiveText
            accessibilityRole="header"
            text="Stay ready for every service"
            textStyle={styles.title}
            variant="stateTitle"
          />
          <ResponsiveText
            text="Enable Service reminders and Fill-in requests on this device."
            textStyle={styles.description}
            variant="supportingCopy"
          />
        </View>
      </View>
      {requestError ? (
        <ResponsiveText
          accessibilityRole="alert"
          text={requestError}
          textStyle={styles.errorText}
          variant="supportingCopy"
        />
      ) : null}
      <View style={styles.actions}>
        <Pressable
          accessibilityHint="Opens the operating-system notification permission prompt"
          accessibilityLabel="Enable notifications"
          accessibilityRole="button"
          accessibilityState={{ busy: requesting, disabled: requesting }}
          disabled={requesting}
          onPress={() => void enableNotifications()}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
            requesting && styles.disabled,
          ]}
        >
          {requesting ? (
            <ActivityIndicator color={colors.headerText} size="small" />
          ) : null}
          <ResponsiveText
            accessible={false}
            style={styles.primaryButtonLabel}
            text="Enable Notifications"
            textStyle={styles.primaryButtonText}
            variant="actionLabel"
          />
        </Pressable>
        <Pressable
          accessibilityHint="Dismisses this notification permission reminder"
          accessibilityLabel="Not now"
          accessibilityRole="button"
          accessibilityState={{ disabled: requesting }}
          disabled={requesting}
          onPress={() => void chooseNotNow()}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
            requesting && styles.disabled,
          ]}
        >
          <ResponsiveText
            accessible={false}
            style={styles.secondaryButtonLabel}
            text="Not Now"
            textStyle={styles.secondaryButtonText}
            variant="actionLabel"
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    marginBottom: 8,
    maxWidth: 728,
    padding: 14,
    width: '92%',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  copy: {
    flex: 1,
    gap: 7,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: colors.headerText,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  primaryButtonLabel: {
    minWidth: 132,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  secondaryButtonLabel: {
    minWidth: 62,
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.58,
  },
});
