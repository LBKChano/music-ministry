import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '@/lib/supabase/client';
import type { Session } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  initialized: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  initialized: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  // Guard so SplashScreen.hideAsync() is called exactly once
  const splashHidden = useRef(false);

  useEffect(() => {
    let mounted = true;

    // Subscribe FIRST — the INITIAL_SESSION event fires after the Supabase client
    // has fully hydrated from AsyncStorage/SecureStore. This is the only correct
    // pattern for Supabase v2 + React Native: do NOT call getSession() in parallel
    // as it races with storage hydration and can return null before the persisted
    // session is read.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      console.log('[AuthContext] onAuthStateChange:', event, newSession ? `user=${newSession.user.id}` : 'no session');

      setSession(newSession);

      // INITIAL_SESSION fires exactly once after storage is fully hydrated.
      // This is the authoritative signal that auth state is known.
      if (event === 'INITIAL_SESSION') {
        console.log('[AuthContext] INITIAL_SESSION received — marking initialized');
        setInitialized(true);
        if (!splashHidden.current) {
          splashHidden.current = true;
          console.log('[AuthContext] auth initialized — hiding splash screen');
          SplashScreen.hideAsync().catch((err) => {
            console.warn('[AuthContext] SplashScreen.hideAsync error (ignored):', err);
          });
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log('[AuthContext] signOut called');
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, initialized, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
