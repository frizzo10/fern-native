const BUDGET_PLANNER_URL = 'https://app.clickpickandcook.com/.netlify/functions/budget-meal-planner';

function normalizeDinner(dinner, index) {
    const ingredients = Array.isArray(dinner?.ingredients)
        ? dinner.ingredients.map((item) => String(item).trim()).filter(Boolean)
        : [];
    const instructions = Array.isArray(dinner?.instructions)
        ? dinner.instructions.map((step) => String(step).trim()).filter(Boolean)
        : [];

    return {
        id: `budget-dinner-${Date.now()}-${index}`,
        day: String(dinner?.day || '').trim(),
        title: String(dinner?.title || '').trim(),
        emoji: dinner?.emoji || '🍽️',
        cuisine: String(dinner?.cuisine || '').trim(),
        time: String(dinner?.time || '').trim(),
        costPerServing: String(dinner?.costPerServing || '').trim(),
        totalCost: String(dinner?.totalCost || '').trim(),
        description: String(dinner?.description || '').trim(),
        ingredients,
        instructions,
        image: null,
    };
}

function normalizeShoppingList(shoppingList) {
    const items = [];

    (Array.isArray(shoppingList) ? shoppingList : []).forEach((section, sectionIndex) => {
        const category = String(section?.category || 'Other').trim();
        (Array.isArray(section?.items) ? section.items : []).forEach((text, itemIndex) => {
            const trimmed = String(text || '').trim();
            if (!trimmed) return;
            items.push({
                id: `budget-shop-${Date.now()}-${sectionIndex}-${itemIndex}`,
                category,
                text: trimmed,
                haveAlready: false,
            });
        });
    });

    return items;
}

export async function fetchBudgetMealPlan({ weeklyBudget, people, dietary, deals, locale }) {
    const res = await fetch(BUDGET_PLANNER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FernApp/1.0 (myaifern.com)',
        },
        body: JSON.stringify({
            weeklyBudget,
            people,
            dietary,
            deals: Array.isArray(deals) ? deals : [],
            locale: locale || 'en',
        }),
    });

    if (!res.ok) {
        throw new Error(`Budget meal planner failed (${res.status})`);
    }

    const json = await res.json();
    const dinners = Array.isArray(json?.dinners) ? json.dinners.map(normalizeDinner) : [];

    return {
        weeklyBudget: json?.weeklyBudget ?? weeklyBudget,
        people: json?.people ?? people,
        estimatedActualCost: String(json?.estimatedActualCost || '').trim(),
        savings: String(json?.savings || '').trim(),
        dealsUsed: Array.isArray(json?.dealsUsed)
            ? json.dealsUsed.map((deal) => String(deal).trim()).filter(Boolean)
            : [],
        dinners,
        shoppingItems: normalizeShoppingList(json?.shoppingList),
        moneyTips: Array.isArray(json?.moneyTips)
            ? json.moneyTips.map((tip) => String(tip).trim()).filter(Boolean)
            : [],
        raw: json,
    };
}
