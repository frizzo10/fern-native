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
  });
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  const pull = useCallback(async () => {
    if (!user?.id || !user?.token) return;
    setLoading(true);
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
        recipes:    dd.saved      || [],
        mealPlan:   dd.meal_plan  || {},
        shopping:   dd.shopping   || [],
        books:      dd.books      || [],
        activities: dd.activities || [],
      };

      setData(next);
      setLastSync(new Date());

      // Cache locally
      await AsyncStorage.setItem('fern_sync_cache', JSON.stringify(next));
    } catch (e) {
      // Fall back to cache
      try {
        const cached = await AsyncStorage.getItem('fern_sync_cache');
        if (cached) setData(JSON.parse(cached));
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [user]);

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

  // Pull on mount + when user changes
  useEffect(() => { pull(); }, [pull]);

  return { data, loading, lastSync, pull, push };
}
