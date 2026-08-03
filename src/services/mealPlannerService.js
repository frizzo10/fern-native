import { logApiResponse } from '../utils/apiLogger';

const MEAL_PLANNER_URL = 'https://app.clickpickandcook.com/.netlify/functions/meal-planner';
const API_HEADERS = {
    'Content-Type': 'application/json',
    'User-Agent': 'FernApp/1.0 (myaifern.com)',
};

function normalizeMealFields(meal) {
    return {
        slot: String(meal?.slot || '').trim(),
        title: String(meal?.title || '').trim(),
        emoji: String(meal?.emoji || '🍽️').trim(),
        description: String(meal?.description || '').trim(),
        time: String(meal?.time || '').trim(),
        difficulty: String(meal?.difficulty || 'Easy').trim(),
        cuisine: String(meal?.cuisine || '').trim(),
        ingredients: Array.isArray(meal?.ingredients)
            ? meal.ingredients.map((item) => String(item || '').trim()).filter(Boolean)
            : [],
        instructions: Array.isArray(meal?.instructions)
            ? meal.instructions.map((step) => String(step || '').trim()).filter(Boolean)
            : [],
        notes: String(meal?.notes || '').trim(),
    };
}

function normalizeMeal(meal, dayIndex, mealIndex) {
    return {
        id: `meal-planner-${dayIndex}-${mealIndex}`,
        ...normalizeMealFields(meal),
    };
}

function normalizeDay(day, index) {
    return {
        id: `meal-planner-day-${index}`,
        dayLabel: String(day?.dayLabel || `Day ${index + 1}`).trim(),
        meals: Array.isArray(day?.meals) ? day.meals.map((meal, mealIndex) => normalizeMeal(meal, index, mealIndex)) : [],
    };
}

export async function fetchMealPlan({ userId, token }) {
    const res = await fetch(MEAL_PLANNER_URL, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ action: 'load_plan', userId, token }),
    });

    if (!res.ok) {
        throw new Error(`Meal planner load failed (${res.status})`);
    }

    const responseJson = await res.json();
    logApiResponse('meal-planner (load_plan)', responseJson);

    const days = Array.isArray(responseJson?.plan?.days)
        ? responseJson.plan.days.map((day, index) => normalizeDay(day, index))
        : [];

    return { days };
}

// Strips our locally-added `id` fields back off before round-tripping the
// current plan to the `generate` call, so the payload matches the shape the
// backend itself returns.
function denormalizeDaysForApi(days) {
    return (Array.isArray(days) ? days : []).map((day) => ({
        dayLabel: day.dayLabel,
        meals: (day.meals || []).map((meal) => ({
            slot: meal.slot,
            title: meal.title,
            emoji: meal.emoji,
            time: meal.time,
            difficulty: meal.difficulty,
            cuisine: meal.cuisine,
            ingredients: meal.ingredients,
            instructions: meal.instructions,
        })),
    }));
}

// Sends the current plan back alongside the user's saved-recipe titles so the
// backend knows what's already been suggested/cooked and can pick something
// different rather than repeating it. Note: unlike `load_plan`, this call
// takes no `token` — matches the captured request shape exactly.
export async function generateMealPlan({ userId, locale, savedRecipes, currentDays }) {
    const payload = {
        action: 'generate',
        userId,
        locale: locale || 'en',
        savedRecipes: Array.isArray(savedRecipes) ? savedRecipes : [],
        plan: { days: denormalizeDaysForApi(currentDays) },
    };

    const res = await fetch(MEAL_PLANNER_URL, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(`Meal planner generate failed (${res.status})`);
    }

    const responseJson = await res.json();
    logApiResponse('meal-planner (generate)', responseJson);

    const days = Array.isArray(responseJson?.plan?.days)
        ? responseJson.plan.days.map((day, index) => normalizeDay(day, index))
        : [];

    return { days };
}

// Swaps a single meal ("Swap this meal") — sends the whole current plan back
// plus `dayIndex`/`slot` so the backend knows exactly which meal to replace;
// those two are the only thing identifying it (not title, since titles could
// repeat), so the caller must splice the response into that same slot rather
// than matching by name. No `token` here either, matching `generate`.
export async function regenerateMeal({ userId, locale, currentDays, dayIndex, slot }) {
    const payload = {
        action: 'regenerate_meal',
        userId,
        locale: locale || 'en',
        plan: { days: denormalizeDaysForApi(currentDays) },
        dayIndex,
        slot,
    };

    const res = await fetch(MEAL_PLANNER_URL, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(`Meal planner regenerate meal failed (${res.status})`);
    }

    const responseJson = await res.json();
    logApiResponse('meal-planner (regenerate_meal)', responseJson);

    return normalizeMealFields(responseJson?.meal);
}

// No confirmed response sample yet — accepts a couple of likely key names
// for the group list (mirrors the defensive style already used for coupons/
// wine pairings elsewhere) so a renamed key degrades to an empty list instead
// of crashing. No `token`, matching `generate`/`regenerate_meal`.
export async function fetchMealPlannerShoppingList({ userId, locale, currentDays }) {
    const payload = {
        action: 'shopping_list',
        userId,
        plan: { days: denormalizeDaysForApi(currentDays) },
        locale: locale || 'en',
    };

    const res = await fetch(MEAL_PLANNER_URL, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(`Meal planner shopping list failed (${res.status})`);
    }

    const responseJson = await res.json();
    logApiResponse('meal-planner (shopping_list)', responseJson);

    const rawGroups = Array.isArray(responseJson?.shoppingList)
        ? responseJson.shoppingList
        : Array.isArray(responseJson?.shopping_list)
            ? responseJson.shopping_list
            : Array.isArray(responseJson?.list)
                ? responseJson.list
                : Array.isArray(responseJson)
                    ? responseJson
                    : [];

    const groups = rawGroups
        .map((group, index) => ({
            category: String(group?.category || group?.section || `Other ${index + 1}`).trim(),
            items: Array.isArray(group?.items)
                ? group.items.map((item) => String(item || '').trim()).filter(Boolean)
                : [],
        }))
        .filter((group) => group.items.length > 0);

    return { groups };
}

// Persists a freshly generated plan (with the preferences that produced it)
// so the backend has a record of it — called right after `generate` resolves.
export async function saveMealPlan({ userId, token, days, preferences }) {
    const payload = {
        action: 'save_plan',
        userId,
        token,
        plan: { days: denormalizeDaysForApi(days) },
        preferences: preferences || {},
    };

    const res = await fetch(MEAL_PLANNER_URL, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(`Meal planner save failed (${res.status})`);
    }

    const responseJson = await res.json();
    logApiResponse('meal-planner (save_plan)', responseJson);

    return Boolean(responseJson?.success);
}
