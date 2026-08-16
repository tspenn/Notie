/** Shared Skyland `profiles.tier` ids for Notie. Customer-facing label stays Free. */

export const NOTIE_APP_KEY = 'notie';

/** profiles.tier written on Notie signup (via handle_new_user + signup_app). */
export const NOTIE_FREE_TIER_ID = 'notie_free';

export const NOTIE_FREE_TIER_LABEL = 'Free';

/** Sister-app free ids — unpaid elsewhere; never overwrite on shared accounts. */
const SISTER_FREE_TIER_IDS = new Set([
  'support',
  'free',
  'sa_free',
  'goshop_free',
  'msa-trial',
  'toc_free',
  'trial-fc',
]);

export function isNotieFreeProfilesTier(tier: string | null | undefined): boolean {
  if (!tier) return true;
  return tier.toLowerCase() === NOTIE_FREE_TIER_ID;
}

export function isUnpaidProfilesTier(tier: string | null | undefined): boolean {
  if (!tier) return true;
  const t = tier.toLowerCase();
  if (t === NOTIE_FREE_TIER_ID) return true;
  if (SISTER_FREE_TIER_IDS.has(t)) return true;
  return t.endsWith('_free') || t.endsWith('-trial') || t.startsWith('trial-');
}

export function profilesTierDisplayName(tier: string | null | undefined): string {
  if (!tier || isUnpaidProfilesTier(tier)) return NOTIE_FREE_TIER_LABEL;
  return tier;
}
