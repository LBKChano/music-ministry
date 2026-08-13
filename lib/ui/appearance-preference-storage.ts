import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_APPEARANCE_PREFERENCE,
  parseStoredAppearancePreference,
  serializeAppearancePreference,
  type AppearancePreference,
} from '@/lib/ui/appearance-preference';

export const APPEARANCE_PREFERENCE_STORAGE_KEY =
  'music-ministry.appearance-preference.v1';

export async function readAppearancePreference(): Promise<AppearancePreference> {
  try {
    const storedValue = await AsyncStorage.getItem(
      APPEARANCE_PREFERENCE_STORAGE_KEY,
    );
    return parseStoredAppearancePreference(storedValue);
  } catch (error) {
    console.warn('[Appearance] Could not read the device preference:', error);
    return DEFAULT_APPEARANCE_PREFERENCE;
  }
}

export async function saveAppearancePreference(
  preference: AppearancePreference,
): Promise<boolean> {
  try {
    await AsyncStorage.setItem(
      APPEARANCE_PREFERENCE_STORAGE_KEY,
      serializeAppearancePreference(preference),
    );
    return true;
  } catch (error) {
    console.warn('[Appearance] Could not save the device preference:', error);
    return false;
  }
}
