import { logApiResponse } from '../utils/apiLogger';

const SCAN_CIRCULAR_URL = 'https://app.clickpickandcook.com/.netlify/functions/scan-circular';
const AI_URL = 'https://app.clickpickandcook.com/.netlify/functions/ai';

function extractResponseText(json) {
    return json?.content?.find((part) => part?.type === 'text')?.text
        || json?.message
        || json?.reply
        || '';
}

function parseJsonLoose(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        const arrayMatch = raw.match(/\[[\s\S]*\]/);
        const objectMatch = raw.match(/\{[\s\S]*\}/);
        const match = arrayMatch || objectMatch;
        if (!match) return null;

        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }
}

async function postToAi(payload) {
    const res = await fetch(AI_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FernApp/1.0 (myaifern.com)',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(`Scan Circular AI request failed (${res.status})`);
    }

    return res.json();
}

export async function fetchDealRecipeIdeas({ itemName, locale, token }) {
    const json = await postToAi({
        system: 'Return ONLY a JSON array of 3 recipe objects. No text before or after. Example: [{"title":"Chicken Stir Fry","time":"25 min","emoji":"🍳","why":"Uses the chicken as the star"},{"title":"Chicken Soup","time":"40 min","emoji":"🥣","why":"A classic comfort meal"},{"title":"Grilled Chicken Salad","time":"20 min","emoji":"🥗","why":"Light and fresh option"}]',
        messages: [
            {
                role: 'user',
                content: `Give me 3 recipe ideas using ${itemName}. Return ONLY the JSON array, nothing else.`,
            },
        ],
        feature: 'fern_chat',
        locale: locale || 'en',
        token,
    });

    logApiResponse('ai (fern_chat, deal-ideas)', json);

    const parsed = parseJsonLoose(extractResponseText(json));
    const list = Array.isArray(parsed) ? parsed : [];

    return list
        .map((idea, index) => ({
            id: `deal-idea-${Date.now()}-${index}`,
            title: String(idea?.title || '').trim(),
            time: String(idea?.time || '').trim(),
            emoji: idea?.emoji || '🍽️',
            why: String(idea?.why || '').trim(),
        }))
        .filter((idea) => idea.title);
}

export async function fetchFullRecipeForDealIdea({ idea, itemName, locale, token }) {
    const json = await postToAi({
        system: 'You are a world-class chef. Return ONLY a single JSON object (no array, no markdown, no explanation) for one full recipe: {"title":"","cuisine":"","mealType":"Dinner","time":"","difficulty":"Easy|Medium|Hard","description":"","ingredients":["2 cups flour"],"instructions":["step one"],"emoji":"🍽️"}',
        messages: [
            {
                role: 'user',
                content: `Give me the full recipe for "${idea?.title}", which uses ${itemName} as a key ingredient. Return ONLY the JSON object, nothing else.`,
            },
        ],
        feature: 'recipe_search',
        locale: locale || 'en',
        token,
    });

    logApiResponse('ai (recipe_search, deal-full-recipe)', json);

    const parsed = parseJsonLoose(extractResponseText(json)) || {};

    return {
        title: String(parsed?.title || idea?.title || '').trim(),
        cuisine: String(parsed?.cuisine || '').trim(),
        mealType: String(parsed?.mealType || 'Dinner').trim(),
        time: String(parsed?.time || idea?.time || '').trim(),
        difficulty: String(parsed?.difficulty || 'Medium').trim(),
        emoji: parsed?.emoji || idea?.emoji || '🍽️',
        description: String(parsed?.description || idea?.why || '').trim(),
        ingredients: Array.isArray(parsed?.ingredients) ? parsed.ingredients.map((item) => String(item).trim()).filter(Boolean) : [],
        instructions: Array.isArray(parsed?.instructions) ? parsed.instructions.map((step) => String(step).trim()).filter(Boolean) : [],
    };
}

function toNumber(value) {
    if (value == null) return null;
    const match = String(value).match(/[\d.]+/);
    if (!match) return null;
    const num = parseFloat(match[0]);
    return Number.isFinite(num) ? num : null;
}

function isBogoItem(item) {
    const haystack = `${item?.salePrice || ''} ${item?.savings || ''}`.toLowerCase();
    return haystack.includes('bogo') || haystack.includes('buy one');
}

function normalizeItem(item, index) {
    return {
        id: `scan-item-${index}`,
        name: String(item?.name || '').trim(),
        brand: item?.brand ? String(item.brand).trim() : null,
        originalPrice: item?.originalPrice ? String(item.originalPrice).trim() : null,
        salePrice: item?.salePrice ? String(item.salePrice).trim() : null,
        unit: item?.unit ? String(item.unit).trim() : null,
        savings: item?.savings ? String(item.savings).trim() : null,
        category: item?.category ? String(item.category).trim() : 'Other',
        emoji: item?.emoji || '🛒',
        dealScore: Number(item?.dealScore) || 0,
        cookable: Boolean(item?.cookable),
        isBogo: isBogoItem(item),
    };
}

function groupByCategory(items) {
    const order = [];
    const map = new Map();

    items.forEach((item) => {
        const key = item.category || 'Other';
        if (!map.has(key)) {
            map.set(key, []);
            order.push(key);
        }
        map.get(key).push(item);
    });

    return order.map((key) => ({ category: key, items: map.get(key) }));
}

function computeTotalSavings(items) {
    let total = 0;
    let hasNumericSavings = false;

    items.forEach((item) => {
        const original = toNumber(item.originalPrice);
        const sale = toNumber(item.salePrice);
        if (original != null && sale != null && original > sale) {
            total += original - sale;
            hasNumericSavings = true;
        }
    });

    return hasNumericSavings ? total : null;
}

export async function scanCircular({ userId, base64, mimeType, token }) {
    const res = await fetch(SCAN_CIRCULAR_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FernApp/1.0 (myaifern.com)',
        },
        body: JSON.stringify({
            mediaType: mimeType || 'image/jpeg',
            userId,
            token,
            imageData: base64,
        }),
    });

    if (!res.ok) {
        throw new Error(`Scan Circular API failed (${res.status})`);
    }

    const json = await res.json();
    // Skipped: this response can carry dozens of flyer items — logApiResponse's
    // truncation would just cut it mid-item. Log a summary instead.
    console.log(`[api] scan-circular → store="${json?.store}" items=${Array.isArray(json?.items) ? json.items.length : 0}`);

    const items = Array.isArray(json?.items) ? json.items.map(normalizeItem) : [];

    return {
        store: json?.store ? String(json.store).trim() : '',
        validDates: json?.validDates ? String(json.validDates).trim() : '',
        headline: json?.headline ? String(json.headline).trim() : '',
        sectionsFound: Array.isArray(json?.sectionsFound) ? json.sectionsFound : [],
        items,
        sections: groupByCategory(items),
        totalSavings: computeTotalSavings(items),
        raw: json,
    };
}
