const AI_URL = 'https://app.clickpickandcook.com/.netlify/functions/ai';
const SUGGESTION_URL = 'https://app.clickpickandcook.com/.netlify/functions/suggestion';

const SUGGESTIONS_SYSTEM_PROMPT = 'You are Fern. Return ONLY raw JSON, no markdown. Format: {"groups":[{"label":"Short label","reason":"One sentence","recipes":[{"id":"sug_1","recipe":{"title":"","emoji":"🍽","cuisine":"","mealType":"Dinner","time":"25 min","difficulty":"Easy","description":"One sentence","ingredients":["item1","item2"],"instructions":["Step 1. Do this","Step 2. Do that","Step 3. Finish"]},"why":"One line","brandName":"Fern","brandEmoji":"🌿","brandColor":"#1C3A1A"}]}]}. Rules: 2 groups, 3 recipes each. Vary cuisines.';

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

function normalizeRecipe(recipe) {
    return {
        title: String(recipe?.title || '').trim(),
        emoji: String(recipe?.emoji || '🍽️').trim(),
        cuisine: String(recipe?.cuisine || '').trim(),
        mealType: String(recipe?.mealType || 'Dinner').trim(),
        time: String(recipe?.time || '').trim(),
        difficulty: String(recipe?.difficulty || 'Medium').trim(),
        description: String(recipe?.description || '').trim(),
        ingredients: Array.isArray(recipe?.ingredients) ? recipe.ingredients.map((i) => String(i || '').trim()).filter(Boolean) : [],
        instructions: Array.isArray(recipe?.instructions) ? recipe.instructions.map((i) => String(i || '').trim()).filter(Boolean) : [],
    };
}

export function buildSuggestionsPrompt({ dietary, household, recentTitles, storeNames }) {
    const lines = [];
    lines.push(`User profile: Dietary: ${dietary || 'None of these'}. Household: ${household || 'solo'}`);
    if (Array.isArray(recentTitles) && recentTitles.length) {
        lines.push(`Recent recipes (avoid repeating): ${recentTitles.join(', ')}`);
    }
    if (Array.isArray(storeNames) && storeNames.length) {
        lines.push(`User shops at: ${storeNames.join(', ')}`);
    }
    lines.push('');
    lines.push('Suggest 6 recipes this user would genuinely love to cook this week.');
    return lines.join('\n');
}

export async function fetchSuggestedRecipeGroups({ prompt, locale, token, userId }) {
    const payload = {
        locale: locale || 'en',
        system: SUGGESTIONS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
        feature: 'suggestions',
        token,
        userId,
    };

    const res = await fetch(AI_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FernApp/1.0 (myaifern.com)',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(`Suggested recipes API failed (${res.status})`);
    }

    const responseJson = await res.json();
    const responseText =
        responseJson?.content?.find((part) => part?.type === 'text')?.text ||
        responseJson?.message ||
        responseJson?.reply ||
        '';

    const parsed = parseResponseTextAsJson(responseText);
    const groups = Array.isArray(parsed?.groups) ? parsed.groups : [];

    return groups.map((group, groupIndex) => ({
        id: `group-${groupIndex}`,
        label: String(group?.label || '').trim(),
        reason: String(group?.reason || '').trim(),
        recipes: Array.isArray(group?.recipes)
            ? group.recipes.map((entry, recipeIndex) => ({
                id: String(entry?.id || `sug_${groupIndex}_${recipeIndex}`),
                why: String(entry?.why || '').trim(),
                recipe: normalizeRecipe(entry?.recipe),
                image: null,
            }))
            : [],
    }));
}

export async function fetchQuickSuggestions({ ingredients, coupons, locale }) {
    const params = new URLSearchParams({
        match: '1',
        ingredients: ingredients || '',
        coupons: coupons || '',
        locale: locale || 'en',
    });

    const res = await fetch(`${SUGGESTION_URL}?${params.toString()}`, {
        method: 'GET',
        headers: { 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
    });

    if (!res.ok) {
        throw new Error(`Quick suggestions API failed (${res.status})`);
    }

    const json = await res.json();
    return Array.isArray(json?.suggestions) ? json.suggestions : [];
}
