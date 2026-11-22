// Saves a scaled recipe (new amounts + servings) either as a new copy or over the saved recipe.
// Works from any screen's recipe viewer: reads and writes rv4_saved directly, then pushes `saved`.
import AsyncStorage from '@react-native-async-storage/async-storage';

const lc = (s) => String(s || '').trim().toLowerCase();

async function readSaved() {
  try {
    const v = JSON.parse((await AsyncStorage.getItem('rv4_saved')) || '[]');
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

async function writeSaved(next, pushChangedFromStorage) {
  await AsyncStorage.setItem('rv4_saved', JSON.stringify(next));
  try {
    const cache = JSON.parse((await AsyncStorage.getItem('fern_sync_cache')) || '{}');
    await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({ ...cache, recipes: next }));
  } catch (e) { /* best effort */ }
  await pushChangedFromStorage({ saved: next });
}

function findIndex(saved, recipe) {
  if (recipe?.id != null) {
    const i = saved.findIndex((r) => r?.id != null && String(r.id) === String(recipe.id));
    if (i >= 0) return i;
  }
  return saved.findIndex((r) => lc(r?.title) === lc(recipe?.title));
}

export async function findSavedScaledTarget(recipe) {
  const saved = await readSaved();
  return findIndex(saved, recipe) >= 0;
}

// A new recipe "<title> (serves N)" next to the original; the original is untouched.
export async function saveScaledCopy({ recipe, servings, ingredients, title, pushChangedFromStorage }) {
  const saved = await readSaved();
  const idx = findIndex(saved, recipe);
  const base = idx >= 0 ? saved[idx] : {
    emoji: recipe?.emoji || '🍽️',
    cuisine: recipe?.category || '',
    mealType: recipe?.meal || 'Dinner',
    time: recipe?.time || '',
    difficulty: recipe?.difficulty || '',
    description: recipe?.description || '',
    instructions: Array.isArray(recipe?.methodSteps) ? recipe.methodSteps : [],
    note: '',
    _cloudPhotos: Array.isArray(recipe?.photos) ? recipe.photos : (recipe?.image ? [recipe.image] : []),
  };
  let newTitle = title;
  let n = 2;
  while (saved.some((r) => lc(r?.title) === lc(newTitle))) { newTitle = `${title} ${n}`; n += 1; }
  const { _addedBy, ...rest } = base; // the person saving the copy is the one who added it
  const copy = {
    ...rest,
    id: `scaled-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: newTitle,
    servings: String(servings),
    ingredients: ingredients.map((x) => String(x)),
  };
  await writeSaved([...saved, copy], pushChangedFromStorage);
  return newTitle;
}

// Overwrite the saved recipe's amounts and servings.
export async function replaceWithScaled({ recipe, servings, ingredients, pushChangedFromStorage }) {
  const saved = await readSaved();
  const idx = findIndex(saved, recipe);
  if (idx < 0) throw new Error('not saved');
  const next = saved.map((r, i) => (i === idx ? { ...r, servings: String(servings), ingredients: ingredients.map((x) => String(x)) } : r));
  await writeSaved(next, pushChangedFromStorage);
}
