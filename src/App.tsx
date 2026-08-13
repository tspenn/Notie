import { useEffect } from 'react';
import { toast } from 'sonner';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LandingPage } from '@/components/LandingPage';
import { Dashboard } from '@/components/Dashboard';
import { TrialExpiredGate } from '@/components/TrialExpiredGate';
import { NotieMark } from '@/components/NotieMark';
import { Toaster } from '@/components/ui/sonner';
import { applyCheckoutSuccess } from '@/lib/plan';

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 font-body text-foreground">
      <a href="/" className="text-sm text-moss hover:underline">
        ← Notie
      </a>
      <h1 className="mt-6 font-display text-3xl font-semibold">Privacy</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        Notie stores your writing on your device for the One Device plan, and in your private
        cloud account for Cloud Sync. We do not sell your notebooks. Contact:{' '}
        <a href="mailto:hello@my-notie.com" className="text-foreground underline-offset-2 hover:underline">
          hello@my-notie.com
        </a>
        .
      </p>
    </div>
  );
}

function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 font-body text-foreground">
      <a href="/" className="text-sm text-moss hover:underline">
        ← Notie
      </a>
      <h1 className="mt-6 font-display text-3xl font-semibold">Terms</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        Notie is a writing tool for personal use. You own your words. Plans and billing are
        described at{' '}
        <a href="https://my-notie.com" className="text-foreground underline-offset-2 hover:underline">
          my-notie.com
        </a>
        .
      </p>
    </div>
  );
}

function CheckoutReturnHandler() {
  const { user, mode, refreshPlan, syncNow } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (!checkout) return;

    const clearParam = () => {
      params.delete('checkout');
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', next);
    };

    if (checkout === 'cancelled') {
      toast.message('Checkout cancelled — your trial or plan is unchanged.');
      clearParam();
      return;
    }

    if (checkout === 'success') {
      void (async () => {
        if (mode === 'cloud' && user) {
          const plan = await applyCheckoutSuccess(user.id);
          await refreshPlan();
          if (plan === 'cloud_sync') {
            await syncNow();
            toast.success('Sync is active — your library can follow you across devices.');
          } else if (plan === 'one_device') {
            toast.success('Download unlocked — your writing stays on this device.');
          } else {
            toast.message('Payment received. If your plan does not update in a moment, tap Refresh plan in Settings.');
          }
        } else {
          toast.success('Payment received. Sign in to activate your plan on this device.');
        }
        clearParam();
      })();
    }
  }, [mode, user, refreshPlan, syncNow]);

  return null;
}

function AuthConfirmPage() {
  const { mode, loading } = useAuth();

  useEffect(() => {
    // Supabase puts tokens in the URL hash; detectSessionInUrl picks them up.
    // After a moment, land on the app root (Notie), not Friday Canvas.
    const t = window.setTimeout(() => {
      if (window.location.pathname === '/auth/confirm') {
        window.history.replaceState({}, '', '/');
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loading && mode) {
      toast.success('Email confirmed — welcome to Notie');
    }
  }, [loading, mode]);

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <NotieMark size="lg" alt="Notie" />
        <p className="font-display text-xl text-foreground">Confirming your Notie account…</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Hang on a second. If nothing happens, open{' '}
          <a href="https://my-notie.com" className="text-moss underline">
            my-notie.com
          </a>{' '}
          and sign in.
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  const { mode, loading } = useAuth();
  const path = window.location.pathname;

  if (path === '/privacy') return <PrivacyPage />;
  if (path === '/terms') return <TermsPage />;
  if (path === '/auth/confirm') return <AuthConfirmPage />;

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <NotieMark size="lg" alt="Notie" />
          <p className="font-display text-lg text-muted-foreground">Opening your shelf…</p>
        </div>
      </div>
    );
  }

  if (!mode) return <LandingPage />;

  return (
    <TrialExpiredGate>
      <Dashboard />
    </TrialExpiredGate>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CheckoutReturnHandler />
      <AppContent />
      <Toaster />
    </AuthProvider>
  );
}
