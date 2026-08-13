import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
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
  initialMode?: 'signin' | 'signup';
}

export function AuthModal({ open, onClose, initialMode = 'signin' }: AuthModalProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkEmailFor, setCheckEmailFor] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCheckEmailFor(null);
      setBusy(false);
      return;
    }
    setMode(initialMode);
  }, [open, initialMode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        toast.success('Welcome back');
        onClose();
      } else {
        const result = await signUp(email.trim(), password, displayName.trim() || undefined);
        if (result.requiresConfirmation) {
          // Keep the dialog open with a clear message (toast alone is easy to miss).
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {checkEmailFor ? (
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
              <DialogTitle>{mode === 'signin' ? 'Sign in' : 'Create your account'}</DialogTitle>
              <DialogDescription>
                {mode === 'signup'
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
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
              </div>

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              {mode === 'signin' ? (
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
