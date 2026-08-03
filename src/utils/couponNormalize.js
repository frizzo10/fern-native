// Coupon field names aren't nailed down against a real API sample yet, so this
// accepts several likely aliases per field (mirrors the defensive style used
// by normalizeWinePairing / normalizeBoardItem) rather than assuming one exact
// shape — a renamed key degrades to an empty string instead of crashing.
export function normalizeCoupon(raw, index = 0) {
    const id = String(raw?.id ?? raw?.couponId ?? raw?.uuid ?? raw?.code ?? `coupon-${index}`);

    return {
        id,
        store: String(raw?.store || raw?.storeName || raw?.retailer || raw?.brand || '').trim(),
        title: String(raw?.title || raw?.name || raw?.offer || raw?.headline || '').trim(),
        category: String(raw?.category || raw?.type || 'Other').trim(),
        discountLabel: String(raw?.discountLabel || raw?.badge || raw?.discount || raw?.savings || raw?.offerLabel || '').trim(),
        description: String(raw?.description || raw?.details || raw?.subtitle || '').trim(),
        image: raw?.image || raw?.imageUrl || raw?.photo || null,
        expiresAt: String(raw?.expiresAt || raw?.expiry || raw?.validUntil || raw?.expirationDate || '').trim(),
        code: String(raw?.code || raw?.barcode || raw?.upc || id || '').trim(),
    };
}

export function normalizeCoupons(list) {
    return Array.isArray(list) ? list.map((item, index) => normalizeCoupon(item, index)) : [];
}

export function groupCouponsByStore(coupons) {
    const order = [];
    const map = new Map();

    (coupons || []).forEach((coupon) => {
        const key = coupon.store || 'Other';
        if (!map.has(key)) {
            map.set(key, []);
            order.push(key);
        }
        map.get(key).push(coupon);
    });

    return order.map((key) => ({ key, coupons: map.get(key) }));
}

export function groupCouponsByCategory(coupons) {
    const order = [];
    const map = new Map();

    (coupons || []).forEach((coupon) => {
        const key = coupon.category || 'Other';
        if (!map.has(key)) {
            map.set(key, []);
            order.push(key);
        }
        map.get(key).push(coupon);
    });

    return order.map((key) => ({ key, coupons: map.get(key) }));
}
