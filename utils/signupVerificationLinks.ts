import * as Linking from 'expo-linking';

export {
  establishSignupVerificationSession,
  isSignupVerificationUrl,
  parseSignupVerificationUrl,
} from '@/lib/auth/signup-verification';

export const SIGNUP_VERIFICATION_REDIRECT_URL = Linking.createURL('verify-email');
