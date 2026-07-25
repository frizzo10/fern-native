// Walkthrough content for TourModal.js, driven through the app's real
// translations.js dictionary (see the tour_* / account_tour_* keys) rather
// than inline per-locale strings, so it stays consistent with the rest of
// the app's i18n approach.
//
// home/find/recipes/shopping auto-show once each, the first time their
// screen mounts (see TourProvider.maybeAutoStart). scan_circular has no
// dedicated screen of its own — it's only reachable from the "Take a Tour"
// list in AccountScreen.js.

import { TIERS } from './tiers';

export const TOURS = {
  home: {
    titleKey: 'tour_home_title',
    steps: [
      { textKey: 'tour_home_step1' },
      { textKey: 'tour_home_step2' },
      { textKey: 'tour_home_step3' },
      { textKey: 'tour_home_step4' },
    ],
  },
  find: {
    titleKey: 'tour_find_title',
    steps: [
      { textKey: 'tour_find_step1' },
      { textKey: 'tour_find_step2' },
      { textKey: 'tour_find_step3' },
    ],
  },
  recipes: {
    titleKey: 'tour_recipes_title',
    steps: [
      { textKey: 'tour_recipes_step1' },
      { textKey: 'tour_recipes_step2' },
      { textKey: 'tour_recipes_step3' },
    ],
  },
  shopping: {
    titleKey: 'tour_shopping_title',
    steps: [
      { textKey: 'tour_shopping_step1' },
      { textKey: 'tour_shopping_step2' },
      { textKey: 'tour_shopping_step3' },
    ],
  },
  scan_circular: {
    titleKey: 'tour_scan_circular_title',
    steps: [
      { textKey: 'tour_scan_circular_step1' },
      { textKey: 'tour_scan_circular_step2' },
      { textKey: 'tour_scan_circular_step3' },
      { textKey: 'tour_scan_circular_step4' },
    ],
  },
  shopping_mode: {
    titleKey: 'tour_shopping_mode_title',
    steps: [
      { textKey: 'tour_shopping_mode_step1' },
      { textKey: 'tour_shopping_mode_step2' },
      { textKey: 'tour_shopping_mode_step3' },
      { textKey: 'tour_shopping_mode_step4' },
      { textKey: 'tour_shopping_mode_step5' },
    ],
  },
  cook_mode: {
    titleKey: 'tour_cook_mode_title',
    steps: [
      { textKey: 'tour_cook_mode_step1' },
      { textKey: 'tour_cook_mode_step2' },
      { textKey: 'tour_cook_mode_step3' },
      { textKey: 'tour_cook_mode_step4' },
      { textKey: 'tour_cook_mode_step5' },
    ],
  },
  family_hub: {
    titleKey: 'tour_family_hub_title',
    steps: [
      { textKey: 'tour_family_hub_step1' },
      { textKey: 'tour_family_hub_step2' },
      { textKey: 'tour_family_hub_step3' },
      { textKey: 'tour_family_hub_step4' },
      { textKey: 'tour_family_hub_step5' },
      { textKey: 'tour_family_hub_step6' },
    ],
  },
  charcuterie: {
    titleKey: 'tour_charcuterie_title',
    steps: [
      { textKey: 'tour_charcuterie_step1' },
      { textKey: 'tour_charcuterie_step2' },
      { textKey: 'tour_charcuterie_step3' },
      { textKey: 'tour_charcuterie_step4' },
      { textKey: 'tour_charcuterie_step5' },
    ],
  },
  dinner_party: {
    titleKey: 'tour_dinner_party_title',
    steps: [
      { textKey: 'tour_dinner_party_step1' },
      { textKey: 'tour_dinner_party_step2' },
      { textKey: 'tour_dinner_party_step3' },
      { textKey: 'tour_dinner_party_step4' },
      { textKey: 'tour_dinner_party_step5' },
    ],
  },
  wine_pairing: {
    titleKey: 'tour_wine_pairing_title',
    steps: [
      { textKey: 'tour_wine_pairing_step1' },
      { textKey: 'tour_wine_pairing_step2' },
      { textKey: 'tour_wine_pairing_step3' },
      { textKey: 'tour_wine_pairing_step4' },
      { textKey: 'tour_wine_pairing_step5' },
    ],
  },
  personal_shopper: {
    titleKey: 'tour_personal_shopper_title',
    steps: [
      { textKey: 'tour_personal_shopper_step1' },
      { textKey: 'tour_personal_shopper_step2' },
      { textKey: 'tour_personal_shopper_step3' },
      { textKey: 'tour_personal_shopper_step4' },
      { textKey: 'tour_personal_shopper_step5' },
    ],
  },
  ask_fern: {
    titleKey: 'tour_ask_fern_title',
    steps: [
      { textKey: 'tour_ask_fern_step1' },
      { textKey: 'tour_ask_fern_step2' },
      { textKey: 'tour_ask_fern_step3' },
      { textKey: 'tour_ask_fern_step4' },
      { textKey: 'tour_ask_fern_step5' },
    ],
  },
  fridge_challenge: {
    titleKey: 'tour_fridge_challenge_title',
    steps: [
      { textKey: 'tour_fridge_challenge_step1' },
      { textKey: 'tour_fridge_challenge_step2' },
      { textKey: 'tour_fridge_challenge_step3' },
      { textKey: 'tour_fridge_challenge_step4' },
    ],
  },
  leftover_magic: {
    titleKey: 'tour_leftover_magic_title',
    steps: [
      { textKey: 'tour_leftover_magic_step1' },
      { textKey: 'tour_leftover_magic_step2' },
      { textKey: 'tour_leftover_magic_step3' },
      { textKey: 'tour_leftover_magic_step4' },
    ],
  },
  quick_dinner: {
    titleKey: 'tour_quick_dinner_title',
    steps: [
      { textKey: 'tour_quick_dinner_step1' },
      { textKey: 'tour_quick_dinner_step2' },
      { textKey: 'tour_quick_dinner_step3' },
      { textKey: 'tour_quick_dinner_step4' },
    ],
  },
  budget_planner: {
    titleKey: 'tour_budget_planner_title',
    steps: [
      { textKey: 'tour_budget_planner_step1' },
      { textKey: 'tour_budget_planner_step2' },
      { textKey: 'tour_budget_planner_step3' },
      { textKey: 'tour_budget_planner_step4' },
    ],
  },
  meal_planner: {
    titleKey: 'tour_meal_planner_title',
    steps: [
      { textKey: 'tour_meal_planner_step1' },
      { textKey: 'tour_meal_planner_step2' },
      { textKey: 'tour_meal_planner_step3' },
      { textKey: 'tour_meal_planner_step4' },
    ],
  },
  semi_homemade: {
    titleKey: 'tour_semi_homemade_title',
    steps: [
      { textKey: 'tour_semi_homemade_step1' },
      { textKey: 'tour_semi_homemade_step2' },
      { textKey: 'tour_semi_homemade_step3' },
      { textKey: 'tour_semi_homemade_step4' },
    ],
  },
  family_vault: {
    titleKey: 'tour_family_vault_title',
    steps: [
      { textKey: 'tour_family_vault_step1' },
      { textKey: 'tour_family_vault_step2' },
      { textKey: 'tour_family_vault_step3' },
      { textKey: 'tour_family_vault_step4' },
    ],
  },
  alexa_skill: {
    titleKey: 'tour_alexa_skill_title',
    steps: [
      { textKey: 'tour_alexa_skill_step1' },
      { textKey: 'tour_alexa_skill_step2' },
      { textKey: 'tour_alexa_skill_step3' },
      { textKey: 'tour_alexa_skill_step4' },
    ],
  },
  nutrition: {
    titleKey: 'tour_nutrition_title',
    steps: [
      { textKey: 'tour_nutrition_step1' },
      { textKey: 'tour_nutrition_step2' },
      { textKey: 'tour_nutrition_step3' },
      { textKey: 'tour_nutrition_step4' },
    ],
  },
  instacart: {
    titleKey: 'tour_instacart_title',
    steps: [
      { textKey: 'tour_instacart_step1' },
      { textKey: 'tour_instacart_step2' },
      { textKey: 'tour_instacart_step3' },
      { textKey: 'tour_instacart_step4' },
    ],
  },
  weekly_nutrition: {
    titleKey: 'tour_weekly_nutrition_title',
    steps: [
      { textKey: 'tour_weekly_nutrition_step1' },
      { textKey: 'tour_weekly_nutrition_step2' },
      { textKey: 'tour_weekly_nutrition_step3' },
      { textKey: 'tour_weekly_nutrition_step4' },
    ],
  },
  end_to_end: {
    titleKey: 'tour_end_to_end_title',
    steps: [
      { textKey: 'tour_end_to_end_step1' },
      { textKey: 'tour_end_to_end_step2' },
      { textKey: 'tour_end_to_end_step3' },
      { textKey: 'tour_end_to_end_step4' },
      { textKey: 'tour_end_to_end_step5' },
      { textKey: 'tour_end_to_end_step6' },
    ],
  },
};

