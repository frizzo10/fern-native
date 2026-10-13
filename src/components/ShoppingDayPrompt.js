import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../constants/tokens';
import { useLanguage } from '../hooks/useLanguage';
import ShoppingDayPicker from './ShoppingDayPicker';
import { getShoppingDay, saveShoppingDay } from '../utils/staples';

const ASKED_KEY = 'fern_shopping_day_asked';

// One-time first-run question: which day do you usually shop? (Drives the evening-before "everyday items" nudge.)
export default function ShoppingDayPrompt({ userId }) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!userId) return undefined;
    let timer;
    (async () => {
      try {
        const [day, asked] = await Promise.all([getShoppingDay(), AsyncStorage.getItem(ASKED_KEY)]);
        if (day == null && !asked) timer = setTimeout(() => setVisible(true), 2500);
      } catch (e) { /* skip */ }
    })();
    return () => clearTimeout(timer);
  }, [userId]);

  const close = async () => {
    setVisible(false);
    try { await AsyncStorage.setItem(ASKED_KEY, '1'); } catch (e) { /* best effort */ }
  };

  const pick = async (day) => {
    await saveShoppingDay(day, { title: t('everyday_nudge_title'), body: t('everyday_nudge_body') });
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('shopday_title')}</Text>
          <Text style={styles.sub}>{t('everyday_day_hint')}</Text>
          <ShoppingDayPicker t={t} day={null} onPick={pick} />
          <TouchableOpacity onPress={close} activeOpacity={0.8} style={{ marginTop: 16, alignSelf: 'center' }}>
            <Text style={styles.skip}>{t('shopday_skip')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  title: { fontSize: 22, fontWeight: '800', color: colors.forest },
  sub: { fontSize: 14, color: '#7a6d60', marginTop: 6, lineHeight: 20 },
  skip: { fontSize: 14, color: '#7a6d60', fontWeight: '700' },
});
