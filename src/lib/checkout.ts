import { supabase, APP_KEY } from '@/lib/supabase';

export type NotieBillingCycle = 'monthly' | 'yearly' | 'one_time';

/** Start Stripe Checkout via the Notie-specific edge function. */
export async function startNotieCheckout(opts: {
  tierId: string;
  billingCycle: NotieBillingCycle;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Sign in first to checkout.');
  }

  const origin = window.location.origin;
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout-notie`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        'x-app-key': APP_KEY,
      },
      body: JSON.stringify({
        tier_id: opts.tierId,
        billing_cycle: opts.billingCycle,
        app_key: APP_KEY,
        success_url: opts.successUrl ?? `${origin}/?checkout=success`,
        cancel_url: opts.cancelUrl ?? `${origin}/?checkout=cancelled`,
      }),
    },
  );

  const data = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || data.error) {
    throw new Error(data.error || 'Checkout failed');
  }
  if (!data.url) throw new Error('No checkout URL returned.');
  window.location.assign(data.url);
}

export async function fetchNotieTiers(): Promise<
  Array<{
    id: string;
    name: string;
    price_monthly: number;
    price_yearly: number;
    features: Record<string, unknown> | null;
    stripe_price_id_monthly: string | null;
    stripe_price_id_yearly: string | null;
  }>
> {
  const { data, error } = await supabase
    .from('subscription_tiers')
    .select(
      'id, name, price_monthly, price_yearly, features, stripe_price_id_monthly, stripe_price_id_yearly',
    )
    .eq('app_key', APP_KEY);

  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    name: string;
    price_monthly: number;
    price_yearly: number;
    features: Record<string, unknown> | null;
    stripe_price_id_monthly: string | null;
    stripe_price_id_yearly: string | null;
  }>;
}
