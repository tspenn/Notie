import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { fetchNotieTiers, startNotieCheckout, type NotieBillingCycle } from '@/lib/checkout';
import { Button } from '@/components/ui/button';
import { AuthModal } from '@/components/AuthModal';
import { NotieMark } from '@/components/NotieMark';

type PlanKey = 'one_device' | 'cloud_sync';

interface LandingPageProps {
  onSeePlans?: () => void;
}

export function LandingPage({ onSeePlans }: LandingPageProps) {
  const { startLocal, mode } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [syncCycle, setSyncCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [tierIds, setTierIds] = useState<Partial<Record<PlanKey, string>>>({});
  const [pendingCheckout, setPendingCheckout] = useState<{
    plan: PlanKey;
    cycle: NotieBillingCycle;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchNotieTiers()
      .then((tiers) => {
        const map: Partial<Record<PlanKey, string>> = {};
        for (const t of tiers) {
          const key = (t.features?.key as PlanKey | undefined) ?? undefined;
          if (key === 'one_device' || t.name === 'One Device') map.one_device = t.id;
          if (key === 'cloud_sync' || t.name === 'Cloud Sync') map.cloud_sync = t.id;
        }
        setTierIds(map);
      })
      .catch(() => {
        /* tiers optional until cloud configured */
      });
  }, []);

  useEffect(() => {
    if (!mode || mode !== 'cloud' || !pendingCheckout) return;
    const run = async () => {
      const tierId = tierIds[pendingCheckout.plan];
      if (!tierId) {
        toast.error('Plan not found. Try again in a moment.');
        setPendingCheckout(null);
        return;
      }
      setBusy(true);
      try {
        await startNotieCheckout({
          tierId,
          billingCycle: pendingCheckout.cycle,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Checkout failed');
        setBusy(false);
        setPendingCheckout(null);
      }
    };
    void run();
  }, [mode, pendingCheckout, tierIds]);

  const beginCheckout = (plan: PlanKey, cycle: NotieBillingCycle) => {
    onSeePlans?.();
    if (mode === 'cloud') {
      setPendingCheckout({ plan, cycle });
      return;
    }
    setPendingCheckout({ plan, cycle });
    setAuthMode('signup');
    setAuthOpen(true);
  };

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(61,107,99,0.12),_transparent_55%)]" />

      {/* Top of landing — free online trial */}
      <div className="relative border-b border-moss/20 bg-moss/10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 px-5 py-3 text-center sm:flex-row sm:justify-between sm:px-8 sm:text-left">
          <p className="font-display text-sm font-medium text-foreground sm:text-base">
            Try Notie free for 30 days — online, no download.
          </p>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Then choose Download or Sync.
          </p>
        </div>
      </div>

      <header className="relative mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-2">
          <NotieMark size="md" alt="Notie" className="shadow-sm" />
          <span className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Notie
          </span>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            setAuthMode('signin');
            setAuthOpen(true);
          }}
        >
          Sign in
        </Button>
      </header>

      <main className="relative mx-auto flex max-w-5xl flex-col px-5 pb-20 pt-8 sm:px-8 sm:pt-14">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div className="animate-page-turn">
            <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Notie
            </h1>
            <p className="mt-5 max-w-md font-body text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Not just for notes!
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => startLocal()} disabled={busy}>
                Try free for 30 days
              </Button>
              <Button
                size="lg"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                See plans
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Free online trial on one device. No download required. After 30 days, pick Download
              ($9.99) or Sync.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              All your writing in the same place. Notes, Lists, Ideas, Plans, Study
              Notes, Research, Novels. Organized. Sorted. Sharable.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-sm animate-shelf-in">
            <div className="absolute -inset-6 rounded-[2rem] bg-moss/10 blur-2xl" />
            <img
              src="/notie-icon.jpg"
              alt="Notie pencil mascot"
              className="relative mx-auto w-full max-w-xs rounded-3xl object-cover shadow-lg ring-1 ring-border"
            />
          </div>
        </section>

        <section id="pricing" className="mt-20 scroll-mt-8">
          <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
            After your free trial
          </h2>
          <p className="mt-2 max-w-lg text-muted-foreground">
            Try online for 30 days — then choose Download for one device, or Sync across all of
            yours.
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <article className="rounded-2xl border border-border bg-card/80 p-6 shadow-sm">
              <h3 className="font-display text-xl font-semibold">Download</h3>
              <p className="mt-3 font-display text-3xl font-semibold text-moss">
                $9.99
                <span className="ml-1 text-base font-normal text-muted-foreground">one-time</span>
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Local on one device. No multi-device sync.
              </p>
              <Button
                className="mt-6 w-full"
                variant="outline"
                disabled={busy}
                onClick={() => beginCheckout('one_device', 'one_time')}
              >
                {busy && pendingCheckout?.plan === 'one_device' ? 'Redirecting…' : 'Buy Download'}
              </Button>
              <button
                type="button"
                className="mt-3 w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => startLocal()}
              >
                or start your free 30-day trial
              </button>
            </article>

            <article className="rounded-2xl border border-border bg-card/80 p-6 shadow-sm">
              <h3 className="font-display text-xl font-semibold">Sync</h3>
              <p className="mt-3 font-display text-3xl font-semibold text-moss">
                {syncCycle === 'monthly' ? '$3.99' : '$39.99'}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  {syncCycle === 'monthly' ? '/month' : '/year'}
                </span>
              </p>
              <div className="mt-3 inline-flex rounded-md border border-border bg-background p-0.5 text-xs">
                <button
                  type="button"
                  className={`rounded px-2.5 py-1 ${syncCycle === 'monthly' ? 'bg-moss text-primary-foreground' : 'text-muted-foreground'}`}
                  onClick={() => setSyncCycle('monthly')}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={`rounded px-2.5 py-1 ${syncCycle === 'yearly' ? 'bg-moss text-primary-foreground' : 'text-muted-foreground'}`}
                  onClick={() => setSyncCycle('yearly')}
                >
                  Annual
                </button>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Keep every notebook with you across devices.
              </p>
              <Button
                className="mt-6 w-full"
                disabled={busy}
                onClick={() => beginCheckout('cloud_sync', syncCycle)}
              >
                {busy && pendingCheckout?.plan === 'cloud_sync' ? 'Redirecting…' : 'Start Sync'}
              </Button>
            </article>
          </div>
        </section>

        <footer className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>
            <a href="https://my-notie.com" className="hover:text-foreground">
              my-notie.com
            </a>
            {' · '}
            <a href="/privacy" className="hover:text-foreground">
              Privacy
            </a>
            {' · '}
            <a href="/terms" className="hover:text-foreground">
              Terms
            </a>
          </p>
        </footer>
      </main>

      <AuthModal
        open={authOpen}
        onClose={() => {
          setAuthOpen(false);
          if (!mode) setPendingCheckout(null);
        }}
        initialMode={authMode}
      />
    </div>
  );
}
