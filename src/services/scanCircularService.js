import { defaultScanZip } from '../utils/storeZip';
import { logApiResponse } from '../utils/apiLogger';
import { archiveCircularScan } from '../utils/circularHistory';
import { saveWeekDeals } from '../utils/savings';

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

export async function fetchDealRecipeIdeas({ itemName, locale, token, exclude = [], note = '' }) {
    const skip = (Array.isArray(exclude) ? exclude : []).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 30);
    const skipLine = skip.length ? ` Do NOT suggest any of these dishes or close variations of them: ${skip.join('; ')}. Make the 3 ideas clearly different from each other (different cuisines or cooking methods).` : ' Make the 3 ideas clearly different from each other (different cuisines or cooking methods).';
    const json = await postToAi({
        system: 'Return ONLY a JSON array of 3 dinner objects. No text before or after. Each is a COMPLETE meal: a main dish that uses the given ingredient as the star, plus 1-2 simple sides. Example: [{"title":"Chicken Stir Fry","time":"25 min","emoji":"🍳","why":"Uses the chicken as the star","sides":["Steamed rice","Cucumber salad"]},{"title":"Lemon Herb Sheet-Pan Chicken","time":"40 min","emoji":"🍗","why":"One pan, minimal cleanup","sides":["Roasted potatoes","Green beans"]}]',
        messages: [
            {
                role: 'user',
                content: `Give me 3 dinner ideas (main + 1-2 sides each) using ${itemName}.${note ? ` ${note}` : ''}${skipLine} Return ONLY the JSON array, nothing else.`,
            },
        ],
        feature: 'fern_chat',
        locale: locale || 'en',
        token,
    });

    logApiResponse('ai (fern_chat, deal-ideas)', json);

    const parsed = parseJsonLoose(extractResponseText(json));
    const list = Array.isArray(parsed) ? parsed : [];

    const skipSet = new Set(skip.map((x) => x.toLowerCase()));
    return list
        .filter((idea) => !skipSet.has(String(idea?.title || '').trim().toLowerCase()))
        .map((idea, index) => ({
            id: `deal-idea-${Date.now()}-${index}`,
            title: String(idea?.title || '').trim(),
            time: String(idea?.time || '').trim(),
            emoji: idea?.emoji || '🍽️',
            why: String(idea?.why || '').trim(),
            sides: Array.isArray(idea?.sides) ? idea.sides.map((x) => String(x).trim()).filter(Boolean).slice(0, 2) : [],
        }))
        .filter((idea) => idea.title);
}

export async function fetchFullRecipeForDealIdea({ idea, itemName, locale, token }) {
    const json = await postToAi({
        system: 'You are a world-class chef. Return ONLY a single JSON object (no array, no markdown, no explanation) for one full recipe: {"title":"","cuisine":"","mealType":"Dinner","time":"35 min total (prep + cook)","difficulty":"Easy|Medium|Hard","description":"one sentence","ingredients":["2 cups flour"],"instructions":["complete step with temperatures and times"],"emoji":"🍽️"}',
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

export async function scanCircular({ userId, base64, mimeType, token, zipCode }) {
    const zip = zipCode || (await defaultScanZip());
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
            ...(zip ? { zipCode: zip } : {}),
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
    const storeName = json?.store ? String(json.store).trim() : '';

    // Fire-and-forget: archive into per-store scan history (shown in the Scan
    // Circular sheet). Never blocks or fails the scan itself.
    archiveCircularScan({ storeName, items });
    // Also remembered for the week so the Shopping tab can show "This week's sales" (every plan, not just Pro Max).
    saveWeekDeals(items.map((item) => ({ ...item, store: storeName })));

    return {
        store: storeName,
        validDates: json?.validDates ? String(json.validDates).trim() : '',
        headline: json?.headline ? String(json.headline).trim() : '',
        sectionsFound: Array.isArray(json?.sectionsFound) ? json.sectionsFound : [],
        items,
        sections: groupByCategory(items),
        totalSavings: computeTotalSavings(items),
        raw: json,
    };
}
