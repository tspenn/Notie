import { APP_KEY, isSupabaseConfigured, supabase } from '@/lib/supabase';
import { localDb } from '@/lib/localDb';
import type { PlanKey } from '@/lib/types';

export type ResolvedSubscription = {
  plan: PlanKey;
  status: string | null;
  tierId: string | null;
  billingCycle: string | null;
};

/** Extract a UUID from local prefixed ids (`nb_…`, `user_…`) or return as-is. */
export function toCloudUuid(id: string): string {
  const match = id.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  return match?.[0] ?? id;
}

export function planLabel(plan: PlanKey): string {
  switch (plan) {
    case 'trial':
      return 'Free trial — Sync across devices for 30 days';
    case 'one_device':
      return 'Download — $9.99 one-time (one device)';
    case 'cloud_sync':
      return 'Sync — $3.99/mo or $39.99/year';
    default:
      return plan;
  }
}

/**
 * Multi-device library sync is on for the free trial and paid Sync.
 * Download (one_device) stays on this device only.
 */
export function canCloudSync(plan: PlanKey): boolean {
  return plan === 'trial' || plan === 'cloud_sync';
}

function tierKeyToPlan(key: unknown, tierName: string | null | undefined): PlanKey | null {
  if (key === 'one_device' || tierName === 'One Device') return 'one_device';
  if (key === 'cloud_sync' || tierName === 'Cloud Sync') return 'cloud_sync';
  return null;
}

/** Read active Notie subscription for a signed-in user. */
export async function fetchNotieSubscription(userId: string): Promise<ResolvedSubscription | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('status, tier_id, billing_cycle, plan_name')
    .eq('user_id', userId)
    .eq('app_key', APP_KEY)
    .maybeSingle();

  if (error || !data) return null;

  const status = (data.status as string | null) ?? null;
  const active = status === 'active' || status === 'trialing';
  const planName = data.plan_name as string | null;
  let fromPlan = tierKeyToPlan(planName, planName);

  if (!fromPlan && data.tier_id) {
    const { data: tier } = await supabase
      .from('subscription_tiers')
      .select('name, features')
      .eq('id', data.tier_id as string)
      .maybeSingle();
    fromPlan = tierKeyToPlan(
      (tier?.features as Record<string, unknown> | null)?.key,
      tier?.name ?? null,
    );
  }

  if (!active || !fromPlan) {
    return {
      plan: 'trial',
      status,
      tierId: (data.tier_id as string | null) ?? null,
      billingCycle: (data.billing_cycle as string | null) ?? null,
    };
  }

  return {
    plan: fromPlan,
    status,
    tierId: (data.tier_id as string | null) ?? null,
    billingCycle: (data.billing_cycle as string | null) ?? null,
  };
}

/**
 * Resolve effective plan:
 * - Paid subscription wins when active
 * - Else local profile plan (trial / download)
 * - Unpaid signed-in users stay on trial (clock starts if needed)
 */
export async function resolveEffectivePlan(opts: {
  cloudUserId: string | null;
  isAnonymous: boolean;
  localPlan: PlanKey | null | undefined;
}): Promise<PlanKey> {
  let local = opts.localPlan ?? 'trial';

  if (opts.cloudUserId && !opts.isAnonymous) {
    const sub = await fetchNotieSubscription(opts.cloudUserId);
    if (sub && (sub.status === 'active' || sub.status === 'trialing') && sub.plan !== 'trial') {
      localDb.setPlan(sub.plan);
      return sub.plan;
    }

    // No paid Notie subscription for this cloud user → free trial.
    // Do not keep a stale local "Download" flag — that trapped signed-in trial users.
    // (After real Download checkout, webhook / applyCheckoutSuccess sets one_device.)
    localDb.ensureProfileForCloudUser(opts.cloudUserId, 'trial');
    localDb.setPlan('trial');
    return 'trial';
  }

  if (!opts.localPlan) {
    local = localDb.getProfile()?.plan ?? 'trial';
  }
  return local;
}

/** Apply checkout success: refresh subscription into local plan. */
export async function applyCheckoutSuccess(cloudUserId: string): Promise<PlanKey | null> {
  // Webhook may lag a moment — retry briefly.
  for (let i = 0; i < 5; i++) {
    const sub = await fetchNotieSubscription(cloudUserId);
    if (sub && sub.plan !== 'trial' && (sub.status === 'active' || sub.status === 'trialing')) {
      localDb.setPlan(sub.plan);
      sessionStorage.removeItem('notie_pending_plan');
      return sub.plan;
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  const pending = sessionStorage.getItem('notie_pending_plan');
  if (pending === 'one_device' || pending === 'cloud_sync') {
    localDb.setPlan(pending);
    sessionStorage.removeItem('notie_pending_plan');
    return pending;
  }
  return null;
}
