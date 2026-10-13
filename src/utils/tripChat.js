// The conversation Fern has when you arrive at a store: it already knows this week's flyer, the coupons that fit
// your list and what is on the list, so it can talk you through the trip instead of starting from a blank chat.
import { AISLES, aisleFor } from './aisles';

const clip = (s, n = 60) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

function dealLine(d) {
  const price = d.salePrice ? ` ${clip(d.salePrice, 12)}` : '';
  const was = d.originalPrice ? ` (was ${clip(d.originalPrice, 12)})` : '';
  return `- ${clip(d.name)}${price}${was}${d.isBogo ? ' BOGO' : ''}${d.store ? ` @ ${clip(d.store, 24)}` : ''}`;
}

function couponLine(c) {
  return `- ${clip(c.title)}${c.discountLabel ? ` — ${clip(c.discountLabel, 24)}` : ''}`;
}

// The unchecked list grouped into store sections, in the order you walk the store (same sections as the Shopping list).
const SECTION_NAMES = {
  produce: 'Produce', bakery: 'Bakery', meat: 'Meat & seafood', dairy: 'Dairy', frozen: 'Frozen',
  pantry: 'Pantry', beverages: 'Beverages', household: 'Household', other: 'Other',
};

function sectionLines(list) {
  const buckets = new Map(AISLES.map((a) => [a.key, []]));
  list.filter((i) => !i.checked).slice(0, 80).forEach((i) => buckets.get(aisleFor(i.text).key).push(clip(i.text, 40)));
  return AISLES.filter((a) => buckets.get(a.key).length)
    .map((a) => `${SECTION_NAMES[a.key] || a.key} (${buckets.get(a.key).length}): ${buckets.get(a.key).join(', ')}`);
}

export function buildTripSystemPrompt({ store, deals = [], list = [], coupons = [] }) {
  const topDeals = [...deals]
    .sort((a, b) => (parseFloat(String(b.savings).replace(/[^0-9.]/g, '')) || 0) - (parseFloat(String(a.savings).replace(/[^0-9.]/g, '')) || 0))
    .slice(0, 30);
  const sections = sectionLines(list);
  return [
    'You are Fern, a warm, decisive shopping companion helping the user shop.',
    store ? `They are at: ${clip(store, 50)}.` : 'They are not at a store right now (or you cannot tell which one), so do not assume a store: help them get ready to shop, whichever store they choose. In your first message, ask if they want to go straight into shopping mode.',
    'Shopping mode is a checklist screen the app opens by itself, by store section, one item at a time. When they say yes or ask for shopping mode, set shopping_mode to true and reply with ONE short line like "Great, opening your checklist." Do NOT walk through the items yourself in chat. Otherwise leave shopping_mode false.',
    topDeals.length ? `This week\'s flyer deals (use ONLY these when you mention a sale):\n${topDeals.map(dealLine).join('\n')}` : 'No flyer is loaded, so do not claim anything is on sale.',
    coupons.length ? `Coupons that fit them (use ONLY these):\n${coupons.slice(0, 12).map(couponLine).join('\n')}` : '',
    sections.length ? `Their shopping list by store section, in the order to walk the store (items not yet checked off):\n${sections.join('\n')}` : 'Their shopping list is empty.',
    'Help them shop: point out the best deals and matching coupons, suggest dinners built around sale items, and help them decide what to buy. Ask one short question at a time. Keep replies to 2-4 sentences. Never invent prices or coupons.',
    'When they agree to buy something, put the plain grocery names (e.g. "Chicken thighs") in add_to_shopping_list and say you are adding it. Otherwise leave add_to_shopping_list empty.',
    'When they tell you they got something ("I got the chicken", "the milk is in the cart"), put the matching names from their shopping list in checked_off and confirm by name. Only tick things they said they have. Otherwise leave it empty.',
    'Respond ONLY with valid JSON, no markdown: {"reply":"...","add_to_shopping_list":["item1"],"checked_off":["item2"],"shopping_mode":false}',
  ].filter(Boolean).join('\n\n');
}

export function tripOpenerPrompt(store) {
  if (!store) return 'I want to go shopping. Greet me in one short sentence, mention the best one or two deals or a coupon that fits my list if there are any, then ask whether I want to go straight into shopping mode, where you walk me through my list section by section.';
  return `I just arrived${store ? ` at ${clip(store, 50)}` : ' at the store'}. Greet me in one short sentence, tell me the best one or two deals and any coupon that fits my list, then ask what dinners I want to plan around them.`;
}
