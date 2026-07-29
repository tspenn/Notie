import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { fetchNotieTiers, startNotieCheckout, type NotieBillingCycle } from '@/lib/checkout';
import { localDb } from '@/lib/localDb';
import { AuthModal } from '@/components/AuthModal';
import { NotieMark } from '@/components/NotieMark';
import { Button } from '@/components/ui/button';

type PaidPlan = 'one_device' | 'cloud_sync';

/**
 * Blocks the app when the free trial has ended until the writer picks Download or Sync.
 */
export function TrialExpiredGate({ children }: { children: React.ReactNode }) {
  const { mode, plan, refreshPlan } = useAuth();
  const expired = plan === 'trial' && localDb.isTrialExpired();
  const [tierIds, setTierIds] = useState<Partial<Record<PaidPlan, string>>>({});
  const [syncCycle, setSyncCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [pending, setPending] = useState<{ plan: PaidPlan; cycle: NotieBillingCycle } | null>(
    null,
  );

  useEffect(() => {
    if (!expired) return;
    fetchNotieTiers()
      .then((tiers) => {
        const map: Partial<Record<PaidPlan, string>> = {};
        for (const t of tiers) {
          const key = t.features?.key as PaidPlan | undefined;
          if (key === 'one_device' || t.name === 'One Device') map.one_device = t.id;
          if (key === 'cloud_sync' || t.name === 'Cloud Sync') map.cloud_sync = t.id;
        }
        setTierIds(map);
      })
      .catch(() => undefined);
  }, [expired]);

  useEffect(() => {
    if (!pending || mode !== 'cloud') return;
    const tierId = tierIds[pending.plan];
    if (!tierId) {
      toast.error('Plan not found. Try again in a moment.');
      setPending(null);
      return;
    }
    setBusy(true);
    void startNotieCheckout({ tierId, billingCycle: pending.cycle })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Checkout failed');
        setBusy(false);
        setPending(null);
      });
  }, [mode, pending, tierIds]);

  if (!expired) return <>{children}</>;

  const begin = (paid: PaidPlan, cycle: NotieBillingCycle) => {
    if (mode === 'cloud') {
      setPending({ plan: paid, cycle });
      return;
    }
    setPending({ plan: paid, cycle });
    setAuthOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 px-5 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
        <div className="flex items-center gap-3">
          <NotieMark size="md" alt="Notie" />
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">
              Your free trial has ended
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Do you want to use only one device, or access your writing across devices?
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <article className="rounded-xl border border-border bg-background/70 p-4">
            <h2 className="font-display text-lg font-semibold">Download</h2>
            <p className="mt-1 font-display text-2xl font-semibold text-moss">
              $9.99
              <span className="ml-1 text-sm font-normal text-muted-foreground">one-time</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              One device forever. You can upgrade to Sync later.
            </p>
            <Button
              className="mt-4 w-full"
              variant="outline"
              disabled={busy}
              onClick={() => begin('one_device', 'one_time')}
            >
              {busy && pending?.plan === 'one_device' ? 'Redirecting…' : 'Buy Download'}
            </Button>
          </article>

          <article className="rounded-xl border border-border bg-background/70 p-4">
            <h2 className="font-display text-lg font-semibold">Sync</h2>
            <p className="mt-1 font-display text-2xl font-semibold text-moss">
              {syncCycle === 'monthly' ? '$3.99' : '$39.99'}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {syncCycle === 'monthly' ? '/month' : '/year'}
              </span>
            </p>
            <div className="mt-2 inline-flex rounded-md border border-border bg-card p-0.5 text-[11px]">
              <button
                type="button"
                className={`rounded px-2 py-0.5 ${syncCycle === 'monthly' ? 'bg-moss text-primary-foreground' : 'text-muted-foreground'}`}
                onClick={() => setSyncCycle('monthly')}
              >
                Monthly
              </button>
              <button
                type="button"
                className={`rounded px-2 py-0.5 ${syncCycle === 'yearly' ? 'bg-moss text-primary-foreground' : 'text-muted-foreground'}`}
                onClick={() => setSyncCycle('yearly')}
              >
                Annual
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Notebooks on every device you use.</p>
            <Button
              className="mt-4 w-full"
              disabled={busy}
              onClick={() => begin('cloud_sync', syncCycle)}
            >
              {busy && pending?.plan === 'cloud_sync' ? 'Redirecting…' : 'Start Sync'}
            </Button>
          </article>
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Your writing stays on this device until you choose. Nothing is deleted.
        </p>
        {mode === 'cloud' && (
          <button
            type="button"
            className="mt-3 w-full text-center text-xs text-moss underline-offset-2 hover:underline"
            onClick={() => void refreshPlan()}
          >
            Already paid? Refresh plan
          </button>
        )}
      </div>

      <AuthModal
        open={authOpen}
        onClose={() => {
          setAuthOpen(false);
          setPending(null);
        }}
        initialMode="signup"
      />
    </div>
  );
}
