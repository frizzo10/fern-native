import { TIERS, tierMeetsRequirement } from '../constants/tiers';
import { LAUNCH_ALL_FREE } from '../constants/launch';
import { useRevenueCat } from '../services/RevenueCatContext';
import { higherTier, useGrantedTier } from '../services/grantStore';

// Single choke point every gated feature in the app calls to check the
// customer's plan — backed by RevenueCat (src/services/RevenueCatContext.js).
// Swapping billing providers, changing tier logic, etc. should only ever
// require editing this file plus RevenueCatContext, never the ~15 call sites
// across screens/modals.
export default function useEntitlement() {
  const { tier: storeTier, loading } = useRevenueCat();
  // Plan given by an admin (admin panel) — works on iOS and Android with no
  // store purchase. The customer gets whichever is higher: what they bought or
  // what they were granted. RevenueCat remains the source of truth for
  // purchases; App.js still pushes the raw RevenueCat tier to the server.
  const grantedTier = useGrantedTier();
  const earnedTier = grantedTier ? higherTier(storeTier, grantedTier) : storeTier;
  // Launch period: everyone is treated as Pro Max (see constants/launch.js).
  const tier = LAUNCH_ALL_FREE ? TIERS.PRO_MAX : earnedTier;

  const hasAccess = (requiredTier) => tierMeetsRequirement(tier, requiredTier);

  return { tier, hasAccess, loading };
}
