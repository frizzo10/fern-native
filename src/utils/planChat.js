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
