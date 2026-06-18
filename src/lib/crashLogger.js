import { Platform } from 'react-native';
import Constants from 'expo-constants';

const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbynnYiD9_j7QRB1PX-3sa3bQvuEJV45wAVYwnMyHEI9h877_p_kC1tUw4WxYunEvs3pdg/exec';

export async function logCrash({ error, stack, screen, userId } = {}) {
  try {
    const payload = {
      user_id:     userId || 'anonymous',
      error:       error?.message || String(error) || 'Unknown error',
      stack:       stack || error?.stack || '',
      screen:      screen || 'unknown',
      device:      `${Platform.OS} ${Platform.Version}`,
      app_version: Constants.expoConfig?.version || '1.0.0',
      platform:    Platform.OS,
    };

    await fetch(SHEETS_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    console.log('[crashLogger] Logged to Google Sheets:', payload.error);
  } catch (e) {
    console.warn('[crashLogger] Failed to log:', e.message);
  }
}

export function setupGlobalErrorHandler(userId) {
  const original = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    logCrash({ error, screen: 'global', userId });
    if (original) original(error, isFatal);
  });
}
