// What kind of product a flyer item really is, judged from its name.
//
// The flyer reader files everything it sees under Meat / Poultry / Seafood / Produce (and marks
// it all cookable), so yogurt, beer and paper towels show up under "Produce" with a Recipes
// button. This puts them in the right aisle and tells the UI which items can have a recipe.
//   dealKind(deal) -> { key, labelKey, food } | null   (null = no opinion; keep the stored category)
//   isFoodDeal(deal) -> false only for things you can't cook with (drinks, household, flowers...)
const RULES = [
  { key: 'alcohol', labelKey: 'sale_cat_alcohol', food: false, re: /\b(beer|wine|vodka|whiske?y|bourbon|tequila|rum|liquor|seltzer|lager|ipa|prosecco|champagne|chardonnay|cabernet|merlot|pinot|bud|budweiser|miller|coors|corona|truly|michelob|heineken|modelo|stella artois|guinness|wente|i heart|barefoot)\b/i },
  { key: 'drinks', labelKey: 'sale_cat_drinks', food: false, re: /\b(soda|cola|coca-cola|pepsi|sprite|7-?up|dr\.? pepper|tonic|sparkling water|bubly|seltzer water|energy drinks?|sports drinks?|gatorade|k-cups?|coffee pods?)\b/i },
  { key: 'snacks', labelKey: 'sale_cat_snacks', food: false, not: /\bchocolate chips\b|\bchips? (for|to) bak/i, re: /\b(tortilla chips|potato chips|doritos|tostitos|ruffles|cheetos|pringles|cheez-?it|snap'?d|crunch'?d|oreo|chips ahoy|nutter butter|cookies|crackers|cereal|raisin bran|ice cream|h[aä]agen-?dazs|candy|donuts?|bagels?)\b/i },
  { key: 'household', labelKey: 'sale_cat_household', food: false, re: /\b(paper towels?|bath tissue|toilet (paper|tissue)|tissue|napkins?|detergent|laundry|bleach|trash bags?|garbage bags?|dish soap|cleaner|sponges?|aluminum foil|plastic wrap|gift cards?|batteries|light bulbs?)\b/i },
  { key: 'floral', labelKey: 'sale_cat_floral', food: false, re: /\b(mums?|chrysanthemums?|flowers?|bouquets?|poinsettias?|potting soil|mulch|garden)\b/i },
  { key: 'health', labelKey: 'sale_cat_health', food: false, re: /\b(vitamins?|shampoo|conditioner|toothpaste|deodorant|lotion|razors?|body wash)\b/i },
  { key: 'pet', labelKey: 'sale_cat_pet', food: false, re: /\b(pet food|dog food|cat food|cat litter|litter|dog treats?)\b/i },
  // Dairy is food, but "peanut butter" / "coconut milk" / "ice cream" are not dairy-aisle items.
  { key: 'dairy', labelKey: 'sale_cat_dairy', food: true, not: /\b(peanut|almond|cocoa|coconut|soy|oat|rice|cashew) (butter|milk)\b|\bice cream\b|\bmilk chocolate\b|\bbutter(scotch| beans?)\b/i, re: /\b(yogurt|yoghurt|cheese|milk|butter|eggs?|sour cream|half (and|&) half|creamer|cottage cheese)\b/i },
];

export function dealKind(deal) {
  const name = String(deal?.name || '');
  if (!name) return null;
  for (const rule of RULES) {
    if (rule.re.test(name) && !(rule.not && rule.not.test(name))) return rule;
  }
  return null;
}

export function isFoodDeal(deal) {
  const kind = dealKind(deal);
  return !kind || kind.food;
}

// The flyer reader's four buckets (or nothing): the only stored categories that can't be trusted.
export function isUnreliableCategory(category) {
  return /meat|poultry|seafood|produce|^other$|^$/i.test(String(category || '').trim());
}
