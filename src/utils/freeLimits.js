// Free-plan caps. Counted from what is on this device, so existing users keep
// everything they already have; the cap only blocks adding more.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const FREE_RECIPE_LIMIT = 20;
export const FREE_COOKBOOK_LIMIT = 1;

async function countOf(key) {
  try {
    const list = JSON.parse((await AsyncStorage.getItem(key)) || '[]');
    return Array.isArray(list) ? list.length : 0;
  } catch (e) {
    return 0;
  }
}

export const savedRecipeCount = () => countOf('rv4_saved');
export const cookbookCount = () => countOf('rv4_books');
export async function recipeLimitReached() {
  return (await savedRecipeCount()) >= FREE_RECIPE_LIMIT;
}
