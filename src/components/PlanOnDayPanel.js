// Inline panel inside the recipe viewer: pick a meal and a day, and the recipe goes on the Family Hub week.
// Plain Views on purpose (a second Modal over the recipe viewer is dropped by iOS).
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import useLanguage from '../hooks/useLanguage';
import { useSync } from '../hooks/useSync';
import { executeAgentActions, emitAgentChange } from '../services/fernAgent';

function dayChipLabel(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString(undefined, { weekday: 'short' }) + ' ' + d.getDate();
}

export default function PlanOnDayPanel({ recipe, user, onClose }) {
  const { t } = useLanguage();
  const { pushChangedFromStorage } = useSync(user);
  const [slot, setSlot] = useState('Dinner');
  const [busy, setBusy] = useState(false);
  const [doneText, setDoneText] = useState('');
  const [err, setErr] = useState('');

  const plan = async (offset) => {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      const res = await executeAgentActions(
        [{ type: 'plan_meal', day_offset: offset, slot, title: recipe?.title, emoji: recipe?.emoji || '🍽️', replace: true }],
        { pushChangedFromStorage, token: user?.token, canSaveUnlimited: true },
      );
      emitAgentChange();
      const day = offset === 0 ? t('psp_today') : dayChipLabel(offset);
      setDoneText(res?.lines?.length ? t('plan_family_done', { slot: t(`meal_planner_slot_${slot.toLowerCase()}`), day }) : t('plan_family_failed'));
    } catch (e) {
      setErr(t('plan_family_failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{t('plan_family_title')}</Text>
      {doneText ? (
        <>
          <Text style={styles.done}>✓ {doneText}</Text>
          <TouchableOpacity style={[styles.chip, styles.chipOn, { alignSelf: 'flex-start', marginTop: 8 }]} onPress={onClose}>
            <Text style={styles.chipOnText}>{t('close_btn')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.row}>
            {['Breakfast', 'Lunch', 'Dinner'].map((k) => (
              <TouchableOpacity key={k} style={[styles.chip, slot === k ? styles.chipOn : null]} onPress={() => setSlot(k)} disabled={busy}>
                <Text style={slot === k ? styles.chipOnText : styles.chipText}>{t(`meal_planner_slot_${k.toLowerCase()}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>{t('option_pick_tapday')}</Text>
          <View style={styles.row}>
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <TouchableOpacity key={n} style={styles.chip} onPress={() => plan(n)} disabled={busy}>
                <Text style={styles.chipText}>{n === 0 ? `${t('psp_today')} ${new Date().getDate()}` : dayChipLabel(n)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {busy ? <ActivityIndicator size="small" color="#3F5645" style={{ marginTop: 8 }} /> : null}
          {err ? <Text style={styles.err}>{err}</Text> : null}
          <TouchableOpacity onPress={onClose} style={{ marginTop: 10 }}><Text style={styles.cancel}>{t('cancel_btn')}</Text></TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: '#ECF2E6', borderWidth: 1, borderColor: '#C8D6BE' },
  title: { color: '#2F4535', fontWeight: '800', fontSize: 15, marginBottom: 8 },
  hint: { color: '#5C7262', fontSize: 13, marginTop: 10, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#C8D6BE', backgroundColor: '#FFFFFF' },
  chipOn: { backgroundColor: '#4E7A54', borderColor: '#4E7A54' },
  chipText: { color: '#3F5645', fontWeight: '700', fontSize: 14 },
  chipOnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  done: { color: '#3F6845', fontWeight: '800', fontSize: 15 },
  err: { color: '#B3261E', marginTop: 8, fontSize: 13 },
  cancel: { color: '#5C7262', fontSize: 14, textDecorationLine: 'underline' },
});
