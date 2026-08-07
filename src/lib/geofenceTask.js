// src/lib/geofenceTask.js
//
// Defines the OS-level geofencing background task. This MUST be imported
// once, early, at the top of index.js -- before registerRootComponent runs
// -- so the task is registered in the JS module graph even when the OS
// launches the app in a background/headless context to deliver a
// geofencing event while the app was fully killed. Defining this inside a
// component or hook (as the previous polling-based implementation
// effectively did, since it only ran while a component was mounted) does
// NOT work for this -- TaskManager.defineTask must run at import time.
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { GeofencingEventType } from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const GEOFENCE_TASK_NAME = 'fern-store-geofence';

// 30 min cooldown per store -- matches the web app's own geofence cooldown.
// This can't live in a JS variable/closure the way the old polling
// implementation's lastNotifiedRef did, because this task can be invoked
// in a completely fresh JS context when the OS wakes the app in the
// background after it was killed -- there is no persistent in-memory state
// across those invocations. AsyncStorage is the only thing that survives.
const COOLDOWN_MS = 30 * 60 * 1000;
const COOLDOWN_KEY_PREFIX = 'fern_geofence_last_notified_';

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn('[geofenceTask] error:', error.message);
    return;
  }
  if (!data) return;

  const { eventType, region } = data;
  // Only notify on Enter -- there's no exit-based feature designed yet, and
  // notifying on Exit too would double the notification volume for no
  // current benefit.
  if (eventType !== GeofencingEventType.Enter) return;

  const cooldownKey = COOLDOWN_KEY_PREFIX + region.identifier;
  try {
    const lastStr = await AsyncStorage.getItem(cooldownKey);
    const last = lastStr ? parseInt(lastStr, 10) : 0;
    if (Date.now() - last < COOLDOWN_MS) return; // still in cooldown for this store
    await AsyncStorage.setItem(cooldownKey, String(Date.now()));
  } catch (e) {
    // If cooldown tracking itself fails, still send the notification --
    // an occasional duplicate is a much smaller problem than silently
    // dropping a real arrival because AsyncStorage had a hiccup.
    console.warn('[geofenceTask] cooldown check failed:', e.message);
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🛒 ${region.identifier}`,
        body: `You've arrived! Open your shopping list?`,
        data: { store: region.identifier },
      },
      trigger: null, // deliver immediately
    });
  } catch (e) {
    console.warn('[geofenceTask] notification failed:', e.message);
  }
});
