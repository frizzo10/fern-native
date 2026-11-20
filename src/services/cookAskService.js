const AI_URL = 'https://app.clickpickandcook.com/.netlify/functions/ai';

// One short answer to a question asked while cooking (plain text, no JSON).
export async function askWhileCooking({ recipe, stepIndex, question, locale }) {
  const steps = Array.isArray(recipe?.methodSteps) ? recipe.methodSteps : [];
  const system =
    'You are Fern, a friendly cooking helper. The person is cooking right now with their hands busy. ' +
    'Answer in ONE to THREE short sentences, plain text, no markdown. Be practical (substitutions, timing, doneness, fixes). ' +
    'Reply in the language of the locale given.';
  const content =
    `Recipe: ${recipe?.title || ''}\n` +
    `Ingredients: ${(recipe?.ingredients || []).slice(0, 40).join('; ')}\n` +
    `Current step (${stepIndex + 1} of ${steps.length}): ${steps[stepIndex] || ''}\n\n` +
    `Question: ${question}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
      body: JSON.stringify({ system, messages: [{ role: 'user', content }], locale: locale || 'en', feature: 'fern_chat' }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error('ai ' + res.status);
    const json = await res.json();
    const text = (json?.content || []).filter((p) => p?.type === 'text').map((p) => p.text).join(' ') || json?.message || json?.reply || '';
    const out = String(text).trim();
    if (!out) throw new Error('empty');
    return out;
  } finally {
    clearTimeout(timer);
  }
}
