import * as Linking from 'expo-linking';
export {
  establishPasswordRecoverySession,
  getAuthParamsFromUrl,
  isPasswordRecoveryUrl,
  parsePasswordRecoveryUrl,
} from '@/lib/auth/password-recovery';

export const PASSWORD_RESET_REDIRECT_URL = Linking.createURL('reset-password');
