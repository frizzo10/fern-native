// locationSetup.js — one place to ask for / check the permissions store-arrival alerts need:
// location (while using), "Always" location (so Fern is woken when the app is closed), and
// notifications. The OS only lets the user grant these (no app can pre-set them), so this
// is asked once, with an explanation, instead of three unexplained pop-ups at launch.
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_PROMPT_KEY = 'fern_location_setup_last'; // local date key of the last time the setup screen was shown

export async function getLocationSetupStatus() {
  const out = { foreground: false, always: false, notifications: false };
  try { out.foreground = (await Location.getForegroundPermissionsAsync()).status === 'granted'; } catch (e) { /* stays false */ }
  try { out.always = (await Location.getBackgroundPermissionsAsync()).status === 'granted'; } catch (e) { /* stays false */ }
  try { out.notifications = (await Notifications.getPermissionsAsync()).status === 'granted'; } catch (e) { /* stays false */ }
  return out;
}

// Android builds ship without background location (no "Always" step there), so only iOS needs it.
export const needsAlways = Platform.OS !== 'android';
export const isSetupComplete = (s) => s.foreground && (s.always || !needsAlways) && s.notifications;

// Runs the prompts in order. iOS only asks for "Always" after "While Using" was granted,
// and only shows it once; after that the user has to use Settings.
export async function requestLocationSetup() {
  let fg = false;
  try { fg = (await Location.requestForegroundPermissionsAsync()).status === 'granted'; } catch (e) { /* ignore */ }
  if (fg && needsAlways) { try { await Location.requestBackgroundPermissionsAsync(); } catch (e) { /* ignore */ } }
  try { await Notifications.requestPermissionsAsync(); } catch (e) { /* ignore */ }
  return getLocationSetupStatus();
}

// Show the setup screen at most once per day, and only while something is missing.
export async function shouldShowLocationSetup(todayKey) {
  const status = await getLocationSetupStatus();
  if (isSetupComplete(status)) return false;
  try {
    if ((await AsyncStorage.getItem(LAST_PROMPT_KEY)) === todayKey) return false;
  } catch (e) { /* show it */ }
  return true;
}

export async function markLocationSetupShown(todayKey) {
  try { await AsyncStorage.setItem(LAST_PROMPT_KEY, todayKey); } catch (e) { /* ignore */ }
}
