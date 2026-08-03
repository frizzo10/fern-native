import { logApiResponse } from '../utils/apiLogger';

export function normalizeWinePairing(item, index) {
  const name = item?.name || item?.title || item?.wine || item?.beverage || `Pairing ${index + 1}`;
  const region = item?.region || item?.origin || item?.location || '';
  const rawCategory = item?.category || item?.type || item?.kind || 'Wine';
  const type = item?.type || item?.category || item?.kind || 'Wine';
  const category = String(rawCategory || '').trim();
  const price = item?.price || item?.budget || item?.priceRange || '';
  const description = item?.description || item?.why || item?.notes || item?.reason || '';
  const badge = item?.badge || item?.tag || item?.highlight || '';
  return { name, region, type, category, price, description, badge };
}

export async function fetchWinePairings({ userId, dish, locale, token }) {
  const normalizedDish = String(dish || '').trim();
  const titledDish = normalizedDish.charAt(0).toUpperCase() + normalizedDish.slice(1);

  const payload = {
    action: 'wine_pairing',
    userId,
    token,
    locale: locale || 'en',
    recipe: {
      title: titledDish,
      cuisine: '',
      description: `A dish the user described: ${titledDish}`,
      ingredients: [],
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
  logApiResponse('recipe-tools (wine_pairing)', responseJson);

  const summary = responseJson?.summary || responseJson?.guidance || responseJson?.message || responseJson?.reply || '';
  const rawPairings = responseJson?.pairings || responseJson?.recommendations || responseJson?.results || responseJson?.wines || [];
  const pairings = Array.isArray(rawPairings)
    ? rawPairings.map((item, index) => normalizeWinePairing(item, index))
    : [];

  return { payload, responseJson, summary, pairings };
}
