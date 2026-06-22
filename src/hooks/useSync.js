import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SYNC_URL = 'https://app.clickpickandcook.com/.netlify/functions/sync';

export function useSync(user) {
  const [data, setData] = useState({
    recipes:    [],
    mealPlan:   {},
    shopping:   [],
    books:      [],
    activities: [],
    followers:  [],
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pull', userId: user.id, token: user.token }),
      });
      const result = await res.json();
      const dd = result.data;
      if (!dd) return;

      const next = {
        recipes:     dd.saved               || [],
        mealPlan:    dd.meal_plan           || {},
        shopping:    dd.shopping            || [],
        books:       dd.books               || [],
        activities:  dd.activities          || [],
        followers:   dd.followed_bloggers   || [],
        userProfile: dd.remi_explicit       || {},
        userStores:  dd.user_stores         || [],
      };

      setData(next);
      setLastSync(new Date());

      // Cache locally
      await AsyncStorage.setItem('fern_sync_cache', JSON.stringify(next));
      await AsyncStorage.setItem('rv4_saved', JSON.stringify(dd.saved || []));
      await AsyncStorage.setItem('rv4_books', JSON.stringify(dd.books || []));
      await AsyncStorage.setItem('rv4_meal_plan', JSON.stringify(dd.meal_plan || {}));
      await AsyncStorage.setItem('rv4_master_shop', JSON.stringify(dd.shopping || []));
      await AsyncStorage.setItem('remi_explicit', JSON.stringify(dd.remi_explicit || {}));
      await AsyncStorage.setItem('cpc_followed_bloggers', JSON.stringify(dd.followed_bloggers || []));
      await AsyncStorage.setItem('cpc_user_stores', JSON.stringify(dd.user_stores || []));
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'push', userId: user.id, token: user.token, ...payload }),
      });
    } catch (e) {
      console.warn('Sync push failed:', e);
    }
  }, [user]);

  // Load cache first, then refresh from API silently
  useEffect(() => {
    loadCache().then(() => {
      pull();
    });
  }, [loadCache, pull]);

  return { data, loading, refreshing, lastSync, pull, push };
}
