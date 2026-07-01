import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../constants/translations';

export const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState('en');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLanguage() {
      try {
        const savedLanguage = await AsyncStorage.getItem('fern_user_locale');
        if (savedLanguage === 'en' || savedLanguage === 'es') {
          setLocale(savedLanguage);
        }
      } catch (e) {
        console.warn('[LanguageContext] failed to load language preference:', e);
      } finally {
        setLoading(false);
      }
    }
    loadLanguage();
  }, []);

  const changeLanguage = useCallback(async (newLocale) => {
    if (newLocale !== 'en' && newLocale !== 'es') return;
    try {
      setLocale(newLocale);
      await AsyncStorage.setItem('fern_user_locale', newLocale);
    } catch (e) {
      console.warn('[LanguageContext] failed to save language preference:', e);
    }
  }, []);

  const t = useCallback((key, params = {}) => {
    const dict = translations[locale] || translations['en'];
    let val = dict[key] || translations['en'][key] || key;
    
    // Support basic interpolation, e.g. {count}
    Object.keys(params).forEach(paramKey => {
      val = val.replace(new RegExp(`{${paramKey}}`, 'g'), String(params[paramKey]));
    });
    
    return val;
  }, [locale]);

  return (
    <LanguageContext.Provider value={{ locale, changeLanguage, t, loading }}>
      {children}
    </LanguageContext.Provider>
  );
}
export default LanguageContext;
