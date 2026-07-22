import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LandingPage } from '@/components/LandingPage';
import { Dashboard } from '@/components/Dashboard';
import { Toaster } from '@/components/ui/sonner';

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

function AppContent() {
  const { mode, loading } = useAuth();
  const path = window.location.pathname;

  if (path === '/privacy') return <PrivacyPage />;
  if (path === '/terms') return <TermsPage />;

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img src="/notie-mark.png" alt="Notie" className="h-16 w-16 rounded-full bg-sand object-contain ring-1 ring-border" />
          <p className="font-display text-lg text-muted-foreground">Opening your shelf…</p>
        </div>
      </div>
    );
  }

  if (!mode) return <LandingPage />;
  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster />
    </AuthProvider>
  );
}
