import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, shadow } from '../../constants/tokens';
import { fetchDealRecipeIdeas, fetchFullRecipeForDealIdea } from '../../services/scanCircularService';
import { fetchMealPlanRecipeDetail } from '../../services/mealPlanRecipeService';
import { buildRollingWeekDateKeys, normalizeSlot, parseDateKey } from '../../utils/familyDates';
import { PANTRY_SKIP, pickStarDeals } from '../../utils/starDeals';
import { dealSaving, fmtMoney } from '../../utils/savings';
import MealPlannerImage from '../MealPlannerImage';
import ListAddPreview from '../ListAddPreview';
import { planShoppingAdditions } from '../../utils/shoppingListSync';
import useEntitlement from '../../hooks/useEntitlement';
import { TIERS } from '../../constants/tiers';
import UpgradeGateModal from '../UpgradeGateModal';

// Free plan: one week of dinners built from the sales per calendar month (device-only counter).
// Counted when the dinners are actually added to the week, not when they are only previewed.
const FREE_PLAN_KEY = 'fern_free_week_plans';
const FREE_PLANS_PER_MONTH = 1;
function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
async function freePlansUsed() {
  const rec = await readJson(FREE_PLAN_KEY, {});
  return rec && rec.month === monthKey() ? Number(rec.count) || 0 : 0;
}
async function markFreePlanUsed() {
  try {
    const used = await freePlansUsed();
    await AsyncStorage.setItem(FREE_PLAN_KEY, JSON.stringify({ month: monthKey(), count: used + 1 }));
  } catch (e) { /* best effort */ }
}

