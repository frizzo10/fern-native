// Shared date/slot helpers for Family Hub's rolling 7-day week — used by
// both FamilyScreen.js (the day-by-day view) and HomeScreen.js (the Weekly
// Review prompt), so both stay in exact agreement about what "this week"
// and "day 3" mean rather than drifting apart with separate copies.

export const DAY_ABBREVIATIONS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function parseDateKey(key) {
    const [y, m, d] = String(key || '').split('-').map(Number);
    return new Date(y || 1970, (m || 1) - 1, d || 1);
}

export function dateToKey(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// A rolling 7-day window starting today — not "whatever dates happen to be
// in mealPlan" (that could include stale/past dates or drift past 7 days).
// Recompute fresh each render so the window itself rolls forward at
// midnight without any extra state.
export function buildRollingWeekDateKeys() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return dateToKey(d);
    });
}

export function daysBetween(dateKeyA, dateKeyB) {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((parseDateKey(dateKeyB).getTime() - parseDateKey(dateKeyA).getTime()) / msPerDay);
}

export function normalizeSlot(entry) {
    return String(entry?.slot || '').trim().toLowerCase();
}

// "Sun 9" — title-case weekday abbreviation + day number, matching the shape
// activities are stored/displayed with (`rv4_activities`'s `day` field).
export function formatDayLabel(dateKey) {
    const date = parseDateKey(dateKey);
    const abbrev = DAY_ABBREVIATIONS[date.getDay()];
    const titleCased = abbrev.charAt(0) + abbrev.slice(1).toLowerCase();
    return `${titleCased} ${date.getDate()}`;
}
