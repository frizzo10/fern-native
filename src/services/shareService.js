import { logApiResponse } from '../utils/apiLogger';
import { fetchRecipeImage } from '../utils/recipeImage';

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
export function toSharedRecipe(recipe, chapter) {
    return {
        chapter: chapter || '',
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
export async function createRecipeShareLink({ recipe, senderName, message, token }) {
    // A link preview with no picture is a blank gray card, so a recipe without a hosted photo gets one first.
    let withPhoto = recipe;
    if (!isWebUrl(recipe?.image)) {
        const url = await fetchRecipeImage(recipe?.title, token);
        if (isWebUrl(url)) withPhoto = { ...recipe, image: url };
    }
    return postJson('share', {
        recipe: toSharedRecipe(withPhoto),
        message: String(message || '').trim(),
        senderName: String(senderName || '').trim(),
        siteUrl: SITE_URL,
    });
}

// POST /share-cookbook → { url }. The web app sends a resized base64 cover; a
// hosted cover URL (what native keeps in rv4_cb_covers) is passed as-is.
export async function createCookbookShareLink({ title, colorId, recipes, coverUrl, senderName, message, chapterById, token }) {
    // No hosted cover? Use the first recipe photo, else look one up, so the link preview is never a blank gray card.
    let cover = isWebUrl(coverUrl) ? coverUrl : '';
    if (!cover) {
        const withPhoto = (recipes || []).find((r) => isWebUrl(r?.image));
        if (withPhoto) cover = withPhoto.image;
        else {
            const found = await fetchRecipeImage(recipes?.[0]?.title || title, token);
            if (isWebUrl(found)) cover = found;
        }
    }
    return postJson('share-cookbook', {
        cookbook: {
            name: String(title || '').trim(),
            colorId: colorId || undefined,
            coverUrl: cover,
            recipes: (recipes || []).map((r) => toSharedRecipe(r, chapterById ? chapterById[String(r.id)] : '')),
        },
        message: String(message || '').trim(),
        senderName: String(senderName || '').trim(),
        siteUrl: SITE_URL,
    });
}

// POST /share-plan → { url } — a public "my week of dinners" page that opens without an account.
// days: [{ label, meals: [{ slot, title, emoji }] }] (meal names only; nothing personal is sent).
export async function createPlanShareLink({ days, senderName, store }) {
    const json = await postJson('share-plan', {
        days: days || [],
        senderName: String(senderName || '').trim(),
        store: String(store || '').trim(),
    });
    return json?.url;
}

// Reads a shared cookbook back from the server so it can be added to this
// library. `input` is a pasted share link (…/cookbook-share.html?id=abc12345,
// possibly with other text around it) or just the bare id.
// → { id, name, recipes: [native raw recipe objects without ids/_bookIds] }
export function parseCookbookShareId(input) {
    const text = String(input || '');
    const fromLink = text.match(/[?&#/]id=([a-z0-9]{1,16})/i) || text.match(/\/s\/[rc]\/([a-z0-9]{1,16})/i);
    if (fromLink) return fromLink[1];
    const bare = text.trim().match(/^[a-z0-9]{6,16}$/i);
    return bare ? bare[0] : '';
}

export async function fetchSharedCookbook(input) {
    const id = parseCookbookShareId(input);
    if (!id) throw new Error('not_a_link');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    let res;
    try {
        res = await fetch(`${FUNCTIONS_BASE}/share-cookbook?id=${encodeURIComponent(id)}`, {
            headers: { 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
            signal: ctrl.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (res.status === 404) throw new Error('not_found');
    if (!res.ok) throw new Error(`server_${res.status}`);
    const d = await res.json();
    const list = Array.isArray(d?.r) ? d.r : [];
    if (!list.length) throw new Error('not_found');
    return {
        id,
        name: String(d.n || 'Shared cookbook'),
        recipes: list.map((r) => ({
            title: r.t || '',
            emoji: r.e || '🍽',
            cuisine: r.c || '',
            mealType: r.m || '',
            time: r.tm || '',
            difficulty: r.d || '',
            description: r.ds || '',
            ingredients: Array.isArray(r.i) ? r.i : [],
            instructions: Array.isArray(r.ins) ? r.ins : [],
            note: r.n || '',
            _cloudPhotos: r.p && /^https?:\/\//i.test(r.p) ? [r.p] : [],
        })).filter((r) => r.title),
        cover: /^https?:\/\//i.test(d.cv || '') ? d.cv : '',
    };
}

// Recipe share links (…/share.html?id=abc12345) come back from `share?id=` as { t,e,c,m,tm,d,ds,i,ins,n,p,s,msg }.
export function parseShareLink(input) {
    const text = String(input || '');
    const id = parseCookbookShareId(text);
    if (!id) return { kind: '', id: '' };
    if (/cookbook-share|\/s\/c\//i.test(text)) return { kind: 'cookbook', id };
    if (/share\.html|\/s\/r\//i.test(text)) return { kind: 'recipe', id };
    return { kind: 'unknown', id }; // bare id: try cookbook first, then recipe
}

export async function fetchSharedRecipe(id) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    let res;
    try {
        res = await fetch(`${FUNCTIONS_BASE}/share?id=${encodeURIComponent(id)}`, {
            headers: { 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
            signal: ctrl.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (res.status === 404 || res.status === 400) throw new Error('not_found');
    if (!res.ok) throw new Error(`server_${res.status}`);
    const r = await res.json();
    if (!r?.t) throw new Error('not_found');
    return {
        title: r.t,
        emoji: r.e || '🍽',
        cuisine: r.c || '',
        mealType: r.m || '',
        time: r.tm || '',
        difficulty: r.d || '',
        description: r.ds || '',
        ingredients: Array.isArray(r.i) ? r.i : [],
        instructions: Array.isArray(r.ins) ? r.ins : [],
        note: r.n || '',
        _cloudPhotos: r.p && /^https?:\/\//i.test(r.p) ? [r.p] : [],
    };
}
