import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SYNC_URL = 'https://app.clickpickandcook.com/.netlify/functions/sync';
const API_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'FernApp/1.0 (myaifern.com)',
};

function fixCorruptedEmojis(recipes) {
  if (!Array.isArray(recipes)) return { fixed: recipes, hadCorruption: false };

  let hadCorruption = false;
  const fixed = recipes.map((recipe) => {
    if (recipe?.emoji?.includes?.('�')) {
      console.log('[sync] Fixed corrupted emoji in recipe:', recipe.title);
      hadCorruption = true;
      return { ...recipe, emoji: '🍽️' };
    }
    return recipe;
  });

  return { fixed, hadCorruption };
}

export function useSync(user) {
  const [data, setData] = useState({
    recipes: [],
    mealPlan: {},
    shopping: [],
    books: [],
    activities: [],
    followers: [],
    userProfile: {},
    userStores: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  const pull = useCallback(async () => {
    if (!user?.id || !user?.token) return;
    if (loading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const res = await fetch(SYNC_URL, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ action: 'pull', userId: user.id, token: user.token }),
      });
      const result = await res.json();
      const dd = result.data;
      if (!dd) return;

      const { fixed: fixedSaved, hadCorruption } = fixCorruptedEmojis(dd.saved || []);

      const next = {
        recipes: fixedSaved,
        mealPlan: dd.meal_plan || {},
        shopping: dd.shopping || [],
        books: dd.books || [],
        activities: dd.activities || [],
        followers: dd.followed_bloggers || [],
        userProfile: dd.remi_explicit || {},
        userStores: dd.user_stores || [],
      };

      setData(next);
      setLastSync(new Date());

      // Cache locally
      await AsyncStorage.setItem('fern_sync_cache', JSON.stringify(next));
      await AsyncStorage.setItem('rv4_saved', JSON.stringify(fixedSaved));
      await AsyncStorage.setItem('rv4_books', JSON.stringify(dd.books || []));
      await AsyncStorage.setItem('rv4_meal_plan', JSON.stringify(dd.meal_plan || {}));
      await AsyncStorage.setItem('rv4_master_shop', JSON.stringify(dd.shopping || []));
      await AsyncStorage.setItem('remi_explicit', JSON.stringify(dd.remi_explicit || {}));
      await AsyncStorage.setItem('cpc_followed_bloggers', JSON.stringify(dd.followed_bloggers || []));
      await AsyncStorage.setItem('cpc_user_stores', JSON.stringify(dd.user_stores || []));

      if (hadCorruption) {
        console.log('[sync] Pushing fixed emoji back to backend');
        await fetch(SYNC_URL, {
          method: 'POST',
          headers: API_HEADERS,
          body: JSON.stringify({
            action: 'push',
            userId: user.id,
            token: user.token,
            data: {
              saved: fixedSaved,
              books: dd.books || [],
              meal_plan: dd.meal_plan || {},
              shopping: dd.shopping || [],
              remi_explicit: dd.remi_explicit || {},
              followed_bloggers: dd.followed_bloggers || [],
              user_stores: dd.user_stores || [],
            },
          }),
        });
      }
    } catch (e) {
      console.warn('Sync pull failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, loading]);

  const loadCache = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem('fern_sync_cache');
      if (cached) {
        setData(JSON.parse(cached));
        setLoading(false);
      }
    } catch (e) {
      console.warn('Load cache failed:', e);
    }
  }, []);

  const push = useCallback(async (payload) => {
    if (!user?.id || !user?.token) return;
    try {
      await fetch(SYNC_URL, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ action: 'push', userId: user.id, token: user.token, ...payload }),
      });
    } catch (e) {
      console.warn('Sync push failed:', e);
    }
  }, [user]);

  const pushChangedFromStorage = useCallback(async (changedData = {}) => {
    if (!user?.id || !user?.token) return null;
    try {
      const saved = JSON.parse(await AsyncStorage.getItem('rv4_saved') || '[]');
      const books = JSON.parse(await AsyncStorage.getItem('rv4_books') || '[]');
      const mealPlan = JSON.parse(await AsyncStorage.getItem('rv4_meal_plan') || '{}');
      const shopping = JSON.parse(await AsyncStorage.getItem('rv4_master_shop') || '[]');
      const remiExplicit = JSON.parse(await AsyncStorage.getItem('remi_explicit') || '{}');
      const followedBloggers = JSON.parse(await AsyncStorage.getItem('cpc_followed_bloggers') || '[]');
      const userStores = JSON.parse(await AsyncStorage.getItem('cpc_user_stores') || '[]');

      const dataToPush = {
        saved,
        books,
        meal_plan: mealPlan,
        shopping,
        remi_explicit: remiExplicit,
        followed_bloggers: followedBloggers,
        user_stores: userStores,
        ...changedData,
      };

      const requestBody = {
        action: 'push',
        userId: user.id,
        token: user.token,
        data: dataToPush,
      };

      console.log('[sync] push request body', requestBody);

      const res = await fetch(SYNC_URL, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(requestBody),
      });

      const responseJson = await res.json().catch(() => null);
      console.log('[sync] push response status', res.status);
      console.log('[sync] push response json', responseJson);

      setLastSync(new Date());
      return responseJson;
    } catch (e) {
      console.warn('Sync changed push failed:', e);
      return null;
    }
  }, [user]);

  const pushAllFromStorage = useCallback(async () => {
    await pushChangedFromStorage();
  }, [pushChangedFromStorage]);

  // Load cache first, then refresh from API silently
  useEffect(() => {
    loadCache().then(() => {
      pull();
    });
  }, [loadCache, pull]);

  return { data, loading, refreshing, lastSync, pull, push, pushAllFromStorage, pushChangedFromStorage };
}
