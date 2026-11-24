// Fern plans your week as a guided tour (one Modal, inline steps only): any plans? -> planning with live steps ->
// each dinner in turn -> review/edit the shopping list -> done. Nothing is changed until the list step is confirmed.
import React, { useEffect, useRef, useState } from 'react';
import AS from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import useLanguage from '../../hooks/useLanguage';
import AutopilotWorking from '../AutopilotWorking';
import MealPlannerImage from '../MealPlannerImage';
import { playWorkSound, startTicking, stopTicking } from '../../utils/workSounds';
import { emitAgentChange } from '../../services/fernAgent';
import { buildRollingWeekDateKeys, formatDayLabel } from '../../utils/familyDates';
import { draftWeek, applyWeek, addPlannedActivities, mealIngredients, addExtraItems, existingDinners, explainDinners, suggestAlternatives, savedRecipeList } from '../../services/autopilot';

// Recipe-card photo: the saved recipe's own picture, else the best stock match by title, else a big emoji tile.
function DinnerPhoto({ photo, title, emoji, compact }) {
  const [bad, setBad] = useState(false);
  useEffect(() => { setBad(false); }, [photo, title]);
  const box = compact ? s.photoRow : s.photo;
  const tile = <View style={s.photoTile}><Text style={compact ? s.photoEmojiSm : s.photoEmoji}>{emoji || '🍽️'}</Text></View>;
  if (photo && !bad) return <Image source={{ uri: photo }} style={box} resizeMode="cover" onError={() => setBad(true)} />;
  return (
    <View style={box}>
      {tile}
      <View style={StyleSheet.absoluteFill}><MealPlannerImage title={title} variant="fill" fallback={null} /></View>
    </View>
  );
}

