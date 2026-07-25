import { CURRENT_TIER, tierMeetsRequirement } from '../constants/tiers';

// TODO(RevenueCat): once subscriptions are live, replace `CURRENT_TIER` here with
// the customer's real entitlement (e.g. from `Purchases.getCustomerInfo()`), ideally
// lifted into context so it updates live after a purchase. Every tier gate in the
// app calls this hook rather than reading src/constants/tiers.js directly, so this
// is the only file that needs to change.
export default function useEntitlement() {
  const tier = CURRENT_TIER;

  const hasAccess = (requiredTier) => tierMeetsRequirement(tier, requiredTier);

  return { tier, hasAccess };
}
