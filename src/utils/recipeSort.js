// Quick-sort helpers (meal -> cuisine -> dish) for a list of normalized recipes.
// Same rules as the Recipes tab; used by the "Add a meal" picker.
export const DISH_WORDS = ['pasta', 'chicken', 'beef', 'pork', 'seafood', 'fish', 'shrimp', 'soup', 'salad', 'tacos', 'pizza', 'sandwich', 'burger', 'steak', 'rice', 'cake', 'cookie', 'bread', 'eggs', 'vegetarian'];
const DISH_MATCH = {
  pasta: /pasta|spaghetti|linguine|fettuccine|penne|lasagna|ravioli|gnocchi|macaroni|carbonara|rigatoni|tortellini/i,
  seafood: /seafood|salmon|shrimp|fish|cod|tuna|crab|lobster|scallop|flounder|tilapia/i,
  fish: /fish|salmon|cod|tuna|flounder|tilapia|trout/i,
  tacos: /taco|burrito|fajita|quesadilla|enchilada/i,
  sandwich: /sandwich|wrap|sub|panini|blt/i,
  burger: /burger/i,
  vegetarian: /vegetarian|veggie|vegan/i,
};
const NOT_A_CUISINE = /^(dinner|lunch|breakfast|dessert|snack|appetizer|main course|side dish|family)$/i;

export const mealOf = (r) => {
  const m = String((r && r.meal) || '').trim();
  if (!m || /^(main course|main|mains|entree|entrée|main dish)$/i.test(m)) return 'Dinner';
  return m;
};
export const cuisineOf = (r) => String((r && r.category) || '').trim();
export const dishMatches = (r, w) => (DISH_MATCH[w] || new RegExp(w, 'i')).test((r && r.title) || '');

export function countBy(list, keyFn, skip) {
  const c = {};
  list.forEach((r) => { const k = keyFn(r); if (k && !(skip && skip.test(k))) c[k] = (c[k] || 0) + 1; });
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}
export const cuisineCountsOf = (list) => countBy(list, cuisineOf, NOT_A_CUISINE);
export const mealCountsOf = (list) => countBy(list, mealOf);
export const dishCountsOf = (list) => DISH_WORDS.map((w) => [w, list.filter((r) => dishMatches(r, w)).length]).filter(([, n]) => n > 0);
