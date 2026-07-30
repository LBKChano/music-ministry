import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isPendingOnboardingIntent,
  type PendingOnboardingIntent,
} from '@/lib/auth/onboarding-workflow';

const PENDING_ONBOARDING_INTENT_KEY = 'music-ministry:pending-onboarding:v1';
const MAX_PENDING_INTENT_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export async function savePendingOnboardingIntent(
  intent: PendingOnboardingIntent,
) {
  await AsyncStorage.setItem(
    PENDING_ONBOARDING_INTENT_KEY,
    JSON.stringify(intent),
  );
}

export async function loadPendingOnboardingIntent(): Promise<
  PendingOnboardingIntent | null
> {
  try {
    const stored = await AsyncStorage.getItem(PENDING_ONBOARDING_INTENT_KEY);
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    if (!isPendingOnboardingIntent(parsed)) {
      await clearPendingOnboardingIntent();
      return null;
    }

    const createdAt = Date.parse(parsed.createdAt);
    if (
      !Number.isFinite(createdAt)
      || Date.now() - createdAt > MAX_PENDING_INTENT_AGE_MS
    ) {
      await clearPendingOnboardingIntent();
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('[Onboarding] Could not restore the pending action:', error);
    return null;
  }
}

export async function clearPendingOnboardingIntent() {
  try {
    await AsyncStorage.removeItem(PENDING_ONBOARDING_INTENT_KEY);
  } catch (error) {
    console.warn('[Onboarding] Could not clear the pending action:', error);
  }
}
