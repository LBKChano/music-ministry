import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '@/lib/supabase/client';

type Session = any;

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
  const splashHidden = useRef(false);
  const initializedRef = useRef(false);

  const hideSplash = () => {
    if (!splashHidden.current) {
      splashHidden.current = true;
      console.log('[AuthContext] hiding splash screen');
      SplashScreen.hideAsync().catch((err) => {
        console.warn('[AuthContext] SplashScreen.hideAsync error (ignored):', err);
      });
    }
  };

  useEffect(() => {
    let mounted = true;
    let subscription: any = null;

    // Safety timeout: if INITIAL_SESSION never fires within 5s (network issue,
    // cold start delay, Supabase misconfiguration), force initialized=true so
    // the app doesn't hang forever on a black screen.
    const timeout = setTimeout(() => {
      if (mounted && !initializedRef.current) {
        console.warn('[AuthContext] INITIAL_SESSION timeout — forcing initialized=true');
        setInitialized(true);
        hideSplash();
      }
    }, 5000);

    try {
      const { data } = supabase.auth.onAuthStateChange((event: string, newSession: Session | null) => {
        if (!mounted) return;

        console.log('[AuthContext] onAuthStateChange:', event, newSession ? `user=${newSession.user?.id}` : 'no session');

        if (event === 'SIGNED_OUT') {
          console.log('[AuthContext] SIGNED_OUT — clearing session');
          setSession(null);
        } else {
          setSession(newSession ?? null);
        }

        // INITIAL_SESSION fires exactly once after storage is fully hydrated.
        if (event === 'INITIAL_SESSION') {
          console.log('[AuthContext] INITIAL_SESSION received — marking initialized');
          initializedRef.current = true;
          clearTimeout(timeout);
          setInitialized(true);
          hideSplash();
        }
      });

      subscription = data?.subscription;
    } catch (err) {
      console.error('[AuthContext] Error setting up auth listener:', err);
      if (mounted) {
        clearTimeout(timeout);
        setSession(null);
        setInitialized(true);
        hideSplash();
      }
    }

    return () => {
      mounted = false;
      clearTimeout(timeout);
      try {
        subscription?.unsubscribe();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  const signOut = async () => {
    console.log('[AuthContext] signOut called');
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[AuthContext] signOut error:', err);
    }
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
