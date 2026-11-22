// Background "organize my cookbook into chapters" (AI). One `ai` call per cookbook, result kept on the
// device in `fern_book_chapters` { [bookId]: { count, chapters: [{ name, ids: [recipeId...] }] } }.
// Device-only on purpose: it is a derived layout, so nothing about it needs to sync, and a new device
// just organizes again. Recipes are never moved or changed; only how the cookbook is laid out.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'fern_book_chapters';
export const MIN_RECIPES_FOR_CHAPTERS = 8;
const MAX_RECIPES = 250;
export const LAYOUT_VERSION = 3;
// The whole recipe library (Recipes tab) is laid out in chapters too, under this id in the same map.
export const LIBRARY_ID = '__library__';
const LIBRARY_MAX = 600;

export function libraryNeedsOrganizing(entry, count) {
  if (count < MIN_RECIPES_FOR_CHAPTERS || count > LIBRARY_MAX) return false;
  if (!entry || entry.v !== LAYOUT_VERSION) return true;
  return Math.abs(count - (entry.count || 0)) >= Math.max(5, Math.round((entry.count || 0) * 0.15));
}

export async function loadChapterMap() {
  try {
    const m = JSON.parse((await AsyncStorage.getItem(KEY)) || '{}');
    return m && typeof m === 'object' ? m : {};
  } catch (e) {
    return {};
  }
}

async function saveChapters(bookId, entry) {
  const m = await loadChapterMap();
  m[bookId] = entry;
  await AsyncStorage.setItem(KEY, JSON.stringify(m));
}

// Re-organize when there is no layout yet, or the book has grown/shrunk by a few recipes.
export function needsOrganizing(entry, count) {
  if (count < MIN_RECIPES_FOR_CHAPTERS || count > MAX_RECIPES) return false;
  if (!entry) return true;
  if (entry.v !== LAYOUT_VERSION) return true; // older layouts were made from titles alone and mis-filed dishes
  return Math.abs(count - (entry.count || 0)) >= Math.max(3, Math.round((entry.count || 0) * 0.1));
}

function parseJsonObject(text) {
  const s = String(text || '');
  try { return JSON.parse(s); } catch (e) { /* fall through */ }
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}

function systemPrompt(locale) {
  const lang = locale === 'es' ? 'Spanish' : 'English';
  return [
    'You organize a cookbook into chapters, the way a well-edited printed cookbook is laid out.',
    'You get numbered recipe titles. Decide what grouping makes sense for THIS book (for example type of dish, cookie type, course, main ingredient, cuisine or occasion) and group the recipes.',
    'Return ONLY JSON, no markdown: {"chapters":[{"name":"...","items":[1,2,3]}]}',
    'Each line is "number. title | meal type | main ingredients". Decide from the ingredients, not from words in the title: a restaurant or place name (like Anchor Bar) says nothing about the dish.',
    'A chapter named for an ingredient or food (seafood, chicken, beef, pasta...) may only hold recipes that really contain it as the main ingredient; chicken wings are poultry, never seafood.',
    'Keep course apart from ingredient: dips, spreads, party bites and finger foods (meal type Appetizer or Snack) go in their own appetizer chapter, soups and stews in a soup chapter, salads and sides in theirs, desserts in theirs, even if they contain meat or seafood. A meat, poultry or seafood chapter holds only main dishes.',
    'Rules: 3 to 10 chapters; every recipe number appears in exactly one chapter; do not invent or drop numbers;',
    'put chapters in a natural reading order (for example starters, mains, sides, desserts; or simple to fancy);',
    'avoid chapters with only one recipe unless unavoidable; no catch-all chapter called "Other" or "Miscellaneous";',
    `chapter names are short, in title case, 2 to 5 words, written in ${lang}.`,
  ].join(' ');
}

