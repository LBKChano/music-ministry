import React, { createContext, useContext, useEffect, useState } from 'react';
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

  useEffect(() => {
    // Get initial session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[AuthContext] getSession:', session ? `user=${session.user.id}` : 'no session');
      setSession(session);
      setInitialized(true);
    });

    // Then listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[AuthContext] onAuthStateChange:', _event, session ? `user=${session.user.id}` : 'no session');
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, initialized }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
