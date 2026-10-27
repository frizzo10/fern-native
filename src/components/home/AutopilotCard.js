// Fern Autopilot on Home: the one-time offer, the "planning..." line, the plan to approve (Ask me first) or the
// "I planned your week" summary with Undo (Fully automatic). Logic lives in services/autopilot.js.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import useLanguage from '../../hooks/useLanguage';
import { emitAgentChange } from '../../services/fernAgent';
import {
  getAutopilotMode, setAutopilotMode, autopilotRanToday, markAutopilotRan, draftWeek, applyWeek, undoWeek,
} from '../../services/autopilot';

export default function AutopilotCard({ user, ready, pushChangedFromStorage, pull }) {
  const { t, locale } = useLanguage();
  const [phase, setPhase] = useState('idle'); // idle | offer | planning | proposal | done
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
      await markAutopilotRan();
      setPhase('planning');
      const draft = await draftWeek({ user, locale });
      if (!draft.meals.length) { setPhase('idle'); return; }
      setMeals(draft.meals);
      setSummary(draft.summary);
      if (mode === 'auto') {
        const r = await applyWeek(draft.meals, env());
        snapshot.current = r.snapshot;
        await refresh();
        setPhase('done');
      } else {
        setPhase('proposal');
      }
    } catch (e) {
      console.warn('[autopilot]', e?.message || e);
      setPhase('idle');
    } finally { running.current = false; }
  }, [user, locale, env, refresh]);

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

  if (phase === 'idle') return null;

  return (
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
        <View style={s.rowCenter}><ActivityIndicator color="#3F5645" /><Text style={[s.body, { marginLeft: 10, marginTop: 0 }]}>{t('autopilot_planning')}</Text></View>
      ) : null}
      {phase === 'proposal' || phase === 'done' ? (
        <>
          <Text style={s.title}>{phase === 'done' ? `✅ ${t('autopilot_done_title')}` : `🤖 ${t('autopilot_proposal_title')}`}</Text>
          {summary ? <Text style={s.body}>{summary}</Text> : null}
          {meals.map((m) => <Text key={m.day_offset} style={s.meal}>{`${m.emoji} ${m.dayLabel}: ${m.title}`}</Text>)}
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
  meal: { fontSize: 14, fontFamily: 'Jost-SemiBold', color: '#2F4535', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 10 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  primary: { backgroundColor: '#3F5645', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginRight: 8, marginBottom: 4 },
  second: { backgroundColor: '#4E7A54' },
  primaryText: { color: '#fff', fontSize: 14, fontFamily: 'Jost-Bold' },
  later: { paddingVertical: 10, paddingHorizontal: 10 },
  laterText: { fontSize: 14, fontFamily: 'Jost-SemiBold', color: '#6B7F66' },
});
