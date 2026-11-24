// Fern Autopilot: Fern plans the empty dinner nights of the next 7 days on her own and puts what they need on the shopping list.
// Two modes the person chooses (device-only `fern_autopilot`): 'ask' (she shows the plan, they approve) and 'auto'
// (she just does it, with an Undo). 'off' or never chosen = she does nothing by herself.
// She only drafts here; the changes are made by the same executor the chat uses (fernAgent.executeAgentActions),
// so what the card says happened is what happened. Runs at most once per local day (`fern_autopilot_last`).
import { mergedDietary } from './householdService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildRollingWeekDateKeys, dateToKey, formatDayLabel } from '../utils/familyDates';
import { loadWeekDeals } from '../utils/savings';
import { pickStarDeals } from '../utils/starDeals';
import { executeAgentActions } from './fernAgent';
import { toShoppingName } from '../utils/shoppingName';
import { normalizeRecipe, stripStepNumber } from '../utils/recipeNormalize';
import { nameKey, addRecipesToShoppingList } from '../utils/shoppingListSync';

const AI_URL = 'https://app.clickpickandcook.com/.netlify/functions/ai';
const MODE_KEY = 'fern_autopilot';
const LAST_KEY = 'fern_autopilot_last';

async function readJson(key, fallback) {
  try { const v = JSON.parse((await AsyncStorage.getItem(key)) || 'null'); return v == null ? fallback : v; } catch (e) { return fallback; }
}

export async function getAutopilotMode() {
  try { const m = await AsyncStorage.getItem(MODE_KEY); return m === 'ask' || m === 'auto' || m === 'off' ? m : null; } catch (e) { return null; }
}
const modeListeners = new Set();
export function subscribeAutopilotMode(fn) { modeListeners.add(fn); return () => modeListeners.delete(fn); }
export async function setAutopilotMode(mode) {
  try { await AsyncStorage.setItem(MODE_KEY, mode); } catch (e) { /* ignore */ }
  modeListeners.forEach((fn) => { try { fn(mode); } catch (e) { /* ignore */ } });
}
export async function autopilotRanToday() {
  try { return (await AsyncStorage.getItem(LAST_KEY)) === dateToKey(new Date()); } catch (e) { return false; }
}
export async function markAutopilotRan() {
  try { await AsyncStorage.setItem(LAST_KEY, dateToKey(new Date())); } catch (e) { /* ignore */ }
}

function parseLoose(text) {
  const raw = String(text || '').trim();
  try { return JSON.parse(raw); } catch (e) { /* fall through */ }
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}

