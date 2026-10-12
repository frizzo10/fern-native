// Savings helpers shared by Personal Shopper (flyer deals) and the Shopping screen
// (coupon matching + the weekly "you saved" ledger).
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SALE_STOP = new Set(['fresh', 'crisp', 'sweet', 'honey', 'crowns', 'crown', 'large', 'small', 'whole', 'boneless', 'skinless', 'family', 'pack', 'value', 'select', 'premium', 'natural', 'farm', 'brand', 'organic', 'frozen', 'ground', 'lean', 'extra', 'with', 'and', 'the', 'each', 'lb', 'oz']);

export function singular(w) { return w.length > 3 ? w.replace(/(ies)$/, 'y').replace(/(es|s)$/, '') : w; }

// Words in front of an ingredient's main noun that don't change what it is.
const NEUTRAL_PREV = new Set(['or', 'and', 'of', 'oz', 'lb', 'lbs', 'cup', 'cups', 'tbsp', 'tsp', 'can', 'cans', 'large', 'small', 'medium', 'fresh', 'chopped', 'sliced', 'diced', 'cooked', 'crispy', 'thick', 'cut', 'the', 'a', 'with', 'for', 'to', 'into', 'about', 'plus', 'extra', 'finely', 'roughly', 'thinly', 'pieces', 'piece', 'strips', 'whole', 'boneless', 'skinless', 'lean', 'raw', 'ripe', 'frozen']);

// Does this single ingredient line contain this on-sale item? Compares the main noun
// ("pepper") and refuses when the ingredient's own qualifier ("black") isn't part of the
// sale item's name, so "Rainbow Bell Peppers" never matches "black pepper".
// A sale item that is a prepared/processed form ("Rotisserie Chicken", "Smoked ...") is not the
// plain ingredient, so it only matches when the recipe itself asks for that form.
const DEAL_FORM_WORDS = ['rotisserie', 'smoked', 'cooked', 'canned', 'deli', 'prepared', 'roasted', 'breaded', 'fried', 'sauce', 'juice', 'dried', 'pickled', 'jarred', 'frozen', 'dressing', 'soup'];

NEUTRAL_PREV.forEach((w) => NEUTRAL_PREV.add(singular(w))); // ingredient words are compared singularized

export function ingredientHasSaleItem(ingredient, deal) {
    const ing = String(ingredient || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean).map(singular);
    const dealWords = String(deal.name || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean).map(singular);
    const keyWords = dealWords.filter((w) => w.length > 2 && !SALE_STOP.has(w));
    if (!keyWords.length || !ing.length) return false;
    const dealForms = DEAL_FORM_WORDS.filter((w) => dealWords.includes(w));
    if (dealForms.some((w) => !ing.includes(w))) return false;
    // The sale item's main noun: its last meaningful word (brand words come first).
    const head = keyWords[keyWords.length - 1];
    const pos = ing.indexOf(head);
    if (pos < 0) return false;
    const prev = pos > 0 ? ing[pos - 1] : '';
    if (!prev || NEUTRAL_PREV.has(prev) || prev.length < 3) return true;
    return dealWords.includes(prev);
}

// Which on-sale items does this ingredient list really contain?
export function matchSaleItems(ingredients, deals) {
    const out = [];
    (deals || []).forEach((deal) => {
        const hit = (ingredients || []).find((ing) => ingredientHasSaleItem(ing, deal));
        if (hit) out.push({ ...deal, usedFor: hit });
    });
    return out;
}

// ── savings math (from the flyer's own prices) ──────────────────────────────
export const priceNum = (v) => {
    const str = String(v || '');
    if (/\d\s*\/\s*\$?\d/.test(str)) return null; // "2/$5" style multi-buys: unit price unknown
    const m = str.match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : null;
};

// How much one purchase of this sale item saves. BOGO ≈ the price of one (second is free), marked estimated.
export function dealSaving(deal) {
    const sv = String(deal?.savings || '');
    if (/\$/.test(sv)) {
        const n = priceNum(sv);
        if (n) return { amount: n, est: false };
    }
    const orig = priceNum(deal?.originalPrice);
    const sale = priceNum(deal?.salePrice || deal?.price);
    if (deal?.isBogo) {
        const base = orig || sale;
        return { amount: base || 0, est: true };
    }
    if (orig && sale && orig > sale) return { amount: Math.round((orig - sale) * 100) / 100, est: false };
    return { amount: 0, est: false };
}

export const fmtMoney = (n) => `$${Number(n || 0).toFixed(2)}`;

