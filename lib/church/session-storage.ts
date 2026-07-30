import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_CHURCH_KEY_PREFIX = 'music-ministry:last-church:';

function lastChurchKey(accountId: string) {
  return `${LAST_CHURCH_KEY_PREFIX}${accountId}`;
}

export async function getLastSelectedChurchId(
  accountId: string,
): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(lastChurchKey(accountId));
  } catch (error) {
    console.warn('[ChurchSession] Could not restore the selected church:', error);
    return null;
  }
}

export async function saveLastSelectedChurchId(
  accountId: string,
  churchId: string,
): Promise<void> {
  try {
    await AsyncStorage.setItem(lastChurchKey(accountId), churchId);
  } catch (error) {
    console.warn('[ChurchSession] Could not save the selected church:', error);
  }
}

export async function clearLastSelectedChurchId(
  accountId: string,
): Promise<void> {
  try {
    await AsyncStorage.removeItem(lastChurchKey(accountId));
  } catch (error) {
    console.warn('[ChurchSession] Could not clear the selected church:', error);
  }
}