// Drafts dinners for the empty nights. Returns { summary, meals: [{ day_offset, dayLabel, title, emoji, sides, ingredients }] }.
export async function draftWeek({ user, locale, onStep, avoid = [], replan = false }) {
  const keys = buildRollingWeekDateKeys();
  const [plan, saved, acts, list, prefs, profile, deals] = await Promise.all([
    readJson('rv4_meal_plan', {}), readJson('rv4_saved', []), readJson('rv4_activities', []),
    readJson('rv4_master_shop', []), readJson('fern_shopper_prefs', {}), readJson('remi_explicit', {}), loadWeekDeals(),
  ]);
  const hasDinner = (k) => (Array.isArray(plan[k]) ? plan[k] : []).some((m) => String(m?.slot || 'Dinner').toLowerCase() === 'dinner');
  const skipDays = new Set((Array.isArray(avoid) ? avoid : []).map(Number));
  const empty = keys.map((k, i) => ({ k, i })).filter((x) => (replan || !hasDinner(x.k)) && !skipDays.has(x.i));
  if (!empty.length) return { summary: '', meals: [], nothingToPlan: true };
  if (onStep) onStep('plan', empty.length);
  const planned = keys.flatMap((k) => (Array.isArray(plan[k]) ? plan[k] : []).map((m) => m?.title)).filter(Boolean);
  const star = pickStarDeals(deals, 8).map((d) => `${d.name}${d.salePrice ? ` ${d.salePrice}` : ''}${d.isBogo ? ' BOGO' : ''}`);
  const busy = keys.map((k, i) => ({ i, n: acts.filter((a) => a.dateKey === k).length })).filter((x) => x.n > 0).map((x) => x.i);
  const context = {
    nightsToPlan: empty.map((x) => ({ day_offset: x.i, day: formatDayLabel(x.k) })),
    alreadyPlanned: replan ? [] : planned.slice(0, 20),
    busyDaysWithActivities: busy,
    peopleCookedFor: prefs?.householdSize || '',
    dietOrAvoid: (await mergedDietary(prefs?.dietary).catch(() => '')) || prefs?.dietary || '',
    saleItemsThisWeek: star,
    savedRecipeTitles: saved.map((r) => r?.title).filter(Boolean).slice(0, 60),
    alreadyOnShoppingList: list.filter((i) => !i.checked).map((i) => i.text).slice(0, 40),
  };
  const system =
    'You are Fern, a food planner. Plan one dinner for EACH night in nightsToPlan. Return ONLY JSON: ' +
    '{"summary":"one friendly sentence","meals":[{"day_offset":0,"title":"dish name","emoji":"🍽️","sides":["side"],"ingredients":["1 lb chicken thighs"],"instructions":["Step in one sentence"],"why":"one short sentence saying why this dish fits THAT day"}]}. ' +
    'Rules: prefer an exact title from savedRecipeTitles (then leave ingredients empty); otherwise a new dish with 5-10 buyable ingredients with quantities and 4-7 short method steps in instructions (for a saved title leave instructions empty too). ' +
    'Build several dinners around saleItemsThisWeek. Respect peopleCookedFor and dietOrAvoid strictly. Quick meals on busyDaysWithActivities. ' +
    'No repeats of alreadyPlanned or of each other. Give each dinner one or two sides. In why, name the real reason for that day (a busy evening with an activity, a sale item it uses, a saved recipe the family already likes, variety after another dish), never generic praise. No markdown.' +
    (locale === 'es' ? ' Write titles and the summary in Spanish.' : '');
  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, feature: 'recipe_search', messages: [{ role: 'user', content: JSON.stringify(context) }], locale, userId: user?.id, token: user?.token }),
  });
  if (!res.ok) throw new Error(`ai ${res.status}`);
  const d = await res.json();
  const parsed = parseLoose(d?.content?.[0]?.text ?? d?.data?.content?.[0]?.text ?? '');
  const allowed = new Set(empty.map((x) => x.i));
  const seen = new Set();
  const meals = (Array.isArray(parsed?.meals) ? parsed.meals : []).map((m) => ({
    day_offset: Number(m?.day_offset),
    title: String(m?.title || '').trim(),
    emoji: m?.emoji || '🍽️',
    sides: Array.isArray(m?.sides) ? m.sides.map(String).filter(Boolean).slice(0, 2) : [],
    ingredients: Array.isArray(m?.ingredients) ? m.ingredients.map(String).filter(Boolean) : [],
    instructions: Array.isArray(m?.instructions) ? m.instructions.map(String).filter(Boolean).slice(0, 10) : [],
    why: String(m?.why || '').trim().slice(0, 220),
  })).filter((m) => m.title && allowed.has(m.day_offset) && !seen.has(m.day_offset) && seen.add(m.day_offset))
    .map((m) => ({ ...m, dayLabel: formatDayLabel(keys[m.day_offset]) }))
    .sort((a, b) => a.day_offset - b.day_offset);
  return { summary: String(parsed?.summary || '').trim(), meals };
}

// Makes the changes. Returns { count, snapshot } (snapshot = what to put back for Undo).
export async function applyWeek(meals, env) {
  const snapshot = { plan: await readJson('rv4_meal_plan', {}), shop: await readJson('rv4_master_shop', []) };
  const actions = meals.flatMap((m) => [
    { type: 'plan_meal', day_offset: m.day_offset, slot: 'Dinner', title: m.title, emoji: m.emoji, sides: m.sides, replace: true },
    { type: 'add_recipe_to_list', title: m.title, ingredients: m.ingredients, skip: Array.isArray(m.skip) ? m.skip : [] },
  ]);
  const out = await executeAgentActions(actions, { ...env, canSaveUnlimited: true });
  return { count: meals.length, lines: out.lines, snapshot };
}

