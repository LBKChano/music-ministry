import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { AppStateScreen } from '@/components/feedback/app-state-screen';
import { useChurch, useChurchSession } from '@/hooks/useChurch';
import { useAuth } from '@/contexts/AuthContext';

export default function NoMembershipScreen() {
  const router = useRouter();
  const { initializationError } = useAuth();
  const {
    sessionStatus,
    sessionError,
    retryChurchSession,
  } = useChurchSession();
  const { signOut } = useChurch();
  const [retrying, setRetrying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (sessionStatus === 'ready') {
      router.replace('/(tabs)/(home)');
    }
  }, [router, sessionStatus]);

  const isError = sessionStatus === 'error' || Boolean(initializationError);
  const message = isError
    ? sessionError || initializationError || 'We could not load your church access.'
    : 'This account is not connected to a church yet. Ask a church administrator to add you, then try again.';

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryChurchSession();
    } finally {
      setRetrying(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AppStateScreen
        title={isError ? 'Church access could not load' : 'No church access yet'}
        message={message}
        iosIcon={isError ? 'exclamationmark.arrow.triangle.2.circlepath' : 'building.2'}
        androidIcon={isError ? 'sync-problem' : 'domain-disabled'}
        iconTone={isError ? 'error' : 'primary'}
        actions={[
          ...(!isError ? [
            {
              label: 'Join a Church',
              disabled: retrying || signingOut,
              onPress: () => router.push({
                pathname: '/onboarding',
                params: { mode: 'join' },
              }),
            },
            {
              label: 'Create a Church',
              disabled: retrying || signingOut,
              variant: 'secondary' as const,
              onPress: () => router.push({
                pathname: '/onboarding',
                params: { mode: 'create' },
              }),
            },
          ] : []),
          {
            label: 'Try Again',
            loading: retrying,
            disabled: signingOut,
            variant: isError ? 'primary' as const : 'secondary' as const,
            onPress: () => {
              void handleRetry();
            },
          },
          {
            label: 'Sign Out',
            loading: signingOut,
            disabled: retrying,
            variant: 'secondary' as const,
            onPress: () => {
              void handleSignOut();
            },
          },
        ]}
      />
    </>
  );
}
