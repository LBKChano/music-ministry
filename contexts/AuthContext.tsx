import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

interface AuthContextType {
  session: Session | null;
  initialized: boolean;
  initializationError: string | null;
  retryInitialization: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  initialized: false,
  initializationError: null,
  retryInitialization: async () => {},
  signOut: async () => {},
  deleteAccount: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const splashHidden = useRef(false);
  const mountedRef = useRef(false);
  const authEventRevisionRef = useRef(0);
  const activeAccountIdRef = useRef<string | null>(null);

  const replaceSession = useCallback((newSession: Session | null) => {
    const nextAccountId = newSession?.user?.id ?? null;

    if (activeAccountIdRef.current !== nextAccountId) {
      void queryClient.cancelQueries();
      queryClient.clear();
      activeAccountIdRef.current = nextAccountId;
    }

    setSession(newSession);
  }, [queryClient]);

  const hideSplash = useCallback(() => {
    if (!splashHidden.current) {
      splashHidden.current = true;
      console.log('[AuthContext] hiding splash screen');
      try {
        SplashScreen.hideAsync().catch((err) => {
          console.warn('[AuthContext] SplashScreen.hideAsync error (ignored):', err);
        });
      } catch (err) {
        console.warn('[AuthContext] SplashScreen.hideAsync threw (ignored):', err);
      }
    }
  }, []);

  const initializeAuth = useCallback(async () => {
    const startingRevision = authEventRevisionRef.current;
    setInitializationError(null);
    setInitialized(false);

    try {
      const { data, error } = await supabase.auth.getSession();
      if (!mountedRef.current) return;

      if (error) {
        setInitializationError(error.message);
        setInitialized(true);
        hideSplash();
        return;
      }

      if (authEventRevisionRef.current === startingRevision) {
        replaceSession(data.session ?? null);
      }
      setInitialized(true);
      hideSplash();
    } catch (error) {
      if (!mountedRef.current) return;
      const message = error instanceof Error
        ? error.message
        : 'Unable to restore your session.';
      console.error('[AuthContext] Session initialization failed:', error);
      setInitializationError(message);
      setInitialized(true);
      hideSplash();
    }
  }, [hideSplash, replaceSession]);

  useEffect(() => {
    mountedRef.current = true;
    let subscription: { unsubscribe: () => void } | null = null;

    try {
      const { data } = supabase.auth.onAuthStateChange((event: string, newSession: Session | null) => {
        if (!mountedRef.current) return;

        console.log('[AuthContext] onAuthStateChange:', event, newSession ? `user=${newSession.user?.id}` : 'no session');
        authEventRevisionRef.current += 1;
        setInitializationError(null);

        if (event === 'SIGNED_OUT') {
          console.log('[AuthContext] SIGNED_OUT — clearing session');
          replaceSession(null);
        } else if (event === 'TOKEN_REFRESHED') {
          // Silently update the session token without triggering navigation side-effects.
          // On iOS, closing and reopening the app fires TOKEN_REFRESHED (not SIGNED_IN),
          // so treating it like a new sign-in would incorrectly redirect to onboarding.
          console.log('[AuthContext] TOKEN_REFRESHED — updating session silently');
          replaceSession(newSession ?? null);
        } else {
          replaceSession(newSession ?? null);
        }

        setInitialized(true);
        hideSplash();
      });

      subscription = data?.subscription ?? null;
    } catch (err) {
      console.error('[AuthContext] Error setting up auth listener:', err);
      setInitializationError(
        err instanceof Error ? err.message : 'Unable to monitor your session.',
      );
    }

    void initializeAuth();

    return () => {
      mountedRef.current = false;
      try {
        subscription?.unsubscribe();
      } catch (e) {
        // ignore cleanup errors
      }
    };
  }, [hideSplash, initializeAuth, replaceSession]);

  const signOut = async () => {
    console.log('[AuthContext] signOut called');
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[AuthContext] signOut error:', err);
    }
  };

  const deleteAccount = async () => {
    console.log('[AuthContext] deleteAccount called');
    const { data, error } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
    });

    if (error) {
      console.error('[AuthContext] deleteAccount function error:', error);
      throw error;
    }

    const response = data as { error?: string } | null;
    if (response?.error) {
      throw new Error(response.error);
    }

    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AuthContext] signOut after deleteAccount failed:', err);
    } finally {
      replaceSession(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        initialized,
        initializationError,
        retryInitialization: initializeAuth,
        signOut,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
