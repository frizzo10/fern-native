function normalizeStringList(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item || '').trim()).filter(Boolean);
}

export function normalizeSemiHomemadeRecipe(responseJson) {
    const recipe = responseJson?.recipe || responseJson || {};

    return {
        title: String(recipe?.title || 'Semi-Homemade Recipe').trim(),
        emoji: String(recipe?.emoji || '🍽️').trim(),
        tagline: String(recipe?.tagline || '').trim(),
        time: String(recipe?.time || '').trim(),
        servings: Number.parseInt(recipe?.servings, 10) || 4,
        difficulty: String(recipe?.difficulty || 'Easy').trim(),
        storeBought: normalizeStringList(recipe?.storeBought),
        homemade: normalizeStringList(recipe?.homemade),
        ingredients: normalizeStringList(recipe?.ingredients),
        instructions: normalizeStringList(recipe?.instructions),
        chefTip: String(recipe?.chefTip || '').trim(),
        shoppingList: normalizeStringList(recipe?.shoppingList),
        image: null,
    };
}

export async function fetchSemiHomemadeRecipe({ userId, items, vibe, servings, locale, token }) {
    const payload = {
        userId: userId || undefined,
        locale: locale || 'en',
        items: Array.isArray(items) ? items : [],
        vibe: String(vibe || '').trim(),
        servings: Number.parseInt(servings, 10) || 4,
        token,
    };

    const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/semi-homemade', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FernApp/1.0 (myaifern.com)',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(`Semi-Homemade API failed (${res.status})`);
    }

    const responseJson = await res.json();
    const recipe = normalizeSemiHomemadeRecipe(responseJson);

    return { payload, responseJson, recipe };
}
