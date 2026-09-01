import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, Role } from '@/types';

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;

  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;

  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: string | null }>;

  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  role: null,
  loading: true,

  signIn: async () => ({
    error: 'Auth not configured',
  }),

  signUp: async () => ({
    error: 'Auth not configured',
  }),

  signOut: async () => {},
});

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user profile
  async function loadProfile(userId: string) {
  if (!supabase) {
    setLoading(false);
    return;
  }

  setLoading(true);

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Profile error:', error);
    setProfile(null);
  } else {
    console.log('Loaded profile:', data);
    setProfile(data as Profile);
  }

  setLoading(false);
}

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get existing session
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Session error:', error);
      }

      setSession(data.session);

      if (data.session) {
        loadProfile(data.session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for login/logout
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);

        if (newSession) {
          setLoading(true);

          setTimeout(() => {
            loadProfile(newSession.user.id);
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // LOGIN
  async function signIn(
    email: string,
    password: string
  ) {
    if (!supabase) {
      return {
        error: 'Authentication is not available.',
      };
    }

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    return {
      error: error?.message ?? null,
    };
  }

  // REGISTER
 async function signUp(
  email: string,
  password: string,
  fullName: string
) {
  if (!supabase) {
    return {
      error: 'Authentication is not available.',
    };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    return {
      error: error.message,
    };
  }

  return {
    error: null,
  };
}

  // LOGOUT
  async function signOut() {
    if (supabase) {
      await supabase.auth.signOut();
    }

    setSession(null);
    setProfile(null);
    setLoading(false);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        role: profile?.role ?? null,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}