import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ensureCalendarSession } from '@/lib/calendarFetch';
import { localDb } from '@/lib/localDb';
import type { PlanKey, UserProfile } from '@/lib/types';

export type AuthMode = 'cloud' | 'local' | null;

interface AuthContextType {
  /** Supabase user — set only in 'cloud' mode. */
  user: User | null;
  /** Local-only profile (localDb) — set in 'local' mode, and also used to
   *  remember plan/display-name preferences alongside a cloud account. */
  profile: UserProfile | null;
  loading: boolean;
  /** 'cloud' = signed in with Supabase auth. 'local' = One Device session. null = signed out. */
  mode: AuthMode;
  /** Stable id used to scope localDb rows, regardless of mode. */
  userId: string | null;
  displayName: string;
  plan: PlanKey;
  isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ requiresConfirmation: boolean }>;
  signOut: () => Promise<void>;
  /** Start a local-only ("One Device") session — no Supabase account required. */
  startLocal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isAnonymousUser(user: User): boolean {
  return user.is_anonymous === true;
}

function applySessionUser(sessionUser: User | null): {
  mode: AuthMode;
  user: User | null;
  profile: UserProfile | null;
} {
  if (!sessionUser) {
    if (localDb.hasLocalSession()) {
      return { mode: 'local', user: null, profile: localDb.getProfile() };
    }
    return { mode: null, user: null, profile: null };
  }

  if (isAnonymousUser(sessionUser) && localDb.hasLocalSession()) {
    return { mode: 'local', user: sessionUser, profile: localDb.getProfile() };
  }

  return { mode: 'cloud', user: sessionUser, profile: localDb.getProfile() };
}

function detectPasswordRecovery(): boolean {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const search = new URLSearchParams(window.location.search);
  return hash.get('type') === 'recovery' || search.get('type') === 'recovery';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mode, setMode] = useState<AuthMode>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const recoveryRef = useRef(false);

  const APP_URL = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;

  useEffect(() => {
    if (detectPasswordRecovery()) {
      recoveryRef.current = true;
      setIsPasswordRecovery(true);
    }

    if (!isSupabaseConfigured) {
      // No cloud project configured — fall back to whatever local session exists.
      if (localDb.hasLocalSession()) {
        setProfile(localDb.getProfile());
        setMode('local');
      }
      setLoading(false);
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoveryRef.current = true;
        setIsPasswordRecovery(true);
      }
      const next = applySessionUser(newSession?.user ?? null);
      setUser(next.user);
      setProfile(next.profile);
      setMode(next.mode);
      setLoading(false);
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        const next = applySessionUser(data.session?.user ?? null);
        setUser(next.user);
        setProfile(next.profile);
        setMode(next.mode);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const safety = window.setTimeout(() => setLoading(false), 8000);

    return () => {
      window.clearTimeout(safety);
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${APP_URL}/auth/confirm`,
        data: displayName ? { display_name: displayName } : undefined,
      },
    });
    if (error) {
      if (error.message?.toLowerCase().includes('rate limit') || error.status === 429) {
        throw new Error('Sign-ups are temporarily limited. Please wait a few minutes and try again.');
      }
      throw error;
    }
    // Supabase returns a fake success (no error, no email) for an address that
    // already exists on the shared project.
    if (data?.user?.identities?.length === 0) {
      throw new Error('__existing__');
    }
    return { requiresConfirmation: !data.session };
  };

  const signOut = async () => {
    if (mode === 'cloud') {
      await supabase.auth.signOut();
    } else {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.is_anonymous) {
        await supabase.auth.signOut();
      }
      localDb.signOutLocal();
    }
    setUser(null);
    setProfile(null);
    setMode(null);
  };

  const startLocal = () => {
    const local = localDb.startLocalSession();
    setProfile(local);
    setMode('local');
    if (isSupabaseConfigured) {
      void ensureCalendarSession().then((token) => {
        if (!token) return;
        void supabase.auth.getUser().then(({ data }) => {
          if (data.user?.is_anonymous) setUser(data.user);
        });
      });
    }
  };

  const userId = mode === 'cloud' ? user?.id ?? null : mode === 'local' ? profile?.id ?? null : null;
  const displayName =
    (mode === 'cloud' ? (user?.user_metadata?.display_name as string | undefined) : profile?.displayName) ||
    'Writer';
  const plan: PlanKey =
    mode === 'cloud' && user && !isAnonymousUser(user)
      ? 'cloud_sync'
      : profile?.plan ?? 'one_device';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        mode,
        userId,
        displayName,
        plan,
        isPasswordRecovery,
        signIn,
        signUp,
        signOut,
        startLocal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
