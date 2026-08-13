import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useChurch } from '@/hooks/useChurch';
import { saveLastSelectedChurchId } from '@/lib/church/session-storage';

type CompletedOnboardingTarget = {
  accountId: string;
  churchId: string;
};

const SCHEDULES_ROUTE = '/(tabs)/(home)';

export function useCompletedOnboardingTransition(
  onError: (message: string) => void,
) {
  const router = useRouter();
  const { session } = useAuth();
  const {
    currentChurch,
    refreshChurches,
    sessionStatus,
  } = useChurch();
  const [target, setTarget] = useState<CompletedOnboardingTarget | null>(null);
  const transitionKeyRef = useRef<string | null>(null);

  const beginTransition = useCallback(async (
    completion: CompletedOnboardingTarget,
  ) => {
    await saveLastSelectedChurchId(
      completion.accountId,
      completion.churchId,
    );
    setTarget(completion);
  }, []);

  useEffect(() => {
    if (!target || session?.user.id !== target.accountId) return;

    if (
      sessionStatus === 'ready'
      && currentChurch?.id === target.churchId
    ) {
      setTarget(null);
      router.replace(SCHEDULES_ROUTE);
      return;
    }

    if (
      sessionStatus === 'restoring'
      || sessionStatus === 'signed-out'
      || sessionStatus === 'loading-memberships'
      || sessionStatus === 'selecting-church'
    ) {
      return;
    }

    const transitionKey = `${target.accountId}:${target.churchId}`;
    if (transitionKeyRef.current === transitionKey) return;
    transitionKeyRef.current = transitionKey;

    void refreshChurches(target.churchId).then(result => {
      if (transitionKeyRef.current !== transitionKey) return;

      if (result.status === 'ready') {
        setTarget(null);
        router.replace(SCHEDULES_ROUTE);
        return;
      }

      if (result.status === 'no-membership') {
        setTarget(null);
        onError(
          'Your church was created, but its membership could not be loaded. Try the same action again to reopen it without creating a duplicate.',
        );
        return;
      }

      if (result.status === 'error') {
        setTarget(null);
        onError(result.error);
      }
    }).catch(error => {
      if (transitionKeyRef.current !== transitionKey) return;
      setTarget(null);
      onError(
        error instanceof Error
          ? error.message
          : 'Your church was created, but it could not be opened.',
      );
    }).finally(() => {
      if (transitionKeyRef.current === transitionKey) {
        transitionKeyRef.current = null;
      }
    });
  }, [
    currentChurch?.id,
    onError,
    refreshChurches,
    router,
    session?.user.id,
    sessionStatus,
    target,
  ]);

  return {
    beginTransition,
    transitionPending: target !== null,
  };
}
