function normalizeBoardItem(item, index, fallbackPrefix = 'Item') {
    const fallbackName = `${fallbackPrefix} ${index + 1}`;
    return {
        name: String(item?.name || item?.title || fallbackName).trim(),
        quantity: String(item?.quantity || item?.amount || '').trim(),
        description: String(item?.description || item?.details || item?.why || '').trim(),
        emoji: String(item?.emoji || '').trim(),
        type: String(item?.type || '').trim(),
        category: String(item?.category || '').trim(),
    };
}

function normalizeStringList(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => String(item || '').trim())
        .filter(Boolean);
}

function normalizeShoppingList(groups) {
    if (!Array.isArray(groups)) return [];

    return groups
        .map((group, groupIndex) => {
            const category = String(group?.category || `Category ${groupIndex + 1}`).trim();
            const items = Array.isArray(group?.items)
                ? group.items.map((item) => String(item || '').trim()).filter(Boolean)
                : [];
            return { category, items };
        })
        .filter((group) => group.items.length > 0);
}

export function normalizeCharcuterieBoard(responseJson) {
    const meats = Array.isArray(responseJson?.meats)
        ? responseJson.meats.map((item, index) => normalizeBoardItem(item, index, 'Meat'))
        : [];
    const cheeses = Array.isArray(responseJson?.cheeses)
        ? responseJson.cheeses.map((item, index) => normalizeBoardItem(item, index, 'Cheese'))
        : [];
    const accompaniments = Array.isArray(responseJson?.accompaniments)
        ? responseJson.accompaniments.map((item, index) => normalizeBoardItem(item, index, 'Accompaniment'))
        : [];
    const crackers = Array.isArray(responseJson?.crackers)
        ? responseJson.crackers.map((item, index) => normalizeBoardItem(item, index, 'Cracker'))
        : [];
    const drinks = Array.isArray(responseJson?.drinks)
        ? responseJson.drinks.map((item, index) => ({
            name: String(item?.name || `Drink ${index + 1}`).trim(),
            why: String(item?.why || item?.description || '').trim(),
            emoji: String(item?.emoji || '').trim(),
        }))
        : [];

    return {
        title: String(responseJson?.title || 'Charcuterie Board').trim(),
        tagline: String(responseJson?.tagline || '').trim(),
        occasion: String(responseJson?.occasion || '').trim(),
        serves: Number.parseInt(responseJson?.serves, 10) || 0,
        estimatedCost: String(responseJson?.estimatedCost || '').trim(),
        meats,
        cheeses,
        accompaniments,
        crackers,
        garnishes: normalizeStringList(responseJson?.garnishes),
        drizzles: normalizeStringList(responseJson?.drizzles),
        drinks,
        boardLayout: String(responseJson?.boardLayout || '').trim(),
        shoppingList: normalizeShoppingList(responseJson?.shoppingList),
        hostTips: normalizeStringList(responseJson?.hostTips),
        prepTimeline: String(responseJson?.prepTimeline || '').trim(),
        totalItems: Number.parseInt(responseJson?.totalItems, 10) || 0,
    };
}

export async function fetchCharcuterieBoard({ occasion, boardType, people, budget, dietary, locale }) {
    const payload = {
        occasion: String(occasion || '').trim(),
        boardType: String(boardType || '').trim(),
        people: Number.parseInt(people, 10) || 1,
        budget: Number.parseInt(budget, 10) || 1,
        dietary: String(dietary || 'None').trim(),
        locale: locale
    };

    const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/charcuterie-board', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FernApp/1.0 (myaifern.com)',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(`Charcuterie API failed (${res.status})`);
    }

    const responseJson = await res.json();
    const board = normalizeCharcuterieBoard(responseJson);

    return { payload, responseJson, board };
}
