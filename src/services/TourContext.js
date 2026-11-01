import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOURS, TOUR_LIST } from '../constants/tourContent';

const TourContext = createContext(null);

const STORAGE_KEY_BY_TOUR = TOUR_LIST.reduce((acc, entry) => {
  acc[entry.key] = entry.storageKey;
  return acc;
}, {});

export function TourProvider({ children }) {
  const [activeTourKey, setActiveTourKey] = useState(null);
  // Lifted here (rather than kept local to TourModal) so any screen can read
  // "which step of which tour is active right now" via useTour() and react
  // to it — e.g. scrolling to the section a given step is narrating.
  const [stepIndex, setStepIndex] = useState(0);
  // true when the person picked the tour from the Account / Plans list (not when the feature opened it itself):
  // only then does finishing the tour take them into the feature.
  const [startedManually, setStartedManually] = useState(false);

  const startTour = useCallback((key, startStep = 0) => {
    if (TOURS[key]) {
      setStepIndex(startStep > 0 && startStep < TOURS[key].steps.length ? startStep : 0);
      setStartedManually(true);
      setActiveTourKey(key);
    }
  }, []);

  // While the first-run setup screen (location / notifications) is up, an automatic tour waits and starts after it,
  // so two overlays never open at once (iOS drops one of them). App.js holds it during that screen.
  const holdRef = useRef(true);
  const pendingRef = useRef(null);
  const maybeAutoStart = useCallback(async (key) => {
    const storageKey = STORAGE_KEY_BY_TOUR[key];
    if (!storageKey || !TOURS[key]) return;
    const seen = await AsyncStorage.getItem(storageKey);
    if (!seen && holdRef.current) { pendingRef.current = key; return; }
    if (!seen) {
      setStepIndex(0);
      setStartedManually(false);
      setActiveTourKey(key);
    }
  }, []);

  const setAutoStartHold = useCallback((on) => {
    holdRef.current = !!on;
    if (!on && pendingRef.current) {
      const key = pendingRef.current;
      pendingRef.current = null;
      setStepIndex(0);
      setStartedManually(false);
      setActiveTourKey(key);
    }
  }, []);

  const closeTour = useCallback(() => {
    setActiveTourKey(null);
    setStepIndex(0);
  }, []);

  const value = useMemo(() => ({
    tour: activeTourKey ? TOURS[activeTourKey] : null,
    tourKey: activeTourKey,
    startedManually,
    stepIndex,
    setStepIndex,
    storageKey: activeTourKey ? STORAGE_KEY_BY_TOUR[activeTourKey] : null,
    startTour,
    maybeAutoStart,
    setAutoStartHold,
    closeTour,
  }), [activeTourKey, startedManually, stepIndex, startTour, maybeAutoStart, setAutoStartHold, closeTour]);

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
