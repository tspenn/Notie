import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LandingPage } from '@/components/LandingPage';
import { Dashboard } from '@/components/Dashboard';
import { TrialExpiredGate } from '@/components/TrialExpiredGate';
import { NotieMark } from '@/components/NotieMark';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

function SetNewPasswordForm() {
  const { updatePassword, clearPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      toast.success('Password updated — you’re signed in');
      window.history.replaceState({}, '', '/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card/80 p-6 shadow-sm"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <NotieMark size="lg" alt="Notie" />
          <h1 className="font-display text-2xl font-semibold text-foreground">Choose a new password</h1>
          <p className="text-sm text-muted-foreground">You’re resetting your Notie account password.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Saving…' : 'Save password'}
        </Button>
        <button
          type="button"
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
          onClick={() => {
            clearPasswordRecovery();
            window.location.href = '/';
          }}
        >
          Cancel
        </button>
      </form>
    </div>
  );
}

function AuthConfirmPage() {
  const { mode, loading, isPasswordRecovery } = useAuth();

  useEffect(() => {
    if (isPasswordRecovery) return;
    const t = window.setTimeout(() => {
      if (window.location.pathname === '/auth/confirm') {
        window.history.replaceState({}, '', '/');
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [isPasswordRecovery]);

  useEffect(() => {
    if (!loading && mode && !isPasswordRecovery) {
      toast.success('Email confirmed — welcome to Notie');
    }
  }, [loading, mode, isPasswordRecovery]);

  if (isPasswordRecovery) return <SetNewPasswordForm />;

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
  const { mode, loading, isPasswordRecovery } = useAuth();
  const path = window.location.pathname;

  if (path === '/privacy') return <PrivacyPage />;
  if (path === '/terms') return <TermsPage />;
  if (path === '/auth/confirm') return <AuthConfirmPage />;
  if (isPasswordRecovery) return <SetNewPasswordForm />;

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
