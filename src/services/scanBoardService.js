// Weekly "top scanners" board (web repo function scan-board). Everything is best-effort.
import { weekKeyFor } from '../utils/savings';

const URL_ = 'https://app.clickpickandcook.com/.netlify/functions/scan-board';

async function post(body) {
    const res = await fetch(URL_, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`scan-board ${res.status}`);
    return res.json();
}

// Fire-and-forget after a scan that read items. pagesWeek = this shopper's pages this ad week (all stores).
export function reportScan({ token, stats, addItems }) {
    try {
        if (!token) return;
        const week = (stats?.weeks || {})[weekKeyFor()] || {};
        const pages = Object.values(week).reduce((a, n) => a + (n || 0), 0);
        post({ token, action: 'record', weekKey: weekKeyFor(), pages, addItems: addItems || 0 }).catch(() => {});
    } catch (e) { /* never block a scan */ }
}

// -> { top: [{ name, pages, items, me }], me: { pages, items, rank, name } }
export async function fetchBoard(token) {
    const j = await post({ token, action: 'board', weekKey: weekKeyFor() });
    return { top: Array.isArray(j?.top) ? j.top : [], me: j?.me || { pages: 0, items: 0, rank: null, name: '' } };
}

// Empty name = leave the board. Returns the saved name ('' when removed).
export async function saveBoardName(token, name) {
    const j = await post({ token, action: 'name', name });
    if (!j?.ok) throw new Error('name failed');
    return j.name || '';
}
