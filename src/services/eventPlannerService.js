import { fetchRecipeImage } from '../utils/recipeImage';

const EVENT_PLANNER_URL = 'https://app.clickpickandcook.com/.netlify/functions/event-planner';
const API_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'FernApp/1.0 (myaifern.com)',
};

export async function generateEventPlan(userId, locale, intake) {
  try {
    console.log('[eventPlanner] Calling API with intake:', intake);
    const response = await fetch(EVENT_PLANNER_URL, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({
        action: 'generate',
        userId,
        locale,
        eventType: 'dinner_party',
        intake,
      }),
    });

    console.log('[eventPlanner] API response status:', response.status);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('[eventPlanner] API response:', JSON.stringify(result, null, 2));

    const normalized = normalizePlanResult(result.plan);
    console.log('[eventPlanner] Normalized result:', JSON.stringify(normalized, null, 2));

    // Fetch images for all recipes
    await fetchImagesForPlan(normalized);

    return normalized;
  } catch (e) {
    console.warn('[eventPlanner] generateEventPlan failed:', e);
    throw e;
  }
}

export async function fetchImagesForPlan(planResult) {
  if (!planResult?.menu) return;

  const allRecipes = [
    ...(planResult.menu.appetizers || []),
    ...(planResult.menu.mains || []),
    ...(planResult.menu.sides || []),
    ...(planResult.menu.desserts || []),
  ];

  console.log('[eventPlanner] Fetching images for', allRecipes.length, 'recipes');

  for (const recipe of allRecipes) {
    try {
      const imageUrl = await fetchRecipeImage(recipe.title);
      if (imageUrl) {
        recipe.image = imageUrl;
        recipe._cloudPhotos = [imageUrl];
        console.log('[eventPlanner] Image fetched for', recipe.title, ':', imageUrl);
      }
    } catch (e) {
      console.warn('[eventPlanner] Failed to fetch image for', recipe.title, e);
    }
  }
}

export function normalizeRecipe(apiRecipe, index = 0) {
  if (!apiRecipe) return null;

  return {
    id: `event-recipe-${index}-${String(apiRecipe.title || 'recipe').toLowerCase().replace(/\s+/g, '-')}`,
    title: apiRecipe.title || 'Untitled Recipe',
    emoji: apiRecipe.emoji || '🍽️',
    category: apiRecipe.category || 'Dinner',
    meal: apiRecipe.meal || 'Main Course',
    time: apiRecipe.time || '',
    difficulty: apiRecipe.difficulty || 'Easy',
    image: apiRecipe.image || null,
    description: apiRecipe.description || '',
    servings: apiRecipe.servings || '4',
    ingredients: Array.isArray(apiRecipe.ingredients) ? apiRecipe.ingredients : [],
    methodSteps: Array.isArray(apiRecipe.instructions) ? apiRecipe.instructions : [],
    note: '',
    bookIds: [],
  };
}

export function normalizePlanResult(plan) {
  if (!plan) {
    console.warn('[eventPlanner] Plan is null or undefined');
    return null;
  }

  console.log('[eventPlanner] Normalizing plan with title:', plan.title);
  console.log('[eventPlanner] Full plan object keys:', Object.keys(plan));

  const menu = plan.menu || {};
  console.log('[eventPlanner] Menu object keys:', Object.keys(menu));
  console.log('[eventPlanner] Menu structure:', {
    appetizers: menu.appetizers?.length || 0,
    mains: menu.mains?.length || 0,
    sides: menu.sides?.length || 0,
    desserts: menu.desserts?.length || 0,
  });

  // Log sample recipes from each section
  if (menu.appetizers?.length > 0) {
    console.log('[eventPlanner] Sample appetizer:', {
      title: menu.appetizers[0].title,
      description: menu.appetizers[0].description,
      time: menu.appetizers[0].time,
    });
  }

  const recipesBySection = {
    appetizers: (menu.appetizers || []).map((r, i) => normalizeRecipe(r, `app-${i}`)),
    mains: (menu.mains || []).map((r, i) => normalizeRecipe(r, `main-${i}`)),
    sides: (menu.sides || []).map((r, i) => normalizeRecipe(r, `side-${i}`)),
    desserts: (menu.desserts || []).map((r, i) => normalizeRecipe(r, `des-${i}`)),
  };

  const normalized = {
    title: plan.title || 'Event Plan',
    overview: plan.overview || '',
    timeline: plan.timeline || [],
    menu: recipesBySection,
    drinks: plan.drinks || [],
    shoppingList: plan.shoppingList || [],
    tableSettings: plan.tableSettings || '',
    hostTips: plan.hostTips || [],
    estimatedCost: plan.estimatedCost || '',
  };

  console.log('[eventPlanner] Normalized result structure:', {
    title: normalized.title,
    overview_length: normalized.overview?.length || 0,
    appetizers: normalized.menu.appetizers.length,
    mains: normalized.menu.mains.length,
    sides: normalized.menu.sides.length,
    desserts: normalized.menu.desserts.length,
    drinks: normalized.drinks.length,
    hostTips: normalized.hostTips.length,
  });

  return normalized;
}