export async function undoWeek(snapshot, env) {
  try {
    await AsyncStorage.setItem('rv4_meal_plan', JSON.stringify(snapshot.plan));
    await AsyncStorage.setItem('rv4_master_shop', JSON.stringify(snapshot.shop));
    const cache = await readJson('fern_sync_cache', {});
    await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({ ...cache, mealPlan: snapshot.plan, shopping: snapshot.shop }));
    await env.pushChangedFromStorage({ meal_plan: snapshot.plan, shopping: snapshot.shop });
    return true;
  } catch (e) { return false; }
}

// The ingredients a planned dinner needs, as the list would show them: a saved recipe's own, else the ones Fern drafted.
export async function mealIngredients(meal) {
  const saved = await readJson('rv4_saved', []);
  const lc = (x) => String(x || '').trim().toLowerCase();
  const own = (Array.isArray(saved) ? saved : []).find((r) => lc(r?.title) === lc(meal.title));
  const norm = own ? normalizeRecipe(own, 0) : null;
  const real = (a) => (Array.isArray(a) ? a : []).map((x) => String(x || '').trim()).filter((x) => x && !/^No (ingredients|method steps) listed yet$/i.test(x));
  const ownIng = norm ? real(norm.ingredients) : [];
  const raw = own && Array.isArray(own.ingredients) && own.ingredients.length ? own.ingredients : meal.ingredients || [];
  const lines = raw.map((x) => (typeof x === 'string' ? x : [x?.amount, x?.unit, x?.item || x?.name].filter(Boolean).join(' '))).map((x) => String(x).trim()).filter(Boolean);
  const shown = ownIng.length ? ownIng : lines;
  const steps = (norm ? real(norm.methodSteps) : real(meal.instructions)).map(stripStepNumber).filter(Boolean);
  const photo = own ? (([...(Array.isArray(own._cloudPhotos) ? own._cloudPhotos : []), own._photoUrl, own.image].find((u) => typeof u === 'string' && /^https?:/.test(u))) || null) : null;
  const seen = new Set();
  return { fromSaved: Boolean(own), photo, lines: shown, steps, servings: own ? String(own.servings || own.serves || own.yield || '').trim() : '', items: lines.map((l) => { const name = toShoppingName(l); return { name, key: nameKey(name) }; }).filter((i) => i.name && !seen.has(i.key) && seen.add(i.key)) };
}

// "soccer Tuesday 5:30, dinner out Friday" -> { activities: [...], skipDinners: [offsets] }. One ai call.
export async function parsePlans({ text, user, locale }) {
  const keys = buildRollingWeekDateKeys();
  const cal = keys.map((k, i) => ({ day_offset: i, day: formatDayLabel(k), weekday: parseWeekday(k) }));
  const system =
    'Turn the person\'s plans into JSON. Return ONLY: {"activities":[{"day_offset":0,"label":"Soccer practice","emoji":"⚽","start":"5:30 PM","end":""}],"skipDinners":[4]}. ' +
    'day_offset comes from calendar (use the weekday or date they say). start/end are "H:MM AM/PM" or empty. Put "dinner out", "eating out", "away" style plans in skipDinners (day_offsets that need no home dinner) AND also as an activity. ' +
    'Ignore anything outside the 7 days. No markdown.' + (locale === 'es' ? ' Labels in Spanish.' : '');
  const res = await fetch(AI_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, feature: 'fern_chat', messages: [{ role: 'user', content: JSON.stringify({ calendar: cal, plans: String(text || '').slice(0, 600) }) }], locale, userId: user?.id, token: user?.token }),
  });
  if (!res.ok) throw new Error(`ai ${res.status}`);
  const d = await res.json();
  const parsed = parseLoose(d?.content?.[0]?.text ?? d?.data?.content?.[0]?.text ?? '');
  const ok = (n) => Number.isInteger(Number(n)) && Number(n) >= 0 && Number(n) <= 6;
  const activities = (Array.isArray(parsed?.activities) ? parsed.activities : []).filter((a) => a?.label && ok(a.day_offset))
    .slice(0, 10).map((a) => ({ day_offset: Number(a.day_offset), label: String(a.label).slice(0, 60), emoji: a.emoji || '📌', start: String(a.start || ''), end: String(a.end || ''), dayLabel: formatDayLabel(keys[Number(a.day_offset)]) }));
  const skipDinners = (Array.isArray(parsed?.skipDinners) ? parsed.skipDinners : []).filter(ok).map(Number);
  return { activities, skipDinners };
}
function parseWeekday(k) { const [y, m, d] = k.split('-').map(Number); return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(y, m - 1, d).getDay()]; }

