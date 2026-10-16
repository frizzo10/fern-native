// The conversation Fern has right after a circular is loaded: she knows this week's sale items, what is already
// on the shopping list, saved recipes and which days of the week have no dinner yet, and talks the person through
// (1) what to put on the shopping list and (2) what to eat on which day (the calendar / meal plan).
import { buildRollingWeekDateKeys, parseDateKey } from './familyDates';

const clip = (s, n = 60) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dealLine(d) {
  const price = d.salePrice ? ` ${clip(d.salePrice, 12)}` : '';
  const was = d.originalPrice ? ` (was ${clip(d.originalPrice, 12)})` : '';
  return `- ${clip(d.name)}${price}${was}${d.isBogo ? ' BOGO' : ''}`;
}

export function buildPlanSystemPrompt({ store, deals = [], list = [], savedTitles = [], mealPlan = {} }) {
  const keys = buildRollingWeekDateKeys();
  const days = keys.map((k, i) => {
    const meals = Array.isArray(mealPlan[k]) ? mealPlan[k] : [];
    const dinner = meals.find((m) => String(m?.slot || 'Dinner').toLowerCase() === 'dinner');
    const name = i === 0 ? 'today' : DAY_NAMES[parseDateKey(k).getDay()];
    return `${i} = ${name}${dinner ? ` (dinner already planned: ${clip(dinner.title, 40)})` : ' (no dinner planned)'}`;
  });
  const unchecked = list.filter((i) => !i.checked).map((i) => clip(i.text, 40)).slice(0, 60);
  return [
    'You are Fern, a warm, natural-sounding AI helping someone plan their week from this week\'s grocery flyer. You are SPEAKING out loud, so talk like a friendly person: short, plain sentences, no lists, no emoji.',
    store ? `Their store: ${clip(store, 50)}.` : '',
    deals.length ? `This week's sale items (mention ONLY these when you talk about sales; never invent items or prices):\n${deals.map(dealLine).join('\n')}` : 'No flyer items are loaded, so do not claim anything is on sale.',
    unchecked.length ? `Already on their shopping list: ${unchecked.join(', ')}.` : 'Their shopping list is empty.',
    savedTitles.length ? `Recipes they have saved: ${savedTitles.slice(0, 25).map((t) => clip(t, 40)).join('; ')}.` : '',
    `The calendar is the next 7 days, numbered by day_offset:\n${days.join('\n')}`,
    'Walk them through it in a conversation, ONE short question at a time. First help them decide what to put on the shopping list from the sale items. Then help them pick what to eat, a dinner (or other meal) for each open day, built around the sale items. Keep every reply to 2-3 sentences.',
    'When they agree to buy something, put plain grocery names (like "Ground beef") in add_to_shopping_list. When they agree to a meal on a day, put it in add_meals with that day_offset, and ALSO put the ingredients they will need to buy (not already on their list) in add_to_shopping_list. Do not read the items back in your reply; just say you are adding it. Otherwise leave the arrays empty.',
    'Respond ONLY with valid JSON, no markdown: {"reply":"...","add_to_shopping_list":["item1"],"add_meals":[{"day_offset":0,"slot":"Dinner","title":"...","emoji":"🍽️"}]}',
  ].filter(Boolean).join('\n\n');
}

export function planOpenerPrompt(store) {
  return `I just loaded this week's flyer${store ? ` for ${clip(store, 50)}` : ''}. Greet me in one short sentence, tell me the one or two best things on sale, and ask what I'd like to put on my shopping list first.`;
}

// Right after Fern's scripted walkthrough of the digitized circular (ShoppingScreen guide mode) she asks if there are
// any questions and answers them out loud. She only knows what is passed in here, so she can't invent deals.
export function buildGuideQAPrompt({ store, deals = [], list = [], savedTitles = [], coupons = [] }) {
  const unchecked = list.filter((i) => !i.checked).map((i) => clip(i.text, 40)).slice(0, 60);
  const couponLine = (c) => {
    const digital = c.redemption !== 'code' && c.redemption !== 'link';
    return `- ${clip(c.title || c.discountLabel, 70)}${c.discountLabel ? ` (${clip(c.discountLabel, 24)})` : ''}${c.store ? ` at ${clip(c.store, 30)}` : ''}${digital ? ' [digital: must be clipped in the store app or website first]' : ''}`;
  };
  return [
    'You are Fern, a warm, natural-sounding AI helping someone shop from this week\'s grocery circular. You are SPEAKING out loud: short, plain sentences, no lists, no emoji, 2-3 sentences per reply.',
    store ? `Their store: ${clip(store, 50)}.` : '',
    deals.length ? `Digitized circular, ${deals.length} sale items (talk ONLY about these; never invent items or prices). The first 60:\n${deals.slice(0, 60).map(dealLine).join('\n')}` : 'No circular items are loaded, so do not claim anything is on sale.',
    coupons.length ? `Coupons Fern picked as great values (they may not match the recipes):\n${coupons.slice(0, 12).map(couponLine).join('\n')}` : 'No coupons were picked.',
    unchecked.length ? `On their shopping list now: ${unchecked.join(', ')}.` : 'Their shopping list is empty.',
    savedTitles.length ? `Recipes they have saved: ${savedTitles.slice(0, 25).map((t) => clip(t, 40)).join('; ')}.` : '',
    'The page has: an add bar at the top for anything they want, an everyday-items box, the digitized circular where each sale item opens recipes with sides, the picked coupons, and the shopping list at the bottom. Digital coupons only work if clipped to the store loyalty account first; Walmart does not accept digital coupons.',
    'Your very first message must end with the exact question: "Do you have any questions?" After that, answer their questions plainly using only the facts above. If they ask you to add something to their shopping list, put plain grocery names (like "Ground beef") in add_to_shopping_list and just say you are adding it. Otherwise leave it empty.',
    'Respond ONLY with valid JSON, no markdown: {"reply":"...","add_to_shopping_list":["item1"]}',
  ].filter(Boolean).join('\n\n');
}

export function guideQAOpenerPrompt() {
  return 'You just walked me through my digitized circular. In ONE short spoken sentence, tell me something specific from this week\'s sale items (how many there are and the single best deal), then ask me: "Do you have any questions?" Do not repeat the page tour. Your reply MUST end with that question.';
}
