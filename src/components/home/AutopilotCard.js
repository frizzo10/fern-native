// Fern Autopilot on Home: the one-time offer, the "planning..." line, the plan to approve (Ask me first) or the
// "I planned your week" summary with Undo (Fully automatic). Logic lives in services/autopilot.js.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useLanguage from '../../hooks/useLanguage';
import AutopilotTourModal from '../modals/AutopilotTourModal';
import { emitAgentChange } from '../../services/fernAgent';
import {
  getAutopilotMode, setAutopilotMode, autopilotRanToday, markAutopilotRan, draftWeek, applyWeek, undoWeek, subscribeAutopilotMode,
} from '../../services/autopilot';

export default function AutopilotCard({ user, ready, pushChangedFromStorage, pull }) {
  const { t, locale } = useLanguage();
  const navigation = useNavigation();
  const [tourOpen, setTourOpen] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | offer | planning | proposal | done | note
  const [stepText, setStepText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [meals, setMeals] = useState([]);
  const [summary, setSummary] = useState('');
  const snapshot = useRef(null);
  const running = useRef(false);

  const env = useCallback(() => ({ pushChangedFromStorage, token: user?.token }), [pushChangedFromStorage, user?.token]);
  const refresh = useCallback(async () => { try { await pull?.(); } catch (e) { /* ignore */ } emitAgentChange(); }, [pull]);

  const run = useCallback(async (mode) => {
    if (running.current) return;
    running.current = true;
    try {
      setStepText(t('autopilot_step_look'));
      setPhase('planning');
      const draft = await draftWeek({ user, locale, onStep: (k, n) => { if (k === 'plan') setStepText(t('autopilot_step_plan', { n })); } });
      if (draft.nothingToPlan) {
        await markAutopilotRan();
        setNoteText(t('autopilot_nothing'));
        setPhase('note');
        return;
      }
      if (!draft.meals.length) { setNoteText(t('autopilot_failed')); setPhase('note'); return; }
      await markAutopilotRan();
      setMeals(draft.meals);
      setSummary(draft.summary);
      if (mode === 'auto') {
        setStepText(t('autopilot_step_apply'));
        const r = await applyWeek(draft.meals, env());
        snapshot.current = r.snapshot;
        await refresh();
        setPhase('done');
      } else {
        setPhase('proposal');
      }
    } catch (e) {
      console.warn('[autopilot]', e?.message || e);
      setNoteText(t('autopilot_failed'));
      setPhase('note');
    } finally { running.current = false; }
  }, [user, locale, env, refresh, t]);

  const check = useCallback(async () => {
    if (!ready || !user?.token || running.current) return;
    const mode = await getAutopilotMode();
    if (mode === null) return; // the Home toggle is how people turn it on
    if (mode === 'off') return;
    if (await autopilotRanToday()) return;
    run(mode);
  }, [ready, user?.token, run]);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
    return () => sub.remove();
  }, [check]);

  // Turning the Home toggle on (or changing the mode) runs it right away, so the person sees it work.
  const tourTimer = useRef(null);
  useEffect(() => {
    const unsub = subscribeAutopilotMode((m) => {
      if (tourTimer.current) clearTimeout(tourTimer.current);
      setPhase('idle');
      // iOS drops a Modal opened while the picker sheet is still closing
      if (m === 'ask' || m === 'auto') tourTimer.current = setTimeout(() => setTourOpen(true), 450);
    });
    return () => { unsub(); if (tourTimer.current) clearTimeout(tourTimer.current); };
  }, []);

  const seeDay = (offset, title) => navigation.navigate('Family', { showDayOffset: offset, showKind: 'meal', showLabel: title, showSlot: 'Dinner', showNonce: Date.now() });

  const choose = async (mode) => {
    await setAutopilotMode(mode);
    if (mode === 'off') { setPhase('idle'); return; }
    run(mode);
  };

  const approve = async () => {
    setPhase('planning');
    try {
      const r = await applyWeek(meals, env());
      snapshot.current = r.snapshot;
      await refresh();
      setPhase('done');
    } catch (e) { setPhase('idle'); }
  };

  const undo = async () => {
    if (snapshot.current) { await undoWeek(snapshot.current, env()); snapshot.current = null; await refresh(); }
    setPhase('idle');
  };

  const tour = (
    <AutopilotTourModal
      visible={tourOpen}
      user={user}
      pushChangedFromStorage={pushChangedFromStorage}
      pull={pull}
      onClose={() => setTourOpen(false)}
      onFinished={({ meals: ms, snapshot: sn }) => { snapshot.current = sn; setMeals(ms); setSummary(''); markAutopilotRan(); setPhase('done'); }}
      onSeeWeek={(off, title) => { setTourOpen(false); setTimeout(() => seeDay(off, title), 450); }}
    />
  );

  if (phase === 'idle') return tour;

  return (
    <>
    {tour}
    <View style={s.card}>
      {phase === 'offer' ? (
        <>
          <Text style={s.title}>🤖 {t('autopilot_offer_title')}</Text>
          <Text style={s.body}>{t('autopilot_offer_body')}</Text>
          <View style={s.row}>
            <TouchableOpacity style={s.primary} activeOpacity={0.85} onPress={() => choose('ask')}><Text style={s.primaryText}>{t('autopilot_mode_ask')}</Text></TouchableOpacity>
            <TouchableOpacity style={[s.primary, s.second]} activeOpacity={0.85} onPress={() => choose('auto')}><Text style={s.primaryText}>{t('autopilot_mode_auto')}</Text></TouchableOpacity>
            <TouchableOpacity style={s.later} onPress={() => choose('off')}><Text style={s.laterText}>{t('autopilot_not_now')}</Text></TouchableOpacity>
          </View>
        </>
      ) : null}
      {phase === 'planning' ? (
        <View style={s.rowCenter}><ActivityIndicator color="#3F5645" /><Text style={[s.body, { marginLeft: 10, marginTop: 0 }]}>{stepText || t('autopilot_planning')}</Text></View>
      ) : null}
      {phase === 'note' ? (
        <>
          <Text style={s.body}>{noteText}</Text>
          <View style={s.row}><TouchableOpacity style={s.later} onPress={() => setPhase('idle')}><Text style={s.laterText}>{t('autopilot_ok')}</Text></TouchableOpacity></View>
        </>
      ) : null}
      {phase === 'proposal' || phase === 'done' ? (
        <>
          <Text style={s.title}>{phase === 'done' ? `✅ ${t('autopilot_done_title')}` : `🤖 ${t('autopilot_proposal_title')}`}</Text>
          {summary ? <Text style={s.body}>{summary}</Text> : null}
          {phase === 'done' ? <Text style={s.body}>{t('autopilot_added', { n: meals.length })}</Text> : null}
          {phase === 'done' ? <Text style={s.body}>{t('autopilot_done_tap')}</Text> : null}
          {meals.map((m) => (phase === 'done'
            ? <TouchableOpacity key={m.day_offset} style={s.mealRow} activeOpacity={0.8} onPress={() => seeDay(m.day_offset, m.title)} accessibilityRole="button"><Text style={s.mealTap}>{`${m.emoji} ${m.dayLabel}: ${m.title}`}</Text><Text style={s.chev}>›</Text></TouchableOpacity>
            : <Text key={m.day_offset} style={s.meal}>{`${m.emoji} ${m.dayLabel}: ${m.title}`}</Text>))}
          <View style={s.row}>
            {phase === 'proposal' ? (
              <>
                <TouchableOpacity style={s.primary} activeOpacity={0.85} onPress={approve}><Text style={s.primaryText}>{t('autopilot_approve')}</Text></TouchableOpacity>
                <TouchableOpacity style={s.later} onPress={() => setPhase('idle')}><Text style={s.laterText}>{t('autopilot_not_now')}</Text></TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={s.later} onPress={undo}><Text style={s.laterText}>{t('autopilot_undo')}</Text></TouchableOpacity>
                <TouchableOpacity style={s.later} onPress={() => setPhase('idle')}><Text style={s.laterText}>{t('autopilot_ok')}</Text></TouchableOpacity>
              </>
            )}
          </View>
        </>
      ) : null}
    </View>
    </>
  );
}

