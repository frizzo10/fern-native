import AsyncStorage from '@react-native-async-storage/async-storage';
import { toShoppingName } from './shoppingName';
import { aisleFor } from './aisles';

function normalizeText(value) {
    return String(value || '').trim();
}

// `recipe` on a list item is a comma-joined list of the meals that need it ("TACOS, STIR FRY"), or one of
// these labels for things added by hand. How many meals need an item is how many to buy.
const GENERIC_TAGS = new Set(['MANUAL ADD', 'FERN STARTER', 'COUPON DEAL', 'RECIPE', '']);

export function recipeTags(recipeField) {
    return normalizeText(recipeField).split(',').map((tag) => tag.trim().toUpperCase()).filter((tag) => !GENERIC_TAGS.has(tag));
}

// 1 unless two or more meals need the item ("Onions" in tacos and stir fry -> 2).
export function buyCount(item) {
    return Math.max(1, recipeTags(item?.recipe).length);
}

// What an item is called for matching: "Onions" and "onion" are the same thing, so two meals asking for
// either want the same list line (and a bigger quantity). Only used to compare — the list keeps the original text.
function nameKey(text) {
    return normalizeText(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).map((w) => {
        if (w.length <= 3) return w;
        if (w.endsWith('ies')) return `${w.slice(0, -3)}y`;
        if (w.endsWith('oes')) return w.slice(0, -2);
        if (w.endsWith('ss') || w.endsWith('us')) return w;
        return w.endsWith('s') ? w.slice(0, -1) : w;
    }).join(' ');
}

// A meal's name as it is stored on the list. Commas would split one meal into two.
function recipeLabelFor(recipe) {
    return normalizeText(recipe?.title).replace(/,/g, ' ').replace(/\s+/g, ' ').toUpperCase() || 'RECIPE';
}

// What adding these recipes would do to the list, without changing anything — the preview.
// Ingredients are merged by name across the recipes and with what is already on the list.
//   recipes   [{ id?, title, ingredients: [] }]
//   -> [{ key, text, aisle, meals: [label], count, status }]
//   status 'new'   not on the list yet
//          'more'  already on the list; another meal needs it too, so we buy more
//          'have'  already on the list for this very meal (nothing changes)
export function planShoppingAdditions(recipes, existingShopping) {
    const existing = Array.isArray(existingShopping) ? existingShopping : [];
    const byKey = new Map();
    (Array.isArray(recipes) ? recipes : []).forEach((recipe) => {
        const label = recipeLabelFor(recipe);
        const names = Array.isArray(recipe?.ingredients)
            ? recipe.ingredients.map((item) => toShoppingName(normalizeText(item))).filter(Boolean)
            : [];
        names.forEach((name) => {
            const key = nameKey(name);
            if (!byKey.has(key)) byKey.set(key, { key, text: name, meals: new Set() });
            byKey.get(key).meals.add(label);
        });
    });

    return Array.from(byKey.values()).map((line) => {
        const entry = existing.find((e) => nameKey(e?.text) === line.key);
        const before = entry ? recipeTags(entry.recipe) : [];
        const all = new Set([...before, ...line.meals]);
        const meals = Array.from(all);
        let status = 'new';
        if (entry) status = all.size > before.length && all.size >= 2 ? 'more' : 'have';
        return { key: line.key, text: entry ? normalizeText(entry.text) : line.text, aisle: aisleFor(line.text), meals, count: Math.max(1, meals.length), status, onList: Boolean(entry) };
    });
}

// Adds recipes' ingredients to the shopping list. An ingredient already on the list is not duplicated:
// this meal is added to its `recipe` tag so the list says to buy more (and it is un-ticked if it had been
// ticked off, since there is more to get). Only genuinely new ingredients are appended.
// `skip` (a Set of lower-cased names) leaves those out — the items un-ticked in the preview.
// Persists to AsyncStorage (rv4_master_shop + sync cache) so callers just need to push/pull afterwards.
export async function addRecipesToShoppingList(recipes, existingShopping, { skip } = {}) {
    const baseShopping = Array.isArray(existingShopping) ? existingShopping : [];
    const skipSet = skip instanceof Set ? skip : new Set();
    const lists = (Array.isArray(recipes) ? recipes : []).map((recipe) => ({
        recipe,
        label: recipeLabelFor(recipe),
        names: (Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
            .map((item) => toShoppingName(normalizeText(item)))
            .filter((name) => name && !skipSet.has(nameKey(name))),
    }));

    if (!lists.some((l) => l.names.length)) {
        return { addedCount: 0, checkedCount: 0, nextShopping: baseShopping };
    }

    let nextShopping = baseShopping.map((entry) => ({ ...entry }));
    let addedCount = 0;
    const matched = new Set();
    let stamp = 0;

    lists.forEach(({ recipe, label, names }) => {
        const seenInThisRecipe = new Set();
        names.forEach((name) => {
            const key = nameKey(name);
            if (seenInThisRecipe.has(key)) return;
            seenInThisRecipe.add(key);

            const idx = nextShopping.findIndex((e) => nameKey(e?.text) === key);
            if (idx >= 0) {
                matched.add(key);
                const entry = nextShopping[idx];
                const tags = normalizeText(entry.recipe).split(',').map((tag) => tag.trim()).filter(Boolean)
                    .filter((tag) => !GENERIC_TAGS.has(tag.toUpperCase()));
                if (tags.map((tag) => tag.toUpperCase()).includes(label)) return;
                // A hand-added item keeps its place; the meal that needs it is now recorded on it.
                nextShopping[idx] = { ...entry, checked: false, recipe: [...tags, label].join(', ') };
                return;
            }

            addedCount += 1;
            stamp += 1;
            nextShopping.push({
                id: `${recipe?.id || 'recipe'}-shop-${Date.now()}-${stamp}`,
                text: name,
                recipe: label,
                checked: false,
            });
        });
    });

    await AsyncStorage.setItem('rv4_master_shop', JSON.stringify(nextShopping));
    const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
    await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({ ...cache, shopping: nextShopping }));

    return { addedCount, checkedCount: matched.size, nextShopping };
}

// One recipe at a time (what most screens call). `checkedCount` is how many items were already on the list.
export async function addRecipeIngredientsToShoppingList(recipe, existingShopping) {
    return addRecipesToShoppingList([recipe], existingShopping);
}
