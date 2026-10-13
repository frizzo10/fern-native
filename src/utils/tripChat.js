// The conversation Fern has when you arrive at a store: it already knows this week's flyer, the coupons that fit
// your list and what is on the list, so it can talk you through the trip instead of starting from a blank chat.
const clip = (s, n = 60) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

function dealLine(d) {
  const price = d.salePrice ? ` ${clip(d.salePrice, 12)}` : '';
  const was = d.originalPrice ? ` (was ${clip(d.originalPrice, 12)})` : '';
  return `- ${clip(d.name)}${price}${was}${d.isBogo ? ' BOGO' : ''}${d.store ? ` @ ${clip(d.store, 24)}` : ''}`;
}

function couponLine(c) {
  return `- ${clip(c.title)}${c.discountLabel ? ` — ${clip(c.discountLabel, 24)}` : ''}`;
}

export function buildTripSystemPrompt({ store, deals = [], list = [], coupons = [] }) {
  const topDeals = [...deals]
    .sort((a, b) => (parseFloat(String(b.savings).replace(/[^0-9.]/g, '')) || 0) - (parseFloat(String(a.savings).replace(/[^0-9.]/g, '')) || 0))
    .slice(0, 30);
  const onList = list.filter((i) => !i.checked).map((i) => clip(i.text, 40)).slice(0, 50);
  return [
    'You are Fern, a warm, decisive shopping companion walking the user through a grocery trip right now.',
    store ? `They are at: ${clip(store, 50)}.` : '',
    topDeals.length ? `This week\'s flyer deals (use ONLY these when you mention a sale):\n${topDeals.map(dealLine).join('\n')}` : 'No flyer is loaded, so do not claim anything is on sale.',
    coupons.length ? `Coupons that fit them (use ONLY these):\n${coupons.slice(0, 12).map(couponLine).join('\n')}` : '',
    onList.length ? `Already on their shopping list: ${onList.join(', ')}.` : 'Their shopping list is empty.',
    'Help them shop: point out the best deals and matching coupons, suggest dinners built around sale items, and help them decide what to buy. Ask one short question at a time. Keep replies to 2-4 sentences. Never invent prices or coupons.',
    'When they agree to buy something, put the plain grocery names (e.g. "Chicken thighs") in add_to_shopping_list and say you are adding it. Otherwise leave add_to_shopping_list empty.',
    'When they tell you they got something ("I got the chicken", "the milk is in the cart"), put the matching names from their shopping list in checked_off and confirm briefly. Only tick things they said they have. Otherwise leave it empty.',
    'Respond ONLY with valid JSON, no markdown: {"reply":"...","add_to_shopping_list":["item1"],"checked_off":["item2"]}',
  ].filter(Boolean).join('\n\n');
}

export function tripOpenerPrompt(store) {
  return `I just arrived${store ? ` at ${clip(store, 50)}` : ' at the store'}. Greet me in one short sentence, tell me the best one or two deals and any coupon that fits my list, then ask what dinners I want to plan around them.`;
}
