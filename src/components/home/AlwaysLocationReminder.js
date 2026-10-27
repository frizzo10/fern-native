// Small Home card for Pro Max users on iPhone whose Location isn't set to "Always".
// Store-arrival alerts can't wake the app without it, and iOS only asks for "Always"
// once, so the only fix is the Settings app. Self-contained: checks the OS permission,
// re-checks when the app comes back from Settings, and can be dismissed for the day.
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import useLanguage from '../../hooks/useLanguage';
import useEntitlement from '../../hooks/useEntitlement';
import { FEATURE_TIERS } from '../../constants/featureAccess';
import { needsAlways } from '../../services/locationSetup';
import { dateToKey } from '../../utils/familyDates';

const DISMISSED_KEY = 'fern_always_reminder_last'; // local date key of the last "Not now" (device-only)

export default function AlwaysLocationReminder() {
  const { t } = useLanguage();
  const { hasAccess } = useEntitlement();
  const eligible = needsAlways && hasAccess(FEATURE_TIERS.personal_shopper);
  const [show, setShow] = useState(false);

  const check = useCallback(async () => {
    if (!eligible) { setShow(false); return; }
    try {
      const always = (await Location.getBackgroundPermissionsAsync()).status === 'granted';
      if (always) { setShow(false); return; }
      const last = await AsyncStorage.getItem(DISMISSED_KEY);
      setShow(last !== dateToKey(new Date()));
    } catch (e) { setShow(false); }
  }, [eligible]);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
    return () => sub.remove();
  }, [check]);

  if (!show) return null;

  const dismiss = async () => {
    setShow(false);
    try { await AsyncStorage.setItem(DISMISSED_KEY, dateToKey(new Date())); } catch (e) { /* ignore */ }
  };

  return (
    <View style={s.card}>
      <Text style={s.title}>📍 {t('loc_reminder_title')}</Text>
      <Text style={s.body}>{t('loc_reminder_body')}</Text>
      <View style={s.row}>
        <TouchableOpacity style={s.primary} activeOpacity={0.85} onPress={() => Linking.openSettings()} accessibilityRole="button">
          <Text style={s.primaryText}>{t('loc_setup_settings')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.later} onPress={dismiss} accessibilityRole="button">
          <Text style={s.laterText}>{t('loc_setup_later')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#ECF2E6', borderRadius: 14, borderWidth: 1, borderColor: '#F0D9BF', padding: 14, marginBottom: 12 },
  title: { fontSize: 16, fontFamily: 'Jost-Bold', color: '#2F4535' },
  body: { fontSize: 14, fontFamily: 'Jost-Regular', color: '#5C7262', marginTop: 4, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  primary: { backgroundColor: '#4E7A54', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  primaryText: { color: '#fff', fontSize: 14, fontFamily: 'Jost-Bold' },
  later: { paddingVertical: 10, paddingHorizontal: 14 },
  laterText: { fontSize: 14, fontFamily: 'Jost-SemiBold', color: '#6B7F66' },
});
