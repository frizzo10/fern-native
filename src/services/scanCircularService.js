import { defaultScanZip } from '../utils/storeZip';
import { logApiResponse } from '../utils/apiLogger';
import { archiveCircularScan } from '../utils/circularHistory';
import { recordScan, streakWeeks, pagesThisWeek } from '../utils/scanStats';
import { reportScan } from './scanBoardService';
import { saveWeekDeals } from '../utils/savings';
import { uploadPhoto } from './uploadPhotoService';

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

// TEMP debug: what the last recipe-ideas call came back with (shown on the phone when it fails).
let lastDealIdeasNote = '';
export function getLastDealIdeasNote() { return lastDealIdeasNote; }

async function postToAi(payload) {
    // A stalled connection used to leave the spinner going forever; give up after 25 s.
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 25000) : null;
    try {
        const res = await fetch(AI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'FernApp/1.0 (myaifern.com)',
            },
            body: JSON.stringify(payload),
            signal: ctrl ? ctrl.signal : undefined,
        });

        if (!res.ok) {
            throw new Error(`Scan Circular AI request failed (${res.status})`);
        }

        return await res.json();
    } catch (e) {
        if (e?.name === 'AbortError') throw new Error('The recipe request timed out');
        throw e;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

export async function fetchDealRecipeIdeas({ itemName, locale, token, exclude = [], note = '' }) {
    const skip = (Array.isArray(exclude) ? exclude : []).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 30);
    const skipLine = skip.length ? ` Do NOT suggest any of these dishes or close variations of them: ${skip.join('; ')}. Make the 3 ideas clearly different from each other (different cuisines or cooking methods).` : ' Make the 3 ideas clearly different from each other (different cuisines or cooking methods).';
    const ask = async () => {
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
        const text = extractResponseText(json);
        let parsed = parseJsonLoose(text);
        // The model sometimes wraps the list ({"ideas":[...]}) or answers with a single dish object.
        if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') {
            const inner = Object.values(parsed).find((v) => Array.isArray(v));
            parsed = inner || (parsed.title ? [parsed] : []);
        }
        if (!Array.isArray(parsed) || !parsed.length) console.log('[deal-ideas] unreadable reply:', String(text).slice(0, 300));
        lastDealIdeasNote = `reply: ${String(text || '(empty)').replace(/\s+/g, ' ').slice(0, 140)}`;
        return Array.isArray(parsed) ? parsed : [];
    };

    let list = await ask();
    if (!list.length) list = await ask(); // one quiet retry: an odd reply is usually a one-off

    const skipSet = new Set(skip.map((x) => x.toLowerCase()));
    return list
        .filter((idea) => !skipSet.has(String(idea?.title || idea?.name || idea?.dish || '').trim().toLowerCase()))
        .map((idea, index) => ({
            id: `deal-idea-${Date.now()}-${index}`,
            // The model sometimes names the dish "name" or "dish" instead of "title".
            title: String(idea?.title || idea?.name || idea?.dish || idea?.recipe || idea?.meal || '').trim(),
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
    return haystack.includes('bogo') || haystack.includes('buy one') || /buy\s*1\s*,?\s*get\s*(1|2|one|two)/.test(haystack);
}

// "99¢", "$99¢" or "69 ¢" -> "$0.99" (the scan sometimes echoes a cents price with a dollar sign).
function fixCents(value) {
    if (value == null) return value;
    const m = String(value).match(/^\s*\$?\s*(\d+)\s*¢\s*$/);
    return m ? `$${(parseInt(m[1], 10) / 100).toFixed(2)}` : value;
}

function normalizeItem(item, index) {
    item = item ? { ...item, salePrice: fixCents(item.salePrice), originalPrice: fixCents(item.originalPrice) } : item;
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

const SCAN_BG_URL = 'https://app.clickpickandcook.com/.netlify/functions/scan-flyer-background';
const SCAN_STATUS_URL = 'https://app.clickpickandcook.com/.netlify/functions/scan-circular-status';

// A dense flyer page can take the AI longer than the ~30 s request limit (every try came back 504),
// so the scan runs as a background job and the phone checks on it. Returns null if the job can't be
// started (an older server), so the caller falls back to the plain request.
async function scanViaBackground(payload) {
    // scan_jobs.job_id is a Postgres uuid column: any other format is rejected by the database (and the job silently never exists).
    const jobId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.floor(Math.random() * 16);
        return (c === 'x' ? r : (r % 4) + 8).toString(16);
    });
    let bgBody = { ...payload, jobId };
    // Netlify background functions refuse bodies over ~256 KB (413) and a flyer photo is far bigger. So the photo goes up
    // first through upload-photo and the background job gets a link to it (the server fetches it, scans it, deletes it).
    // If the upload fails we return null and the caller uses the plain request, as before.
    if (JSON.stringify(payload).length > 240000) {
        let url = null;
        try {
            const png = payload.mediaType === 'image/png';
            url = await uploadPhoto(`data:${png ? 'image/png' : 'image/jpeg'};base64,${payload.imageData}`, `scanjob_${jobId}.${png ? 'png' : 'jpg'}`, 60000);
        } catch (e) {
            console.log('[scan-circular] photo upload failed:', e?.message || e);
            // A timeout means the connection is too slow to send the photo; the direct request would hang the same way, so say so.
            if (/timed out/.test(String(e?.message))) throw new Error(`Couldn't send the photo (${e.message}). Check your Wi-Fi or signal and try again.`);
        }
        if (!url) return null;
        const { imageData, ...rest } = payload;
        bgBody = { ...rest, imageUrl: url, jobId };
    }
    let started;
    try {
        const c1 = new AbortController();
        const t1 = setTimeout(() => c1.abort(), 20000);
        try {
            started = await fetch(SCAN_BG_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
                body: JSON.stringify(bgBody),
                signal: c1.signal,
            });
        } finally { clearTimeout(t1); }
    } catch (e) {
        return null;
    }
    if (!started.ok && started.status !== 202) return null;

    const t0 = Date.now();
    let misses = 0;
    while (Date.now() - t0 < 140000) {
        await new Promise((r) => setTimeout(r, 2500));
        let st;
        try {
            const c2 = new AbortController();
            const t2 = setTimeout(() => c2.abort(), 15000);
            try {
                const r = await fetch(`${SCAN_STATUS_URL}?jobId=${encodeURIComponent(jobId)}`, { signal: c2.signal });
                if (!r.ok) continue;
                st = await r.json();
            } finally { clearTimeout(t2); }
        } catch (e) {
            continue;
        }
        if (st?.status === 'done' && st.result) return st.result;
        if (st?.status === 'error') throw new Error(st.error || 'Scan failed');
        if (st?.status === 'not_found') {
            // The job row is written a moment after the start; if it never shows up, use the plain request.
            if (++misses > 8) return null;
        }
    }
    throw new Error('Scan took too long');
}

