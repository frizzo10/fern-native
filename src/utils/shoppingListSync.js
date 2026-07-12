import AsyncStorage from '@react-native-async-storage/async-storage';

function normalizeText(value) {
    return String(value || '').trim();
}

// Adds a recipe's ingredients to the shopping list. Ingredients that already
// exist in the list (by text, regardless of which recipe added them) are not
// duplicated — they're checked off and their `recipe` tag is enhanced to
// also credit this recipe. Only genuinely new ingredients are appended as
// new unchecked items. Persists to AsyncStorage (rv4_master_shop + sync
// cache) so callers just need to push/pull afterwards.
export async function addRecipeIngredientsToShoppingList(recipe, existingShopping) {
    const ingredients = Array.isArray(recipe?.ingredients)
        ? recipe.ingredients.map((item) => normalizeText(item)).filter(Boolean)
        : [];

    const baseShopping = Array.isArray(existingShopping) ? existingShopping : [];

    if (!ingredients.length) {
        return { addedCount: 0, checkedCount: 0, nextShopping: baseShopping };
    }

    const recipeLabel = normalizeText(recipe?.title).toUpperCase() || 'RECIPE';
    const matchedKeys = new Set();
    let checkedCount = 0;

    const updatedShopping = baseShopping.map((entry) => {
        const entryText = normalizeText(entry?.text).toLowerCase();
        const isMatch = ingredients.some((ingredient) => ingredient.toLowerCase() === entryText);
        if (!isMatch) return entry;

        matchedKeys.add(entryText);
        checkedCount += 1;

        const existingRecipeTags = normalizeText(entry?.recipe).split(',').map((tag) => tag.trim()).filter(Boolean);
        const nextRecipeTags = existingRecipeTags.includes(recipeLabel)
            ? existingRecipeTags
            : [...existingRecipeTags, recipeLabel];

        return {
            ...entry,
            checked: true,
            recipe: nextRecipeTags.join(', '),
        };
    });

    let addedCount = 0;
    const newAdditions = [];
    ingredients.forEach((ingredient) => {
        const key = ingredient.toLowerCase();
        if (matchedKeys.has(key)) return;
        matchedKeys.add(key);
        addedCount += 1;
        newAdditions.push({
            id: `${recipe?.id || 'recipe'}-shop-${Date.now()}-${addedCount}`,
            text: ingredient,
            recipe: recipeLabel,
            checked: false,
        });
    });

    const nextShopping = [...updatedShopping, ...newAdditions];

    await AsyncStorage.setItem('rv4_master_shop', JSON.stringify(nextShopping));
    const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
    await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({ ...cache, shopping: nextShopping }));

    return { addedCount, checkedCount, nextShopping };
}
