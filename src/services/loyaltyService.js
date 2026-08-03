import { sha256Hex } from '../utils/sha256';
import { logApiResponse } from '../utils/apiLogger';

export function hashPhoneNumber(phone) {
    const digitsOnly = String(phone || '').replace(/\D/g, '');
    return sha256Hex(digitsOnly);
}

export async function matchLoyaltyCard({ phone }) {
    const phone_hash = hashPhoneNumber(phone);

    const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/loyalty', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FernApp/1.0 (myaifern.com)',
        },
        body: JSON.stringify({ action: 'match', phone_hash }),
    });

    if (!res.ok) {
        throw new Error(`Loyalty API failed (${res.status})`);
    }

    const responseJson = await res.json();
    logApiResponse('loyalty (match)', responseJson);

    if (!responseJson?.success) {
        throw new Error(responseJson?.message || 'Loyalty card match failed');
    }

    return {
        phone_hash,
        points: Number.parseInt(responseJson?.points, 10) || 0,
        tier: String(responseJson?.tier || '').trim(),
        linkedCards: Array.isArray(responseJson?.linkedCards) ? responseJson.linkedCards : [],
        message: String(responseJson?.message || '').trim(),
    };
}

function normalizeStoreCard(card) {
    return {
        storeName: String(card?.storeName || '').trim(),
        cardNumber: String(card?.cardNumber || '').trim(),
        linkedAt: String(card?.linkedAt || '').trim(),
    };
}

async function postLoyalty(payload) {
    const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/loyalty', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FernApp/1.0 (myaifern.com)',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(`Loyalty API failed (${res.status})`);
    }

    const responseJson = await res.json();
    logApiResponse(`loyalty (${payload.action})`, responseJson);

    if (!responseJson?.success) {
        throw new Error(responseJson?.message || 'Loyalty request failed');
    }

    return responseJson;
}

// Separate from the phone-hash "match" flow above — these manage a list of
// manually-entered per-store loyalty card numbers, keyed by store name.
export async function fetchLinkedStoreCards({ token }) {
    const responseJson = await postLoyalty({ action: 'list', token });
    return (Array.isArray(responseJson?.linkedCards) ? responseJson.linkedCards : []).map(normalizeStoreCard);
}

export async function linkStoreCard({ token, storeName, cardNumber }) {
    const responseJson = await postLoyalty({
        action: 'link',
        token,
        storeName: String(storeName || '').trim(),
        cardNumber: String(cardNumber || '').trim(),
    });
    return (Array.isArray(responseJson?.linkedCards) ? responseJson.linkedCards : []).map(normalizeStoreCard);
}

export async function unlinkStoreCard({ token, storeName }) {
    const responseJson = await postLoyalty({ action: 'unlink', token, storeName: String(storeName || '').trim() });
    return (Array.isArray(responseJson?.linkedCards) ? responseJson.linkedCards : []).map(normalizeStoreCard);
}
