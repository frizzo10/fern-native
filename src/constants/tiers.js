// Subscription tiers. Mirrors the web app's Free / Pro / Pro Max plan structure.
export const TIERS = {
  FREE: 'free',
  PRO: 'pro',
  PRO_MAX: 'pro_max',
};

const TIER_RANK = {
  [TIERS.FREE]: 0,
  [TIERS.PRO]: 1,
  [TIERS.PRO_MAX]: 2,
};

export function tierMeetsRequirement(tier, required) {
  if (!required) return true;
  return (TIER_RANK[tier] ?? 0) >= (TIER_RANK[required] ?? 0);
}
