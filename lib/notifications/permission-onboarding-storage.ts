import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createNotificationPermissionOnboardingState,
  parseNotificationPermissionOnboardingState,
  type NotificationPermissionDecision,
} from '@/lib/notifications/permission-onboarding';

const NOTIFICATION_PERMISSION_ONBOARDING_KEY =
  'music-ministry.notification-permission-onboarding.v1';

export async function readNotificationPermissionOnboardingState() {
  try {
    return parseNotificationPermissionOnboardingState(
      await AsyncStorage.getItem(NOTIFICATION_PERMISSION_ONBOARDING_KEY),
    );
  } catch (error) {
    console.warn('[Notifications] Could not read permission onboarding state:', error);
    return null;
  }
}

export async function saveNotificationPermissionDecision(
  decision: NotificationPermissionDecision,
) {
  const state = createNotificationPermissionOnboardingState(decision);

  try {
    await AsyncStorage.setItem(
      NOTIFICATION_PERMISSION_ONBOARDING_KEY,
      JSON.stringify(state),
    );
  } catch (error) {
    console.warn('[Notifications] Could not save permission onboarding state:', error);
  }

  return state;
}
