// Translate a cookbook (recipes, title, chapter names) for sharing. Only the shared copy is translated;
// the recipes in the person's own library are never touched. Uses the `ai` function (feature recipe_search,
// the large-reply cap), a few recipes per call, three calls at a time.
const AI_URL = 'https://app.clickpickandcook.com/.netlify/functions/ai';
const LANG_NAME = { es: 'Spanish (neutral Latin American)' };
const BATCH = 4;
const PARALLEL = 3;

function parseJson(text) {
  const s = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(s); } catch (e) { /* fall through */ }
  const m = s.match(/[\[{][\s\S]*[\]}]/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}

async function askAi({ system, user, token, locale }, attempt = 0) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
      body: JSON.stringify({
        system,
        messages: [{ role: 'user', content: user }],
        feature: 'recipe_search',
        locale: locale || 'en',
        token,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`translate failed (${res.status})`);
    const json = await res.json();
    const text = json?.content?.find((p) => p?.type === 'text')?.text || json?.message || json?.reply || '';
    const parsed = parseJson(text);
    if (!parsed) throw new Error('translate: unreadable reply');
    return parsed;
  } catch (e) {
    if (attempt < 1) return askAi({ system, user, token, locale }, attempt + 1);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const lines = (a) => (Array.isArray(a) ? a.map((x) => String(x || '').trim()).filter(Boolean) : []);

async function translateBatch(batch, lang, token) {
  const payload = batch.map((r) => ({
    title: r.title || '',
    description: r.description || '',
    cuisine: r.category || '',
    mealType: r.meal || '',
    difficulty: r.difficulty || '',
    ingredients: lines(r.ingredients),
    instructions: lines(r.methodSteps),
    notes: r.note || '',
  }));
  const system = [
    `You translate recipes into ${LANG_NAME[lang] || lang}.`,
    `You get a JSON array of ${payload.length} recipes. Return ONLY a JSON array of exactly ${payload.length} objects, same order,`,
    'with the same keys (title, description, cuisine, mealType, difficulty, ingredients, instructions, notes) and the same number of ingredient and instruction lines.',
    'Translate every text value naturally, the way a Spanish-language cookbook would say it. Keep numbers, fractions and quantities unchanged; convert unit words (cup, tablespoon, teaspoon, ounce, pound) to their Spanish names but do not convert amounts.',
    'Keep brand names. Empty strings stay empty. No markdown, no commentary.',
  ].join(' ');
  const out = await askAi({ system, user: JSON.stringify(payload), token, locale: lang });
  const arr = Array.isArray(out) ? out : (Array.isArray(out?.recipes) ? out.recipes : null);
  if (!arr || arr.length !== payload.length) throw new Error('translate: wrong number of recipes');
  return batch.map((r, i) => {
    const t = arr[i] || {};
    return {
      ...r,
      title: String(t.title || r.title || ''),
      description: t.description != null ? String(t.description) : r.description,
      category: t.cuisine != null && t.cuisine !== '' ? String(t.cuisine) : r.category,
      meal: t.mealType != null && t.mealType !== '' ? String(t.mealType) : r.meal,
      difficulty: t.difficulty != null && t.difficulty !== '' ? String(t.difficulty) : r.difficulty,
      ingredients: lines(t.ingredients).length ? lines(t.ingredients) : r.ingredients,
      methodSteps: lines(t.instructions).length ? lines(t.instructions) : r.methodSteps,
      note: t.notes != null ? String(t.notes) : r.note,
    };
  });
}

// Short strings (cookbook title, chapter names), same order back.
export async function translateStrings(strings, lang, token) {
  const list = (strings || []).map((s) => String(s || ''));
  if (!list.length) return [];
  const system = `Translate each string into ${LANG_NAME[lang] || lang}. Return ONLY a JSON array of exactly ${list.length} strings, same order. Keep names and brands; no commentary.`;
  const out = await askAi({ system, user: JSON.stringify(list), token, locale: lang });
  if (!Array.isArray(out) || out.length !== list.length) throw new Error('translate: wrong number of strings');
  return out.map((s, i) => String(s || list[i]));
}

// recipes: normalized native recipes (title, description, category, meal, difficulty, ingredients, methodSteps, note, ...).
// Returns the same recipes, translated, in the same order. Throws if any batch fails, so a half-translated book is never sent.
export async function translateRecipes(recipes, lang, token) {
  const batches = [];
  for (let i = 0; i < recipes.length; i += BATCH) batches.push(recipes.slice(i, i + BATCH));
  const results = new Array(batches.length);
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const idx = next++;
      results[idx] = await translateBatch(batches[idx], lang, token);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, batches.length) }, worker));
  return results.flat();
}
