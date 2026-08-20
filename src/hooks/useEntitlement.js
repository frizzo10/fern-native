import { tierMeetsRequirement } from '../constants/tiers';
import { useRevenueCat } from '../services/RevenueCatContext';

// Single choke point every gated feature in the app calls to check the
// customer's plan — backed by RevenueCat (src/services/RevenueCatContext.js).
// Swapping billing providers, changing tier logic, etc. should only ever
// require editing this file plus RevenueCatContext, never the ~15 call sites
// across screens/modals.
export default function useEntitlement() {
  const { tier, loading } = useRevenueCat();

  const hasAccess = (requiredTier) => tierMeetsRequirement(tier, requiredTier);

  return { tier, hasAccess, loading };
}
