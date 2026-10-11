import AsyncStorage from '@react-native-async-storage/async-storage';

// Per-store archive of completed circular scans. Same key name and record shape
// as the web app's `cpc_circular_history`: [{ key, storeId, storeName, date, items }].
// Device-only on both platforms (the web app keeps it in localStorage and does
// not sync it either), so history does not carry across devices.
export const CIRCULAR_HISTORY_KEY = 'cpc_circular_history';
const MAX_ENTRIES = 300;

// Local calendar day, never toISOString().slice(0, 10): that converts to UTC
// first and returns tomorrow's date for evening scans west of UTC.
function localDayKey(date = new Date()) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

function storeIdFromName(name) {
    return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

function slimItem(item) {
    return {
        name: item?.name || '',
        brand: item?.brand || null,
        salePrice: item?.salePrice || null,
        originalPrice: item?.originalPrice || null,
        unit: item?.unit || null,
        category: item?.category || 'Other',
        emoji: item?.emoji || '🛒',
    };
}

export async function loadCircularHistory() {
    try {
        const raw = await AsyncStorage.getItem(CIRCULAR_HISTORY_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.log('[circular history] load failed', e?.message || e);
        return [];
    }
}

// One entry per store per local day. Scanning more pages of the same flyer the
// same day merges into that entry (de-duplicated by name + price) instead of
// replacing it, because the native scan flow returns one page per scan.
export async function archiveCircularScan({ storeName, items }) {
    try {
        if (!Array.isArray(items) || !items.length) return;

        const name = String(storeName || '').trim() || 'Unknown Store';
        const storeId = storeIdFromName(name);
        const entryKey = `${storeId}_${localDayKey()}`;

        const history = await loadCircularHistory();
        const existingIndex = history.findIndex((entry) => entry?.key === entryKey);
        const existing = existingIndex >= 0 ? history[existingIndex] : null;

        const seen = new Set();
        const merged = [...(existing?.items || []), ...items.map(slimItem)].filter((item) => {
            const dedupeKey = `${String(item?.name || '').toLowerCase()}|${item?.salePrice || ''}`;
            if (!item?.name || seen.has(dedupeKey)) return false;
            seen.add(dedupeKey);
            return true;
        });

        const record = { key: entryKey, storeId, storeName: name, date: new Date().toISOString(), items: merged };
        const next = existingIndex >= 0
            ? history.map((entry, index) => (index === existingIndex ? record : entry))
            : [record, ...history];

        await AsyncStorage.setItem(CIRCULAR_HISTORY_KEY, JSON.stringify(next.slice(0, MAX_ENTRIES)));
    } catch (e) {
        console.log('[circular history] archive failed', e?.message || e);
    }
}
