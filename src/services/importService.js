// Backend contracts here mirror the web app's index.html doImport() exactly,
// so results and error handling stay consistent across platforms.

const BASE = 'https://app.clickpickandcook.com/.netlify/functions';

export async function importFromUrl(url) {
  const res = await fetch(`${BASE}/fetch-recipe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Could not fetch that URL.');
  return data.recipe;
}

export async function importFromVideo(url, locale) {
  const res = await fetch(`${BASE}/import-video`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, locale: locale || 'en' }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    let msg = data.error || 'Could not read that video.';
    if (/private|login|captions|caption/i.test(msg)) {
      msg += ' Try Paste Text instead and paste the caption directly.';
    }
    throw new Error(msg);
  }
  return data.recipe;
}

export async function importFromCard({ base64, mimeType, locale }) {
  const res = await fetch(`${BASE}/scan-recipe-card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData: base64, mediaType: mimeType || 'image/jpeg', locale: locale || 'en' }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Could not read the card. Try a clearer photo.');
  return data.recipe;
}

// Text paste doesn't have its own dedicated function on the backend -- the
// web app sends it straight to the shared `ai` function with an extraction
// prompt, same pattern already used for recipe_search. Mirrored here rather
// than adding a new backend endpoint for what's already a one-off prompt.
export async function importFromText(text, locale) {
  const prompt = 'Extract and structure this recipe text into a recipe object.\n\nRecipe text:\n' + text +
    '\n\nReturn ONLY a single raw JSON object (no markdown, no backticks) with these fields: title, emoji (1 emoji), cuisine, mealType (Breakfast/Lunch/Dinner/Dessert/Snack/Appetizer), time (e.g. "40 min"), difficulty (Easy/Medium/Hard), description (2 sentences), ingredients (string[]), instructions (string[]), notes (string or "").';

  const res = await fetch(`${BASE}/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: 'You are a recipe extraction assistant. Extract and structure recipes from text. Always respond with ONLY a valid raw JSON object -- no markdown, no backticks, no explanation.',
      messages: [{ role: 'user', content: prompt }],
      feature: 'recipe_import_text',
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Could not extract recipe. Check the text and try again.');

  const raw = (data.content && data.content[0] && data.content[0].text) || '';
  const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    throw new Error('Could not extract recipe. Check the text and try again.');
  }
}
