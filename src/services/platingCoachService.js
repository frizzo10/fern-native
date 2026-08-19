import { logApiResponse } from '../utils/apiLogger';

export async function fetchPlatingCoach({ userId, recipe, locale, token }) {
  const payload = {
    action: 'plating',
    userId,
    token,
    locale: locale || 'en',
    recipe: {
      title: recipe?.title || '',
      cuisine: recipe?.category || recipe?.cuisine || '',
      description: recipe?.description || '',
      ingredients: Array.isArray(recipe?.ingredients) ? recipe.ingredients : [],
    },
  };

  const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/recipe-tools', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'FernApp/1.0 (myaifern.com)',
    },
    body: JSON.stringify(payload),
  });

  const responseJson = await res.json();
  logApiResponse('recipe-tools (plating)', responseJson);

  const vibe = responseJson?.vibe || responseJson?.style || '';
  const plateChoice = responseJson?.plateChoice || responseJson?.plate || '';
  const composition = Array.isArray(responseJson?.composition) ? responseJson.composition : [];
  const garnishes = Array.isArray(responseJson?.garnishes) ? responseJson.garnishes : [];
  const sauceApplication = responseJson?.sauceApplication || responseJson?.sauce || '';

  return { payload, responseJson, vibe, plateChoice, composition, garnishes, sauceApplication };
}
