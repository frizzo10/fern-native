// Publish walkthrough helpers: step text from the server, Fern-written listing, cover image, and the device-only
// progress / "where am I" notes. Steps live on the server (netlify/functions/publish-guide.js) so a changed
// Lemon Squeezy screen can be fixed without an app update.
import AsyncStorage from '@react-native-async-storage/async-storage';

const FN = 'https://app.clickpickandcook.com/.netlify/functions';
const PUBLISH_KEY = 'fern_publish';         // { [bookId]: { path, step, listing, coverUrl, pdfUrl, pages, finished } }
const CTX_KEY = 'fern_publish_ctx';         // what step the person is on, read by Ask Fern ("I'm stuck")
const CTX_MAX_AGE_MS = 6 * 60 * 60 * 1000;

async function readAll() {
    try {
        const v = JSON.parse((await AsyncStorage.getItem(PUBLISH_KEY)) || '{}');
        return v && typeof v === 'object' ? v : {};
    } catch (e) { return {}; }
}

export async function getPublish(bookId) {
    const all = await readAll();
    return all[String(bookId)] || {};
}

export async function setPublish(bookId, patch) {
    const all = await readAll();
    const next = { ...(all[String(bookId)] || {}), ...patch };
    all[String(bookId)] = next;
    try { await AsyncStorage.setItem(PUBLISH_KEY, JSON.stringify(all)); } catch (e) { /* best effort */ }
    return next;
}

export async function setPublishContext(ctx) {
    try { await AsyncStorage.setItem(CTX_KEY, JSON.stringify({ ...ctx, at: Date.now() })); } catch (e) { /* best effort */ }
}

export async function clearPublishContext() {
    try { await AsyncStorage.removeItem(CTX_KEY); } catch (e) { /* best effort */ }
}

export async function getPublishContext() {
    try {
        const v = JSON.parse((await AsyncStorage.getItem(CTX_KEY)) || 'null');
        if (v && Date.now() - (v.at || 0) < CTX_MAX_AGE_MS) return v;
    } catch (e) { /* none */ }
    return null;
}

export async function fetchPublishGuide(path, locale) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
        const res = await fetch(`${FN}/publish-guide?path=${encodeURIComponent(path)}&lang=${locale === 'es' ? 'es' : 'en'}`, {
            headers: { 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
            signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`guide failed (${res.status})`);
        const json = await res.json();
        if (!Array.isArray(json?.steps) || !json.steps.length) throw new Error('guide empty');
        return json.steps;
    } finally {
        clearTimeout(timer);
    }
}

// 1600 x 1600 JPG made on the server (title, author, optional first photo). -> url
export async function makeCookbookCover({ title, author, photoUrl, token }) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
        const res = await fetch(`${FN}/cookbook-cover`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
            body: JSON.stringify({ token, title, author, photoUrl: /^https?:\/\//i.test(photoUrl || '') ? photoUrl : '' }),
            signal: ctrl.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.url) throw new Error(json?.error || `cover failed (${res.status})`);
        return json.url;
    } finally {
        clearTimeout(timer);
    }
}

// Full-wrap Amazon KDP cover PDF (back + spine + front), sized from the page count and paper. -> { url, spineIn, ... }
export async function makeKdpCover({ title, author, pages, paper, trim, blurb, photoUrls, token }) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 40000);
    try {
        const res = await fetch(`${FN}/cookbook-kdp-cover`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
            body: JSON.stringify({ token, title, author, pages, paper, trim, blurb, photoUrls: (photoUrls || []).slice(0, 6) }),
            signal: ctrl.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.url) throw new Error(json?.error || `cover failed (${res.status})`);
        return json;
    } finally {
        clearTimeout(timer);
    }
}

function parseLoose(text) {
    const s = String(text || '').replace(/```json|```/g, '');
    try { return JSON.parse(s); } catch (e) { /* try the first {...} */ }
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch (e) { return null; }
}

export function fallbackListing({ title, recipes, locale }) {
    const n = (recipes || []).length;
    const es = locale === 'es';
    const names = (recipes || []).slice(0, 5).map((r) => r.title).filter(Boolean);
    return {
        title: title || (es ? 'Mi recetario' : 'My Cookbook'),
        subtitle: es ? `${n} recetas para cocinar en casa` : `${n} recipes for the home kitchen`,
        description: es
            ? `Un recetario con ${n} recetas.${names.length ? ` Incluye ${names.join(', ')} y más.` : ''}\n\nCada receta trae sus ingredientes y pasos claros.`
            : `A cookbook of ${n} recipes.${names.length ? ` Inside you'll find ${names.join(', ')}, and more.` : ''}\n\nEvery recipe has its ingredients and clear steps.`,
        price: '9.99',
    };
}

// Fern writes the sales listing from what is really in the book (no invented claims).
export async function generateListing({ title, author, recipes, locale, token }) {
    const chapters = Array.from(new Set((recipes || []).map((r) => r.chapter).filter(Boolean))).slice(0, 12);
    const res = await fetch(`${FN}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
        body: JSON.stringify({
            system: 'You write the sales listing for a home cook\'s cookbook that is sold as a PDF download. Use ONLY the facts given (title, author, number of recipes, chapter names, recipe titles). Never invent claims such as awards, bestseller, "family tested", health benefits, reviews or guarantees. Warm, plain and honest. Return ONLY JSON, no other text: {"title":"the cookbook title, improved only if it is clearly unfinished","subtitle":"at most 12 words","description":"110 to 190 words of plain text, short paragraphs separated by a blank line, say what is inside and who it is for, no hashtags, no emoji","price":9.99}. "price" is a fair US-dollar price for a digital cookbook of that size, between 4.99 and 14.99, ending in .99. Write in the language of the locale.',
            messages: [{ role: 'user', content: JSON.stringify({ title, author, recipeCount: (recipes || []).length, chapters, sampleRecipes: (recipes || []).slice(0, 24).map((r) => r.title) }) }],
            feature: 'fern_chat',
            locale: locale || 'en',
            token,
        }),
    });
    if (!res.ok) throw new Error(`listing failed (${res.status})`);
    const json = await res.json();
    const text = json?.content?.find((p) => p?.type === 'text')?.text || json?.message || json?.reply || '';
    const p = parseLoose(text);
    if (!p || !String(p.description || '').trim()) throw new Error('listing unreadable');
    const price = Number(p.price);
    return {
        title: String(p.title || title || '').trim().slice(0, 120) || title,
        subtitle: String(p.subtitle || '').trim().slice(0, 140),
        description: String(p.description).trim().slice(0, 2500),
        price: (price >= 1 && price <= 50 ? price : 9.99).toFixed(2),
    };
}
