import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOURS, TOUR_LIST } from '../constants/tourContent';

const TourContext = createContext(null);

const STORAGE_KEY_BY_TOUR = TOUR_LIST.reduce((acc, entry) => {
  acc[entry.key] = entry.storageKey;
  return acc;
}, {});

export function TourProvider({ children }) {
  const [activeTourKey, setActiveTourKey] = useState(null);

  const startTour = useCallback((key) => {
    if (TOURS[key]) setActiveTourKey(key);
  }, []);

  const maybeAutoStart = useCallback(async (key) => {
    const storageKey = STORAGE_KEY_BY_TOUR[key];
    if (!storageKey || !TOURS[key]) return;
    const seen = await AsyncStorage.getItem(storageKey);
    if (!seen) setActiveTourKey(key);
  }, []);

  const closeTour = useCallback(() => setActiveTourKey(null), []);

  const value = useMemo(() => ({
    tour: activeTourKey ? TOURS[activeTourKey] : null,
    storageKey: activeTourKey ? STORAGE_KEY_BY_TOUR[activeTourKey] : null,
    startTour,
    maybeAutoStart,
    closeTour,
  }), [activeTourKey, startTour, maybeAutoStart, closeTour]);

  return (
    <TourContext.Provider value={value}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within a TourProvider');
  return ctx;
}

export default TourContext;