// The recipe card for one dinner (used for the walk-through and for previewing a swap idea).
function DinnerCard({ m, t, dim }) {
  return (
    <View style={[s.card, dim && { opacity: 0.5 }]}>
      <DinnerPhoto photo={m.ing.photo} title={m.title} emoji={m.emoji} />
      <View style={s.dayPill}><Text style={s.dayPillText}>{m.dayLabel}</Text></View>
      <View style={s.cardBody}>
        <Text style={s.dish}>{m.title}</Text>
        <View style={[s.srcBadge, m.ing.fromSaved ? s.srcSaved : s.srcAi]}>
          <Text style={[s.srcText, m.ing.fromSaved ? s.srcTextSaved : s.srcTextAi]}>{m.ing.fromSaved ? `📖 ${t('autopilot_tour_from_saved')}` : `✨ ${t('autopilot_tour_new_idea')}`}</Text>
        </View>
        {m.sides?.length ? <Text style={s.p}>+ {m.sides.join(', ')}</Text> : null}
        <View style={s.whyBox}>
          <Text style={s.whyTitle}>🤔 {t('autopilot_tour_why_title', { day: m.dayLabel })}</Text>
          <Text style={s.whyText}>{m.why || t('autopilot_tour_why_none')}</Text>
        </View>
        <Text style={s.sub}>{t('autopilot_tour_ingredients')}{m.ing.servings ? ` · ${t('autopilot_tour_serves', { n: m.ing.servings })}` : ''}</Text>
        {(m.ing.lines?.length ? m.ing.lines : m.ing.items.map((i) => i.name)).map((line, k) => <Text key={k} style={s.ing}>• {line}</Text>)}
        {m.ing.steps?.length ? <Text style={[s.sub, { marginTop: 14 }]}>{t('autopilot_tour_method')}</Text> : null}
        {(m.ing.steps || []).map((st, k) => <Text key={`st${k}`} style={s.step2}><Text style={s.stepNo}>{k + 1}.  </Text>{st}</Text>)}
        {!m.ing.items.length && !m.ing.lines?.length ? <Text style={s.p}>{t('autopilot_tour_no_ing')}</Text> : null}
      </View>
    </View>
  );
}

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
  const swapReqRef = useRef(0);
  const [picks, setPicks] = useState([]); // [{ label, emoji, days: [offsets], noDinner }]
  const [history, setHistory] = useState([]); // past activities, most frequent first
  const [customAct, setCustomAct] = useState('');
  const [added, setAdded] = useState([]);
  const [skipDays, setSkipDays] = useState([]);
  const [meals, setMeals] = useState([]); // each gets include + ing { fromSaved, items }
  const [idx, setIdx] = useState(0);
  const [unticked, setUnticked] = useState({});
  const [extras, setExtras] = useState([]);
  const [extraText, setExtraText] = useState('');
  const [note, setNote] = useState('');
  const [existing, setExisting] = useState(new Set());
  const [swap, setSwap] = useState(null); // null | { loading, options, error, browse, query, list }
  const [swapNote, setSwapNote] = useState('');
  const snapshotRef = useRef(null);
  const env = () => ({ pushChangedFromStorage, token: user?.token });

  useEffect(() => () => stopTicking(), []);
  useEffect(() => {
    sessionRef.current += 1;
    if (!visible) { stopTicking(); return; }
    setStep('ask'); setText(''); setPicks([]); setCustomAct(''); setAdded([]); setSkipDays([]); setMeals([]); setIdx(0); setUnticked({}); setExtras([]); setExtraText(''); setNote(''); setSwap(null); setSwapNote('');
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const acts = await readJson('rv4_activities', []);
      const seen = new Map();
      (Array.isArray(acts) ? acts : []).forEach((a) => {
        const label = String(a?.label || '').trim();
        if (!label) return;
        const k = label.toLowerCase();
        const cur = seen.get(k) || { label, emoji: a?.emoji || '📌', count: 0 };
        cur.count += 1; seen.set(k, cur);
      });
      setHistory([...seen.values()].sort((a, b) => b.count - a.count).slice(0, 10));
    })();
  }, [visible]);

  useEffect(() => { swapReqRef.current += 1; stopTicking(); setSwap(null); setSwapNote(''); }, [idx]);

  const dwell = (ms) => new Promise((r) => setTimeout(r, ms));
  // Moves the checklist to step n (each step stays on screen long enough to be seen) and rings the bell for the one just finished.
  const goStage = async (n) => {
    const wait = 1700 - (Date.now() - stageAt.current);
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
    beginWork([t('autopilot_work_week'), t('autopilot_work_busy'), t('autopilot_work_sales'), t('autopilot_work_match'), t('autopilot_work_pick'), t('autopilot_work_ing'), t('autopilot_work_list')]);
    try {
      const draftP = draftWeek({ user, locale, avoid, replan: Boolean(replan) });
      await goStage(1); await goStage(2); await goStage(3); await goStage(4);
      if (sessionRef.current !== mine) return;
      startTicking();
      const draft = await draftP;
      stopTicking();
      if (sessionRef.current !== mine) return;
      if (draft.nothingToPlan) { setStep('full'); return; }
      if (!draft.meals.length) { setNote(t('autopilot_failed')); setStep('done'); setMeals([]); return; }
      await goStage(5);
      const full = await buildMeals(draft.meals.map((m) => (replan ? { ...m, replace: true } : m)));
      await goStage(6);
      await dwell(1500);
      if (sessionRef.current !== mine) return;
      await endWork();
      if (sessionRef.current !== mine) return;
      setMeals(full); setIdx(0); setStep('walk');
    } catch (e) { stopTicking(); setNote(t('autopilot_failed')); setMeals([]); setStep('done'); }
  };

  const walkExisting = async () => {
    const mine = sessionRef.current;
    beginWork([t('autopilot_work_week'), t('autopilot_work_explain'), t('autopilot_work_ing'), t('autopilot_work_list')]);
    try {
      const have = await existingDinners(avoidDays);
      if (!have.length) { stopTicking(); setNote(t('autopilot_nothing')); setStep('done'); return; }
      await goStage(1);
      startTicking();
      let why = {};
      try { why = await explainDinners({ dinners: have, user, locale }); } catch (e) { /* reasons are a nicety */ }
      stopTicking();
      if (sessionRef.current !== mine) return;
      await goStage(2);
      const full = await buildMeals(have.map((m) => ({ ...m, why: why[m.day_offset] || '' })));
      await goStage(3);
      await dwell(1500);
      if (sessionRef.current !== mine) return;
      await endWork();
      if (sessionRef.current !== mine) return;
      setMeals(full); setIdx(0); setStep('walk');
    } catch (e) { stopTicking(); setNote(t('autopilot_failed')); setMeals([]); setStep('done'); }
  };

  // Swapping one dinner: Fern offers other ideas (saved recipes and new ones, each with a reason), or the person browses their saved recipes.
  const openSwap = async () => {
    const mine = sessionRef.current;
    const req = ++swapReqRef.current;
    const stale = () => sessionRef.current !== mine || swapReqRef.current !== req;
    const cur = meals[idx];
    setSwap({ loading: true, options: [], error: false, browse: false, query: '', list: [] });
    playWorkSound('start'); startTicking(500);
    try {
      const options = await suggestAlternatives({ dayOffset: cur.day_offset, currentTitle: cur.title, otherTitles: meals.map((x) => x.title), user, locale });
      stopTicking();
      if (stale()) return;
      const withSrc = [];
      for (const o of options) withSrc.push({ ...o, ing: await mealIngredients(o) });
      if (stale()) return;
      setSwap({ loading: false, options: withSrc, error: !withSrc.length, browse: false, query: '', list: [] });
      playWorkSound('bell');
    } catch (e) { stopTicking(); if (!stale()) setSwap({ loading: false, options: [], error: true, browse: false, query: '', list: [] }); }
  };
  const openBrowse = async () => {
    const mine = sessionRef.current;
    const req = swapReqRef.current;
    try {
      const list = await savedRecipeList();
      if (sessionRef.current !== mine || swapReqRef.current !== req) return;
      setSwap((sw) => (sw ? { ...sw, loading: false, browse: true, query: '', list } : sw));
    } catch (e) { /* ignore */ }
  };
  // Keep the dinner as it is and go on to the next one (or to the shopping list after the last).
  const keepOriginal = () => {
    swapReqRef.current += 1; stopTicking(); setSwap(null);
    if (idx < meals.length - 1) setIdx(idx + 1); else setStep('list');
  };
  const pickReplacement = async (o, whyText) => {
    const base = { day_offset: meals[idx].day_offset, dayLabel: meals[idx].dayLabel, replace: meals[idx].replace };
    const ing = o.ing || await mealIngredients(o);
    const next = { ...base, title: o.title, emoji: o.emoji || '🍽️', sides: o.sides || [], ingredients: o.ingredients || [], why: whyText || o.why || '', include: true, ing, swapped: true };
    setMeals((ms) => ms.map((x, k) => (k === idx ? next : x)));
    setSwap(null);
    setSwapNote(t('autopilot_tour_swap_done', { title: o.title, day: meals[idx].dayLabel }));
    playWorkSound('bell');
  };
  // Tapping an idea shows its full recipe card first; the person then confirms with "Use this dinner".
  const previewIdea = async (o, whyText) => {
    const mine = sessionRef.current;
    const req = swapReqRef.current;
    const ing = o.ing || await mealIngredients(o);
    if (sessionRef.current !== mine || swapReqRef.current !== req) return;
    setSwap((sw) => (sw ? { ...sw, preview: { ...o, ing, why: whyText || o.why || '' } } : sw));
  };

  const weekKeys = buildRollingWeekDateKeys();
  const pickFor = (label) => picks.find((p) => p.label.toLowerCase() === label.toLowerCase());
  const togglePick = (label, emoji, noDinner) => {
    setPicks((ps) => (ps.some((p) => p.label.toLowerCase() === label.toLowerCase())
      ? ps.filter((p) => p.label.toLowerCase() !== label.toLowerCase())
      : [...ps, { label, emoji, days: [], noDinner: Boolean(noDinner) }]));
  };
  const toggleDay = (label, d) => setPicks((ps) => ps.map((p) => (p.label === label ? { ...p, days: p.days.includes(d) ? p.days.filter((x) => x !== d) : [...p.days, d].sort((a, b) => a - b) } : p)));
  const addCustom = () => {
    const v = customAct.trim().slice(0, 40);
    if (!v) return;
    if (!pickFor(v)) setPicks((ps) => [...ps, { label: v, emoji: '📌', days: [], noDinner: false }]);
    setCustomAct('');
  };

  const submitPicks = async (skip) => {
    const ready = skip ? [] : picks.filter((p) => p.days.length);
    if (!ready.length) { plan([]); return; }
    const mine = sessionRef.current;
    beginWork([t('autopilot_work_read_plans'), t('autopilot_work_calendar')]);
    try {
      await goStage(1);
      const activities = ready.flatMap((p) => p.days.map((d) => ({ day_offset: d, label: p.label, emoji: p.emoji, start: '', end: '', dayLabel: formatDayLabel(weekKeys[d]) })));
      const skipDinners = [...new Set(ready.filter((p) => p.noDinner).flatMap((p) => p.days))];
      await addPlannedActivities(activities, env());
      emitAgentChange();
      if (sessionRef.current !== mine) return;
      setAdded(activities); setSkipDays(skipDinners);
      await goStage(2);
      await dwell(500);
      if (sessionRef.current !== mine) return;
      plan(skipDinners);
    } catch (e) { if (sessionRef.current === mine) plan([]); }
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
              {history.length ? (
                <>
                  <Text style={s.askLabel}>{t('autopilot_tour_ask_past')}</Text>
                  <View style={s.chipRow}>
                    {history.map((h) => {
                      const on = Boolean(pickFor(h.label));
                      return <TouchableOpacity key={h.label} style={[s.actChip, on && s.actChipOn]} activeOpacity={0.85} onPress={() => togglePick(h.label, h.emoji, /dinner out|eating out|cena fuera/i.test(h.label))}><Text style={[s.actChipText, on && s.actChipTextOn]}>{h.emoji} {h.label}</Text></TouchableOpacity>;
                    })}
                  </View>
                </>
              ) : null}
              <Text style={s.askLabel}>{t('autopilot_tour_ask_common')}</Text>
              <View style={s.chipRow}>
                {COMMON_ACTIVITIES.map((c) => {
                  const label = t(c.key);
                  const on = Boolean(pickFor(label));
                  return <TouchableOpacity key={c.key} style={[s.actChip, on && s.actChipOn]} activeOpacity={0.85} onPress={() => togglePick(label, c.emoji, c.noDinner)}><Text style={[s.actChipText, on && s.actChipTextOn]}>{c.emoji} {label}</Text></TouchableOpacity>;
                })}
              </View>
              <View style={s.customRow}>
                <TextInput style={[s.input, { flex: 1, minHeight: 44, marginBottom: 0 }]} value={customAct} onChangeText={setCustomAct} placeholder={t('autopilot_tour_ask_custom_ph')} placeholderTextColor="#8A9C86" maxLength={40} returnKeyType="done" onSubmitEditing={addCustom} />
                <TouchableOpacity style={s.customBtn} activeOpacity={0.85} onPress={addCustom}><Text style={s.customBtnText}>+</Text></TouchableOpacity>
              </View>
              {picks.length ? (
                <View style={{ marginTop: 14 }}>
                  <Text style={s.askLabel}>{t('autopilot_tour_ask_days')}</Text>
                  {picks.map((p) => (
                    <View key={p.label} style={s.pickCard}>
                      <View style={s.pickHead}>
                        <Text style={s.pickName}>{p.emoji} {p.label}</Text>
                        <TouchableOpacity onPress={() => togglePick(p.label, p.emoji)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={s.close}>✕</Text></TouchableOpacity>
                      </View>
                      <View style={s.chipRow}>
                        {weekKeys.map((k, d) => {
                          const on = p.days.includes(d);
                          return <TouchableOpacity key={k} style={[s.dayChip, on && s.actChipOn]} activeOpacity={0.85} onPress={() => toggleDay(p.label, d)}><Text style={[s.actChipText, on && s.actChipTextOn]}>{d === 0 ? t('psp_today') : formatDayLabel(k)}</Text></TouchableOpacity>;
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
              <TouchableOpacity style={[s.primary, { marginTop: 16 }]} activeOpacity={0.85} onPress={() => submitPicks(false)}><Text style={s.primaryText}>{picks.some((p) => p.days.length) ? t('autopilot_tour_ask_go') : t('autopilot_tour_ask_skip')}</Text></TouchableOpacity>
              {picks.some((p) => p.days.length) ? <TouchableOpacity style={s.link} onPress={() => submitPicks(true)}><Text style={s.linkText}>{t('autopilot_tour_ask_skip')}</Text></TouchableOpacity> : null}
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
              {swapNote ? <View style={s.doneBox}><Text style={s.doneText}>✓ {swapNote}</Text></View> : null}
              <DinnerCard m={m} t={t} dim={!m.include} />
              {!swap ? (
                <>
                  <TouchableOpacity style={[s.second, { marginTop: 12, flex: 0 }]} activeOpacity={0.85} onPress={openSwap}><Text style={s.secondText}>🔄 {t('autopilot_tour_swap_btn')}</Text></TouchableOpacity>
                  <TouchableOpacity style={s.link} onPress={() => setMeals((ms) => ms.map((x, k) => (k === idx ? { ...x, include: !x.include } : x)))}>
                    <Text style={s.linkText}>{m.include ? t('autopilot_tour_drop') : t('autopilot_tour_keep')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={s.swapBox}>
                  <Text style={s.swapTitle}>{t('autopilot_tour_swap_title', { day: m.dayLabel })}</Text>
                  {swap.loading ? <View style={{ alignItems: 'center', paddingVertical: 16 }}><ActivityIndicator color="#3F5645" /><Text style={[s.p, { textAlign: 'center' }]}>{t('autopilot_tour_swap_loading')}</Text></View> : null}
                  {!swap.loading && swap.error && !swap.browse ? <Text style={s.p}>{t('autopilot_tour_swap_failed')}</Text> : null}
                  {swap.preview ? (
                    <>
                      <DinnerCard m={{ ...swap.preview, dayLabel: m.dayLabel }} t={t} />
                      <TouchableOpacity style={[s.primary, { marginTop: 12 }]} activeOpacity={0.85} onPress={() => pickReplacement(swap.preview)}><Text style={s.primaryText}>{t('autopilot_tour_swap_use', { day: m.dayLabel })}</Text></TouchableOpacity>
                      <TouchableOpacity style={s.link} onPress={() => setSwap((sw) => ({ ...sw, preview: null }))}><Text style={s.linkText}>{t('autopilot_tour_swap_ideas')}</Text></TouchableOpacity>
                    </>
                  ) : null}
                  {!swap.preview && !swap.loading && !swap.browse ? swap.options.map((o, i) => (
                    <TouchableOpacity key={i} style={s.optRow} activeOpacity={0.85} onPress={() => previewIdea(o)}>
                      <DinnerPhoto photo={o.ing?.photo} title={o.title} emoji={o.emoji} compact />
                      <View style={s.optText}>
                        <Text style={s.optTitle}>{o.title}</Text>
                        <Text style={[s.optSrc, o.ing?.fromSaved ? s.srcTextSaved : s.srcTextAi]}>{o.ing?.fromSaved ? `📖 ${t('autopilot_tour_from_saved')}` : `✨ ${t('autopilot_tour_new_idea')}`}</Text>
                        {o.why ? <Text style={s.optWhy}>{o.why}</Text> : null}
                      </View>
                    </TouchableOpacity>
                  )) : null}
                  {!swap.preview && swap.browse ? (
                    <>
                      <TextInput style={[s.input, { minHeight: 44, marginTop: 8, marginBottom: 8 }]} value={swap.query} onChangeText={(q) => setSwap((sw) => ({ ...sw, query: q }))} placeholder={t('autopilot_tour_swap_search_ph')} placeholderTextColor="#8A9C86" />
                      {swap.list.filter((r) => !swap.query.trim() || r.title.toLowerCase().includes(swap.query.trim().toLowerCase())).slice(0, 30).map((r, i) => (
                        <TouchableOpacity key={i} style={s.optRow} activeOpacity={0.85} onPress={() => previewIdea({ title: r.title, emoji: r.emoji, ingredients: [], sides: [] }, t('autopilot_tour_swap_you_picked'))}>
                          <DinnerPhoto photo={r.photo} title={r.title} emoji={r.emoji} compact />
                          <View style={s.optText}>
                            <Text style={s.optTitle}>{r.title}</Text>
                            <Text style={[s.optSrc, s.srcTextSaved]}>📖 {t('autopilot_tour_from_saved')}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </>
                  ) : null}
                  {!swap.preview && !swap.loading && !swap.browse ? <TouchableOpacity style={s.link} onPress={openBrowse}><Text style={s.linkText}>📖 {t('autopilot_tour_swap_browse')}</Text></TouchableOpacity> : null}
                  {!swap.preview && !swap.loading && !swap.browse ? <TouchableOpacity style={s.link} onPress={openSwap}><Text style={s.linkText}>{t('autopilot_tour_swap_more')}</Text></TouchableOpacity> : null}
                  <TouchableOpacity style={s.link} onPress={keepOriginal}><Text style={s.linkText}>{t('autopilot_tour_swap_back')}</Text></TouchableOpacity>
                </View>
              )}
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
  card: { backgroundColor: '#ECF2E6', borderRadius: 18, borderWidth: 1, borderColor: '#C8D6BE', overflow: 'hidden' },
  step2: { fontSize: 16, fontFamily: 'Jost-Regular', color: '#2F4535', marginTop: 8, lineHeight: 23 },
  stepNo: { fontFamily: 'Jost-Bold', color: '#3F5645' },
  cardBody: { padding: 16 },
  photo: { width: '100%', height: 210, backgroundColor: '#DDE7D5' },
  photoTile: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoEmoji: { fontSize: 72 },
  dayPill: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  dayPillText: { fontSize: 15, fontFamily: 'Jost-Bold', color: '#2F4535' },
  day: { fontSize: 15, fontFamily: 'Jost-SemiBold', color: '#5C7262' },
  dish: { fontSize: 24, fontFamily: 'Jost-Bold', color: '#2F4535' },
  srcBadge: { alignSelf: 'flex-start', marginTop: 10, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  srcSaved: { backgroundColor: '#DDE7D5', borderWidth: 1, borderColor: '#4E7A54' },
  srcAi: { backgroundColor: '#FFF4D6', borderWidth: 1, borderColor: '#C9A227' },
  srcText: { fontSize: 14, fontFamily: 'Jost-Bold' },
  srcTextSaved: { color: '#3F5645' },
  srcTextAi: { color: '#8A6A00' },
  whyBox: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#C8D6BE', padding: 12, marginTop: 12 },
  whyTitle: { fontSize: 14, fontFamily: 'Jost-Bold', color: '#2F4535' },
  whyText: { fontSize: 16, fontFamily: 'Jost-Regular', color: '#2F4535', marginTop: 4, lineHeight: 23 },
  swapBox: { marginTop: 12, backgroundColor: '#ECF2E6', borderRadius: 14, borderWidth: 1, borderColor: '#C8D6BE', padding: 12 },
  swapTitle: { fontSize: 17, fontFamily: 'Jost-Bold', color: '#2F4535' },
  optRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#C8D6BE', padding: 10, marginTop: 10 },
  doneBox: { backgroundColor: '#DDE7D5', borderRadius: 12, borderWidth: 1, borderColor: '#4E7A54', padding: 12, marginBottom: 10 },
  doneText: { fontSize: 15, fontFamily: 'Jost-SemiBold', color: '#2F4535', lineHeight: 21 },
  optText: { flex: 1, marginLeft: 12 },
  photoRow: { width: 84, height: 84, borderRadius: 12, overflow: 'hidden', backgroundColor: '#DDE7D5' },
  photoEmojiSm: { fontSize: 34 },
  optTitle: { fontSize: 17, fontFamily: 'Jost-Bold', color: '#2F4535' },
  optSrc: { fontSize: 13, fontFamily: 'Jost-SemiBold', marginTop: 4 },
  optWhy: { fontSize: 15, fontFamily: 'Jost-Regular', color: '#5C7262', marginTop: 4, lineHeight: 21 },
  badge: { alignSelf: 'flex-start', marginTop: 8, fontSize: 13, fontFamily: 'Jost-SemiBold', color: '#3F5645', backgroundColor: '#DDE7D5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  sub: { fontSize: 14, fontFamily: 'Jost-Bold', color: '#2F4535', marginTop: 14, marginBottom: 4 },
  ing: { fontSize: 16, fontFamily: 'Jost-Regular', color: '#2F4535', lineHeight: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C8D6BE', marginHorizontal: 4 },
  dotOn: { backgroundColor: '#3F5645' },
  askLabel: { fontSize: 14, fontFamily: 'Jost-Bold', color: '#5C7262', marginTop: 14, marginBottom: 8, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actChip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, borderWidth: 1.5, borderColor: '#C8D6BE', backgroundColor: '#FFFFFF' },
  actChipOn: { backgroundColor: '#4E7A54', borderColor: '#4E7A54' },
  actChipText: { fontSize: 15, fontFamily: 'Jost-SemiBold', color: '#2F4535' },
  actChipTextOn: { color: '#FFFFFF' },
  dayChip: { minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#C8D6BE', backgroundColor: '#FFFFFF' },
  customRow: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  customBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4E7A54', alignItems: 'center', justifyContent: 'center' },
  customBtnText: { color: '#FFFFFF', fontSize: 26, fontFamily: 'Jost-Bold', lineHeight: 30 },
  pickCard: { backgroundColor: '#ECF2E6', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#C8D6BE' },
  pickHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pickName: { fontSize: 16, fontFamily: 'Jost-Bold', color: '#2F4535', flexShrink: 1 },
  chipBox: { backgroundColor: '#DDE7D5', borderRadius: 12, padding: 12, marginBottom: 14 },
  chipLabel: { fontSize: 14, fontFamily: 'Jost-Bold', color: '#2F4535', marginBottom: 4 },
  chipText: { fontSize: 15, fontFamily: 'Jost-Regular', color: '#2F4535', lineHeight: 22 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#E3ECDC', minHeight: 44 },
  box: { fontSize: 22, color: '#3F5645', width: 32 },
  itemText: { flex: 1, fontSize: 17, fontFamily: 'Jost-Regular', color: '#2F4535' },
  strike: { color: '#8A9C86', textDecorationLine: 'line-through' },
  plus: { width: 48, height: 44, borderRadius: 12, backgroundColor: '#4E7A54', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
