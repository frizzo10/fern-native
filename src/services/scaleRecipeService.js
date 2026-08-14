import { logApiResponse } from '../utils/apiLogger';

function normalizeScaledIngredients(responseJson, originalIngredients) {
  const raw = responseJson?.ingredients
    || responseJson?.scaledIngredients
    || responseJson?.scaled?.ingredients
    || responseJson?.result?.ingredients
    || [];

  if (!Array.isArray(raw)) return [];

  return raw.map((item, index) => {
    const was = originalIngredients[index] || '';
    if (typeof item === 'string') {
      return { was, now: item };
    }
    const now = item?.now || item?.scaled || item?.text || item?.amount || '';
    return { was: item?.was || item?.original || was, now };
  }).filter((row) => row.now);
}

export async function fetchScaledRecipe({ ingredients, current, target, locale, token }) {
  const payload = {
    ingredients: Array.isArray(ingredients) ? ingredients.join('\n') : String(ingredients || ''),
    current: String(current || ''),
    target,
    locale: locale || 'en',
    token,
  };

  const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/scale-recipe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'FernApp/1.0 (myaifern.com)',
    },
    body: JSON.stringify(payload),
  });

  const responseJson = await res.json();
  logApiResponse('scale-recipe', responseJson);

  const originalIngredients = Array.isArray(ingredients) ? ingredients : [];
  const scaledIngredients = normalizeScaledIngredients(responseJson, originalIngredients);

  return { payload, responseJson, scaledIngredients };
}
