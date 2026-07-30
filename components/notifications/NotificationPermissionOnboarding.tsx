import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        void chooseNotNow();
      }}
    >
      <SafeAreaView style={styles.overlay}>
        <ScrollView
          accessibilityViewIsModal
          accessibilityLabel="Enable service notifications"
          style={styles.sheet}
          contentContainerStyle={styles.sheetContent}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconContainer}>
            <IconSymbol
              ios_icon_name="bell.badge.fill"
              android_material_icon_name="notifications-active"
              size={30}
              color={colors.headerText}
            />
          </View>

          <View style={styles.copy}>
            <Text accessibilityRole="header" style={styles.title}>
              Stay ready for every service
            </Text>
            <Text style={styles.description}>
              Enable notifications to receive the updates that directly affect
              your ministry schedule.
            </Text>
          </View>

          <View style={styles.benefits}>
            <View style={styles.benefitRow}>
              <IconSymbol
                ios_icon_name="calendar.badge.clock"
                android_material_icon_name="event"
                size={21}
                color={colors.primary}
              />
              <View style={styles.benefitCopy}>
                <Text style={styles.benefitTitle}>Service reminders</Text>
                <Text style={styles.benefitText}>
                  Know before a service where you have an assigned role.
                </Text>
              </View>
            </View>

            <View style={styles.benefitRow}>
              <IconSymbol
                ios_icon_name="person.2.fill"
                android_material_icon_name="group"
                size={21}
                color={colors.primary}
              />
              <View style={styles.benefitCopy}>
                <Text style={styles.benefitTitle}>Fill-in requests</Text>
                <Text style={styles.benefitText}>
                  Respond when someone with your role needs help.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            {requestError ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {requestError}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enable notifications"
              accessibilityState={{ busy: requesting, disabled: requesting }}
              disabled={requesting}
              onPress={() => {
                void enableNotifications();
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                requesting && styles.disabled,
              ]}
            >
              {requesting ? (
                <ActivityIndicator size="small" color={colors.headerText} />
              ) : (
                <IconSymbol
                  ios_icon_name="bell.fill"
                  android_material_icon_name="notifications"
                  size={19}
                  color={colors.headerText}
                />
              )}
              <Text style={styles.primaryButtonText}>Enable Notifications</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Not now"
              disabled={requesting}
              onPress={() => {
                void chooseNotNow();
              }}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
                requesting && styles.disabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Not Now</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
    backgroundColor: `${colors.navyDark}90`,
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '100%',
    alignSelf: 'center',
    borderRadius: 8,
    backgroundColor: colors.card,
  },
  sheetContent: {
    padding: 20,
    gap: 18,
  },
  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  copy: {
    gap: 7,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  description: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  benefits: {
    gap: 14,
  },
  benefitRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitCopy: {
    flex: 1,
    gap: 2,
  },
  benefitTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  benefitText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 50,
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
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.58,
  },
});
