// Fern Autopilot: Fern plans the empty dinner nights of the next 7 days on her own and puts what they need on the shopping list.
// Two modes the person chooses (device-only `fern_autopilot`): 'ask' (she shows the plan, they approve) and 'auto'
// (she just does it, with an Undo). 'off' or never chosen = she does nothing by herself.
// She only drafts here; the changes are made by the same executor the chat uses (fernAgent.executeAgentActions),
// so what the card says happened is what happened. Runs at most once per local day (`fern_autopilot_last`).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildRollingWeekDateKeys, dateToKey, formatDayLabel } from '../utils/familyDates';
import { loadWeekDeals } from '../utils/savings';
import { pickStarDeals } from '../utils/starDeals';
import { executeAgentActions } from './fernAgent';

const AI_URL = 'https://app.clickpickandcook.com/.netlify/functions/ai';
const MODE_KEY = 'fern_autopilot';
const LAST_KEY = 'fern_autopilot_last';

async function readJson(key, fallback) {
  try { const v = JSON.parse((await AsyncStorage.getItem(key)) || 'null'); return v == null ? fallback : v; } catch (e) { return fallback; }
}

export async function getAutopilotMode() {
  try { const m = await AsyncStorage.getItem(MODE_KEY); return m === 'ask' || m === 'auto' || m === 'off' ? m : null; } catch (e) { return null; }
}
export async function setAutopilotMode(mode) {
  try { await AsyncStorage.setItem(MODE_KEY, mode); } catch (e) { /* ignore */ }
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
export async function draftWeek({ user, locale }) {
  const keys = buildRollingWeekDateKeys();
  const [plan, saved, acts, list, prefs, profile, deals] = await Promise.all([
    readJson('rv4_meal_plan', {}), readJson('rv4_saved', []), readJson('rv4_activities', []),
    readJson('rv4_master_shop', []), readJson('fern_shopper_prefs', {}), readJson('remi_explicit', {}), loadWeekDeals(),
  ]);
  const hasDinner = (k) => (Array.isArray(plan[k]) ? plan[k] : []).some((m) => String(m?.slot || 'Dinner').toLowerCase() === 'dinner');
  const empty = keys.map((k, i) => ({ k, i })).filter((x) => !hasDinner(x.k));
  if (!empty.length) return { summary: '', meals: [] };
  const planned = keys.flatMap((k) => (Array.isArray(plan[k]) ? plan[k] : []).map((m) => m?.title)).filter(Boolean);
  const star = pickStarDeals(deals, 8).map((d) => `${d.name}${d.salePrice ? ` ${d.salePrice}` : ''}${d.isBogo ? ' BOGO' : ''}`);
  const busy = keys.map((k, i) => ({ i, n: acts.filter((a) => a.dateKey === k).length })).filter((x) => x.n > 0).map((x) => x.i);
  const context = {
    nightsToPlan: empty.map((x) => ({ day_offset: x.i, day: formatDayLabel(x.k) })),
    alreadyPlanned: planned.slice(0, 20),
    busyDaysWithActivities: busy,
    peopleCookedFor: prefs?.householdSize || '',
    dietOrAvoid: prefs?.dietary || '',
    saleItemsThisWeek: star,
    savedRecipeTitles: saved.map((r) => r?.title).filter(Boolean).slice(0, 60),
    alreadyOnShoppingList: list.filter((i) => !i.checked).map((i) => i.text).slice(0, 40),
  };
  const system =
    'You are Fern, a food planner. Plan one dinner for EACH night in nightsToPlan. Return ONLY JSON: ' +
    '{"summary":"one friendly sentence","meals":[{"day_offset":0,"title":"dish name","emoji":"🍽️","sides":["side"],"ingredients":["1 lb chicken thighs"]}]}. ' +
    'Rules: prefer an exact title from savedRecipeTitles (then leave ingredients empty); otherwise a new dish with 5-10 buyable ingredients with quantities. ' +
    'Build several dinners around saleItemsThisWeek. Respect peopleCookedFor and dietOrAvoid strictly. Quick meals on busyDaysWithActivities. ' +
    'No repeats of alreadyPlanned or of each other. Give each dinner one or two sides. No markdown.' +
    (locale === 'es' ? ' Write titles and the summary in Spanish.' : '');
  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, feature: 'fern_chat', messages: [{ role: 'user', content: JSON.stringify(context) }], locale, userId: user?.id, token: user?.token }),
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
  })).filter((m) => m.title && allowed.has(m.day_offset) && !seen.has(m.day_offset) && seen.add(m.day_offset))
    .map((m) => ({ ...m, dayLabel: formatDayLabel(keys[m.day_offset]) }))
    .sort((a, b) => a.day_offset - b.day_offset);
  return { summary: String(parsed?.summary || '').trim(), meals };
}

// Makes the changes. Returns { count, snapshot } (snapshot = what to put back for Undo).
export async function applyWeek(meals, env) {
  const snapshot = { plan: await readJson('rv4_meal_plan', {}), shop: await readJson('rv4_master_shop', []) };
  const actions = meals.flatMap((m) => [
    { type: 'plan_meal', day_offset: m.day_offset, slot: 'Dinner', title: m.title, emoji: m.emoji, sides: m.sides },
    { type: 'add_recipe_to_list', title: m.title, ingredients: m.ingredients },
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
