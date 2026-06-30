export function pickFirst(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

export function getDifficultyLevel(difficulty) {
  const value = String(difficulty || '').trim().toLowerCase();
  if (value.includes('hard')) return 3;
  if (value.includes('medium') || value.includes('med')) return 2;
  return 1;
}

export function toList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          return pickFirst(item.name, item.title, item.text, item.ingredient, item.step, item.value, '').trim();
        }
        return '';
      })
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/\n|,|;/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
}

export function toSteps(value) {
  if (Array.isArray(value)) return toList(value);
  if (typeof value !== 'string') return [];
  const lines = value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  return value
    .split(/\.(?:\s+|$)/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function firstNonEmptyArray(...arrays) {
  for (const arr of arrays) {
    if (Array.isArray(arr) && arr.length) return arr;
  }
  return [];
}

export function normalizeIdArray(value) {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => normalizeIdArray(item))
      .filter(Boolean);
  }

  if (value && typeof value === 'object') {
    return normalizeIdArray(
      pickFirst(
        value.id,
        value.uuid,
        value.recipe_id,
        value.recipeId,
        value._bookId,
      )
    );
  }

  if (value === undefined || value === null || value === '') return [];
  return [String(value)];
}

export function getRawRecipeId(item, index) {
  return String(pickFirst(item?.id, item?.uuid, item?.recipe_id, `${index}`));
}

export function normalizeRecipe(item, index) {
  const title = pickFirst(item?.title, item?.name, item?.recipe_name, item?.recipeTitle, 'Untitled recipe');
  const emoji = pickFirst(item?.emoji, item?.icon, item?.symbol, '🍽');
  const category = pickFirst(item?.cuisine, item?.category, item?.type, item?.mealType, 'Dinner');
  const meal = pickFirst(item?.slot, item?.meal, item?.course, 'Dinner');
  const time = pickFirst(item?.time, item?.minutes ? `${item.minutes} min` : null, item?.duration, '');
  const difficulty = pickFirst(item?.difficulty, item?.skillLevel, item?.level, 'Easy');
  const image = pickFirst(
    Array.isArray(item?._cloudPhotos) ? item._cloudPhotos[0] : null,
    item?._cloudPhotos?.[0],
    item?._photoUrl,
    item?.image,
    item?.imageUrl,
    item?.photo,
    item?.thumbnail,
    item?.coverImage,
    item?.picture,
  );
  const id = pickFirst(item?.id, item?.uuid, item?.recipe_id, `${index}`);
  const description = pickFirst(item?.description, item?.summary, item?.blurb, item?.about, 'No description yet.');
  const servings = pickFirst(item?.servings, item?.serves, item?.yield, '4');
  const ingredients = firstNonEmptyArray(
    toList(item?.ingredients),
    toList(item?._ingredients),
    toList(item?.ingredientLines),
    toList(item?.shopping),
  );
  const methodSteps = firstNonEmptyArray(
    toSteps(item?.method),
    toSteps(item?.steps),
    toSteps(item?.instructions),
    toSteps(item?.directions),
  );
  const note = pickFirst(item?.note, item?.myNote, item?.notes, '');
  const bookIds = Array.from(new Set([
    ...normalizeIdArray(item?._bookId),
    ...normalizeIdArray(item?._bookIds),
  ]));

  return {
    id,
    title,
    category,
    meal,
    time,
    difficulty,
    emoji,
    image,
    description,
    servings,
    ingredients: ingredients.length ? ingredients : ['No ingredients listed yet'],
    methodSteps: methodSteps.length ? methodSteps : ['No method steps listed yet'],
    note,
    bookIds,
  };
}

// AI search results (from the recipe_search /ai endpoint) don't have a stable id,
// image, or servings yet — those only exist once the recipe is saved to the library.
export function normalizeAiRecipe(item, index) {
  const title = pickFirst(item?.title, 'Untitled recipe');
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  const ingredients = toList(item?.ingredients);
  const methodSteps = toSteps(item?.instructions);

  return {
    id: `ai-${slug || 'recipe'}-${index}`,
    title,
    category: pickFirst(item?.cuisine, 'Dinner'),
    meal: pickFirst(item?.mealType, 'Dinner'),
    time: pickFirst(item?.time, ''),
    difficulty: pickFirst(item?.difficulty, 'Easy'),
    emoji: pickFirst(item?.emoji, '🍽'),
    image: null,
    description: pickFirst(item?.description, ''),
    servings: '4',
    ingredients: ingredients.length ? ingredients : ['No ingredients listed yet'],
    methodSteps: methodSteps.length ? methodSteps : ['No method steps listed yet'],
    note: '',
    bookIds: [],
    matchType: pickFirst(item?.matchType, 'variation'),
    photoSearch: pickFirst(item?.photoSearch, ''),
  };
}
