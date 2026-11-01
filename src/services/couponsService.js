import { logApiResponse } from '../utils/apiLogger';

// Full coupon catalog, fetched live — replaces the old `available_coupons`
// field from the sync pull response, which is no longer collected client-side.
export async function fetchAllCoupons() {
    // Give up after 15 s so "Fern is scanning today's coupons…" never stays up forever.
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 15000) : null;
    let res;
    try {
        res = await fetch('https://app.clickpickandcook.com/.netlify/functions/fetch-coupons', {
            method: 'GET',
            headers: {
                'User-Agent': 'FernApp/1.0 (myaifern.com)',
            },
            ...(ctrl ? { signal: ctrl.signal } : {}),
        });
    } finally {
        if (timer) clearTimeout(timer);
    }

    if (!res.ok) {
        throw new Error(`fetch-coupons failed (${res.status})`);
    }

    const responseJson = await res.json();
    logApiResponse('fetch-coupons', responseJson);

    return Array.isArray(responseJson?.coupons) ? responseJson.coupons : [];
}
