// Fern inside the recipe viewer: answers questions about the open recipe and can do a few things with it
// (scale, add to the shopping list, plan it on a day, start Cook Mode). One `ai` call per question
// (feature fern_chat; does not count against the Ask Fern daily cap).
const AI_URL = 'https://app.clickpickandcook.com/.netlify/functions/ai';

function weekLines() {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const name = d.toLocaleDateString('en-US', { weekday: 'long' });
    const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    out.push(`day_offset ${i}: ${i === 0 ? `today (${name})` : name}, ${date}`);
  }
  return out.join('\n');
}

function parseReply(text) {
  const s = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const tryParse = (x) => { try { return JSON.parse(x); } catch (e) { return null; } };
  let obj = tryParse(s);
  if (!obj) { const m = s.match(/\{[\s\S]*\}/); if (m) obj = tryParse(m[0]); }
  if (obj && typeof obj === 'object') return obj;
  return s && !/^[{`]/.test(s) ? { answer: s } : null;
}

// history: [{ q, a }] (oldest first). Returns { answer, action } where action is null or one of
// { type: 'scale', servings } | { type: 'add_to_list' } | { type: 'plan', day_offset, slot } | { type: 'cook' }.
export async function askAboutRecipe({ recipe, servings, ingredients, question, history = [], locale }) {
  const steps = Array.isArray(recipe?.methodSteps) ? recipe.methodSteps : [];
  const system = [
    'You are Fern, a warm, practical cooking helper inside the recipe the person is looking at in the Fern app.',
    'You know this recipe completely (below). Answer questions about it: substitutions, timing, make-ahead, storage, doneness, equipment, nutrition estimates, wine or sides, what a step means, how to change it.',
    'Answer in ONE to FOUR short sentences, plain text, no markdown. Reply in the language of the locale given.',
    'You can also DO these things for this recipe, by returning an action:',
    '- scale: when they want it for a different number of people ("make it for 6", "double it", "half"). servings = the new number (double = current x 2, half = current / 2, rounded, 1-50).',
    '- add_to_list: when they want the ingredients on their shopping list.',
    '- plan: when they want it on a day in Family Hub ("put this on Friday dinner"). day_offset from the WEEK below, slot Breakfast, Lunch or Dinner (default Dinner). Only days in the WEEK can be planned; for another date say to use the calendar in Family Hub.',
    '- cook: when they want to start cooking / Cook Mode.',
    'When you return an action, the answer is one short sentence saying what you are doing. Never invent an action for a plain question.',
    'Return ONLY JSON: {"answer": "...", "action": null} or {"answer": "...", "action": {"type": "scale", "servings": 6}} (types: scale, add_to_list, plan with day_offset and slot, cook).',
    '',
    'WEEK:',
    weekLines(),
  ].join('\n');
  const recipeText =
    `RECIPE: ${recipe?.title || ''}\n` +
    (recipe?.description ? `About: ${recipe.description}\n` : '') +
    `Serves: ${servings || recipe?.servings || 'not stated'}\n` +
    (recipe?.time ? `Time: ${recipe.time}\n` : '') +
    (recipe?.category ? `Cuisine: ${recipe.category}\n` : '') +
    `Ingredients:\n${(ingredients || recipe?.ingredients || []).slice(0, 60).map((x) => `- ${x}`).join('\n')}\n` +
    `Steps:\n${steps.slice(0, 40).map((x, i) => `${i + 1}. ${x}`).join('\n')}\n` +
    (recipe?.note ? `Their note: ${recipe.note}\n` : '');
  const messages = [{ role: 'user', content: recipeText + '\n(The recipe above is what we are talking about.)' }, { role: 'assistant', content: '{"answer":"Got it.","action":null}' }];
  history.slice(-4).forEach((h) => {
    messages.push({ role: 'user', content: h.q });
    messages.push({ role: 'assistant', content: JSON.stringify({ answer: h.a, action: null }) });
  });
  messages.push({ role: 'user', content: question });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
      body: JSON.stringify({ system, messages, locale: locale || 'en', feature: 'fern_chat' }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error('ai ' + res.status);
    const json = await res.json();
    const text = (json?.content || []).filter((p) => p?.type === 'text').map((p) => p.text).join(' ') || json?.message || json?.reply || '';
    const obj = parseReply(text);
    if (!obj || !String(obj.answer || '').trim()) throw new Error('empty');
    const a = obj.action && typeof obj.action === 'object' ? obj.action : null;
    let action = null;
    if (a?.type === 'scale') {
      const n = Math.round(Number(a.servings));
      if (n >= 1 && n <= 50) action = { type: 'scale', servings: n };
    } else if (a?.type === 'add_to_list' || a?.type === 'cook') {
      action = { type: a.type };
    } else if (a?.type === 'plan') {
      const d = Math.round(Number(a.day_offset));
      const slot = ['Breakfast', 'Lunch', 'Dinner'].find((s) => s.toLowerCase() === String(a.slot || 'Dinner').toLowerCase()) || 'Dinner';
      if (d >= 0 && d <= 6) action = { type: 'plan', day_offset: d, slot };
    }
    return { answer: String(obj.answer).trim(), action };
  } finally {
    clearTimeout(timer);
  }
}