async function readJson(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

// Step 4 of the shopping trip: a week of dinners built around the week's best sale items.
// Several complete meals (main + sides) per star item; tick the ones you want, swap dishes or the
// whole sale item, preview any recipe, then one tap writes the dinners to the Family Hub week and
// every ingredient to the shopping list.
//   onAddToList(recipes)  recipes: [{ title, ingredients: [] }] -> shopping list
//   pushChangedFromStorage, onChanged  keep sync/UI fresh after the meal plan is written
export default function WeekMealsSection({ t, locale, token, weekDeals, onAddToList, pushChangedFromStorage, onChanged, shoppingItems, autoStart = false }) {
  const { hasAccess } = useEntitlement();
  const [gate, setGate] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | loading | ready | checking | review | saving | done
  const [pending, setPending] = useState(null); // { picks, recipes } waiting on the list preview
  const [want, setWant] = useState(5);
  const [cards, setCards] = useState([]); // [{ key, deal, ideas: [{id,title,time,emoji,why,sides,checked}], loading }]
  const [maxOpen, setMaxOpen] = useState(5);
  const [previews, setPreviews] = useState({});
  const [sidePreviews, setSidePreviews] = useState({}); // `${idea.id}::${side}` -> { loading | failed | recipe }
  const [failed, setFailed] = useState('');
  const [summary, setSummary] = useState(null);
  const openKeys = useRef([]);
  const prefs = useRef({});
  const [mood, setMood] = useState('');
  const [busy, setBusy] = useState('');

  const total = cards.reduce((a, c) => a + c.ideas.filter((x) => x.checked).length, 0);
  const noteFor = () => [
    prefs.current.householdSize ? `Cooking for ${prefs.current.householdSize} people.` : '',
    prefs.current.dietary && prefs.current.dietary !== 'none' ? `Dietary needs: ${prefs.current.dietary}.` : '',
    mood ? `This week they are in the mood for: ${mood}.` : '',
    busy === 'busy' ? 'It is a very busy week: every dinner must be quick (30 minutes or less) and easy, with minimal cleanup.' : '',
    busy === 'normal' ? 'A normal week: mostly weeknight-friendly dinners under 45 minutes.' : '',
    busy === 'relaxed' ? 'A relaxed week: there is time for a couple of dinners that take longer to cook.' : '',
  ].filter(Boolean).join(' ');

  // Opened for a freshly loaded flyer: build dinner ideas for the three best-value items without a tap.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStarted.current || phase !== 'idle' || !(weekDeals || []).length) return;
    autoStarted.current = true;
    start();
  }, [autoStart, weekDeals]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setFailed('');
    setPhase('loading');
    try {
      prefs.current = await readJson('fern_shopper_prefs', {});
      const mealPlan = await readJson('rv4_meal_plan', {});
      const open = buildRollingWeekDateKeys().filter((k) => !(Array.isArray(mealPlan[k]) ? mealPlan[k] : []).some((e) => normalizeSlot(e) === 'dinner'));
      openKeys.current = open;
      setMaxOpen(open.length);
      if (!open.length) { setFailed(t('trip_week_no_open')); setPhase('idle'); return; }
      const n = Math.max(1, Math.min(open.length, want));
      const starCount = autoStart ? 3 : Math.min(4, Math.max(2, Math.ceil(n / 2)));
      const stars = pickStarDeals(weekDeals, starCount, '');
      if (!stars.length) { setFailed(t('trip_week_failed')); setPhase('idle'); return; }
      const exclude = Object.values(mealPlan).flat().map((e) => String(e?.title || '')).filter(Boolean);
      const results = await Promise.all(stars.map((d) => fetchDealRecipeIdeas({ itemName: d.name, locale, token, exclude, note: noteFor() }).catch(() => [])));
      const built = stars.map((d, i) => ({ key: `${d.name}-${i}`, deal: d, ideas: (results[i] || []).map((x) => ({ ...x, checked: false })) })).filter((c) => c.ideas.length);
      if (!built.length) { setFailed(t('trip_week_failed')); setPhase('idle'); return; }
      let picked = 0;
      for (let r = 0; r < 3 && picked < n; r += 1) {
        for (const c of built) {
          if (picked >= n) break;
          if (c.ideas[r]) { c.ideas[r].checked = true; picked += 1; }
        }
      }
      setCards(built);
      setPreviews({});
      setPhase('ready');
    } catch (e) {
      console.log('[trip] week plan failed', e?.message || e);
      setFailed(t('trip_week_failed'));
      setPhase('idle');
    }
  };

  const toggle = (ci, id) => setCards((prev) => {
    const cur = prev.reduce((a, c) => a + c.ideas.filter((x) => x.checked).length, 0);
    return prev.map((c, i) => (i !== ci ? c : {
      ...c,
      ideas: c.ideas.map((x) => (x.id !== id ? x : (x.checked ? { ...x, checked: false } : (cur >= openKeys.current.length ? x : { ...x, checked: true })))),
    }));
  });

  const preview = async (idea, itemName) => {
    if (previews[idea.id]) { setPreviews((p) => ({ ...p, [idea.id]: undefined })); return; }
    setPreviews((p) => ({ ...p, [idea.id]: { loading: true } }));
    try {
      const recipe = await fetchFullRecipeForDealIdea({ idea, itemName, locale, token });
      setPreviews((p) => ({ ...p, [idea.id]: { recipe } }));
    } catch (e) {
      setPreviews((p) => ({ ...p, [idea.id]: { failed: true } }));
    }
  };

  // Tap a side dish to see its recipe (tap again to hide).
  const previewSide = async (idea, side) => {
    const key = `${idea.id}::${side}`;
    if (sidePreviews[key]) { setSidePreviews((p) => ({ ...p, [key]: undefined })); return; }
    setSidePreviews((p) => ({ ...p, [key]: { loading: true } }));
    try {
      const recipe = await fetchMealPlanRecipeDetail({ title: side, locale, token });
      setSidePreviews((p) => ({ ...p, [key]: { recipe } }));
    } catch (e) {
      setSidePreviews((p) => ({ ...p, [key]: { failed: true } }));
    }
  };

  // Three different dishes for one sale item (keeps whatever is ticked).
  const moreDishes = async (ci) => {
    const card = cards[ci];
    if (!card || card.loading) return;
    const shown = cards.flatMap((c) => c.ideas.map((x) => x.title));
    setCards((prev) => prev.map((c, i) => (i === ci ? { ...c, loading: true } : c)));
    try {
      const fresh = await fetchDealRecipeIdeas({ itemName: card.deal.name, locale, token, exclude: shown, note: noteFor() });
      setCards((prev) => prev.map((c, i) => (i !== ci ? c : { ...c, loading: false, ideas: [...c.ideas.filter((x) => x.checked), ...fresh.map((x) => ({ ...x, checked: false }))].slice(0, 6) })));
    } catch (e) {
      setCards((prev) => prev.map((c, i) => (i === ci ? { ...c, loading: false } : c)));
    }
  };

  // Swap the whole sale item for the next-best one; ticks as many dishes as were ticked before.
  const swapItem = async (ci) => {
    const card = cards[ci];
    if (!card || card.loading) return;
    const used = new Set(cards.map((c) => c.deal.name));
    const next = pickStarDeals(weekDeals, 14, '').find((d) => !used.has(d.name));
    if (!next) return;
    const keep = Math.max(1, card.ideas.filter((x) => x.checked).length);
    setCards((prev) => prev.map((c, i) => (i === ci ? { ...c, loading: true } : c)));
    try {
      const exclude = cards.flatMap((c) => c.ideas.map((x) => x.title));
      const fresh = await fetchDealRecipeIdeas({ itemName: next.name, locale, token, exclude, note: noteFor() });
      if (!fresh.length) throw new Error('none');
      setCards((prev) => prev.map((c, i) => (i !== ci ? c : { key: `${next.name}-${Date.now()}`, deal: next, loading: false, ideas: fresh.map((x, n) => ({ ...x, checked: n < keep })) })));
    } catch (e) {
      setCards((prev) => prev.map((c, i) => (i === ci ? { ...c, loading: false } : c)));
    }
  };

  // Step 1: work out every ingredient and show what will go on the list. Nothing is written yet.
  const review = async () => {
    const picks = cards.flatMap((c) => c.ideas.filter((x) => x.checked).map((x) => ({ ...x, star: c.deal })));
    if (!picks.length) return;
    setFailed('');
    setPhase('checking');
    try {
      const details = await Promise.all(picks.map((p) => fetchMealPlanRecipeDetail({ title: p.title, locale, token }).catch(() => null)));
      const recipes = picks.map((p, i) => {
        const ings = (details[i]?.ingredients || []).filter((ing) => !PANTRY_SKIP.test(String(ing)));
        return { title: p.title, ingredients: [...(ings.length ? ings : [p.star.name]), ...(p.sides || [])] };
      });
      setPending({ picks, recipes });
      setPhase('review');
    } catch (e) {
      console.log('[trip] review week failed', e?.message || e);
      setFailed(t('save_error_desc'));
      setPhase('ready');
    }
  };

  // Step 2: after the preview is confirmed, write the dinners and the list. `skip` = names un-ticked in the preview.
  const confirm = async (skip) => {
    const picks = pending?.picks || [];
    const recipes = pending?.recipes || [];
    if (!picks.length) return;
    setPhase('saving');
    try {
      const keys = openKeys.current.slice(0, picks.length);
      const mealPlan = await readJson('rv4_meal_plan', {});
      let next = { ...mealPlan };
      const lines = [];
      picks.forEach((p, i) => {
        const key = keys[i];
        if (!key) return;
        const dayMeals = Array.isArray(next[key]) ? next[key] : [];
        next = { ...next, [key]: [...dayMeals, { slot: 'Dinner', title: p.title, emoji: p.emoji || '🍽️', ...((p.sides || []).length ? { sides: p.sides } : {}) }] };
        lines.push({ day: parseDateKey(key).toLocaleDateString(locale === 'es' ? 'es' : 'en-US', { weekday: 'long' }), title: p.title, emoji: p.emoji, sides: p.sides || [], star: p.star?.name || '' });
      });
      await AsyncStorage.setItem('rv4_meal_plan', JSON.stringify(next));
      await pushChangedFromStorage?.({ meal_plan: next });
      await onAddToList?.(recipes, { skip });
      if (!hasAccess(TIERS.PRO)) await markFreePlanUsed();
      setSummary({ n: picks.length, lines });
      setPending(null);
      setPhase('done');
      onChanged?.();
    } catch (e) {
      console.log('[trip] confirm week failed', e?.message || e);
      setFailed(t('save_error_desc'));
      setPhase('review');
    }
  };

  return (
    <View style={phase === 'idle' ? styles.bare : [styles.card, shadow.card]}>
      <UpgradeGateModal visible={gate} onClose={() => setGate(false)} tier={TIERS.PRO} title={t('trip_limit_title')} desc={t('trip_limit_desc')} />
      {phase !== 'idle' ? <Text style={styles.title}>{`📅 ${t('trip_week_title')}`}</Text> : null}
      {phase !== 'idle' ? <Text style={styles.sub}>{t('trip_week_sub')}</Text> : null}

      {phase === 'idle' ? (
        weekDeals.length ? (
          <View style={{ marginTop: 10 }}>
            <View style={styles.stepRow}>
              <Text style={styles.sub}>{t('trip_week_count')}</Text>
              <View style={styles.stepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setWant((n) => Math.max(1, n - 1))}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
                <Text style={styles.stepNum}>{want}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setWant((n) => Math.min(7, n + 1))}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={styles.primary} activeOpacity={0.88} onPress={async () => {
              if (!hasAccess(TIERS.PRO) && (await freePlansUsed()) >= FREE_PLANS_PER_MONTH) { setGate(true); return; }
              setPhase('ask');
            }}>
              <Text style={styles.primaryText}>{t('trip_week_plan_btn')}</Text>
            </TouchableOpacity>
          </View>
        ) : <Text style={[styles.sub, { marginTop: 8 }]}>{t('trip_week_need_deals')}</Text>
      ) : null}
      {failed ? <Text style={styles.err}>{failed}</Text> : null}

      {phase === 'ask' ? (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.askQ}>{t('trip_ask_mood')}</Text>
          <View style={styles.chipRow}>
            {[['trip_mood_comfort', 'comfort food'], ['trip_mood_light', 'something light and fresh'], ['trip_mood_family', 'family favorites'], ['trip_mood_new', 'trying something new']].map(([k, v]) => (
              <TouchableOpacity key={k} style={[styles.chip, mood === v && styles.chipOn]} onPress={() => setMood(mood === v ? '' : v)}>
                <Text style={[styles.chipText, mood === v && styles.chipTextOn]}>{t(k)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.askQ}>{t('trip_ask_busy')}</Text>
          <View style={styles.chipRow}>
            {[['trip_busy_relaxed', 'relaxed'], ['trip_busy_normal', 'normal'], ['trip_busy_busy', 'busy']].map(([k, v]) => (
              <TouchableOpacity key={k} style={[styles.chip, busy === v && styles.chipOn]} onPress={() => setBusy(busy === v ? '' : v)}>
                <Text style={[styles.chipText, busy === v && styles.chipTextOn]}>{t(k)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.primary} activeOpacity={0.88} onPress={start}>
            <Text style={styles.primaryText}>{t('trip_ask_go')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {phase === 'loading' || phase === 'checking' || phase === 'saving' ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.orange} />
          <Text style={styles.sub}>{phase === 'saving' ? t('trip_week_saving') : phase === 'checking' ? t('trip_week_checking') : t('trip_week_working')}</Text>
        </View>
      ) : null}

      {phase === 'review' && pending ? (
        <ListAddPreview
          lines={planShoppingAdditions(pending.recipes, shoppingItems)}
          t={t}
          intro={t('trip_review_intro', { n: pending.picks.length })}
          onConfirm={confirm}
          onCancel={() => { setPending(null); setPhase('ready'); }}
        />
      ) : null}

      {phase === 'ready' ? (
        <View>
          {cards.map((c, ci) => {
            const sv = dealSaving(c.deal);
            return (
              <View key={c.key} style={styles.star}>
                <Text style={styles.starName}>{t('trip_week_star_sale', { item: c.deal.name })}</Text>
                <Text style={styles.sub}>{[c.deal.isBogo ? 'BOGO' : c.deal.salePrice, c.deal.store, sv.amount > 0 ? t('psp_save_amt', { amt: `${sv.est ? '~' : ''}${fmtMoney(sv.amount)}` }) : ''].filter(Boolean).join(' · ')}</Text>
                {c.loading ? <ActivityIndicator color={colors.orange} style={{ marginVertical: 8 }} /> : c.ideas.map((idea, ii) => {
                  const pv = previews[idea.id];
                  return (
                    <View key={idea.id} style={styles.idea}>
                      <View style={styles.ideaTop}>
                        <TouchableOpacity style={[styles.check, idea.checked ? styles.checkOn : null]} activeOpacity={0.85} onPress={() => toggle(ci, idea.id)}>
                          <Text style={styles.checkMark}>{idea.checked ? '✓' : ''}</Text>
                        </TouchableOpacity>
                        <MealPlannerImage title={idea.title} index={ii} fallback={<Text style={{ fontSize: 26 }}>{idea.emoji || '🍽️'}</Text>} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.ideaTitle}>{idea.title}</Text>
                          <Text style={styles.sub}>{[idea.time, (idea.sides || []).length ? t('trip_week_with', { sides: idea.sides.join(', ') }) : ''].filter(Boolean).join(' · ')}</Text>
                        </View>
                        <TouchableOpacity onPress={() => preview(idea, c.deal.name)} activeOpacity={0.8}>
                          <Text style={styles.link}>{pv ? t('trip_week_hide') : t('trip_week_preview')}</Text>
                        </TouchableOpacity>
                      </View>
                      {pv?.loading ? <ActivityIndicator color={colors.orange} style={{ marginTop: 6 }} /> : null}
                      {pv?.failed ? <Text style={styles.err}>{t('sale_list_recipes_failed')}</Text> : null}
                      {pv?.recipe ? (
                        <View style={styles.previewBox}>
                          <MealPlannerImage title={idea.title} index={ii} variant="hero" />
                          <Text style={styles.sub}>{[pv.recipe.time, pv.recipe.difficulty].filter(Boolean).join(' · ')}</Text>
                          {pv.recipe.description ? <Text style={styles.previewText}>{pv.recipe.description}</Text> : null}
                          {(idea.sides || []).length ? <Text style={[styles.previewText, { fontWeight: '700' }]}>{t('trip_preview_sides_label')}</Text> : null}
                          {(idea.sides || []).map((side, si) => {
                            const sp = sidePreviews[`${idea.id}::${side}`];
                            return (
                              <View key={`side-${si}`}>
                                <TouchableOpacity onPress={() => previewSide(idea, side)} activeOpacity={0.8}>
                                  <Text style={[styles.link, { marginTop: 4, textDecorationLine: 'underline' }]}>{`${sp ? '▾' : '▸'} ${side}`}</Text>
                                </TouchableOpacity>
                                {sp?.loading ? <ActivityIndicator color={colors.orange} style={{ marginTop: 4, alignSelf: 'flex-start' }} /> : null}
                                {sp?.failed ? <Text style={styles.err}>{t('sale_list_recipes_failed')}</Text> : null}
                                {sp?.recipe ? (
                                  <View style={styles.previewBox}>
                                    <Text style={styles.sub}>{[sp.recipe.time, sp.recipe.servings ? t('trip_side_servings', { n: sp.recipe.servings }) : ''].filter(Boolean).join(' · ')}</Text>
                                    {(sp.recipe.ingredients || []).length ? <Text style={[styles.previewText, { fontWeight: '700' }]}>{t('trip_preview_ingredients')}</Text> : null}
                                    {(sp.recipe.ingredients || []).map((ing, n) => <Text key={`si${n}`} style={styles.previewText}>{`• ${ing}`}</Text>)}
                                    {(sp.recipe.directions || []).map((st, n) => <Text key={`sd${n}`} style={styles.previewText}>{`${n + 1}. ${st}`}</Text>)}
                                  </View>
                                ) : null}
                              </View>
                            );
                          })}
                          {(pv.recipe.ingredients || []).length ? <Text style={[styles.previewText, { fontWeight: '700' }]}>{t('trip_preview_ingredients')}</Text> : null}
                          {(pv.recipe.ingredients || []).map((ing, n) => <Text key={`i${n}`} style={styles.previewText}>{`• ${ing}`}</Text>)}
                          {(pv.recipe.instructions || []).map((s, n) => <Text key={n} style={styles.previewText}>{`${n + 1}. ${s}`}</Text>)}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
                <View style={styles.swapRow}>
                  <TouchableOpacity onPress={() => moreDishes(ci)} activeOpacity={0.8}><Text style={styles.link}>{t('trip_week_swap_dishes')}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => swapItem(ci)} activeOpacity={0.8}><Text style={styles.link}>{t('trip_week_swap_item')}</Text></TouchableOpacity>
                </View>
              </View>
            );
          })}
          <Text style={styles.count}>{t('trip_week_picked', { n: total, max: maxOpen })}</Text>
          <TouchableOpacity style={[styles.primary, !total ? { opacity: 0.5 } : null]} disabled={!total} activeOpacity={0.88} onPress={review}>
            <Text style={styles.primaryText}>{t('trip_week_confirm', { n: total })}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {phase === 'done' && summary ? (
        <View>
          <Text style={styles.doneTitle}>{t('trip_week_done_title', { n: summary.n })}</Text>
          {summary.lines.map((l, i) => (
            <View key={`${l.day}-${l.title}`} style={styles.idea}>
              <View style={styles.ideaTop}>
                <MealPlannerImage title={l.title} index={i} fallback={<Text style={{ fontSize: 26 }}>{l.emoji || '🍽️'}</Text>} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sub}>{l.day}</Text>
                  <Text style={styles.ideaTitle}>{l.title}</Text>
                  <Text style={styles.sub}>{[l.sides.length ? t('trip_week_with', { sides: l.sides.join(', ') }) : '', l.star ? t('trip_week_star_sale', { item: l.star }) : ''].filter(Boolean).join(' · ')}</Text>
                </View>
              </View>
            </View>
          ))}
          <Text style={[styles.sub, { marginTop: 8 }]}>{t('trip_week_done_sub')}</Text>
          <TouchableOpacity onPress={() => { setPhase('idle'); setCards([]); setSummary(null); }} activeOpacity={0.8}>
            <Text style={[styles.link, { marginTop: 8 }]}>{t('trip_week_again')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bare: { marginBottom: 14 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg || 16, padding: 16, marginBottom: 14 },
  title: { fontSize: 16, fontWeight: '800', color: '#2D1B10' },
  sub: { fontSize: 13, color: '#7a6d60', marginTop: 2 },
  err: { fontSize: 13, color: '#B3402A', marginTop: 8 },
  primary: { backgroundColor: colors.orange, borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  askQ: { fontSize: 14, fontWeight: '800', color: '#2D1B10', marginTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { borderWidth: 1, borderColor: colors.orange, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipOn: { backgroundColor: colors.orange },
  chipText: { color: colors.orange, fontWeight: '700', fontSize: 13 },
  chipTextOn: { color: '#fff' },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: colors.orange, fontSize: 18, fontWeight: '800' },
  stepNum: { fontSize: 16, fontWeight: '800', color: '#2D1B10', minWidth: 18, textAlign: 'center' },
  star: { marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E4DCD2' },
  starName: { fontSize: 14, fontWeight: '800', color: '#2F7D4F' },
  idea: { marginTop: 10 },
  ideaTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#C9BFB3', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  checkMark: { color: '#fff', fontWeight: '800', fontSize: 14 },
  ideaTitle: { fontSize: 14, fontWeight: '700', color: '#2D1B10' },
  link: { color: colors.orange, fontSize: 13, fontWeight: '700' },
  previewBox: { marginTop: 6, marginLeft: 34, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#E4DCD2' },
  previewText: { fontSize: 13, color: '#2D1B10', marginTop: 3, lineHeight: 18 },
  swapRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  count: { fontSize: 13, color: '#7a6d60', textAlign: 'center', marginTop: 14 },
  done: { marginTop: 10, backgroundColor: '#E6F1EA', borderRadius: 12, padding: 12 },
  doneTitle: { fontSize: 15, fontWeight: '800', color: '#1d4d34', marginBottom: 4 },
  doneSave: { fontSize: 13, fontWeight: '800', color: '#2F7D4F', marginTop: 6 },
});
