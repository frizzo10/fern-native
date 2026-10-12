const STORE_DEALS_URL = 'https://app.clickpickandcook.com/.netlify/functions/store-deals';

// POST { token, stores: [names] } -> the CURRENT weekly-ad items other Fern shoppers (or this
// user) already scanned for those stores. Shared across users, prices only. Only stores with a
// current flyer come back; the backend decides "current" from the flyer's printed dates.
// Best-effort: any failure returns [] so planning just falls back to asking for a flyer scan.
export async function fetchStoreDeals({ token, stores }) {
    const names = [...new Set((Array.isArray(stores) ? stores : []).map((s) => String(s || '').trim()).filter(Boolean))];
    if (!token || !names.length) return [];
    try {
        const res = await fetch(STORE_DEALS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
            body: JSON.stringify({ token, stores: names }),
        });
        if (!res.ok) return [];
        const json = await res.json();
        return (Array.isArray(json?.stores) ? json.stores : []).filter((s) => Array.isArray(s?.items) && s.items.length);
    } catch (e) {
        console.log('[store-deals] fetch failed', e?.message || e);
        return [];
    }
}
