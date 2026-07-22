/**
 * stripe-checkout-notie — Stripe Checkout for My Notie (app_key = notie).
 *
 * Plans:
 *   - Cloud Sync (subscription): monthly / yearly price IDs on subscription_tiers
 *   - One Device / Download (one-time payment): stripe_price_id_one_time in features
 *     (also stored on stripe_price_id_yearly for convenience)
 */
import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const APP_KEY = 'notie';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, x-app-key',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-06-20',
    });

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const {
      tier_id,
      billing_cycle = 'monthly',
      success_url,
      cancel_url,
    } = body as {
      tier_id?: string;
      billing_cycle?: 'monthly' | 'yearly' | 'one_time';
      success_url?: string;
      cancel_url?: string;
    };

    if (!tier_id) return json({ error: 'tier_id is required' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: tier, error: tierErr } = await admin
      .from('subscription_tiers')
      .select('id, name, app_key, stripe_price_id_monthly, stripe_price_id_yearly, features')
      .eq('id', tier_id)
      .maybeSingle();

    if (tierErr || !tier) return json({ error: 'Invalid tier' }, 400);
    if (tier.app_key !== APP_KEY) {
      return json({ error: 'Tier does not belong to Notie' }, 400);
    }

    const features = (tier.features ?? {}) as Record<string, unknown>;
    const isOneTime =
      billing_cycle === 'one_time' ||
      features.mode === 'payment' ||
      features.key === 'one_device' ||
      tier.name === 'One Device';

    let priceId: string | null = null;
    let mode: 'subscription' | 'payment' = 'subscription';

    if (isOneTime) {
      mode = 'payment';
      priceId =
        (typeof features.stripe_price_id_one_time === 'string'
          ? features.stripe_price_id_one_time
          : null) ||
        tier.stripe_price_id_yearly?.trim() ||
        null;
    } else {
      priceId =
        billing_cycle === 'yearly'
          ? tier.stripe_price_id_yearly?.trim() || null
          : tier.stripe_price_id_monthly?.trim() || null;
    }

    if (!priceId) {
      return json(
        { error: `No Stripe price configured for Notie ${tier.name} (${billing_cycle})` },
        400,
      );
    }

    const { data: existingSub } = await admin
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .eq('app_key', APP_KEY)
      .maybeSingle();

    let customerId = existingSub?.stripe_customer_id as string | null | undefined;
    if (customerId) {
      try {
        const existing = await stripe.customers.retrieve(customerId);
        if ((existing as { deleted?: boolean }).deleted) customerId = null;
      } catch {
        customerId = null;
      }
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { supabase_user_id: user.id, app_key: APP_KEY },
      });
      customerId = customer.id;
      // Persist customer id if a subscription row already exists; webhook creates/updates the rest.
      if (existingSub) {
        await admin
          .from('user_subscriptions')
          .update({
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('app_key', APP_KEY);
      }
    }

    const origin = req.headers.get('origin') || 'https://my-notie.com';
    const meta: Record<string, string> = {
      user_id: user.id,
      tier_id: tier.id,
      tier_name: tier.name,
      billing_cycle: isOneTime ? 'one_time' : billing_cycle,
      app_key: APP_KEY,
    };

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      client_reference_id: user.id,
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: success_url || `${origin}/?checkout=success`,
      cancel_url: cancel_url || `${origin}/?checkout=cancelled`,
      allow_promotion_codes: true,
      metadata: meta,
    };

    if (mode === 'subscription') {
      sessionParams.subscription_data = { metadata: meta };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return json({ url: session.url, session_id: session.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[stripe-checkout-notie]', msg);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
