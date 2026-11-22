import { useCallback } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

// While the screen is in front: pull now, every LIVE_PULL_MS, and whenever the
// app comes back from the background. So a change made on another phone
// (a household member's recipe or planned meal) shows within about half a minute.
// Pulls share one in-flight request in useSync, so overlapping calls cost nothing extra.
export const LIVE_PULL_MS = 30000;

export default function useLivePull(pull) {
  useFocusEffect(
    useCallback(() => {
      pull();
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') pull();
      }, LIVE_PULL_MS);
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') pull();
      });
      return () => {
        clearInterval(timer);
        sub?.remove?.();
      };
    }, [pull])
  );
}
