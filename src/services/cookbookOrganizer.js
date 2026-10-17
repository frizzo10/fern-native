// Background "organize my cookbook into chapters" (AI). One `ai` call per cookbook, result kept on the
// device in `fern_book_chapters` { [bookId]: { count, chapters: [{ name, ids: [recipeId...] }] } }.
// Device-only on purpose: it is a derived layout, so nothing about it needs to sync, and a new device
// just organizes again. Recipes are never moved or changed; only how the cookbook is laid out.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'fern_book_chapters';
export const MIN_RECIPES_FOR_CHAPTERS = 8;
const MAX_RECIPES = 250;

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
    'Rules: 3 to 10 chapters; every recipe number appears in exactly one chapter; do not invent or drop numbers;',
    'put chapters in a natural reading order (for example starters, mains, sides, desserts; or simple to fancy);',
    'avoid chapters with only one recipe unless unavoidable; no catch-all chapter called "Other" or "Miscellaneous";',
    `chapter names are short, in title case, 2 to 5 words, written in ${lang}.`,
  ].join(' ');
}

// recipes: [{ id, title }]. Returns [{ name, ids }] or throws.
export async function organizeRecipes({ recipes, locale, token }) {
  const list = recipes.map((r, i) => `${i + 1}. ${String(r.title || '').trim()}`).join('\n');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  let res;
  try {
    res = await fetch('https://app.clickpickandcook.com/.netlify/functions/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
      body: JSON.stringify({
        system: systemPrompt(locale),
        messages: [{ role: 'user', content: `Organize these ${recipes.length} recipes into chapters:\n${list}` }],
        feature: 'fern_chat',
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
  // Anything the AI forgot goes in a last chapter instead of vanishing.
  const left = recipes.filter((_, i) => !used.has(i)).map((r) => String(r.id));
  if (left.length) chapters.push({ name: locale === 'es' ? 'Más recetas' : 'More Recipes', ids: left });
  if (chapters.length < 2) throw new Error('organize: too few chapters');
  return chapters;
}

export async function organizeBook({ bookId, recipes, locale, token }) {
  const chapters = await organizeRecipes({ recipes, locale, token });
  await saveChapters(bookId, { count: recipes.length, chapters, at: Date.now() });
  return chapters;
}