async function scanDirect(send) {
    // A dropped connection or a gateway timeout can happen after the server already
    // finished reading the flyer (the server caches the result by photo), so one quiet
    // retry usually returns instantly instead of showing "couldn't read that circular".
    let res;
    try {
        res = await send();
        if (res.status >= 502) throw new Error(`Scan Circular API failed (${res.status})`);
    } catch (firstErr) {
        console.log('[scan-circular] first try failed, retrying once:', firstErr?.message || firstErr);
        await new Promise((r) => setTimeout(r, 1500));
        res = await send();
    }
    if (!res.ok) {
        throw new Error(`Scan Circular API failed (${res.status})`);
    }
    return res.json();
}

export async function scanCircular({ userId, base64, mimeType, token, zipCode, storeName: pickedStore }) {
    const zip = zipCode || (await defaultScanZip());
    const send = () => fetch(SCAN_CIRCULAR_URL, {
        signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(60000) : undefined,
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
            ...(pickedStore ? { store: pickedStore } : {}),
        }),
    });

    const payload = {
        mediaType: mimeType || 'image/jpeg',
        userId,
        token,
        imageData: base64,
        ...(zip ? { zipCode: zip } : {}),
        ...(pickedStore ? { store: pickedStore } : {}),
    };
    const json = await scanViaBackground(payload) || await scanDirect(send);
    // Skipped: this response can carry dozens of flyer items — logApiResponse's
    // truncation would just cut it mid-item. Log a summary instead.
    console.log(`[api] scan-circular → store="${json?.store}" items=${Array.isArray(json?.items) ? json.items.length : 0}`);

    const items = Array.isArray(json?.items) ? json.items.map(normalizeItem) : [];
    // A store the shopper picked first wins over the name read off the photo, so the flyer is filed under that store.
    // But if the flyer clearly says it is a DIFFERENT chain (a Harris Teeter page scanned while Publix was open), believe the flyer.
    const chainOf = (n) => String(n || '').toLowerCase().split(/ - |#/)[0].replace(/[^a-z0-9]/g, '');
    const readStore = json?.store ? String(json.store).trim() : '';
    const pk = chainOf(pickedStore);
    const rk = chainOf(readStore);
    const differs = pk && rk.length >= 4 && !pk.includes(rk) && !rk.includes(pk);
    const storeName = pickedStore && !differs ? String(pickedStore).trim() : (readStore || (pickedStore ? String(pickedStore).trim() : ''));

    // Fire-and-forget: archive into per-store scan history (shown in the Scan
    // Circular sheet). Never blocks or fails the scan itself.
    archiveCircularScan({ storeName, items });
    // Also remembered for the week so the Shopping tab can show "This week's sales" (every plan, not just Pro Max).
    await saveWeekDeals(items.map((item) => ({ ...item, store: storeName })));
    // Scan game: count this page for the shopper's streak / pages-this-week (never blocks the scan).
    let game = null;
    try {
        const stats = await recordScan(storeName, items.length);
        if (stats) {
            game = { streak: streakWeeks(stats), pages: pagesThisWeek(stats, storeName), total: stats.total };
            reportScan({ token, stats, addItems: items.length });
        }
    } catch (e) { game = null; }

    return {
        store: storeName,
        validDates: json?.validDates ? String(json.validDates).trim() : '',
        headline: json?.headline ? String(json.headline).trim() : '',
        sectionsFound: Array.isArray(json?.sectionsFound) ? json.sectionsFound : [],
        items,
        sections: groupByCategory(items),
        totalSavings: computeTotalSavings(items),
        game,
        raw: json,
    };
}