// Account setting: Off / Ask me first / Fully automatic.
export function AutopilotModePicker() {
  const { t } = useLanguage();
  const [mode, setMode] = useState(null);
  useEffect(() => { getAutopilotMode().then(setMode); }, []);
  const pick = async (m) => { setMode(m); await setAutopilotMode(m); };
  const opts = [['off', 'autopilot_mode_off'], ['ask', 'autopilot_mode_ask'], ['auto', 'autopilot_mode_auto']];
  return (
    <View style={[s.card, { marginTop: 10, marginBottom: 0 }]}>
      <Text style={s.title}>🤖 {t('autopilot_settings_title')}</Text>
      <Text style={s.body}>{t('autopilot_settings_desc')}</Text>
      <View style={s.row}>
        {opts.map(([m, key]) => (
          <TouchableOpacity key={m} style={[s.chip, (mode || 'off') === m && s.chipOn]} activeOpacity={0.85} onPress={() => pick(m)} accessibilityRole="button">
            <Text style={[s.chipText, (mode || 'off') === m && s.chipTextOn]}>{t(key)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  chip: { borderRadius: 10, borderWidth: 1, borderColor: '#C8D6BE', paddingVertical: 9, paddingHorizontal: 12, marginRight: 8, marginBottom: 4, backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#3F5645', borderColor: '#3F5645' },
  chipText: { fontSize: 14, fontFamily: 'Jost-SemiBold', color: '#3F5645' },
  chipTextOn: { color: '#fff' },
  card: { backgroundColor: '#ECF2E6', borderRadius: 14, borderWidth: 1, borderColor: '#C8D6BE', padding: 14, marginBottom: 12 },
  title: { fontSize: 16, fontFamily: 'Jost-Bold', color: '#2F4535' },
  body: { fontSize: 14, fontFamily: 'Jost-Regular', color: '#5C7262', marginTop: 4, lineHeight: 20 },
  mealRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#C8D6BE', paddingVertical: 11, paddingHorizontal: 12, marginTop: 6, minHeight: 44 },
  mealTap: { flex: 1, fontSize: 15, fontFamily: 'Jost-SemiBold', color: '#2F4535' },
  chev: { fontSize: 22, color: '#4E7A54', marginLeft: 8 },
  meal: { fontSize: 14, fontFamily: 'Jost-SemiBold', color: '#2F4535', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 10 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  primary: { backgroundColor: '#3F5645', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginRight: 8, marginBottom: 4 },
  second: { backgroundColor: '#4E7A54' },
  primaryText: { color: '#fff', fontSize: 14, fontFamily: 'Jost-Bold' },
  later: { paddingVertical: 10, paddingHorizontal: 10 },
  laterText: { fontSize: 14, fontFamily: 'Jost-SemiBold', color: '#6B7F66' },
});