// Total across a list of deals, counting each product once.
export function sumSavings(deals) {
    const seen = new Set();
    let total = 0;
    let est = false;
    let counted = 0;
    (deals || []).forEach((d) => {
        const key = `${String(d?.name || '').toLowerCase()}|${d?.store || ''}`;
        if (seen.has(key)) return;
        seen.add(key);
        const sv = dealSaving(d);
        if (sv.amount > 0) {
            total += sv.amount;
            counted += 1;
            if (sv.est) est = true;
        }
    });
    return { total: Math.round(total * 100) / 100, est, counted };
}

// ── weeks ───────────────────────────────────────────────────────────────────
// Weeks start on Monday and are keyed by that Monday's LOCAL date (never toISOString —
// that shifts to UTC and gives tomorrow's date on evenings west of UTC).
export function weekKeyFor(date = new Date()) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const back = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - back);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}

export function weekLabel(weekKey, locale = 'en') {
    const [y, m, d] = String(weekKey).split('-').map(Number);
    if (!y) return weekKey;
    return new Date(y, m - 1, d).toLocaleDateString(locale === 'es' ? 'es' : 'en-US', { month: 'short', day: 'numeric' });
}

// ── this week's flyer deals, remembered so the Shopping screen can match list items ──
const WEEK_DEALS_KEY = 'fern_week_deals';

export async function saveWeekDeals(deals) {
    try {
        const wk = weekKeyFor();
        const raw = JSON.parse((await AsyncStorage.getItem(WEEK_DEALS_KEY)) || 'null');
        const prev = raw && raw.weekKey === wk && Array.isArray(raw.deals) ? raw.deals : [];
        const seen = new Set();
        const merged = [...(deals || []), ...prev].filter((d) => {
            const k = `${String(d?.name || '').toLowerCase()}|${d?.store || ''}`;
            if (!d?.name || seen.has(k)) return false;
            seen.add(k);
            return true;
        }).slice(0, 400);
        await AsyncStorage.setItem(WEEK_DEALS_KEY, JSON.stringify({ weekKey: wk, deals: merged }));
    } catch (e) { /* best effort */ }
}

export async function loadWeekDeals() {
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(WEEK_DEALS_KEY)) || 'null');
        return raw && raw.weekKey === weekKeyFor() && Array.isArray(raw.deals) ? raw.deals : [];
    } catch (e) { return []; }
}

// ── coupon matching ─────────────────────────────────────────────────────────
const MATCH_STOP = new Set([...SALE_STOP, 'save', 'off', 'any', 'one', 'two', 'buy', 'get', 'free', 'when', 'you', 'your', 'purchase', 'product', 'products', 'size', 'sizes', 'select', 'varieties', 'variety', 'cup', 'tbsp', 'tsp', 'can', 'pkg', 'package', 'ct', 'count', 'for', 'on', 'of', 'a', 'to', 'in', 'or']);

function keyWords(text) {
    return String(text || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean)
        .map(singular).filter((w) => w.length > 2 && !MATCH_STOP.has(w));
}

// Coupons only apply to non-food products (cleaning, paper goods, health & beauty, baby, pet).
// Food coupons are brand-specific and never fit a recipe ingredient like "chicken" or "milk".
// Categories are the backend's COUPON_SECTIONS buckets (netlify/functions/fetch-coupons.js).
const NON_FOOD_COUPON_CATEGORIES = ['household & cleaning', 'health & beauty', 'baby & kids', 'pet care'];
export function isNonFoodCoupon(coupon) {
    return NON_FOOD_COUPON_CATEGORIES.includes(String(coupon?.category || '').trim().toLowerCase());
}

// 'match' when every key word of the list item is in the coupon's title (and a single-word item is its main noun); 'possible' when
// at least the item's main noun (its last key word) shows up in the title or description.
export function couponMatchLevel(itemText, coupon) {
    const item = keyWords(itemText);
    if (!item.length) return null;
    const titleList = keyWords(coupon?.title);
    const title = new Set(titleList);
    const all = new Set([...title, ...keyWords(coupon?.description)]);
    // A lone word ("milk") only counts as a firm match when it is the coupon's main noun,
    // so "milk" vs "milk chocolate yogurt" stays a possible match.
    const firm = item.length > 1 || titleList[titleList.length - 1] === item[0];
    if (firm && item.every((w) => title.has(w))) return 'match';
    if (all.has(item[item.length - 1])) return 'possible';
    return null;
}

