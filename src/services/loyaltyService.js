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
