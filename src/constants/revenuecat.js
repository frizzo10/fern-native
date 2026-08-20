import { Platform } from 'react-native';
import { TIERS } from './tiers';

// RevenueCat public SDK keys — these are safe to embed client-side (same trust
// level as EXPO_PUBLIC_SUPABASE_ANON_KEY elsewhere in this repo). Real secrets
// (App Store Connect / Play Console credentials, webhook auth) live only in the
// RevenueCat dashboard, never in this app.
export const REVENUECAT_API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  default: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
});

// Must match the entitlement identifier created in the RevenueCat dashboard
// (Project → Entitlements). One entitlement gates every paid feature in the
// app today — see PRODUCT_TIER for how PRO vs PRO_MAX is derived from *which*
// product unlocked it, rather than from a second entitlement.
export const ENTITLEMENT_ID = 'Fern Pro';

// Two plans, both monthly-recurring — Pro Max isn't a longer commitment, it's
// more features at a higher monthly price (matches plans_pro_price /
// plans_pro_max_price in translations.js: $2.99/mo and $6.99/mo). No
// yearly/lifetime tier exists. These identifiers must match the product IDs
// created in App Store Connect / Play Console and attached to the "Fern Pro"
// entitlement in the RevenueCat dashboard (Project → Products).
export const PRODUCT_IDS = {
  proMonthly: 'fern_pro_monthly',
  proMaxMonthly: 'fern_pro_max_monthly',
};

// RevenueCat's built-in package types (`$rc_monthly`, `$rc_annual`, etc.) are
// meant for one product per type per Offering — they can't represent "two
// different monthly products" on their own. Use CUSTOM package identifiers in
// the RevenueCat dashboard's default Offering instead, one per product below,
// so both show up side by side. (Project → Offerings → default → Packages →
// Custom → identifier = the values below.)
export const PACKAGE_IDS = {
  proMonthly: 'pro_monthly',
  proMaxMonthly: 'pro_max_monthly',
};

// Store-facing display metadata (Display Name shown in the RevenueCat
// dashboard's Product list, and the localized name/description each store
// asks for when you create the subscription product). Descriptions are
// exactly 55 characters each (App Store Connect / Play Console
// character-count requirement) — if you edit one, recount before saving.
// Keep these in sync with translations.js's `tool_*`/`plan_desc_*` copy —
// this is the same content, just the store/dashboard-facing versions rather
// than in-app UI (which has no length limit).
export const PRODUCT_DISPLAY = {
  [PRODUCT_IDS.proMonthly]: {
    en: {
      displayName: 'Fern Pro (Monthly)',
      subtitle: 'Pro',
      description: "Unlock Fern's Fridge Challenge, meal plans & more tools",
    },
    es: {
      displayName: 'Fern Pro (Mensual)',
      subtitle: 'Pro',
      description: 'Desbloquea el Reto de Nevera, planes y más herramientas',
    },
  },
  [PRODUCT_IDS.proMaxMonthly]: {
    en: {
      displayName: 'Fern Pro Max (Monthly)',
      subtitle: 'Pro Max',
      description: 'Everything in Pro, plus Alexa Skill & personal shoppers',
    },
    es: {
      // Matches the in-app "PRO MÁXIMO" label (translations.js's `pro_max`
      // key for the es locale) rather than leaving "Pro Max" untranslated.
      displayName: 'Fern Pro Máximo (Mensual)',
      subtitle: 'Pro Máximo',
      description: 'Todo lo de Pro, más Alexa, vinos, cenas y compras extra',
    },
  },
};

// Every gated feature in this app checks TIERS.PRO or TIERS.PRO_MAX
// (src/hooks/useEntitlement.js). There is a single RevenueCat entitlement, so
// which *tier* a customer gets is derived from which *product* granted that
// entitlement. This is the one place that mapping lives — change it here if
// pricing/packaging changes, nothing else in the app needs to know.
export const PRODUCT_TIER = {
  [PRODUCT_IDS.proMonthly]: TIERS.PRO,
  [PRODUCT_IDS.proMaxMonthly]: TIERS.PRO_MAX,
};

// Given a RevenueCat CustomerInfo object, return the highest tier the
// customer's active entitlement(s) grant. Falls back to TIERS.FREE when the
// "Fern Pro" entitlement isn't active.
export function tierFromCustomerInfo(customerInfo) {
  const entitlement = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
  if (!entitlement) return TIERS.FREE;

  const productIdentifier = entitlement.productIdentifier || '';
  // Product identifiers on-device sometimes carry a store-specific suffix
  // (e.g. Android's `:base-plan-id`) — match by prefix against our known IDs.
  const matchedProductId = Object.keys(PRODUCT_TIER).find((id) => productIdentifier.startsWith(id));

  return PRODUCT_TIER[matchedProductId] || TIERS.PRO;
}
