import { SALE_STOP, singular, dealSaving } from './savings';

// Never worth planning a dinner around these, even when they're a great deal.
export const NOT_FOOD = /(gift card|batter|detergent|paper towel|toilet|soap|diaper|vitamin|pet food|litter|candle|wine|beer|vodka|whiskey|liquor|cigarette|lotto|lottery|bleach|trash bag)/i;
export const PANTRY_SKIP = /^\s*(salt|pepper|black pepper|salt and pepper|water|ice)\b/i;

// The week's "star" deals: biggest saving, food that can anchor a dinner, one per kind of product.
export function pickStarDeals(deals, n, craving) {
    const scored = (deals || []).filter((d) => d?.name && !NOT_FOOD.test(d.name)).map((d) => {
        const sv = dealSaving(d).amount;
        const food = d.cookable || /meat|poultry|seafood|produce|deli|dairy|fish|chicken|beef|pork|vegetable|fruit/i.test(`${d.category || ''} ${d.name}`);
        let score = sv * 2 + (d.isBogo ? 2 : 0) + (food ? 4 : 0) + (Number(d.dealScore) || 0) * 0.5;
        if (craving && String(d.name).toLowerCase().includes(String(craving).toLowerCase())) score += 6;
        return { d, score, food };
    }).sort((a, b) => b.score - a.score);
    const out = [];
    const seen = new Set();
    for (const { d, food } of scored) {
        if (!food) continue;
        const words = String(d.name).toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !SALE_STOP.has(w)).map(singular);
        const key = words.filter((w) => w.length > 3);
        if (key.some((w) => seen.has(w))) continue;
        key.forEach((w) => seen.add(w));
        out.push(d);
        if (out.length >= n) break;
    }
    return out;
}

