/**
 * stripe-webhook-notie — Fulfill My Notie Stripe Checkout / subscription events.
 * Upserts user_subscriptions with tier_id for both Sync (subscription) and Download (one-time).
 */
import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const APP_KEY = 'notie';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, stripe-signature',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function log(level: 'INFO' | 'WARN' | 'ERROR', event: string, detail: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, event, ts: new Date().toISOString(), app: APP_KEY, ...detail }));
}

async function activateNotiePlan(opts: {
  userId: string;
  tierId: string;
  billingCycle: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  periodEnd: Date | null;
  status?: string;
}) {
  const { data: tier, error: tierError } = await supabaseAdmin
    .from('subscription_tiers')
    .select('id, name, app_key, features')
    .eq('id', opts.tierId)
    .maybeSingle();

  if (tierError || !tier) {
    log('ERROR', 'activate.tier_missing', { tierId: opts.tierId, error: tierError?.message });
    return;
  }
  if (tier.app_key !== APP_KEY) {
    log('WARN', 'activate.wrong_app', { tierId: opts.tierId, app_key: tier.app_key });
    return;
  }

  const features = (tier.features ?? {}) as Record<string, unknown>;
  const planName =
    features.key === 'one_device' || tier.name === 'One Device'
      ? 'one_device'
      : features.key === 'cloud_sync' || tier.name === 'Cloud Sync'
        ? 'cloud_sync'
        : tier.name;

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(opts.userId);
  const userEmail = authUser.user?.email ?? null;

  const { error } = await supabaseAdmin.from('user_subscriptions').upsert(
    {
      user_id: opts.userId,
      tier_id: opts.tierId,
      app_key: APP_KEY,
      plan_name: planName,
      status: opts.status ?? 'active',
      billing_cycle: opts.billingCycle,
      current_period_start: new Date().toISOString(),
      current_period_end: opts.periodEnd?.toISOString() ?? null,
      trial_ends_at: null,
      stripe_customer_id: opts.stripeCustomerId,
      stripe_subscription_id: opts.stripeSubscriptionId,
      stripe_price_id: opts.stripePriceId,
      user_email: userEmail,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,app_key' },
  );

  if (error) {
    log('ERROR', 'activate.upsert_failed', { userId: opts.userId, error: error.message });
  } else {
    log('INFO', 'activate.ok', { userId: opts.userId, planName, billingCycle: opts.billingCycle });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id || session.client_reference_id || null;
  const tierId = session.metadata?.tier_id || null;
  const billingCycle = session.metadata?.billing_cycle || 'monthly';
  const appKey = session.metadata?.app_key || APP_KEY;

  if (appKey !== APP_KEY) {
    log('INFO', 'checkout.skipped_other_app', { appKey, sessionId: session.id });
    return;
  }
  if (!userId || !tierId) {
    log('WARN', 'checkout.missing_meta', { sessionId: session.id, userId, tierId });
    return;
  }

  if (session.mode === 'subscription' && session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    await activateNotiePlan({
      userId,
      tierId,
      billingCycle,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0]?.price.id ?? null,
      periodEnd: new Date(subscription.current_period_end * 1000),
    });
    return;
  }

  if (session.mode === 'payment' && session.payment_status === 'paid') {
    // Download / One Device — lifetime local plan (no subscription id).
    await activateNotiePlan({
      userId,
      tierId,
      billingCycle: 'one_time',
      stripeCustomerId: (session.customer as string) || '',
      stripeSubscriptionId: null,
      stripePriceId: null,
      periodEnd: null,
    });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const rawBody = new Uint8Array(await req.arrayBuffer());
    const sig = req.headers.get('stripe-signature');
    const webhookSecret =
      Deno.env.get('STRIPE_WEBHOOK_SECRET_NOTIE') ||
      Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret || !sig) {
      log('ERROR', 'missing_signature_or_secret', { hasSig: !!sig, hasSecret: !!webhookSecret });
      return json({ error: 'Missing signature or webhook secret' }, 400);
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log('ERROR', 'signature_verification_failed', { error: message });
      return json({ error: 'Invalid signature' }, 400);
    }

    log('INFO', 'event_received', { type: event.type, id: event.id });

    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason === 'subscription_create') break;
        const stripeSubscriptionId = invoice.subscription as string | null;
        if (!stripeSubscriptionId) break;

        const { data: existingSub } = await supabaseAdmin
          .from('user_subscriptions')
          .select('user_id, tier_id, billing_cycle, stripe_customer_id, stripe_price_id, app_key')
          .eq('stripe_subscription_id', stripeSubscriptionId)
          .maybeSingle();

        if (!existingSub || existingSub.app_key !== APP_KEY || !existingSub.tier_id) break;

        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        await activateNotiePlan({
          userId: existingSub.user_id as string,
          tierId: existingSub.tier_id as string,
          billingCycle: (existingSub.billing_cycle as string) || 'monthly',
          stripeCustomerId: (existingSub.stripe_customer_id as string) || (invoice.customer as string),
          stripeSubscriptionId,
          stripePriceId: (existingSub.stripe_price_id as string) || null,
          periodEnd: new Date(subscription.current_period_end * 1000),
        });
        break;
      }

      case 'customer.subscription.deleted':
      case 'customer.subscription.paused': {
        const subscription = event.data.object as Stripe.Subscription;
        const { data: sub } = await supabaseAdmin
          .from('user_subscriptions')
          .select('user_id, app_key')
          .eq('stripe_subscription_id', subscription.id)
          .maybeSingle();
        if (sub?.app_key !== APP_KEY) break;

        await supabaseAdmin
          .from('user_subscriptions')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscription.id)
          .eq('app_key', APP_KEY);
        log('INFO', 'subscription_cancelled', { subscriptionId: subscription.id });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const appKey = subscription.metadata?.app_key || APP_KEY;
        if (appKey !== APP_KEY) break;
        const tierId = subscription.metadata?.tier_id;
        if (subscription.status === 'active' && tierId) {
          const { data: existingSub } = await supabaseAdmin
            .from('user_subscriptions')
            .select('user_id, stripe_customer_id')
            .eq('stripe_subscription_id', subscription.id)
            .maybeSingle();
          if (existingSub) {
            await activateNotiePlan({
              userId: existingSub.user_id as string,
              tierId,
              billingCycle: subscription.metadata?.billing_cycle || 'monthly',
              stripeCustomerId: (existingSub.stripe_customer_id as string) || (subscription.customer as string),
              stripeSubscriptionId: subscription.id,
              stripePriceId: subscription.items.data[0]?.price.id ?? null,
              periodEnd: new Date(subscription.current_period_end * 1000),
            });
          }
        } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
          await supabaseAdmin
            .from('user_subscriptions')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', subscription.id)
            .eq('app_key', APP_KEY);
        }
        break;
      }

      default:
        log('INFO', 'event_unhandled', { type: event.type });
    }

    return json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('ERROR', 'unhandled_exception', { error: message });
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
