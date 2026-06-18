import { Platform } from 'react-native';
import Constants from 'expo-constants';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// ── Crash Logger ──────────────────────────────────────────────────────────────
// Logs crashes to Supabase crash_logs table
// Free, no third party, you own the data

export async function logCrash({ error, stack, screen, userId } = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  try {
    const payload = {
      error:       error?.message || String(error) || 'Unknown error',
      stack:       stack || error?.stack || null,
      screen:      screen || 'unknown',
      user_id:     userId || null,
      device:      `${Platform.OS} ${Platform.Version}`,
      app_version: Constants.expoConfig?.version || '1.0.0',
      platform:    Platform.OS,
    };

    await fetch(`${SUPABASE_URL}/rest/v1/crash_logs`, {
      method:  'POST',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify(payload),
    });

    console.log('[crashLogger] Logged crash:', payload.error);
  } catch (e) {
    // Never let the logger itself crash the app
    console.warn('[crashLogger] Failed to log:', e.message);
  }
}

// ── Global JS error handler ───────────────────────────────────────────────────
export function setupGlobalErrorHandler(userId) {
  const originalHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    // Log to Supabase
    logCrash({
      error,
      screen: 'global',
      userId,
    });

    // Call original handler (shows red screen in dev, crashes in prod)
    if (originalHandler) originalHandler(error, isFatal);
  });
}

// ── Unhandled promise rejection handler ───────────────────────────────────────
export function setupPromiseRejectionHandler(userId) {
  const tracking = require('promise/setimmediate/rejection-tracking');
  tracking.enable({
    allRejections: true,
    onUnhandled: (id, error) => {
      logCrash({
        error,
        screen: 'promise',
        userId,
      });
    },
  });
}
