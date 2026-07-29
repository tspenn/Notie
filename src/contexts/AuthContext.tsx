import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { adoptLocalLibrary, syncLibrary } from '@/lib/cloudSync';
import { localDb } from '@/lib/localDb';
import { canCloudSync, resolveEffectivePlan } from '@/lib/plan';
import type { PlanKey, UserProfile } from '@/lib/types';

export type AuthMode = 'cloud' | 'local' | null;

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  mode: AuthMode;
  userId: string | null;
  displayName: string;
  plan: PlanKey;
  trialDaysRemaining: number | null;
  isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<{ requiresConfirmation: boolean }>;
  signOut: () => Promise<void>;
  /** Local / Download session without cloud Sync. */
  startLocal: () => void;
  refreshPlan: () => Promise<PlanKey>;
  syncNow: () => Promise<void>;
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
  const [plan, setPlan] = useState<PlanKey>('trial');
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const recoveryRef = useRef(false);
  const priorLocalIdRef = useRef<string | null>(null);
  const syncingRef = useRef(false);
  const planRef = useRef<PlanKey>('trial');

  const APP_URL = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;

  const refreshPlan = useCallback(async (): Promise<PlanKey> => {
    const local = localDb.getProfile();
    const cloudId = user && !isAnonymousUser(user) ? user.id : null;
    const next = await resolveEffectivePlan({
      cloudUserId: cloudId,
      isAnonymous: Boolean(user && isAnonymousUser(user)),
      localPlan: local?.plan ?? profile?.plan ?? 'trial',
    });
    planRef.current = next;
    setPlan(next);
    setProfile(localDb.getProfile());
    return next;
  }, [user, profile?.plan]);

  const syncNow = useCallback(async () => {
    if (!user || isAnonymousUser(user) || syncingRef.current) return;
    if (!canCloudSync(planRef.current)) return;

    syncingRef.current = true;
    try {
      const prior = priorLocalIdRef.current || localDb.getProfile()?.id;
      if (prior && prior !== user.id) {
        adoptLocalLibrary(prior, user.id);
        priorLocalIdRef.current = null;
      }
      await syncLibrary({ cloudUserId: user.id, plan: planRef.current });
      setProfile(localDb.getProfile());
    } finally {
      syncingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (detectPasswordRecovery()) {
      recoveryRef.current = true;
      setIsPasswordRecovery(true);
    }

    if (!isSupabaseConfigured) {
      if (localDb.hasLocalSession()) {
        const p = localDb.getProfile();
        setProfile(p);
        setMode('local');
        setPlan(p?.plan ?? 'trial');
        planRef.current = p?.plan ?? 'trial';
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

  useEffect(() => {
    if (loading) return;
    void refreshPlan();
  }, [loading, mode, user?.id, refreshPlan]);

  // Open + every 5 min while visible + push on hide/close (trial & Sync only).
  useEffect(() => {
    if (mode !== 'cloud' || !user || isAnonymousUser(user) || !canCloudSync(plan)) return;

    void syncNow();

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void syncNow();
    }, 5 * 60 * 1000);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void syncNow();
    };
    const onPageHide = () => {
      void syncNow();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, user?.id, plan]);

  const signIn = async (email: string, password: string) => {
    const localId = localDb.getProfile()?.id ?? null;
    if (localId) priorLocalIdRef.current = localId;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    const localId = localDb.getProfile()?.id ?? null;
    if (localId) priorLocalIdRef.current = localId;
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
    if (data?.user?.identities?.length === 0) {
      throw new Error('__existing__');
    }
    if (data.user) {
      localDb.ensureProfileForCloudUser(data.user.id, 'trial');
    }
    return { requiresConfirmation: !data.session };
  };

  const signOut = async () => {
    if (canCloudSync(planRef.current) && user && !isAnonymousUser(user)) {
      try {
        await syncNow();
      } catch {
        /* best-effort flush */
      }
    }
    if (mode === 'cloud') {
      await supabase.auth.signOut();
    } else {
      localDb.signOutLocal();
    }
    setUser(null);
    setProfile(null);
    setMode(null);
    setPlan('trial');
    planRef.current = 'trial';
  };

  const startLocal = () => {
    const local = localDb.startLocalSession();
    // Paid Download path may call this; for unpaid, keep trial clock but no cloud Sync.
    setProfile(local);
    setMode('local');
    setPlan(local.plan);
    planRef.current = local.plan;
  };

  const userId =
    mode === 'cloud' && user && !isAnonymousUser(user)
      ? user.id
      : mode === 'local'
        ? profile?.id ?? null
        : null;

  const displayName =
    (mode === 'cloud'
      ? (user?.user_metadata?.display_name as string | undefined)
      : profile?.displayName) || 'Writer';

  const trialDaysRemaining = plan === 'trial' ? localDb.getTrialDaysRemaining() : null;

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
        trialDaysRemaining,
        isPasswordRecovery,
        signIn,
        signUp,
        signOut,
        startLocal,
        refreshPlan,
        syncNow,
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
