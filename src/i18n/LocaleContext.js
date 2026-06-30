// src/i18n/LocaleContext.js
//
// Minimal locale provider for the Fern native app. No new native
// dependency is required — device language is detected via the JS
// `Intl` API (available in Hermes on RN 0.76 / Expo SDK 52), with a
// safe fallback to English if it's ever unavailable. The user's choice
// is persisted in AsyncStorage under 'fern_locale' — the same key name
// the web app uses in localStorage, so the concept stays consistent
// across both clients even though the storage mechanisms differ.

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './translations';

const STORAGE_KEY = 'fern_locale';

function detectDeviceLocale() {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale || DEFAULT_LOCALE;
    const base = tag.split('-')[0].toLowerCase();
    return SUPPORTED_LOCALES.includes(base) ? base : DEFAULT_LOCALE;
  } catch (e) {
    return DEFAULT_LOCALE;
  }
}

const LocaleContext = createContext({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
  ready: false,
});

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (cancelled) return;
        if (saved && SUPPORTED_LOCALES.includes(saved)) {
          setLocaleState(saved);
        } else {
          setLocaleState(detectDeviceLocale());
        }
      })
      .catch(() => {
        if (!cancelled) setLocaleState(detectDeviceLocale());
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => { cancelled = true; };
  }, []);

  const setLocale = useCallback((code) => {
    if (!SUPPORTED_LOCALES.includes(code)) return;
    setLocaleState(code);
    AsyncStorage.setItem(STORAGE_KEY, code).catch(() => {});
  }, []);

  // t(key, ...args) — same fallback chain as the web app's fernT():
  // current locale -> English -> the raw key itself (visible-but-safe).
  const t = useCallback((key, ...args) => {
    const fromCurrent = translations[locale] && translations[locale][key];
    const fromEnglish = translations[DEFAULT_LOCALE][key];
    const value = fromCurrent !== undefined ? fromCurrent : fromEnglish;
    if (value === undefined) return key;
    return typeof value === 'function' ? value(...args) : value;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t, ready }), [locale, setLocale, t, ready]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useTranslation() {
  return useContext(LocaleContext);
}
