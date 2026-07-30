import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCoordinator } from '@/lib/query/refresh-coordinator';

const DEFAULT_REFRESH_ERROR =
  'Some information could not be refreshed. Pull down to try again.';

export function useRefreshController(scopeKey: string | null = null) {
  const coordinatorRef = useRef(new RefreshCoordinator());
  const mountedRef = useRef(true);
  const scopeKeyRef = useRef(scopeKey);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  scopeKeyRef.current = scopeKey;

  useEffect(() => {
    setRefreshing(false);
    setRefreshError(null);
  }, [scopeKey]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runRefresh = useCallback((task: () => Promise<void>) => (
    coordinatorRef.current.run(`screen:${scopeKeyRef.current ?? 'default'}`, async () => {
      const refreshScopeKey = scopeKeyRef.current;
      setRefreshing(true);
      setRefreshError(null);

      try {
        await task();
      } catch (error) {
        console.error('[Refresh] Background refresh failed:', error);
        if (mountedRef.current && scopeKeyRef.current === refreshScopeKey) {
          setRefreshError(
            error instanceof Error && error.message
              ? error.message
              : DEFAULT_REFRESH_ERROR,
          );
        }
      } finally {
        if (mountedRef.current && scopeKeyRef.current === refreshScopeKey) {
          setRefreshing(false);
        }
      }
    })
  ), []);

  return {
    refreshing,
    refreshError,
    runRefresh,
  };
}
