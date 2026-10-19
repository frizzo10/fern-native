// Browse the weekly circulars other Fern shoppers have scanned (shared server-side, prices only).
// Backed by the store-deals function's browse modes. Best-effort: failures throw so the
// screen can show a retry, never crash.
const STORE_DEALS_URL = 'https://app.clickpickandcook.com/.netlify/functions/store-deals';

async function post(body) {
    const res = await fetch(STORE_DEALS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`circulars ${res.status}`);
    return res.json();
}

// -> [{ storeKey, store, scannedAt, validDates, itemCount, scanCount }]
export async function fetchCircularStores({ token, zip }) {
    if (!token) return [];
    const json = await post({ token, browse: true, ...(zip ? { zip } : {}) });
    return Array.isArray(json?.stores) ? json.stores : [];
}

// -> { store, scannedAt, validDates, itemCount, items: [{ name, brand, category, price, unit, originalPrice, savings, isBogo }] }
export async function fetchCircularItems({ token, storeKey, zip }) {
    const json = await post({ token, browseStore: storeKey, ...(zip ? { zip } : {}) });
    return { ...json, items: Array.isArray(json?.items) ? json.items : [] };
}
