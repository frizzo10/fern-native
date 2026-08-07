import { useState, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { GEOFENCE_TASK_NAME } from '../lib/geofenceTask';

// useGeofence — monitors stores using real OS-level geofencing (region
// monitoring), not a JS polling loop. This means arrival can be detected
// even if the app has been fully killed by the OS, subject to each
// platform's own background-execution rules (Android is generally more
// reliable here than iOS, and both depend on the user having granted
// "Always" location access rather than only "While Using").
//
// stores = [{ name, lat, lon }]
//
// The actual store-arrival handling (cooldown + notification) lives in
// geofenceTask.js, registered at the module level (see index.js) --
// because a background-launched task runs in a context where this hook
// and any component state don't exist. onArrival here is a best-effort
// in-app callback for when the app happens to already be open/foregrounded
// when a region event fires; it is NOT the mechanism that guarantees the
// notification itself, which geofenceTask.js handles independently.
export function useGeofence({ stores = [], onArrival } = {}) {
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const storesRef = useRef(stores);
  storesRef.current = stores;

  const requestPermissions = useCallback(async () => {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      setPermissionStatus('denied');
      return false;
    }

    // Real OS-level geofencing requires "Always" (background) permission
    // to keep working once the app is backgrounded or killed -- with only
    // "While Using", iOS/Android will still let monitoring start, but it
    // effectively only fires while the app is open, similar to the old
    // polling approach's real-world limitation.
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();

    await Notifications.requestPermissionsAsync();

    setPermissionStatus(bgStatus === 'granted' ? 'always' : 'whenInUse');
    return true;
  }, []);

  // Start monitoring: registers real OS region-monitoring for each store,
  // radius-matched to the web app's own geofence radius.
  const start = useCallback(async () => {
    const granted = await requestPermissions();
    if (!granted) return;

    const validStores = storesRef.current.filter(s => s.lat && s.lon);
    if (!validStores.length) {
      setIsMonitoring(false);
      return;
    }

    const regions = validStores.map(s => ({
      identifier: s.name,
      latitude: s.lat,
      longitude: s.lon,
      radius: 150, // ~500ft — same as web app
      notifyOnEnter: true,
      notifyOnExit: false,
    }));

    try {
      await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
      setIsMonitoring(true);
    } catch (e) {
      console.warn('[geofence] failed to start region monitoring:', e.message);
      setIsMonitoring(false);
      return;
    }

    // Region monitoring only fires on a boundary CROSSING going forward --
    // if the user is already standing inside a store's radius at the
    // moment monitoring starts, the OS won't retroactively fire an Enter
    // event for it. This one-time manual check covers that case so
    // "already there when you open the app" isn't silently missed.
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: userLat, longitude: userLon } = pos.coords;
      const nearby = validStores.find(s => getDistanceMeters(userLat, userLon, s.lat, s.lon) <= 150);
      if (nearby) onArrival?.(nearby, 0);
    } catch (e) {
      // Non-fatal — region monitoring is already running regardless.
      console.warn('[geofence] initial position check failed:', e.message);
    }
  }, [requestPermissions, onArrival]);

  const stop = useCallback(async () => {
    try {
      const running = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
      if (running) await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    } catch (e) {
      console.warn('[geofence] failed to stop region monitoring:', e.message);
    }
    setIsMonitoring(false);
  }, []);

  return { permissionStatus, isMonitoring, start, stop };
}

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
