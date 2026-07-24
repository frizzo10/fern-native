// Walkthrough content for TourModal.js, driven through the app's real
// translations.js dictionary (see the tour_* / account_tour_* keys) rather
// than inline per-locale strings, so it stays consistent with the rest of
// the app's i18n approach.
//
// home/find/recipes/shopping auto-show once each, the first time their
// screen mounts (see TourProvider.maybeAutoStart). scan_circular has no
// dedicated screen of its own — it's only reachable from the "Take a Tour"
// list in AccountScreen.js.

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
};

// Order + AsyncStorage "seen" keys for the "Take a Tour" list in AccountScreen.
export const TOUR_LIST = [
  { key: 'home', labelKey: 'account_tour_home', icon: '🏠', storageKey: 'fern_tour_seen_home' },
  { key: 'find', labelKey: 'account_tour_find', icon: '🔍', storageKey: 'fern_tour_seen_find' },
  { key: 'recipes', labelKey: 'account_tour_recipes', icon: '📖', storageKey: 'fern_tour_seen_recipes' },
  { key: 'shopping', labelKey: 'account_tour_shopping', icon: '🛒', storageKey: 'fern_tour_seen_shopping' },
  { key: 'scan_circular', labelKey: 'account_tour_scan_circular', icon: '📷', storageKey: 'fern_tour_seen_scan_circular' },
];
