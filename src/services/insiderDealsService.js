import { logApiResponse } from '../utils/apiLogger';

const INSIDER_DEALS_URL = 'https://app.clickpickandcook.com/.netlify/functions/insider-deals';

function normalizeDeal(raw, index) {
    return {
        id: String(raw?.id ?? `insider-deal-${index}`),
        brand: String(raw?.brand || '').trim(),
        title: String(raw?.title || '').trim(),
        description: String(raw?.description || '').trim(),
        imageUrl: String(raw?.image_url || '').trim(),
        dealCode: String(raw?.deal_code || '').trim(),
        dealUrl: String(raw?.deal_url || '').trim(),
        validUntil: raw?.valid_until || null,
        featured: Boolean(raw?.featured),
    };
}

// POST { token } → { deals: [...] } for a real Pro/Pro Max user, or
// { proOnly: true } when the backend's own record of the user's plan is free.
// The backend resolves the plan from the verified token, not from anything the
// client claims. That record is mirrored from this app by `tier` in the sync
// push (see DATAMODEL.md → "Subscription tier sync"), so a user who just
// subscribed can briefly see `proOnly` until the next app launch pushes it.
// Matches the web app's openInsiderDeals().
export async function fetchInsiderDeals({ token }) {
    const res = await fetch(INSIDER_DEALS_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FernApp/1.0 (myaifern.com)',
        },
        body: JSON.stringify({ token }),
    });

    if (!res.ok) {
        throw new Error(`Insider deals request failed (${res.status})`);
    }

    const json = await res.json();
    logApiResponse('insider-deals', json);

    if (json?.proOnly) return { proOnly: true, deals: [] };

    const deals = Array.isArray(json?.deals)
        ? json.deals.map(normalizeDeal).filter((deal) => deal.title)
        : [];

    return { proOnly: false, deals };
}
