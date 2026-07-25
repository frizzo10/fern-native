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

// Single source of truth for "what plan is this device on" until RevenueCat is wired in.
// Change this one line to test Free / Pro / Pro Max gating anywhere in the app.
// When RevenueCat is added, replace the constant below with the real entitlement
// check inside `useEntitlement()` (src/hooks/useEntitlement.js) — nothing else in
// the app should need to change, since every gate reads through that hook.
export const CURRENT_TIER = TIERS.FREE;

export function tierMeetsRequirement(tier, required) {
  if (!required) return true;
  return (TIER_RANK[tier] ?? 0) >= (TIER_RANK[required] ?? 0);
}
