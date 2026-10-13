// Which part of the store an item is in, judged from its name ("Onions" -> Produce, "Chicken broth" -> Pantry).
// Used to group the shopping list in the order you walk the store.
//   aisleFor(text) -> { key, labelKey, emoji }     (always returns something; 'other' when unsure)
//   AISLES         -> the sections in walking order
export const AISLES = [
  { key: 'produce', labelKey: 'aisle_produce', emoji: '🥬' },
  { key: 'bakery', labelKey: 'aisle_bakery', emoji: '🍞' },
  { key: 'meat', labelKey: 'aisle_meat', emoji: '🥩' },
  { key: 'dairy', labelKey: 'sale_cat_dairy', emoji: '🥛' },
  { key: 'frozen', labelKey: 'aisle_frozen', emoji: '🧊' },
  { key: 'pantry', labelKey: 'aisle_pantry', emoji: '🥫' },
  { key: 'beverages', labelKey: 'aisle_beverages', emoji: '🥤' },
  { key: 'household', labelKey: 'sale_cat_household', emoji: '🧻' },
  { key: 'other', labelKey: 'sale_list_other', emoji: '🛒' },
];

const BY_KEY = Object.fromEntries(AISLES.map((a) => [a.key, a]));

// Checked top to bottom; the first rule that matches wins, so specific phrases come before general words
// ("green beans" before "beans", "black pepper" before "pepper", "coconut milk" before "milk").
const RULES = [
  // Plant milks are in the dairy case ("almond" would otherwise read as a pantry nut; canned coconut milk stays pantry).
  ['dairy', /\b(almond|oat|soy|cashew|hemp|rice) milk\b/i],
  ['frozen', /\b(frozen|ice cream|sorbet|gelato|popsicles?|ice pops?)\b/i],
  ['household', /\b(paper towels?|bath tissue|toilet (paper|tissue)|tissues?|napkins?|detergent|laundry|bleach|trash bags?|garbage bags?|dish soap|soap|sponges?|aluminum foil|plastic wrap|parchment paper|wax paper|zip.?lock|baggies|batteries|light bulbs?|shampoo|toothpaste|deodorant|lotion|vitamins?|pet food|dog food|cat food|litter)\b/i],
  // Fresh produce that shares a word with a pantry item.
  ['produce', /\b(green beans?|string beans?|snap peas?|sugar snap|bean sprouts?|bell peppers?|jalape[nñ]os?|chil[ie] peppers?|hot peppers?|poblanos?|serranos?|habaneros?|sweet potato(es)?|yams?|fresh (herbs?|basil|cilantro|parsley|mint|dill|thyme|rosemary))\b/i],
  // Shelf items that share a word with something fresh or refrigerated.
  ['pantry', /\b(coconut milk|coconut cream|cream of \w+|peanut butter|almond butter|sunflower butter|black pepper|white pepper|red pepper flakes|pepper flakes|peppercorns?|garlic (powder|salt)|onion (powder|salt)|chil[ie] powder|tomato (sauce|paste|puree)|diced tomatoes|crushed tomatoes|canned \w+|(lemon|lime) juice|(chicken|beef|vegetable|bone) (broth|stock)|broth|stock|bouillon|beans?|chickpeas?|lentils?|rice|pasta|spaghetti|penne|noodles?|macaroni|couscous|quinoa|oats?|oatmeal|cereal|granola|flour|cornstarch|cornmeal|sugar|baking (soda|powder)|yeast|honey|maple syrup|syrup|molasses|vanilla|extract|cocoa|chocolate chips?|salt|oil|vinegar|soy sauce|worcestershire|hot sauce|sriracha|ketchup|mustard|mayo|mayonnaise|salsa|dressing|bbq sauce|barbecue sauce|teriyaki|hoisin|fish sauce|sauce|jam|jelly|nuts?|almonds?|walnuts?|pecans?|cashews?|peanuts?|pistachios?|raisins|breadcrumbs|panko|tortilla chips|chips|crackers?|pretzels?|popcorn|cumin|paprika|oregano|cinnamon|nutmeg|turmeric|cayenne|italian seasoning|seasoning|spices?|bay leaves|dried \w+|tahini|pesto|olives?|capers|pickles?|relish|water chestnuts?|tuna (can|pouch))\b/i],
  ['meat', /\b(chicken|turkey|beef|steaks?|pork|bacon|sausages?|ham|lamb|veal|ribs?|roast|brisket|chops?|tenderloin|drumsticks?|thighs?|breasts?|wings?|hot dogs?|salami|pepperoni|prosciutto|chorizo|bratwurst|kielbasa|meatballs?|shrimp|prawns?|salmon|tuna|cod|tilapia|halibut|fish|crab|lobster|scallops?|mussels?|clams?|oysters?|anchov(y|ies)|sardines?|mahi|snapper|trout|catfish)\b/i],
  ['dairy', /\b(milk|butter|buttermilk|cheese|cheddar|mozzarella|parmesan|feta|ricotta|gouda|swiss|provolone|brie|queso|cream cheese|cottage cheese|sour cream|heavy cream|whipping cream|half (and|&) half|cream|yogurt|yoghurt|eggs?|creamer|kefir|margarine)\b/i],
  ['bakery', /\b(bread|buns?|rolls?|bagels?|tortillas?|pita|naan|baguette|croissants?|muffins?|cake|pie crust|pizza dough|dough|wraps?|brioche|sourdough|ciabatta)\b/i],
  // Drinks before fresh produce so "orange juice" isn't filed with the oranges.
  ['beverages', /\b(juice|soda|cola|sparkling water|seltzer|coffee|tea|lemonade|kombucha|energy drinks?|sports drinks?|water|beer|wine|vodka|whiske?y|rum|tequila|bourbon|gin|liquor|champagne|prosecco)\b/i],
  ['produce', /\b(apples?|bananas?|oranges?|lemons?|limes?|grapes?|berries|strawberr(y|ies)|blueberr(y|ies)|raspberr(y|ies)|blackberr(y|ies)|cherr(y|ies)|peach(es)?|pears?|plums?|mango(es)?|pineapples?|melons?|watermelon|cantaloupe|avocados?|tomato(es)?|potato(es)?|onions?|shallots?|scallions?|green onions?|garlic|ginger|carrots?|celery|cucumbers?|zucchini|squash|pumpkin|eggplant|cauliflower|broccoli|cabbage|lettuce|romaine|spinach|kale|arugula|salad|greens|mushrooms?|corn|peas|asparagus|beets?|radish(es)?|turnips?|leeks?|fennel|herbs?|basil|cilantro|parsley|mint|rosemary|thyme|sage|dill|chives|peppers?|chiles?|brussels sprouts?|artichokes?|okra|sprouts|apricots?|figs?|kiwi|pomegranate|coconut|dates)\b/i],
];

export function aisleFor(text) {
  const name = String(text || '');
  for (const [key, re] of RULES) {
    if (re.test(name)) return BY_KEY[key];
  }
  return BY_KEY.other;
}
