// Fern's opening move on the Shopping screen: one small AI call that looks at the list, this week's
// flyer deals, saved recipes and the empty dinner nights, and proposes a few things. Suggest-only:
// nothing is saved until the user taps. Cached per day (see FernGreetingCard) so it stays cheap.
const AI_URL = 'https://app.clickpickandcook.com/.netlify/functions/ai';

function parseLoose(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { /* fall through */ }
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch (e) { return null; }
}

export async function fetchShoppingGreeting({ listItems, deals, savedTitles, emptyDinners, hasFlyer, locale, token }) {
    const context = {
        onMyList: (listItems || []).slice(0, 40),
        saleItemsThisWeek: (deals || []).slice(0, 12).map((d) => ({
            name: d.name,
            price: d.salePrice || '',
            was: d.originalPrice || '',
            bogo: Boolean(d.isBogo),
            store: d.store || '',
        })),
        savedRecipes: (savedTitles || []).slice(0, 20),
        dinnersStillToPlanThisWeek: emptyDinners,
        flyerScannedThisWeek: Boolean(hasFlyer),
    };
    const res = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
        body: JSON.stringify({
            system: 'You are Fern, a warm, practical grocery-planning assistant. Look at the shopper\'s data and open their shopping trip with a short plan. Return ONLY JSON, no other text: {"greeting":"one or two short friendly sentences","suggestions":[{"text":"short suggestion, max 18 words","add":["plain grocery item"],"plan":false}]}. Rules: at most 3 suggestions. Only mention sale items that appear in saleItemsThisWeek and never invent prices or deals. "add" holds 0-4 plain buyable item names (no quantities) that are NOT already on the list. Set "plan":true on at most one suggestion, and only when dinnersStillToPlanThisWeek is above 0 and a sale item could anchor those dinners. If flyerScannedThisWeek is false, one suggestion should invite them to scan this week\'s flyer (add: [], plan: false). Do not repeat items already on the list.',
            messages: [{ role: 'user', content: JSON.stringify(context) }],
            feature: 'fern_chat',
            locale: locale || 'en',
            token,
        }),
    });
    if (!res.ok) throw new Error(`greeting request failed (${res.status})`);
    const json = await res.json();
    const text = json?.content?.find((p) => p?.type === 'text')?.text || json?.message || json?.reply || '';
    const parsed = parseLoose(text);
    if (!parsed || typeof parsed !== 'object') return null;
    const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
        .map((s) => ({
            text: String(s?.text || '').trim(),
            add: (Array.isArray(s?.add) ? s.add : []).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 4),
            plan: s?.plan === true,
        }))
        .filter((s) => s.text)
        .slice(0, 3);
    const greeting = String(parsed.greeting || '').trim();
    if (!greeting && !suggestions.length) return null;
    return { greeting, suggestions };
}
