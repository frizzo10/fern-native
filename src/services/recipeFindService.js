import { normalizeAiRecipe } from '../utils/recipeNormalize';

const AI_URL = 'https://app.clickpickandcook.com/.netlify/functions/ai';

const SYSTEM = 'You are a world-class chef. The user tells you what they are looking for (a dish, an ingredient, a craving, or a named recipe). If it is not about food or cooking respond with exactly []. Otherwise respond ONLY with a raw JSON array of exactly 3 distinct recipe objects that best match, no markdown, no backticks, no explanation. If they named a specific dish or person, the first result must be that exact recipe. Each object: title, emoji (1 emoji), cuisine, mealType (Breakfast/Lunch/Dinner/Dessert/Snack/Appetizer), time (e.g. "40 min"), difficulty (Easy/Medium/Hard), description (2 sentences), ingredients (string array with QUANTITIES), instructions (string[]), notes (string or ""), photoSearch (3-5 word specific phrase), matchType ("exact" or "variation").';

function parseList(rawText) {
  const cleaned = String(rawText || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    const m = cleaned.match(/\[[\s\S]*\]/);
    if (!m) return [];
    try { const parsed = JSON.parse(m[0]); return Array.isArray(parsed) ? parsed : []; } catch (e2) { return []; }
  }
}

// "chicken parmesan" / "something cozy with sweet potatoes" -> up to 3 full recipes (normalized, not saved yet).
export async function findRecipes({ query, locale, token, userId }) {
  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
    body: JSON.stringify({
      system: SYSTEM,
      messages: [{ role: 'user', content: `Find recipes for: ${query}` }],
      feature: 'recipe_search',
      userId: userId || '',
      token,
      locale,
    }),
  });
  const json = await res.json();
  const text = json?.content?.find?.((p) => p.type === 'text')?.text ?? json?.content?.[0]?.text ?? '[]';
  return parseList(text).slice(0, 3).map((r, i) => normalizeAiRecipe(r, i));
}
