// Device-only scan gamification: how many pages the shopper has scanned, per store and week, and the weekly streak.
// { total, items, weeks: { [weekKey]: { [chain]: pages } } }  (weekKey = ad week, Wednesday start, see savings.weekKeyFor)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { weekKeyFor } from './savings';
import { chainKey } from './flyerStore';

const KEY = 'fern_scan_stats';
const WEEK_MS = 7 * 24 * 3600 * 1000;

export async function loadScanStats() {
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(KEY)) || 'null');
        if (raw && typeof raw === 'object') return { total: raw.total || 0, items: raw.items || 0, weeks: raw.weeks || {} };
    } catch (e) { /* best effort */ }
    return { total: 0, items: 0, weeks: {} };
}

// Counts one scanned page (only when it actually read items). Returns the updated stats.
export async function recordScan(storeName, itemCount) {
    const chain = chainKey(storeName);
    if (!chain || !(itemCount > 0)) return null;
    try {
        const stats = await loadScanStats();
        const wk = weekKeyFor();
        const week = { ...(stats.weeks[wk] || {}) };
        week[chain] = (week[chain] || 0) + 1;
        const weeks = { ...stats.weeks, [wk]: week };
        // keep ~1 year
        Object.keys(weeks).sort().slice(0, Math.max(0, Object.keys(weeks).length - 52)).forEach((k) => { delete weeks[k]; });
        const next = { total: stats.total + 1, items: stats.items + itemCount, weeks };
        await AsyncStorage.setItem(KEY, JSON.stringify(next));
        return next;
    } catch (e) { return null; }
}

// Consecutive ad weeks with at least one scan, counting back from this week (or last week if this one has none yet).
export function streakWeeks(stats) {
    const weeks = stats?.weeks || {};
    const parse = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
    let cursor = parse(weekKeyFor());
    const has = (date) => Boolean(weeks[weekKeyFor(date)] && Object.keys(weeks[weekKeyFor(date)]).length);
    if (!has(cursor)) cursor = new Date(cursor.getTime() - WEEK_MS + 3600 * 1000);
    let n = 0;
    while (has(cursor)) { n += 1; cursor = new Date(cursor.getTime() - WEEK_MS + 3600 * 1000); }
    return n;
}

export function pagesThisWeek(stats, storeName) {
    return (stats?.weeks?.[weekKeyFor()] || {})[chainKey(storeName)] || 0;
}
