import { logApiResponse } from '../utils/apiLogger';

const PERSONAL_SHOPPER_URL = 'https://app.clickpickandcook.com/.netlify/functions/personal-shopper-plan';

async function postShopper(body) {
    const res = await fetch(PERSONAL_SHOPPER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FernApp/1.0 (myaifern.com)',
        },
        body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => ({}));
    logApiResponse(`personal-shopper-plan (${body.action})`, json);

    if (!res.ok || json?.error) {
        throw new Error(json?.error || `personal-shopper-plan ${body.action} failed (${res.status})`);
    }
    return json;
}

// The backend only ever reads a saved recipe's `title` for start/suggest_dinners,
// so send titles only instead of the whole library (images, steps, notes…).
function titlesOnly(recipes) {
    return (Array.isArray(recipes) ? recipes : [])
        .map((recipe) => ({ title: String(recipe?.title || '').trim() }))
        .filter((recipe) => recipe.title)
        .slice(0, 25);
}

// action: 'start' → { reply, systemPrompt, forecast[], recurringActs[], thisWeekActs, planStatus }
export async function startPersonalShopper({ userProfile, lat, lon, mealPlan, savedRecipes, activities, locale }) {
    const json = await postShopper({
        action: 'start',
        locale: locale || 'en',
        userProfile: userProfile || {},
        lat: lat ?? null,
        lon: lon ?? null,
        mealPlan: mealPlan || {},
        savedRecipes: titlesOnly(savedRecipes),
        activities: activities || [],
        activityHistory: activities || [],
    });

    return {
        reply: String(json?.reply || '').trim(),
        systemPrompt: String(json?.systemPrompt || ''),
        forecast: Array.isArray(json?.forecast) ? json.forecast : [],
        recurringActs: Array.isArray(json?.recurringActs) ? json.recurringActs.filter((act) => typeof act === 'string') : [],
    };
}

// Saved recipes with a few ingredient names, so the backend can tell which
// cookbook recipes actually use the sale items.
function recipesWithIngredients(recipes) {
    return (Array.isArray(recipes) ? recipes : [])
        .map((recipe) => ({
            title: String(recipe?.title || '').trim(),
            ingredients: (Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
                .map((ing) => (typeof ing === 'string' ? ing : String(ing?.item || ing?.name || '')))
                .map((ing) => ing.replace(/^[\d\s¼½¾⅓⅔./-]+(cups?|tbsp|tsp|oz|lbs?|g|kg|ml|l|cans?|cloves?)?\s*/i, '').trim())
                .filter(Boolean)
                .slice(0, 10),
        }))
        .filter((recipe) => recipe.title)
        .slice(0, 25);
}

// action: 'suggest_dinners' → { suggestions: [{ dayName, date, title, reason, quick }], pitch }
export async function fetchDinnerSuggestions({ savedRecipes, forecast, activities, mealPlan, userProfile, locale, deals, dealsStore }) {
    const json = await postShopper({
        action: 'suggest_dinners',
        locale: locale || 'en',
        savedRecipes: recipesWithIngredients(savedRecipes),
        forecast: forecast || [],
        activities: activities || [],
        mealPlan: mealPlan || {},
        userProfile: userProfile || {},
        // Sale items scanned from the store flyer (Pro Max arrival flow); omitted otherwise.
        ...(Array.isArray(deals) && deals.length ? { deals, dealsStore: dealsStore || '' } : {}),
    });

    return {
        pitch: String(json?.pitch || '').trim(),
        suggestions: (Array.isArray(json?.suggestions) ? json.suggestions : [])
            .map((item) => ({
                dayName: String(item?.dayName || '').trim(),
                date: String(item?.date || '').trim(),
                title: String(item?.title || '').trim(),
                reason: String(item?.reason || '').trim(),
                quick: Boolean(item?.quick),
                source: item?.source === 'cookbook' ? 'cookbook' : 'ai',
                saleItems: (Array.isArray(item?.saleItems) ? item.saleItems : [])
                    .filter((sale) => sale && sale.name)
                    .map((sale) => ({ name: String(sale.name), price: String(sale.price || ''), isBogo: Boolean(sale.isBogo), store: String(sale.store || '') })),
            }))
            .filter((item) => item.title && /^\d{4}-\d{2}-\d{2}$/.test(item.date)),
    };
}

// action: 'get_recipe_ingredients' → { needed: [""], alreadyHave: [""] }
// Pure string matching on the backend (no AI call): drops anything the user
// said they have or that is already on the in-progress list.
export async function fetchNeededIngredients({ title, ingredients, alreadyHave, onList }) {
    const json = await postShopper({
        action: 'get_recipe_ingredients',
        recipe: { title, ingredients },
        alreadyHave: alreadyHave || [],
        onList: onList || [],
    });

    return {
        needed: (Array.isArray(json?.needed) ? json.needed : []).filter((item) => typeof item === 'string' && item.trim()),
        alreadyHave: (Array.isArray(json?.alreadyHave) ? json.alreadyHave : []).filter((item) => typeof item === 'string'),
    };
}

// action: 'build_list' → { sections: [{ id, name, emoji, items: [""] }] }
export async function buildSortedShoppingList({ items, locale }) {
    const json = await postShopper({ action: 'build_list', items, locale: locale || 'en' });

    return (Array.isArray(json?.sections) ? json.sections : [])
        .map((section) => ({
            id: String(section?.id || section?.name || ''),
            name: String(section?.name || '').trim(),
            emoji: String(section?.emoji || '🛒'),
            items: (Array.isArray(section?.items) ? section.items : []).filter((item) => typeof item === 'string' && item.trim()),
        }))
        .filter((section) => section.items.length);
}

// action: 'chat' → { reply }. `conversationHistory` includes the system prompt
// that `start` returned, as role 'system'.
export async function chatWithPersonalShopper({ conversationHistory, userMessage, locale }) {
    const json = await postShopper({
        action: 'chat',
        conversationHistory,
        userMessage,
        locale: locale || 'en',
    });

    return String(json?.reply || '').trim();
}
