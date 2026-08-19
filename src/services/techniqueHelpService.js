import { logApiResponse } from '../utils/apiLogger';

const AI_URL = 'https://app.clickpickandcook.com/.netlify/functions/ai';

const TECHNIQUE_HELP_SYSTEM_PROMPT = 'You are a cooking instructor. Given a recipe step, identify the single most important cooking technique or skill a home cook might need help with. Return ONLY a JSON object with: { "technique": "short name e.g. sear salmon", "query": "YouTube search query 4-6 words e.g. how to properly sear salmon", "tip": "one sentence tip for this technique" }. No markdown, no backticks.';

function parseResponseTextAsJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function fetchTechniqueHelp({ recipeTitle, step, locale }) {
  const payload = {
    system: TECHNIQUE_HELP_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Recipe: ${recipeTitle}\nStep: ${step}` }],
    locale: locale || 'en',
  };

  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'FernApp/1.0 (myaifern.com)',
    },
    body: JSON.stringify(payload),
  });

  const responseJson = await res.json();
  logApiResponse('technique help (ai)', responseJson);

  const responseText =
    responseJson?.content?.find((part) => part?.type === 'text')?.text ||
    responseJson?.message ||
    responseJson?.reply ||
    '';

  const parsed = parseResponseTextAsJson(responseText);
  const technique = String(parsed?.technique || '').trim();
  const query = String(parsed?.query || '').trim();
  const tip = String(parsed?.tip || '').trim();

  if (!technique && !query && !tip) {
    throw new Error('Technique help API returned no usable data');
  }

  return { technique, query, tip };
}
