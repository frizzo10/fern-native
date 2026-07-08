function normalizeDifficulty(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw.includes('easy')) return 'Easy';
    if (raw.includes('ambitious') || raw.includes('hard')) return 'Ambitious';
    return 'Medium';
}

function parseResponseTextAsJson(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) return null;

        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }
}

function normalizeIngredient(item) {
    return {
        amount: String(item?.amount || '').trim(),
        unit: String(item?.unit || '').trim(),
        item: String(item?.item || item?.name || '').trim(),
    };
}

function normalizeRecipe(recipe, index) {
    const fallbackTitle = `Recipe ${index + 1}`;
    const ingredients = Array.isArray(recipe?.ingredients)
        ? recipe.ingredients
            .map(normalizeIngredient)
            .filter((entry) => entry.item)
        : [];

    const instructions = Array.isArray(recipe?.instructions)
        ? recipe.instructions.map((step) => String(step || '').trim()).filter(Boolean)
        : [];

    return {
        id: `leftover-${Date.now()}-${index}`,
        title: String(recipe?.title || fallbackTitle).trim(),
        description: String(recipe?.description || '').trim(),
        time: String(recipe?.time || '').trim(),
        difficulty: normalizeDifficulty(recipe?.difficulty),
        ingredients,
        instructions,
        cuisine: String(recipe?.cuisine || '').trim(),
        emoji: String(recipe?.emoji || '🍽️').trim(),
    };
}

function getDifficultyRank(difficulty) {
    if (difficulty === 'Easy') return 1;
    if (difficulty === 'Medium') return 2;
    return 3;
}

export async function fetchLeftoverRecipes({ ingredients, locale }) {
    const normalizedIngredients = String(ingredients || '').trim();

    const payload = {
        system: 'You are a creative chef. Given a list of ingredients, return ONLY a JSON object: {"recipes":[{"title":"","description":"","time":"","difficulty":"Easy|Medium|Ambitious","ingredients":[{"amount":"","unit":"","item":""}],"instructions":[""],"cuisine":"","emoji":""}]} - exactly 3 recipes from easy to ambitious. No markdown.',
        messages: [
            {
                role: 'user',
                content: `I have: ${normalizedIngredients}. What 3 recipes can I make? Return JSON only.`,
            },
        ],
        feature: 'recipe_search',
        locale: locale || 'en',
    };

    const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/ai', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FernApp/1.0 (myaifern.com)',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(`Leftover Magic API failed (${res.status})`);
    }

    const responseJson = await res.json();
    const responseText =
        responseJson?.content?.find((part) => part?.type === 'text')?.text ||
        responseJson?.message ||
        responseJson?.reply ||
        '';

    const parsed =
        parseResponseTextAsJson(responseText) ||
        (Array.isArray(responseJson?.recipes) ? { recipes: responseJson.recipes } : null);

    const recipes = Array.isArray(parsed?.recipes)
        ? parsed.recipes.map((recipe, index) => normalizeRecipe(recipe, index))
        : [];

    recipes.sort((a, b) => getDifficultyRank(a.difficulty) - getDifficultyRank(b.difficulty));

    return { payload, responseJson, responseText, recipes };
}