// Order + AsyncStorage "seen" keys for the "Take a Tour" list in AccountScreen.
// `tier` is the plan required to use the real feature behind the tour (see
// src/constants/tiers.js + src/hooks/useEntitlement.js for the gating this drives).
// `planDescKey` is the one-line marketing copy shown for paid tiers on the
// "See Plans" screen (src/screens/PlansScreen.js) — only set for pro/pro_max entries.
export const TOUR_LIST = [
  { key: 'home', labelKey: 'account_tour_home', icon: '🏠', storageKey: 'fern_tour_seen_home', tier: TIERS.FREE },
  { key: 'find', labelKey: 'account_tour_find', icon: '🔍', storageKey: 'fern_tour_seen_find', tier: TIERS.FREE },
  { key: 'recipes', labelKey: 'account_tour_recipes', icon: '📖', storageKey: 'fern_tour_seen_recipes', tier: TIERS.FREE },
  { key: 'shopping', labelKey: 'account_tour_shopping', icon: '🛒', storageKey: 'fern_tour_seen_shopping', tier: TIERS.FREE },
  { key: 'scan_circular', labelKey: 'account_tour_scan_circular', icon: '📷', storageKey: 'fern_tour_seen_scan_circular', tier: TIERS.FREE },
  { key: 'shopping_mode', labelKey: 'account_tour_shopping_mode', icon: '🛒', storageKey: 'fern_tour_seen_shopping_mode', tier: TIERS.PRO, planDescKey: 'plan_desc_shopping_mode' },
  { key: 'cook_mode', labelKey: 'account_tour_cook_mode', icon: '🎙️', storageKey: 'fern_tour_seen_cook_mode', tier: TIERS.PRO, planDescKey: 'plan_desc_cook_mode' },
  { key: 'family_hub', labelKey: 'account_tour_family_hub', icon: '📅', storageKey: 'fern_tour_seen_family_hub', tier: TIERS.PRO, planDescKey: 'plan_desc_family_hub' },
  { key: 'charcuterie', labelKey: 'account_tour_charcuterie', icon: '🧀', storageKey: 'fern_tour_seen_charcuterie', tier: TIERS.PRO_MAX, planDescKey: 'plan_desc_charcuterie' },
  { key: 'dinner_party', labelKey: 'account_tour_dinner_party', icon: '🎉', storageKey: 'fern_tour_seen_dinner_party', tier: TIERS.PRO_MAX, planDescKey: 'plan_desc_dinner_party' },
  { key: 'wine_pairing', labelKey: 'account_tour_wine_pairing', icon: '🍷', storageKey: 'fern_tour_seen_wine_pairing', tier: TIERS.PRO_MAX, planDescKey: 'plan_desc_wine_pairing' },
  { key: 'personal_shopper', labelKey: 'account_tour_personal_shopper', icon: '🤝', storageKey: 'fern_tour_seen_personal_shopper', tier: TIERS.PRO_MAX, planDescKey: 'plan_desc_personal_shopper' },
  { key: 'ask_fern', labelKey: 'account_tour_ask_fern', icon: '🎤', storageKey: 'fern_tour_seen_ask_fern', tier: TIERS.FREE },
  { key: 'fridge_challenge', labelKey: 'account_tour_fridge_challenge', icon: '🧊', storageKey: 'fern_tour_seen_fridge_challenge', tier: TIERS.PRO, planDescKey: 'plan_desc_fridge_challenge' },
  { key: 'leftover_magic', labelKey: 'account_tour_leftover_magic', icon: '📸', storageKey: 'fern_tour_seen_leftover_magic', tier: TIERS.PRO, planDescKey: 'plan_desc_leftover_magic' },
  { key: 'quick_dinner', labelKey: 'account_tour_quick_dinner', icon: '⚡', storageKey: 'fern_tour_seen_quick_dinner', tier: TIERS.PRO, planDescKey: 'plan_desc_quick_dinner' },
  { key: 'budget_planner', labelKey: 'account_tour_budget_planner', icon: '💰', storageKey: 'fern_tour_seen_budget_planner', tier: TIERS.PRO, planDescKey: 'plan_desc_budget_planner' },
  { key: 'meal_planner', labelKey: 'account_tour_meal_planner', icon: '📅', storageKey: 'fern_tour_seen_meal_planner', tier: TIERS.PRO, planDescKey: 'plan_desc_meal_planner' },
  { key: 'semi_homemade', labelKey: 'account_tour_semi_homemade', icon: '🥫', storageKey: 'fern_tour_seen_semi_homemade', tier: TIERS.PRO, planDescKey: 'plan_desc_semi_homemade' },
  { key: 'family_vault', labelKey: 'account_tour_family_vault', icon: '📖', storageKey: 'fern_tour_seen_family_vault', tier: TIERS.PRO, planDescKey: 'plan_desc_family_vault' },
  { key: 'alexa_skill', labelKey: 'account_tour_alexa_skill', icon: '🔵', storageKey: 'fern_tour_seen_alexa_skill', tier: TIERS.PRO_MAX, planDescKey: 'plan_desc_alexa_skill' },
  { key: 'nutrition', labelKey: 'account_tour_nutrition', icon: '📊', storageKey: 'fern_tour_seen_nutrition', tier: TIERS.PRO, planDescKey: 'plan_desc_nutrition' },
  { key: 'instacart', labelKey: 'account_tour_instacart', icon: '🛍️', storageKey: 'fern_tour_seen_instacart', tier: TIERS.FREE },
  { key: 'weekly_nutrition', labelKey: 'account_tour_weekly_nutrition', icon: '🥗', storageKey: 'fern_tour_seen_weekly_nutrition', tier: TIERS.PRO, planDescKey: 'plan_desc_weekly_nutrition' },
  { key: 'end_to_end', labelKey: 'account_tour_end_to_end', icon: '✨', storageKey: 'fern_tour_seen_end_to_end', tier: TIERS.FREE },
];