// "$1.50 off", "50¢", "25% off", "BOGO" -> { amount, percent, bogo }
export function parseCouponValue(label) {
    const s = String(label || '').toLowerCase();
    const out = { amount: 0, percent: 0, bogo: /bogo|buy one|buy 1/.test(s) };
    const dollars = s.match(/\$\s*(\d+(?:\.\d+)?)/);
    const cents = s.match(/(\d+)\s*(?:¢|cents?)/);
    const pct = s.match(/(\d+(?:\.\d+)?)\s*%/);
    if (dollars) out.amount = parseFloat(dollars[1]);
    else if (cents) out.amount = parseInt(cents[1], 10) / 100;
    if (pct) out.percent = parseFloat(pct[1]);
    return out;
}

// For each list item, the best flyer deal and the coupons that fit it.
export function matchListItems(items, deals, coupons) {
    const out = {};
    (items || []).forEach((item) => {
        const deal = (deals || []).find((d) => ingredientHasSaleItem(item.text, d)) || null;
        const found = [];
        (coupons || []).filter(isNonFoodCoupon).forEach((c) => {
            const level = couponMatchLevel(item.text, c);
            if (level) found.push({ coupon: c, level, value: parseCouponValue(c.discountLabel || c.title) });
        });
        found.sort((a, b) => (a.level === b.level ? 0 : a.level === 'match' ? -1 : 1));
        if (deal || found.length) out[item.id] = { deal, coupons: found.slice(0, 3) };
    });
    return out;
}

// ── the savings ledger: { [weekKey]: { [entryId]: entry } } ─────────────────
// entry = { id, type: 'circular' | 'coupon', label, amount, est, store, at }
// Device-only for now (no `sync` field exists server-side for it yet).
const LEDGER_KEY = 'fern_savings_ledger';

export async function loadLedger() {
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(LEDGER_KEY)) || '{}');
        return raw && typeof raw === 'object' ? raw : {};
    } catch (e) { return {}; }
}

export async function updateLedger({ upsert = [], remove = [] }, weekKey = weekKeyFor()) {
    const ledger = await loadLedger();
    const week = { ...(ledger[weekKey] || {}) };
    remove.forEach((id) => { delete week[id]; });
    upsert.forEach((e) => { week[e.id] = { ...week[e.id], ...e, at: week[e.id]?.at || Date.now() }; });
    const next = { ...ledger, [weekKey]: week };
    // keep ~2 years of weeks
    Object.keys(next).sort().slice(0, -104).forEach((k) => { delete next[k]; });
    try { await AsyncStorage.setItem(LEDGER_KEY, JSON.stringify(next)); } catch (e) { /* best effort */ }
    return next;
}

// Keep flyer savings in step with what is ticked off. Only ticked (bought) items count;
// unticking an item still on the list takes its entry back out; removed items keep theirs.
export async function syncCircularSavings(items, matches) {
    const upsert = [];
    const remove = [];
    (items || []).forEach((item) => {
        const deal = matches?.[item.id]?.deal;
        const id = `c:${item.id}`;
        if (item.checked && deal) {
            const sv = dealSaving(deal);
            if (sv.amount > 0) upsert.push({ id, type: 'circular', label: item.text, amount: sv.amount, est: sv.est, store: deal.store || '' });
        } else {
            remove.push(id);
        }
    });
    return updateLedger({ upsert, remove });
}

export function summarizeLedger(ledger, weekKey = weekKeyFor()) {
    const totalOf = (week) => Object.values(week || {}).reduce((a, e) => {
        a[e.type] = (a[e.type] || 0) + (e.amount || 0);
        a.total += e.amount || 0;
        a.est = a.est || Boolean(e.est);
        a.count += 1;
        return a;
    }, { circular: 0, coupon: 0, total: 0, est: false, count: 0 });
    const round = (s) => ({ ...s, circular: Math.round(s.circular * 100) / 100, coupon: Math.round(s.coupon * 100) / 100, total: Math.round(s.total * 100) / 100 });
    const weeks = Object.keys(ledger || {}).sort().reverse().map((k) => ({ weekKey: k, ...round(totalOf(ledger[k])) }));
    const allTime = round(weeks.reduce((a, w) => ({ circular: a.circular + w.circular, coupon: a.coupon + w.coupon, total: a.total + w.total, est: a.est || w.est, count: a.count + w.count }), { circular: 0, coupon: 0, total: 0, est: false, count: 0 }));
    return { thisWeek: round(totalOf(ledger?.[weekKey])), weeks, allTime };
}
