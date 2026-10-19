const STORE_DEALS_URL = 'https://app.clickpickandcook.com/.netlify/functions/store-deals';

// POST { token, stores: [names] } -> the CURRENT weekly-ad items other Fern shoppers (or this
// user) already scanned for those stores. Shared across users, prices only. Only stores with a
// current flyer come back; the backend decides "current" from the flyer's printed dates.
// Best-effort: any failure returns [] so planning just falls back to asking for a flyer scan.
export async function fetchStoreDeals({ token, stores, zips }) {
    const names = [...new Set((Array.isArray(stores) ? stores : []).map((s) => String(s || '').trim()).filter(Boolean))];
    if (!token || !names.length) return [];
    try {
        const res = await fetch(STORE_DEALS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
            body: JSON.stringify({ token, stores: names, ...(zips && Object.keys(zips).length ? { zips } : {}) }),
        });
        if (!res.ok) return [];
        const json = await res.json();
        return (Array.isArray(json?.stores) ? json.stores : []).filter((s) => Array.isArray(s?.items) && s.items.length);
    } catch (e) {
        console.log('[store-deals] fetch failed', e?.message || e);
        return [];
    }
}

// The user said the flyer photo they just scanned was the wrong one: ask the backend to
// remove their most recent scan from the shared data. Best-effort; returns true if removed.
export async function discardLatestScan({ token }) {
    if (!token) return false;
    try {
        const res = await fetch(STORE_DEALS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
            body: JSON.stringify({ token, discardLatest: true }),
        });
        if (!res.ok) return false;
        const json = await res.json();
        return Boolean(json?.discarded);
    } catch (e) {
        console.log('[store-deals] discard failed', e?.message || e);
        return false;
    }
}

// Shared-flyer stores (from fetchStoreDeals) -> the deal objects the rest of the app (fern_week_deals) uses.
export function sharedStoresToDeals(stores) {
    return (stores || []).flatMap((k) => (k.items || []).map((it) => ({
        name: it.name,
        salePrice: it.price || '',
        originalPrice: it.originalPrice || '',
        savings: it.savings || '',
        category: it.category || '',
        cookable: Boolean(it.cookable),
        isBogo: Boolean(it.isBogo),
        store: k.store,
    })));
}
