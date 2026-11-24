// Fern plans your week as a guided tour (one Modal, inline steps only): any plans? -> planning with live steps ->
// each dinner in turn -> review/edit the shopping list -> done. Nothing is changed until the list step is confirmed.
import React, { useEffect, useRef, useState } from 'react';
import AS from '@react-native-async-storage/async-storage';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import useLanguage from '../../hooks/useLanguage';
import AutopilotWorking from '../AutopilotWorking';
import { playWorkSound, startTicking, stopTicking } from '../../utils/workSounds';
import { emitAgentChange } from '../../services/fernAgent';
import { draftWeek, applyWeek, parsePlans, addPlannedActivities, mealIngredients, addExtraItems, existingDinners } from '../../services/autopilot';

export default function AutopilotTourModal({ visible, user, pushChangedFromStorage, pull, onClose, onFinished, onSeeWeek }) {
  const { t, locale } = useLanguage();
  const [step, setStep] = useState('ask'); // ask | working | full | walk | list | applying | done
  const [avoidDays, setAvoid] = useState([]);
  const [text, setText] = useState('');
  const [stage, setStage] = useState(0);
  const [workSteps, setWorkSteps] = useState([]);
  const [workDone, setWorkDone] = useState(false);
  const stageAt = useRef(0);
  const sessionRef = useRef(0);
  const [added, setAdded] = useState([]);
  const [skipDays, setSkipDays] = useState([]);
  const [meals, setMeals] = useState([]); // each gets include + ing { fromSaved, items }
  const [idx, setIdx] = useState(0);
  const [unticked, setUnticked] = useState({});
  const [extras, setExtras] = useState([]);
  const [extraText, setExtraText] = useState('');
  const [note, setNote] = useState('');
  const [existing, setExisting] = useState(new Set());
  const snapshotRef = useRef(null);
  const env = () => ({ pushChangedFromStorage, token: user?.token });

  useEffect(() => () => stopTicking(), []);
  useEffect(() => {
    sessionRef.current += 1;
    if (!visible) { stopTicking(); return; }
    setStep('ask'); setText(''); setAdded([]); setSkipDays([]); setMeals([]); setIdx(0); setUnticked({}); setExtras([]); setExtraText(''); setNote('');
  }, [visible]);

  const dwell = (ms) => new Promise((r) => setTimeout(r, ms));
  // Moves the checklist to step n (each step stays on screen long enough to be seen) and rings the bell for the one just finished.
  const goStage = async (n) => {
    const wait = 900 - (Date.now() - stageAt.current);
    if (wait > 0) await dwell(wait);
    setStage(n); stageAt.current = Date.now();
    if (n > 0) playWorkSound('bell');
  };
  const beginWork = (labels) => {
    setWorkSteps(labels); setStage(0); setWorkDone(false); stageAt.current = Date.now(); setStep('working');
    playWorkSound('start');
  };
  const endWork = async () => {
    stopTicking();
    setWorkDone(true); playWorkSound('done');
    await dwell(1100);
  };

  const buildMeals = async (drafted) => {
    const full = [];
    for (const m of drafted) full.push({ ...m, include: true, ing: await mealIngredients(m) });
    try {
      const list = JSON.parse((await AS.getItem('rv4_master_shop')) || '[]');
      setExisting(new Set(list.filter((i) => !i.checked).map((i) => String(i.text || '').toLowerCase())));
    } catch (e) { /* ignore */ }
    return full;
  };

  const plan = async (avoid, replan) => {
    setAvoid(avoid);
    const mine = sessionRef.current;
    beginWork([t('autopilot_work_week'), t('autopilot_work_sales'), t('autopilot_work_pick'), t('autopilot_work_ing'), t('autopilot_work_list')]);
    try {
      const draftP = draftWeek({ user, locale, avoid, replan: Boolean(replan) });
      await goStage(1); await goStage(2);
      if (sessionRef.current !== mine) return;
      startTicking();
      const draft = await draftP;
      stopTicking();
      if (sessionRef.current !== mine) return;
      if (draft.nothingToPlan) { setStep('full'); return; }
      if (!draft.meals.length) { setNote(t('autopilot_failed')); setStep('done'); setMeals([]); return; }
      await goStage(3);
      const full = await buildMeals(draft.meals.map((m) => (replan ? { ...m, replace: true } : m)));
      await goStage(4);
      if (sessionRef.current !== mine) return;
      await endWork();
      if (sessionRef.current !== mine) return;
      setMeals(full); setIdx(0); setStep('walk');
    } catch (e) { stopTicking(); setNote(t('autopilot_failed')); setMeals([]); setStep('done'); }
  };

  const walkExisting = async () => {
    const mine = sessionRef.current;
    beginWork([t('autopilot_work_week'), t('autopilot_work_ing'), t('autopilot_work_list')]);
    try {
      const have = await existingDinners(avoidDays);
      if (!have.length) { stopTicking(); setNote(t('autopilot_nothing')); setStep('done'); return; }
      await goStage(1);
      const full = await buildMeals(have);
      await goStage(2);
      if (sessionRef.current !== mine) return;
      await endWork();
      if (sessionRef.current !== mine) return;
      setMeals(full); setIdx(0); setStep('walk');
    } catch (e) { stopTicking(); setNote(t('autopilot_failed')); setMeals([]); setStep('done'); }
  };

  const submitPlans = async (skip) => {
    if (skip || !text.trim()) { plan([]); return; }
    const mine = sessionRef.current;
    beginWork([t('autopilot_work_read_plans'), t('autopilot_work_calendar')]);
    startTicking();
    try {
      const r = await parsePlans({ text, user, locale });
      stopTicking();
      if (sessionRef.current !== mine) return;
      await goStage(1);
      await addPlannedActivities(r.activities, env());
      if (r.activities.length) { emitAgentChange(); }
      setAdded(r.activities); setSkipDays(r.skipDinners);
      await goStage(2);
      await dwell(500);
      if (sessionRef.current !== mine) return;
      plan(r.skipDinners);
    } catch (e) { stopTicking(); if (sessionRef.current === mine) plan([]); }
  };

  const included = meals.filter((m) => m.include);
  const allItems = () => {
    const seen = new Map();
    included.forEach((m) => m.ing.items.forEach((i) => { if (!seen.has(i.key)) seen.set(i.key, i); }));
    return [...seen.values()];
  };

  const confirm = async () => {
    const mine = sessionRef.current;
    beginWork([t('autopilot_work_adding_week'), t('autopilot_work_adding_list'), t('autopilot_work_syncing')]);
    try {
      const skip = Object.keys(unticked).filter((k) => unticked[k]);
      startTicking(500);
      const r = await applyWeek(included.map((m) => ({ ...m, skip })), env());
      snapshotRef.current = r.snapshot;
      stopTicking();
      await goStage(1);
      await addExtraItems(extras, env());
      await goStage(2);
      try { await pull?.(); } catch (e) { /* ignore */ }
      emitAgentChange();
      onFinished?.({ meals: included, snapshot: r.snapshot });
      if (sessionRef.current !== mine) return;
      await endWork();
      if (sessionRef.current !== mine) return;
      setStep('done');
    } catch (e) { stopTicking(); setNote(t('autopilot_failed')); setMeals([]); setStep('done'); }
  };

  const m = meals[idx];
  const items = step === 'list' ? allItems() : [];
  const tickedCount = items.filter((i) => !unticked[i.key]).length + extras.length;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.head}>
          <Text style={s.headTitle}>🤖 {t('autopilot_tour_title')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button"><Text style={s.close}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {step === 'ask' ? (
            <>
              <Text style={s.h}>{t('autopilot_tour_ask_title')}</Text>
              <Text style={s.p}>{t('autopilot_tour_ask_body')}</Text>
              <TextInput style={s.input} value={text} onChangeText={setText} multiline placeholder={t('autopilot_tour_ask_ph')} placeholderTextColor="#8A9C86" maxLength={600} />
              <TouchableOpacity style={s.primary} activeOpacity={0.85} onPress={() => submitPlans(false)}><Text style={s.primaryText}>{text.trim() ? t('autopilot_tour_ask_go') : t('autopilot_tour_ask_skip')}</Text></TouchableOpacity>
              {text.trim() ? <TouchableOpacity style={s.link} onPress={() => submitPlans(true)}><Text style={s.linkText}>{t('autopilot_tour_ask_skip')}</Text></TouchableOpacity> : null}
            </>
          ) : null}
          {step === 'working' ? <AutopilotWorking title={t('autopilot_work_title')} steps={workSteps} current={stage} finished={workDone} /> : null}
          {step === 'full' ? (
            <>
              <Text style={s.h}>{t('autopilot_tour_full_title')}</Text>
              <Text style={s.p}>{t('autopilot_tour_full_body')}</Text>
              <TouchableOpacity style={[s.primary, { marginTop: 18 }]} activeOpacity={0.85} onPress={walkExisting}><Text style={s.primaryText}>{t('autopilot_tour_full_walk')}</Text></TouchableOpacity>
              <TouchableOpacity style={[s.second, { marginTop: 12, flex: 0 }]} activeOpacity={0.85} onPress={() => plan(avoidDays, true)}><Text style={s.secondText}>{t('autopilot_tour_full_replan')}</Text></TouchableOpacity>
              <Text style={[s.p, { fontSize: 14 }]}>{t('autopilot_tour_full_hint')}</Text>
            </>
          ) : null}
          {step === 'walk' && m ? (
            <>
              {added.length ? <View style={s.chipBox}><Text style={s.chipLabel}>📅 {t('autopilot_tour_added_title')}</Text>{added.map((a, i) => <Text key={i} style={s.chipText}>{`${a.emoji} ${a.dayLabel}: ${a.label}${a.start ? ` ${a.start}` : ''}`}</Text>)}</View> : null}
              <Text style={s.step}>{t('autopilot_tour_walk_title')} · {idx + 1}/{meals.length}</Text>
              <View style={[s.card, !m.include && { opacity: 0.5 }]}>
                <Text style={s.day}>{m.dayLabel}</Text>
                <Text style={s.dish}>{m.emoji} {m.title}</Text>
                <Text style={s.badge}>{m.ing.fromSaved ? t('autopilot_tour_from_saved') : t('autopilot_tour_new_idea')}</Text>
                {m.sides?.length ? <Text style={s.p}>+ {m.sides.join(', ')}</Text> : null}
                <Text style={s.sub}>{t('autopilot_tour_ingredients')}</Text>
                {m.ing.items.map((i) => <Text key={i.key} style={s.ing}>• {i.name}</Text>)}
              </View>
              <TouchableOpacity style={s.link} onPress={() => setMeals((ms) => ms.map((x, k) => (k === idx ? { ...x, include: !x.include } : x)))}>
                <Text style={s.linkText}>{m.include ? t('autopilot_tour_drop') : t('autopilot_tour_keep')}</Text>
              </TouchableOpacity>
              <View style={s.dots}>{meals.map((_, k) => <View key={k} style={[s.dot, k === idx && s.dotOn]} />)}</View>
              <View style={s.row}>
                <TouchableOpacity style={[s.second, idx === 0 && { opacity: 0.4 }]} disabled={idx === 0} onPress={() => setIdx(idx - 1)}><Text style={s.secondText}>{t('autopilot_tour_back')}</Text></TouchableOpacity>
                {idx < meals.length - 1
                  ? <TouchableOpacity style={s.primaryHalf} onPress={() => setIdx(idx + 1)}><Text style={s.primaryText}>{t('autopilot_tour_next')}</Text></TouchableOpacity>
                  : <TouchableOpacity style={s.primaryHalf} onPress={() => setStep('list')}><Text style={s.primaryText}>{t('autopilot_tour_to_list')}</Text></TouchableOpacity>}
              </View>
            </>
          ) : null}
          {step === 'list' ? (
            <>
              <Text style={s.h}>{t('autopilot_tour_list_title')}</Text>
              <Text style={s.p}>{t('autopilot_tour_list_body')}</Text>
              {items.map((i) => (
                <TouchableOpacity key={i.key} style={s.itemRow} activeOpacity={0.8} onPress={() => setUnticked((u) => ({ ...u, [i.key]: !u[i.key] }))}>
                  <Text style={s.box}>{unticked[i.key] ? '☐' : '☑'}</Text>
                  <Text style={[s.itemText, unticked[i.key] && s.strike]}>{i.name}{existing.has(i.name.toLowerCase()) ? `  · ${t('autopilot_tour_list_have')}` : ''}</Text>
                </TouchableOpacity>
              ))}
              {extras.map((x, k) => (
                <View key={`x${k}`} style={s.itemRow}><Text style={s.box}>☑</Text><Text style={s.itemText}>{x}</Text>
                  <TouchableOpacity onPress={() => setExtras((e) => e.filter((_, j) => j !== k))}><Text style={s.close}>✕</Text></TouchableOpacity></View>
              ))}
              <View style={[s.row, { marginTop: 10 }]}>
                <TextInput style={[s.input, { flex: 1, minHeight: 44, marginBottom: 0 }]} value={extraText} onChangeText={setExtraText} placeholder={t('autopilot_tour_list_add_ph')} placeholderTextColor="#8A9C86" maxLength={80}
                  onSubmitEditing={() => { if (extraText.trim()) { setExtras((e) => [...e, extraText.trim()]); setExtraText(''); } }} returnKeyType="done" />
                <TouchableOpacity style={s.plus} onPress={() => { if (extraText.trim()) { setExtras((e) => [...e, extraText.trim()]); setExtraText(''); } }}><Text style={s.primaryText}>+</Text></TouchableOpacity>
              </View>
              <TouchableOpacity style={[s.primary, { marginTop: 16 }]} activeOpacity={0.85} onPress={confirm}><Text style={s.primaryText}>{t('autopilot_tour_list_confirm', { n: tickedCount })}</Text></TouchableOpacity>
              <TouchableOpacity style={s.link} onPress={() => setStep('walk')}><Text style={s.linkText}>{t('autopilot_tour_back')}</Text></TouchableOpacity>
            </>
          ) : null}
          {step === 'done' ? (
            <View style={s.center}>
              <Text style={[s.h, { textAlign: 'center' }]}>{note ? '🌿' : `✅ ${t('autopilot_tour_done_title')}`}</Text>
              <Text style={[s.p, { textAlign: 'center' }]}>{note || t('autopilot_tour_done_body', { n: included.length })}</Text>
              {!note && included.length ? <TouchableOpacity style={[s.primary, { alignSelf: 'stretch' }]} onPress={() => onSeeWeek?.(included[0].day_offset, included[0].title)}><Text style={s.primaryText}>{t('autopilot_tour_see_week')}</Text></TouchableOpacity> : null}
              <TouchableOpacity style={s.link} onPress={onClose}><Text style={s.linkText}>{t('autopilot_tour_home')}</Text></TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#F7FAF3' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 18, paddingBottom: 12, backgroundColor: '#B5C7AB' },
  headTitle: { fontSize: 18, fontFamily: 'Jost-Bold', color: '#34493A' },
  close: { fontSize: 20, color: '#3F5645', paddingHorizontal: 8 },
  body: { padding: 18, paddingBottom: 60 },
  center: { alignItems: 'center', paddingTop: 50 },
  h: { fontSize: 22, fontFamily: 'Jost-Bold', color: '#2F4535' },
  p: { fontSize: 16, fontFamily: 'Jost-Regular', color: '#5C7262', marginTop: 8, lineHeight: 23 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#C8D6BE', borderRadius: 12, padding: 12, fontSize: 17, fontFamily: 'Jost-Regular', color: '#2F4535', minHeight: 90, marginTop: 14, marginBottom: 14, textAlignVertical: 'top' },
  primary: { backgroundColor: '#4E7A54', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryHalf: { flex: 1, backgroundColor: '#4E7A54', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginLeft: 10 },
  primaryText: { color: '#fff', fontSize: 17, fontFamily: 'Jost-Bold' },
  second: { flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#C8D6BE', backgroundColor: '#fff' },
  secondText: { color: '#3F5645', fontSize: 17, fontFamily: 'Jost-SemiBold' },
  link: { alignItems: 'center', paddingVertical: 14 },
  linkText: { color: '#3F5645', fontSize: 16, fontFamily: 'Jost-SemiBold', textDecorationLine: 'underline' },
  row: { flexDirection: 'row', alignItems: 'center' },
  step: { fontSize: 13, fontFamily: 'Jost-SemiBold', color: '#5C7262', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  card: { backgroundColor: '#ECF2E6', borderRadius: 16, borderWidth: 1, borderColor: '#C8D6BE', padding: 16 },
  day: { fontSize: 15, fontFamily: 'Jost-SemiBold', color: '#5C7262' },
  dish: { fontSize: 24, fontFamily: 'Jost-Bold', color: '#2F4535', marginTop: 4 },
  badge: { alignSelf: 'flex-start', marginTop: 8, fontSize: 13, fontFamily: 'Jost-SemiBold', color: '#3F5645', backgroundColor: '#DDE7D5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  sub: { fontSize: 14, fontFamily: 'Jost-Bold', color: '#2F4535', marginTop: 14, marginBottom: 4 },
  ing: { fontSize: 16, fontFamily: 'Jost-Regular', color: '#2F4535', lineHeight: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C8D6BE', marginHorizontal: 4 },
  dotOn: { backgroundColor: '#3F5645' },
  chipBox: { backgroundColor: '#DDE7D5', borderRadius: 12, padding: 12, marginBottom: 14 },
  chipLabel: { fontSize: 14, fontFamily: 'Jost-Bold', color: '#2F4535', marginBottom: 4 },
  chipText: { fontSize: 15, fontFamily: 'Jost-Regular', color: '#2F4535', lineHeight: 22 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#E3ECDC', minHeight: 44 },
  box: { fontSize: 22, color: '#3F5645', width: 32 },
  itemText: { flex: 1, fontSize: 17, fontFamily: 'Jost-Regular', color: '#2F4535' },
  strike: { color: '#8A9C86', textDecorationLine: 'line-through' },
  plus: { width: 48, height: 44, borderRadius: 12, backgroundColor: '#4E7A54', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
