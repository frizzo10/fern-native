import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { colors } from '../../constants/tokens';
import { useFernVoice } from '../../hooks/useFernVoice';
import { spokenSummary } from '../../utils/spokenSummary';
import { fetchShoppingGreeting } from '../../services/shoppingGreetingService';
import { buildRollingWeekDateKeys } from '../../utils/familyDates';
import { toShoppingName } from '../../utils/shoppingName';
import { pickStarDeals } from '../../utils/starDeals';

// The AI's opening move on Shopping: Fern reads the list, this week's flyer deals, saved recipes and
// the empty dinner nights, then proposes a few things. Suggest-only: nothing changes until a tap.
// One call per day (cache key `fern_shop_greeting`, device-only) unless the flyer or the number of
// empty dinners changes or the user taps refresh. Any failure just hides the card.
const CACHE_KEY = 'fern_shop_greeting';
const SPOKEN_KEY = 'fern_shop_greeting_spoken'; // the sig we already read aloud, so it autoplays once a day

function dayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function FernGreetingCard({ t, locale, token, items, weekDeals, recipes, mealPlan, onAddItems, onPlan, onScan, alwaysSpeak = false, hideSuggestions = false, hold = false }) {
  const [state, setState] = useState('loading'); // loading | ready | hidden
  const [result, setResult] = useState(null);
  const [doneIdx, setDoneIdx] = useState([]);
  const [voiceErr, setVoiceErr] = useState('');
  const focused = useIsFocused();
  const { speakText, stopSpeaking, isSpeaking } = useFernVoice({
    onError: (m) => { console.warn('[FernGreetingCard] voice error:', m); setVoiceErr(String(m || 'unknown')); },
    token,
    enabled: true,
  });
  const reqId = useRef(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const emptyDinners = useMemo(() => {
    const plan = mealPlan || {};
    return buildRollingWeekDateKeys().filter((k) => !(Array.isArray(plan[k]) ? plan[k] : []).some((m) => String(m?.slot || m?.meal || 'Dinner').toLowerCase() === 'dinner')).length;
  }, [mealPlan]);

  const sig = `${dayKey()}|${(weekDeals || []).length}|${emptyDinners}`;

  const load = useCallback(async (force) => {
    const myReq = ++reqId.current;
    try {
      if (!force) {
        try {
          const cached = JSON.parse((await AsyncStorage.getItem(CACHE_KEY)) || 'null');
          if (cached && cached.sig === sig && cached.result) { setResult(cached.result); setDoneIdx([]); setState('ready'); return; }
        } catch (e) { /* no cache */ }
      }
      setState('loading');
      const stars = pickStarDeals(weekDeals || [], 8);
      const rest = (weekDeals || []).filter((d) => !stars.includes(d)).slice(0, 4);
      const out = await fetchShoppingGreeting({
        listItems: itemsRef.current.filter((i) => !i.checked).map((i) => i.text),
        deals: [...stars, ...rest],
        savedTitles: (recipes || []).map((r) => r?.title).filter(Boolean),
        emptyDinners,
        hasFlyer: (weekDeals || []).length > 0,
        locale,
        token,
      });
      if (myReq !== reqId.current) return; // a newer request (flyer finished loading) supersedes this one
      if (!out) { setState('hidden'); return; }
      setResult(out);
      setDoneIdx([]);
      setState('ready');
      try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ sig, result: out })); } catch (e) { /* best effort */ }
    } catch (e) {
      if (myReq === reqId.current) setState('hidden');
    }
  }, [sig, weekDeals, recipes, emptyDinners, locale, token]);

  useEffect(() => { load(false); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fern says the opening out loud: once a day automatically (while Shopping is on screen and
  // voice is on in Account), and any time via the speaker button. Stops when you leave the screen.
  const spokenText = result ? spokenSummary(`${result.greeting || ''} ${result.suggestions?.[0]?.text || ''}`) : '';
  useEffect(() => {
    return; // Fern never speaks the AI-written greeting by herself (only scripted lines and tours speak); the speaker button still plays it on tap
    if (hold || state !== 'ready' || !focused || !spokenText) return;
    let cancelled = false;
    (async () => {
      try {
        if (!alwaysSpeak && (await AsyncStorage.getItem(SPOKEN_KEY)) === sig) return;
        if (cancelled) return;
        await AsyncStorage.setItem(SPOKEN_KEY, sig);
        speakText(spokenText);
      } catch (e) { /* best effort */ }
    })();
    return () => { cancelled = true; };
  }, [hold, state, focused, spokenText, sig]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!focused) stopSpeaking(); }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === 'hidden') return null;

  const onList = new Set(items.map((i) => String(i.text).toLowerCase()));
  const needed = (s) => s.add.map(toShoppingName).filter((x) => x && !onList.has(x.toLowerCase()));

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{`🌿 ${t('greet_title')}`}</Text>
        <View style={styles.headRight}>
          {state === 'ready' && spokenText ? (
            <TouchableOpacity onPress={() => { setVoiceErr(''); if (isSpeaking) stopSpeaking(); else speakText(spokenText); }} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.refresh}>{isSpeaking ? '⏹' : '🔊'}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => load(true)} disabled={state === 'loading'} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.refresh}>{t('greet_refresh')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {state === 'loading' ? (
        <View style={styles.loadRow}>
          <ActivityIndicator color={'#8A4A4E'} />
          <Text style={styles.loadText}>{t('greet_loading')}</Text>
        </View>
      ) : (
        <>
          {result?.greeting ? <Text style={styles.greeting}>{result.greeting}</Text> : null}
          {voiceErr ? <Text style={styles.voiceErr}>{`Fern's voice problem: ${voiceErr}`}</Text> : null}
          {(hideSuggestions ? [] : (result?.suggestions || [])).map((s, idx) => {
            const toAdd = needed(s);
            const done = doneIdx.includes(idx);
            return (
              <View key={idx} style={styles.row}>
                <Text style={styles.rowText}>{s.text}</Text>
                {s.plan ? (
                  <TouchableOpacity style={styles.btn} activeOpacity={0.85} onPress={onPlan}>
                    <Text style={styles.btnText}>{t('greet_plan_btn')}</Text>
                  </TouchableOpacity>
                ) : toAdd.length ? (
                  <TouchableOpacity
                    style={[styles.btn, done ? styles.btnDone : null]}
                    activeOpacity={0.85}
                    disabled={done}
                    onPress={async () => { await onAddItems(toAdd); setDoneIdx((d) => [...d, idx]); }}
                  >
                    <Text style={styles.btnText}>{done ? t('greet_added') : t('greet_add_btn', { n: toAdd.length })}</Text>
                  </TouchableOpacity>
                ) : (!(weekDeals || []).length && /flyer|circular|ad\b/i.test(s.text)) ? (
                  <TouchableOpacity style={styles.btn} activeOpacity={0.85} onPress={onScan}>
                    <Text style={styles.btnText}>{t('greet_scan_btn')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FDE8E0', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#D8607C' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { fontSize: 16, fontWeight: '800', color: '#5A3236' },
  refresh: { fontSize: 13, fontWeight: '700', color: '#8A4A4E' },
  greeting: { fontSize: 15, color: '#5A3236', lineHeight: 21, marginTop: 8 },
  voiceErr: { fontSize: 12, color: '#B3261E', marginTop: 8 },
  loadRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  loadText: { fontSize: 14, color: '#9A7872' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3C9BD' },
  rowText: { flex: 1, fontSize: 14, color: '#5A3236', lineHeight: 19 },
  btn: { backgroundColor: '#D8607C', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  btnDone: { backgroundColor: '#8A4A4E' },
  btnText: { fontSize: 13, fontWeight: '800', color: '#fff' },
});
