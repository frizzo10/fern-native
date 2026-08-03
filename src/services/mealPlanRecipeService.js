import { logApiResponse } from '../utils/apiLogger';

const MEAL_PLAN_RECIPE_SYSTEM_PROMPT = 'You are a recipe assistant. Return ONLY a JSON object with: title, ingredients (array of strings), directions (array of step strings), time (string like "30 min"), servings (number). No markdown.';

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

const DINNER_IDEAS_SYSTEM_PROMPT = 'Generate dinner ideas. Return ONLY a JSON array of objects: [{title,emoji,cuisine,time}]. No markdown.';

function parseResponseTextAsJsonArray(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;

    try {
        const direct = JSON.parse(raw);
        return Array.isArray(direct) ? direct : null;
    } catch {
        const match = raw.match(/\[[\s\S]*\]/);
        if (!match) return null;

        try {
            const parsed = JSON.parse(match[0]);
            return Array.isArray(parsed) ? parsed : null;
        } catch {
            return null;
        }
    }
}

// "AI Fill Week" — asks for exactly as many ideas as there are empty dinner
// slots in the current 7-day window, one idea per missing day.
export async function fetchDinnerIdeas({ count, locale, token }) {
    const requestedCount = Math.max(1, Number.parseInt(count, 10) || 1);
    const payload = {
        system: DINNER_IDEAS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Give me ${requestedCount} different quick weeknight dinner ideas. Vary cuisines.` }],
        locale: locale || 'en',
        token,
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
        throw new Error(`Dinner ideas API failed (${res.status})`);
    }

    const responseJson = await res.json();
    logApiResponse('ai (dinner ideas)', responseJson);

    const responseText = responseJson?.content?.find((part) => part?.type === 'text')?.text
        || responseJson?.message
        || responseJson?.reply
        || '';

    const parsed = parseResponseTextAsJsonArray(responseText) || [];

    return parsed.map((idea) => ({
        title: String(idea?.title || '').trim(),
        emoji: String(idea?.emoji || '🍽️').trim(),
        cuisine: String(idea?.cuisine || '').trim(),
        time: String(idea?.time || '').trim(),
    })).filter((idea) => idea.title);
}

export async function fetchMealPlanRecipeDetail({ title, locale, token }) {
    const payload = {
        system: MEAL_PLAN_RECIPE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Give me the recipe for: ${title}` }],
        locale: locale || 'en',
        token,
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
        throw new Error(`Meal plan recipe API failed (${res.status})`);
    }

    const responseJson = await res.json();
    logApiResponse('ai (meal-plan recipe)', responseJson);

    const responseText = responseJson?.content?.find((part) => part?.type === 'text')?.text
        || responseJson?.message
        || responseJson?.reply
        || '';

    const parsed = parseResponseTextAsJson(responseText) || {};

    return {
        title: String(parsed?.title || title || '').trim(),
        ingredients: Array.isArray(parsed?.ingredients) ? parsed.ingredients.map((i) => String(i || '').trim()).filter(Boolean) : [],
        directions: Array.isArray(parsed?.directions) ? parsed.directions.map((s) => String(s || '').trim()).filter(Boolean) : [],
        time: String(parsed?.time || '').trim(),
        servings: Number.parseInt(parsed?.servings, 10) || 4,
    };
}
