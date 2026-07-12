function normalizeRecipe(recipe, index) {
    const ingredients = Array.isArray(recipe?.ingredients)
        ? recipe.ingredients.map((item) => String(item || '').trim()).filter(Boolean)
        : [];

    const instructions = Array.isArray(recipe?.instructions)
        ? recipe.instructions.map((step) => String(step || '').trim()).filter(Boolean)
        : [];

    return {
        id: `quick-dinner-${Date.now()}-${index}`,
        title: String(recipe?.title || `Recipe ${index + 1}`).trim(),
        tagline: String(recipe?.tagline || '').trim(),
        description: String(recipe?.description || '').trim(),
        time: String(recipe?.time || '').trim(),
        difficulty: String(recipe?.difficulty || 'Easy').trim(),
        cuisine: String(recipe?.cuisine || '').trim(),
        mealType: String(recipe?.mealType || 'Dinner').trim(),
        emoji: String(recipe?.emoji || '🍽️').trim(),
        ingredients,
        instructions,
        chefTip: String(recipe?.chefTip || '').trim(),
        whyFast: String(recipe?.whyFast || '').trim(),
        servings: Number.parseInt(recipe?.servings, 10) || 4,
    };
}

export async function fetchQuickDinnerRecipes({ quickPicks, ingredients, servings, locale }) {
    const payload = {
        quickPicks: Array.isArray(quickPicks) ? quickPicks.filter(Boolean) : [],
        ingredients: String(ingredients || '').trim(),
        servings: Number.parseInt(servings, 10) || 4,
        locale: locale || 'en',
    };

    const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/whats-for-dinner', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FernApp/1.0 (myaifern.com)',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(`Whats For Dinner API failed (${res.status})`);
    }

    const responseJson = await res.json();
    const recipes = Array.isArray(responseJson?.recipes)
        ? responseJson.recipes.map((recipe, index) => normalizeRecipe(recipe, index))
        : [];

    return { payload, responseJson, recipes };
}
