import { logApiResponse } from '../utils/apiLogger';

const SYSTEM_PROMPT = 'You are a helpful cooking assistant. The user gives a recipe and one ingredient from it. Suggest 3 to 4 realistic substitutes for that ingredient that work well in this specific recipe. Return ONLY a JSON array of objects: [{"name": string, "amount": string, "note": string}]. "amount" is how much to use in place of the original quantity. "note" is one short sentence on how it changes taste or texture. No markdown.';

function parseArray(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  try {
    const direct = JSON.parse(raw);
    return Array.isArray(direct) ? direct : [];
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

export async function fetchIngredientSubstitutions({ recipeTitle, ingredient, locale, token }) {
  const language = locale === 'es' ? ' Respond in Spanish.' : '';
  const payload = {
    system: SYSTEM_PROMPT + language,
    messages: [{
      role: 'user',
      content: `Recipe: ${recipeTitle || 'Untitled'}\nIngredient to replace: ${ingredient}`,
    }],
    locale: locale || 'en',
    token,
  };

  const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'FernApp/1.0 (myaifern.com)',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Substitutions API failed (${res.status})`);

  const responseJson = await res.json();
  logApiResponse('ai (ingredient substitutions)', responseJson);

  const text = responseJson?.content?.find((part) => part?.type === 'text')?.text
    || responseJson?.message
    || responseJson?.reply
    || '';

  return parseArray(text)
    .map((s) => ({
      name: String(s?.name || '').trim(),
      amount: String(s?.amount || '').trim(),
      note: String(s?.note || '').trim(),
    }))
    .filter((s) => s.name);
}
