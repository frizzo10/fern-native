// Fern's memory of what you buy again and again (toilet paper, toothpaste...), plus the weekly
// "think about your everyday items" nudge the day before your usual shopping day.
// All device-only: fern_purchase_history, fern_shopping_day.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const HISTORY_KEY = 'fern_purchase_history';
const DAY_KEY = 'fern_shopping_day';
export const NUDGE_ID = 'fern-everyday-nudge';
const DEFAULT_SHOPPING_DAY = 4; // Thursday (0 = Sunday): ads change Wednesday, so the nudge lands as the new flyer does
const MAX_DATES = 12;

// Same local-calendar rule as the rest of the app (never toISOString: that is UTC and rolls to tomorrow in the evening).
export function localDateKey(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// "Paper towels" and "paper towel" are the same item.
export function stapleKey(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)).join(' ');
}

// Tap-to-add everyday items, none of which come from a recipe.
export const EVERYDAY_CHIPS = [
  { text: 'Toilet paper', emoji: '🧻' },
  { text: 'Paper towels', emoji: '🧻' },
  { text: 'Toothpaste', emoji: '🪥' },
  { text: 'Dish soap', emoji: '🧼' },
  { text: 'Laundry detergent', emoji: '🧺' },
  { text: 'Trash bags', emoji: '🗑️' },
  { text: 'Shampoo', emoji: '🧴' },
  { text: 'Deodorant', emoji: '🧴' },
  { text: 'Aluminum foil', emoji: '📦' },
  { text: 'Zip bags', emoji: '📦' },
  { text: 'Coffee', emoji: '☕' },
  { text: 'Pet food', emoji: '🐾' },
];

async function readJson(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}

export const loadHistory = () => readJson(HISTORY_KEY, {});

// Ticking an item off = bought it. One entry per item per day.
export async function logPurchase(text, now = new Date()) {
  const key = stapleKey(text);
  if (!key) return;
  try {
    const history = await loadHistory();
    const entry = history[key] || { text: String(text).trim(), dates: [] };
    const today = localDateKey(now);
    if (!entry.dates.includes(today)) entry.dates = [...entry.dates, today].slice(-MAX_DATES);
    history[key] = { ...entry, text: entry.text || String(text).trim() };
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) { /* best effort */ }
}

// Unticking it again (a mis-tap) takes today's entry back out.
export async function unlogPurchase(text, now = new Date()) {
  const key = stapleKey(text);
  if (!key) return;
  try {
    const history = await loadHistory();
    if (!history[key]) return;
    const today = localDateKey(now);
    history[key].dates = history[key].dates.filter((d) => d !== today);
    if (!history[key].dates.length) delete history[key];
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) { /* best effort */ }
}

const dayNumber = (key) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };

// Things you buy regularly that are about due again and are not already on the list.
// Needs two purchases to learn a rhythm; "due" = 85% of your usual gap has passed.
export function dueStaples(history, onListTexts = [], now = new Date(), limit = 8) {
  const onList = new Set((onListTexts || []).map(stapleKey));
  const today = dayNumber(localDateKey(now));
  const out = [];
  Object.entries(history || {}).forEach(([key, entry]) => {
    if (onList.has(key) || !Array.isArray(entry?.dates) || entry.dates.length < 2) return;
    const days = entry.dates.map(dayNumber).sort((a, b) => a - b);
    const gaps = days.slice(1).map((d, i) => d - days[i]).filter((g) => g > 0);
    if (!gaps.length) return;
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const since = today - days[days.length - 1];
    if (since >= avg * 0.85) out.push({ text: entry.text, key, since, avg: Math.round(avg), ratio: since / avg });
  });
  return out.sort((a, b) => b.ratio - a.ratio).slice(0, limit);
}

export async function getShoppingDay() {
  const raw = await readJson(DAY_KEY, null);
  return typeof raw === 'number' && raw >= 0 && raw <= 6 ? raw : null;
}

export const effectiveShoppingDay = (day) => (day == null ? DEFAULT_SHOPPING_DAY : day);

// The nudge: 6pm the day before the shopping day, every week. Same identifier each time, so rescheduling replaces it.
export async function scheduleEverydayNudge(shoppingDay, copy) {
  try {
    try { await Notifications.cancelScheduledNotificationAsync(NUDGE_ID); } catch (e) { /* none yet */ }
    const day = effectiveShoppingDay(shoppingDay);
    const before = (day + 6) % 7; // 0 = Sunday
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync();
      if (asked.status !== 'granted') return false;
    }
    await Notifications.scheduleNotificationAsync({
      identifier: NUDGE_ID,
      content: { title: copy?.title || '🛒 Shopping tomorrow?', body: copy?.body || '', data: { type: 'everyday_nudge' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes?.WEEKLY || 'weekly',
        weekday: before + 1, // expo: 1 = Sunday
        hour: 18,
        minute: 0,
      },
    });
    return true;
  } catch (e) {
    console.warn('[staples] could not schedule the everyday nudge', e?.message || e);
    return false;
  }
}

export async function saveShoppingDay(day, copy) {
  try { await AsyncStorage.setItem(DAY_KEY, JSON.stringify(day)); } catch (e) { /* best effort */ }
  return scheduleEverydayNudge(day, copy);
}
