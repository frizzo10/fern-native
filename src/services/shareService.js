import { logApiResponse } from '../utils/apiLogger';

const FUNCTIONS_BASE = 'https://app.clickpickandcook.com/.netlify/functions';
const SITE_URL = 'https://app.clickpickandcook.com';

// RecipeDetailModal / RecipesScreen fill these in when a recipe has no real
// ingredients, steps or description yet — never send them to a share page.
const PLACEHOLDERS = new Set([
    'no ingredients listed yet',
    'no method steps listed yet',
    'no description yet.',
]);

function realLines(list) {
    return (Array.isArray(list) ? list : [])
        .map((line) => String(line || '').trim())
        .filter((line) => line && !PLACEHOLDERS.has(line.toLowerCase()));
}

function realText(value) {
    const text = String(value || '').trim();
    return PLACEHOLDERS.has(text.toLowerCase()) ? '' : text;
}

function isWebUrl(value) {
    return /^https?:\/\//i.test(String(value || ''));
}

// Maps a normalized native recipe (src/utils/recipeNormalize.js) to the field
// names the web app's `share` / `share-cookbook` functions read.
export function toSharedRecipe(recipe) {
    return {
        title: String(recipe?.title || '').trim(),
        emoji: recipe?.emoji || '🍽',
        cuisine: recipe?.category || '',
        mealType: recipe?.meal || '',
        time: recipe?.time || '',
        difficulty: recipe?.difficulty || '',
        description: realText(recipe?.description),
        servings: recipe?.servings || '',
        ingredients: realLines(recipe?.ingredients),
        instructions: realLines(recipe?.methodSteps),
        notes: String(recipe?.note || '').trim(),
        // Only a hosted photo can be shown on the share page — a local file
        // or data URI would be a dead image for everyone else.
        photo: isWebUrl(recipe?.image) ? recipe.image : '',
    };
}

async function postJson(fn, body) {
    const res = await fetch(`${FUNCTIONS_BASE}/${fn}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FernApp/1.0 (myaifern.com)',
        },
        body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => ({}));
    logApiResponse(fn, json);

    if (!res.ok || json?.error) {
        throw new Error(json?.error || `${fn} failed (${res.status})`);
    }
    if (!json?.url) {
        throw new Error(`${fn} returned no link`);
    }
    return json.url;
}

// POST /share → { url }. The backend saves the recipe to Supabase
// (shared_recipes) and returns a share.html?id=… link.
export function createRecipeShareLink({ recipe, senderName, message }) {
    return postJson('share', {
        recipe: toSharedRecipe(recipe),
        message: String(message || '').trim(),
        senderName: String(senderName || '').trim(),
        siteUrl: SITE_URL,
    });
}

// POST /share-cookbook → { url }. The web app sends a resized base64 cover; a
// hosted cover URL (what native keeps in rv4_cb_covers) is passed as-is.
export function createCookbookShareLink({ title, colorId, recipes, coverUrl, senderName, message }) {
    return postJson('share-cookbook', {
        cookbook: {
            name: String(title || '').trim(),
            colorId: colorId || undefined,
            coverUrl: isWebUrl(coverUrl) ? coverUrl : '',
            recipes: (recipes || []).map(toSharedRecipe),
        },
        message: String(message || '').trim(),
        senderName: String(senderName || '').trim(),
        siteUrl: SITE_URL,
    });
}