export async function addPlannedActivities(activities, env) {
  if (!activities.length) return;
  await executeAgentActions(activities.map((a) => ({ type: 'add_activity', day_offset: a.day_offset, label: a.label, emoji: a.emoji, start: a.start, end: a.end })), env);
}

// Extra items the person typed in the shopping review.
export async function addExtraItems(items, env) {
  const names = items.map((x) => String(x).trim()).filter(Boolean);
  if (!names.length) return;
  const list = await readJson('rv4_master_shop', []);
  await addRecipesToShoppingList([{ id: `autopilot-extra-${Date.now()}`, title: 'Manual Add', ingredients: names }], list, { skip: new Set() });
  await env.pushChangedFromStorage();
}

// The dinners already on the week (for walking through them when every night is planned).
export async function existingDinners(avoid = []) {
  const keys = buildRollingWeekDateKeys();
  const plan = await readJson('rv4_meal_plan', {});
  const skip = new Set((avoid || []).map(Number));
  const out = [];
  keys.forEach((k, i) => {
    if (skip.has(i)) return;
    const m = (Array.isArray(plan[k]) ? plan[k] : []).find((x) => String(x?.slot || 'Dinner').toLowerCase() === 'dinner');
    if (m?.title) out.push({ day_offset: i, dayLabel: formatDayLabel(k), title: String(m.title), emoji: m.emoji || '🍽️', sides: Array.isArray(m.sides) ? m.sides.slice(0, 2) : [], ingredients: [] });
  });
  return out;
}

function jsonAsk(system, content, user, locale, feature = 'fern_chat') {
  return fetch(AI_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, feature, messages: [{ role: 'user', content: JSON.stringify(content) }], locale, userId: user?.id, token: user?.token }),
  }).then(async (res) => {
    if (!res.ok) throw new Error(`ai ${res.status}`);
    const d = await res.json();
    return parseLoose(d?.content?.[0]?.text ?? d?.data?.content?.[0]?.text ?? '');
  });
}

async function dayFacts(dayOffset) {
  const keys = buildRollingWeekDateKeys();
  const [acts, deals, saved, plan, prefs] = await Promise.all([
    readJson('rv4_activities', []), loadWeekDeals(), readJson('rv4_saved', []), readJson('rv4_meal_plan', {}), readJson('fern_shopper_prefs', {}),
  ]);
  const k = keys[dayOffset];
  return {
    day: formatDayLabel(k),
    activitiesThatDay: acts.filter((a) => a.dateKey === k).map((a) => `${a.label}${a.startTime ? ` at ${a.startTime}` : ''}`),
    saleItems: pickStarDeals(deals, 8).map((d) => `${d.name}${d.salePrice ? ` ${d.salePrice}` : ''}${d.isBogo ? ' BOGO' : ''}`),
    savedRecipeTitles: saved.map((r) => r?.title).filter(Boolean).slice(0, 80),
    plannedThisWeek: keys.flatMap((kk) => (Array.isArray(plan[kk]) ? plan[kk] : []).map((m) => m?.title)).filter(Boolean).slice(0, 20),
    people: prefs?.householdSize || '',
    diet: (await mergedDietary(prefs?.dietary).catch(() => '')) || prefs?.dietary || '',
  };
}

