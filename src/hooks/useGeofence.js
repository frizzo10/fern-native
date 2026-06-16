import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

const GEOFENCE_RADIUS_M = 150;  // ~500ft — same as web app
const COOLDOWN_MS = 30 * 60 * 1000; // 30 min cooldown per store

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// useGeofence — monitors stores, fires onArrival when user gets close
// stores = [{ name, lat, lon }]
export function useGeofence({ stores = [], onArrival }) {
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const lastNotifiedRef = useRef({});
  const intervalRef = useRef(null);

  // Request permissions
  const requestPermissions = useCallback(async () => {
    // Location
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      setPermissionStatus('denied');
      return false;
    }

    // Try background location (for always-on geofence)
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();

    // Notifications (for store arrival alert)
    await Notifications.requestPermissionsAsync();

    setPermissionStatus(bgStatus === 'granted' ? 'always' : 'whenInUse');
    return true;
  }, []);

  // Check if user is near any store
  const checkGeofence = useCallback(async () => {
    if (!stores.length) return;
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        maximumAge: 60000,
      });
      const { latitude: userLat, longitude: userLon } = pos.coords;

      stores.forEach(store => {
        if (!store.lat || !store.lon) return;
        const dist = getDistanceMeters(userLat, userLon, store.lat, store.lon);
        const storeKey = `${store.name}_${Math.round(store.lat * 100)}`;
        const lastNotified = lastNotifiedRef.current[storeKey] || 0;

        if (dist <= GEOFENCE_RADIUS_M && Date.now() - lastNotified > COOLDOWN_MS) {
          lastNotifiedRef.current[storeKey] = Date.now();
          onArrival?.(store, Math.round(dist));

          // Send push notification
          Notifications.scheduleNotificationAsync({
            content: {
              title: `🛒 ${store.name}`,
              body: `You've arrived! Open your shopping list?`,
              data: { store: store.name },
            },
            trigger: null, // immediate
          });
        }
      });
    } catch (e) {
      console.warn('[geofence] GPS error:', e.message);
    }
  }, [stores, onArrival]);

  // Start monitoring
  const start = useCallback(async () => {
    const granted = await requestPermissions();
    if (!granted) return;

    checkGeofence(); // immediate check
    intervalRef.current = setInterval(checkGeofence, 2 * 60 * 1000); // every 2 min
    setIsMonitoring(true);
  }, [requestPermissions, checkGeofence]);

  // Stop monitoring
  const stop = useCallback(() => {
    clearInterval(intervalRef.current);
    setIsMonitoring(false);
  }, []);

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  return { permissionStatus, isMonitoring, start, stop, checkGeofence };
}
