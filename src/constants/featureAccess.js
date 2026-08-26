// Single source of truth for which subscription tier a feature requires.
//
// Every gated modal/screen calls `hasAccess(FEATURE_TIERS.<key>)` instead of
// hardcoding `TIERS.PRO`/`TIERS.PRO_MAX` inline, and `PlansScreen`/`TOUR_LIST`
// (src/constants/tourContent.js) read the same map for their marketing copy.
// To move a feature to a different plan, change its line here — nothing else
// needs to be touched.
import { TIERS } from './tiers';

export const FEATURE_TIERS = {
  // Free
  home: TIERS.FREE,
  find: TIERS.FREE,
  recipes: TIERS.FREE,
  shopping: TIERS.FREE,
  scan_circular: TIERS.FREE,
  ask_fern: TIERS.FREE,
  instacart: TIERS.FREE,
  end_to_end: TIERS.FREE,

  // Pro
  shopping_mode: TIERS.PRO,
  cook_mode: TIERS.PRO,
  family_hub: TIERS.PRO,
  fridge_challenge: TIERS.PRO,
  leftover_magic: TIERS.PRO,
  quick_dinner: TIERS.PRO,
  budget_planner: TIERS.PRO,
  meal_planner: TIERS.PRO,
  semi_homemade: TIERS.PRO,
  family_vault: TIERS.PRO,
  nutrition: TIERS.PRO,
  weekly_nutrition: TIERS.PRO,

  // Pro Max
  charcuterie: TIERS.PRO_MAX,
  dinner_party: TIERS.PRO_MAX,
  wine_pairing: TIERS.PRO_MAX,
  personal_shopper: TIERS.PRO_MAX,
  alexa_skill: TIERS.PRO_MAX,
};