// A reason, per dinner, for dinners that are already on the week (so the walkthrough can say why each fits its day).
export async function explainDinners({ dinners, user, locale }) {
  const keys = buildRollingWeekDateKeys();
  const acts = await readJson('rv4_activities', []);
  const deals = await loadWeekDeals();
  const context = {
    dinners: dinners.map((m) => ({ day_offset: m.day_offset, day: formatDayLabel(keys[m.day_offset]), title: m.title, activitiesThatDay: acts.filter((a) => a.dateKey === keys[m.day_offset]).map((a) => a.label) })),
    saleItemsThisWeek: pickStarDeals(deals, 8).map((d) => d.name),
  };
  const system = 'You are Fern. For each dinner say in one short sentence why it works on THAT day (an activity that night, a sale item it uses, variety with the other dinners, an easy night). Be specific and honest; if there is no special reason say it is a good fit for an open evening. Return ONLY JSON: {"reasons":[{"day_offset":0,"why":"..."}]}. No markdown.' + (locale === 'es' ? ' Write in Spanish.' : '');
  const parsed = await jsonAsk(system, context, user, locale);
  const out = {};
  (Array.isArray(parsed?.reasons) ? parsed.reasons : []).forEach((r) => { if (Number.isInteger(Number(r?.day_offset)) && r?.why) out[Number(r.day_offset)] = String(r.why).slice(0, 220); });
  return out;
}

// Other dinners for one night: some from the saved recipes, some new ideas, each with a reason.
export async function suggestAlternatives({ dayOffset, currentTitle, otherTitles = [], user, locale }) {
  const facts = await dayFacts(dayOffset);
  const system = 'You are Fern, planning ONE dinner. Give 4 alternatives for this night: exactly two whose title is copied EXACTLY from savedRecipeTitles and two new ideas. Not the current dish and not anything in plannedThisWeek. Return ONLY JSON: {"options":[{"title":"","emoji":"🍽️","sides":[""],"ingredients":["1 lb ..."],"instructions":["Step"],"why":"one short specific sentence why it fits THIS day"}]}. For saved titles leave ingredients empty. For new ideas give 5-9 buyable ingredients with quantities and 4-6 short method steps in instructions. Respect people and diet strictly. No markdown.' + (locale === 'es' ? ' Titles and why in Spanish (saved titles stay exactly as they are).' : '');
  const parsed = await jsonAsk(system, { ...facts, plannedThisWeek: [...facts.plannedThisWeek, ...otherTitles].slice(0, 30), currentDish: currentTitle }, user, locale, 'recipe_search');
  const planned = new Set([String(currentTitle || '').toLowerCase(), ...otherTitles.map((x) => String(x || '').toLowerCase())]);
  return (Array.isArray(parsed?.options) ? parsed.options : []).map((o) => ({
    title: String(o?.title || '').trim(), emoji: o?.emoji || '🍽️',
    sides: Array.isArray(o?.sides) ? o.sides.map(String).filter(Boolean).slice(0, 2) : [],
    ingredients: Array.isArray(o?.ingredients) ? o.ingredients.map(String).filter(Boolean) : [],
    instructions: Array.isArray(o?.instructions) ? o.instructions.map(String).filter(Boolean).slice(0, 10) : [],
    why: String(o?.why || '').trim().slice(0, 220),
  })).filter((o) => o.title && !planned.has(o.title.toLowerCase()) && planned.add(o.title.toLowerCase())).slice(0, 5);
}

export async function savedRecipeList() {
  const savedRaw = await readJson('rv4_saved', []);
  const saved = Array.isArray(savedRaw) ? savedRaw : [];
  return saved.map((r) => ({ title: String(r?.title || '').trim(), emoji: r?.emoji || '🍽️' })).filter((r) => r.title);
}
