import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import {
  GEOFENCE_RADIUS_M,
  claimArrival,
  getDistanceMeters,
  notifyArrival,
  registerStoreGeofences,
  storeKey,
} from '../services/storeGeofencing';

// useGeofence — store-arrival detection.
//   * With "Always" location permission, the user's stores are registered as OS
//     geofences (src/services/storeGeofencing.js) so Fern is woken up in the
//     background when they arrive, even if the app is closed.
//   * Either way, while the app is running it also checks the GPS every 2 minutes.
//     That covers users who only granted "While Using", and the case where the user
//     is already inside the store when the app opens (an OS geofence only fires when
//     the boundary is crossed).
// Both paths share one 30-minute per-store cooldown, so an arrival never notifies twice.
// stores = [{ name, lat, lon }]
export function useGeofence({ stores = [], onArrival }) {
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const intervalRef = useRef(null);
  const backgroundGrantedRef = useRef(false);
  // Always-current copies, so the 2-minute timer never uses a stale (e.g. empty)
  // store list captured when monitoring first started.
  const storesRef = useRef(stores);
  const onArrivalRef = useRef(onArrival);
  storesRef.current = stores;
  onArrivalRef.current = onArrival;

  // Request permissions
  const requestPermissions = useCallback(async () => {
    // Location
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      setPermissionStatus('denied');
      return false;
    }

    // Background ("Always") location, needed for OS geofences while the app is closed
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    backgroundGrantedRef.current = bgStatus === 'granted';

    // Notifications (for store arrival alert)
    await Notifications.requestPermissionsAsync();

    setPermissionStatus(bgStatus === 'granted' ? 'always' : 'whenInUse');
    return true;
  }, []);

  // Check if user is near any store
  const checkGeofence = useCallback(async () => {
    const stores = storesRef.current || [];
    if (!stores.length) return;
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        maximumAge: 60000,
      });
      const { latitude: userLat, longitude: userLon } = pos.coords;

      for (const store of stores) {
        if (!store.lat || !store.lon) continue;
        const dist = getDistanceMeters(userLat, userLon, store.lat, store.lon);
        if (dist > GEOFENCE_RADIUS_M) continue;
        if (!(await claimArrival(storeKey(store)))) continue;
        onArrivalRef.current?.(store, Math.round(dist));
        await notifyArrival(store.name);
      }
    } catch (e) {
      console.warn('[geofence] GPS error:', e.message);
    }
  }, []);

  // Start monitoring
  const start = useCallback(async () => {
    const granted = await requestPermissions();
    if (!granted) return;

    if (backgroundGrantedRef.current) await registerStoreGeofences(storesRef.current);

    checkGeofence(); // immediate check
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(checkGeofence, 2 * 60 * 1000); // every 2 min
    setIsMonitoring(true);
  }, [requestPermissions, checkGeofence]);

  // Stop the foreground poll. (The OS geofences are removed on sign-out via
  // stopStoreGeofencing(), not here, so closing a screen never switches them off.)
  const stop = useCallback(() => {
    clearInterval(intervalRef.current);
    setIsMonitoring(false);
  }, []);

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  // Stores usually finish syncing after monitoring has started, and the user can add
  // or remove stores later — re-register the OS geofences and check right away
  // instead of waiting for the next 2-minute tick.
  const storesKey = (stores || []).map((s) => `${s.name}:${s.lat}:${s.lon}`).join('|');
  useEffect(() => {
    if (!isMonitoring) return;
    if (backgroundGrantedRef.current) registerStoreGeofences(storesRef.current);
    if (storesKey) checkGeofence();
  }, [storesKey, isMonitoring, checkGeofence]);

  return { permissionStatus, isMonitoring, start, stop, checkGeofence };
}
