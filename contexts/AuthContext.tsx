import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '@/lib/supabase/client';
import type { Session } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  initialized: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  initialized: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  // Guard so SplashScreen.hideAsync() is called exactly once
  const splashHidden = useRef(false);

  useEffect(() => {
    let cancelled = false;

    // Listen for auth state changes FIRST so we never miss an event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.log('[AuthContext] onAuthStateChange:', _event, newSession ? `user=${newSession.user.id}` : 'no session');
      if (cancelled) return;
      setSession(newSession);
      // Mark initialized on the first auth event too (covers the case where
      // onAuthStateChange fires before getSession resolves)
      setInitialized(true);
    });

    // Then get the initial session (resolves from storage)
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (cancelled) return;
      console.log('[AuthContext] getSession:', initialSession ? `user=${initialSession.user.id}` : 'no session');
      setSession(initialSession);
      setInitialized(true);
    }).catch((err) => {
      console.error('[AuthContext] getSession error:', err);
      if (!cancelled) setInitialized(true);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Hide splash screen exactly once after auth is initialized
  useEffect(() => {
    if (initialized && !splashHidden.current) {
      splashHidden.current = true;
      console.log('[AuthContext] auth initialized — hiding splash screen');
      SplashScreen.hideAsync().catch((err) => {
        console.warn('[AuthContext] SplashScreen.hideAsync error (ignored):', err);
      });
    }
  }, [initialized]);

  return (
    <AuthContext.Provider value={{ session, initialized }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