// Puts recipes into the closest existing chapter (mutates `chapters`' ids). One small `ai` call.
// Returns the recipes that fit no chapter (or all of them if the call fails).
export async function assignToChapters({ chapters, recipes, locale, token, feature }) {
  const names = chapters.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
  const list = recipes.map((r, i) => `${i + 1}. ${String(r.title || '').trim()}${r.hint ? ` | ${r.hint}` : ''}`).join('\n');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  let res;
  try {
    res = await fetch('https://app.clickpickandcook.com/.netlify/functions/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
      body: JSON.stringify({
        system: 'You file recipes into the closest existing cookbook chapter. Return ONLY JSON, no markdown: {"assign":[{"item":1,"chapter":2}]}. "item" is the recipe number, "chapter" the chapter number; use chapter 0 only if no chapter fits at all. Decide from the main ingredients, not from words in the title.',
        messages: [{ role: 'user', content: `Chapters:\n${names}\n\nRecipes:\n${list}` }],
        feature: feature || 'fern_chat',
        locale: locale || 'en',
        token,
      }),
      signal: ctrl.signal,
    });
  } catch (e) {
    return recipes;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) return recipes;
  let parsed = null;
  try {
    const json = await res.json();
    parsed = parseJsonObject(json?.content?.find((p) => p?.type === 'text')?.text || json?.message || json?.reply || '');
  } catch (e) { return recipes; }
  const arr = Array.isArray(parsed?.assign) ? parsed.assign : [];
  const done = new Set();
  arr.forEach((a) => {
    const i = Number.parseInt(a?.item, 10) - 1;
    const c = Number.parseInt(a?.chapter, 10) - 1;
    if (i >= 0 && i < recipes.length && c >= 0 && c < chapters.length && !done.has(i)) {
      done.add(i);
      chapters[c].ids.push(String(recipes[i].id));
    }
  });
  return recipes.filter((_, i) => !done.has(i));
}

// An existing layout plus recipes added since: file the new ones into the closest chapters and save.
export async function placeNewRecipes({ bookId, entry, recipes, locale, token, feature }) {
  const placed = new Set();
  (entry?.chapters || []).forEach((c) => (c.ids || []).forEach((id) => placed.add(String(id))));
  const fresh = recipes.filter((r) => !placed.has(String(r.id)));
  if (!fresh.length || !entry?.chapters?.length) return false;
  const chapters = entry.chapters.map((c) => ({ name: c.name, ids: [...(c.ids || [])] }));
  const rest = await assignToChapters({ chapters, recipes: fresh, locale, token, feature });
  if (rest.length === fresh.length) return false; // nothing placed; leave the layout alone
  await saveChapters(bookId, { ...entry, count: recipes.length, chapters, at: Date.now() });
  return true;
}

// recipes: [{ id, title }]. Returns [{ name, ids }] or throws.
export async function organizeRecipes({ recipes, locale, token, feature }) {
  const list = recipes.map((r, i) => `${i + 1}. ${String(r.title || '').trim()}${r.hint ? ` | ${r.hint}` : ''}`).join('\n');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), recipes.length > 150 ? 70000 : 45000);
  let res;
  try {
    res = await fetch('https://app.clickpickandcook.com/.netlify/functions/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
      body: JSON.stringify({
        system: systemPrompt(locale),
        messages: [{ role: 'user', content: `Organize these ${recipes.length} recipes into chapters:\n${list}` }],
        feature: feature || 'fern_chat',
        locale: locale || 'en',
        token,
      }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`organize failed (${res.status})`);
  const json = await res.json();
  const text = json?.content?.find((p) => p?.type === 'text')?.text || json?.message || json?.reply || '';
  const parsed = parseJsonObject(text);
  const raw = Array.isArray(parsed?.chapters) ? parsed.chapters : null;
  if (!raw) throw new Error('organize: no chapters in reply');

  const used = new Set();
  const chapters = [];
  raw.forEach((c) => {
    const ids = [];
    (Array.isArray(c?.items) ? c.items : []).forEach((n) => {
      const i = Number.parseInt(n, 10) - 1;
      if (i >= 0 && i < recipes.length && !used.has(i)) { used.add(i); ids.push(String(recipes[i].id)); }
    });
    const name = String(c?.name || '').trim();
    if (name && ids.length) chapters.push({ name, ids });
  });
  // Anything the AI forgot goes into the closest chapter; only what fits nowhere lands in "More Recipes".
  const leftRecipes = recipes.filter((_, i) => !used.has(i));
  if (leftRecipes.length && chapters.length) {
    const rest = await assignToChapters({ chapters, recipes: leftRecipes, locale, token, feature }).catch(() => leftRecipes);
    if (rest.length) chapters.push({ name: locale === 'es' ? 'Más recetas' : 'More Recipes', ids: rest.map((r) => String(r.id)) });
  } else if (leftRecipes.length) {
    chapters.push({ name: locale === 'es' ? 'Más recetas' : 'More Recipes', ids: leftRecipes.map((r) => String(r.id)) });
  }
  if (chapters.length < 2) throw new Error('organize: too few chapters');
  return chapters;
}

export async function organizeBook({ bookId, recipes, locale, token, feature }) {
  const chapters = await organizeRecipes({ recipes, locale, token, feature });
  await saveChapters(bookId, { v: LAYOUT_VERSION, count: recipes.length, chapters, at: Date.now() });
  return chapters;
}
