import { useEffect, useState } from 'react';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup' | 'forgot';
}

export function AuthModal({ open, onClose, initialMode = 'signin' }: AuthModalProps) {
  const { signIn, signUp, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checkEmailFor, setCheckEmailFor] = useState<string | null>(null);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCheckEmailFor(null);
      setResetSentTo(null);
      setBusy(false);
      setShowPassword(false);
      return;
    }
    setMode(initialMode);
  }, [open, initialMode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'forgot') {
        await requestPasswordReset(email.trim());
        setResetSentTo(email.trim());
        toast.message('Check your email for a reset link.');
      } else if (mode === 'signin') {
        await signIn(email.trim(), password);
        toast.success('Welcome back');
        onClose();
      } else {
        const result = await signUp(email.trim(), password, displayName.trim() || undefined);
        if (result.requiresConfirmation) {
          setCheckEmailFor(email.trim());
        } else {
          toast.success('Welcome to Notie');
          onClose();
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      if (msg === '__existing__') {
        toast.error('An account with that email already exists. Try signing in.');
        setMode('signin');
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === 'forgot'
      ? 'Reset password'
      : mode === 'signin'
        ? 'Sign in'
        : 'Create your account';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {resetSentTo ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display">
                <Mail className="h-5 w-5 text-moss" />
                Check your email
              </DialogTitle>
              <DialogDescription className="text-left leading-relaxed">
                If an account exists for{' '}
                <span className="font-medium text-foreground">{resetSentTo}</span>, we sent a
                password reset link. Open it on this device, then choose a new password.
              </DialogDescription>
            </DialogHeader>
            <Button
              className="w-full"
              onClick={() => {
                setResetSentTo(null);
                setMode('signin');
              }}
            >
              Back to sign in
            </Button>
          </>
        ) : checkEmailFor ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display">
                <Mail className="h-5 w-5 text-moss" />
                Please check your email
              </DialogTitle>
              <DialogDescription className="text-left leading-relaxed">
                We sent a confirmation link to{' '}
                <span className="font-medium text-foreground">{checkEmailFor}</span>. Open that
                email and confirm — then come back here and sign in to Notie.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              The link should open <span className="font-medium text-foreground">my-notie.com</span>
              . If it opens another app, close that tab and sign in at my-notie.com after confirming.
            </p>
            <Button
              className="w-full"
              onClick={() => {
                setCheckEmailFor(null);
                setMode('signin');
              }}
            >
              Got it — I’ll sign in next
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {mode === 'forgot'
                  ? 'We’ll email you a link to choose a new password.'
                  : mode === 'signup'
                    ? 'Create a free account to start your 30-day trial — Sync across devices included.'
                    : 'Sign in to open your library on this device.'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={submit} className="mt-2 space-y-4">
              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Display name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              {mode !== 'forgot' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="password">Password</Label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        className="text-xs font-medium text-moss underline-offset-2 hover:underline"
                        onClick={() => setMode('forgot')}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
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
              )}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy
                  ? 'Please wait…'
                  : mode === 'forgot'
                    ? 'Send reset link'
                    : mode === 'signin'
                      ? 'Sign in'
                      : 'Create account'}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              {mode === 'forgot' ? (
                <>
                  Remembered it?{' '}
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => setMode('signin')}
                  >
                    Sign in
                  </button>
                </>
              ) : mode === 'signin' ? (
                <>
                  New here?{' '}
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => setMode('signup')}
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already writing?{' '}
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => setMode('signin')}
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
