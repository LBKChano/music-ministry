import * as Linking from 'expo-linking';

export const PASSWORD_RESET_REDIRECT_URL = Linking.createURL('reset-password');

export function getAuthParamsFromUrl(url: string) {
  const queryString = url.includes('?') ? url.split('?')[1]?.split('#')[0] ?? '' : '';
  const hashString = url.includes('#') ? url.split('#')[1] ?? '' : '';
  const params = new URLSearchParams(queryString);
  const hashParams = new URLSearchParams(hashString);

  hashParams.forEach((value, key) => {
    params.set(key, value);
  });

  return params;
}

export function isPasswordRecoveryUrl(url: string | null) {
  if (!url) return false;

  const params = getAuthParamsFromUrl(url);
  return params.get('type') === 'recovery' || Boolean(params.get('error') || params.get('error_description'));
}
