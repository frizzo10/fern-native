// Recipe cards Fern offers in the chat (the agent's "options"): tap to preview, then add to the list or save.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, radius } from '../constants/tokens';
import useLanguage from '../hooks/useLanguage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveOptionRecipe } from '../services/fernAgent';
import { ListAddPreviewBody } from './ListAddPreview';
import { planShoppingAdditions } from '../utils/shoppingListSync';

function dayLabel(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString(undefined, { weekday: 'long' });
}

function OptionCard({ option, onAction }) {
  const { t } = useLanguage();
  const [recipe, setRecipe] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [done, setDone] = useState({});
  const [review, setReview] = useState(null); // lines of the ingredient review (un-tick what you already have)
  const [ask, setAsk] = useState(false); // after planning: "add the ingredients too?"
  const [picking, setPicking] = useState(false); // card had no day: choose meal + day
  const [pickSlot, setPickSlot] = useState('Dinner');

  useEffect(() => {
    let live = true;
    resolveOptionRecipe(option).then((r) => { if (live) setRecipe(r); }).catch(() => {});
    return () => { live = false; };
  }, [option]);

  if (!recipe) return null;
  const noDay = recipe.dayOffset === null || recipe.dayOffset === undefined;

  // Adding ingredients first shows the review so you can un-tick what you already have.
  const openReview = async () => {
    if (busy || done.list) return;
    let shop = [];
    try { shop = JSON.parse((await AsyncStorage.getItem('rv4_master_shop')) || '[]'); } catch (e) { shop = []; }
    setReview(planShoppingAdditions([{ title: recipe.title, ingredients: recipe.ingredients }], shop));
  };

  const run = async (kind, extra) => {
    if (busy || done[kind]) return;
    setBusy(kind);
    try {
      const ok = await onAction(kind, recipe, extra);
      if (ok && kind === 'list') setReview(null);
      if (ok) setDone((d) => ({ ...d, [kind]: true }));
      if (ok && kind === 'plan') { setPicking(false); }
    } finally {
      setBusy('');
    }
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setOpen((o) => !o)} style={styles.head}>
        <Text style={styles.emoji}>{recipe.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>{recipe.title}</Text>
          <Text style={styles.badge}>{recipe.isSaved ? t('option_from_yours') : t('option_new_idea')}{recipe.time ? ` · ${recipe.time}` : ''}</Text>
        </View>
        <Text style={styles.chev}>{open ? '▴' : '▾'}</Text>
      </TouchableOpacity>
      {open ? (
        <View style={styles.body}>
          {recipe.description ? <Text style={styles.desc}>{recipe.description}</Text> : null}
          {recipe.ingredients.length ? <Text style={styles.sub}>{t('option_ingredients')}</Text> : null}
          {recipe.ingredients.map((x, i) => <Text key={`i${i}`} style={styles.line}>• {x}</Text>)}
          {recipe.instructions.length ? <Text style={styles.sub}>{t('option_steps')}</Text> : null}
          {recipe.instructions.map((x, i) => <Text key={`s${i}`} style={styles.line}>{i + 1}. {x}</Text>)}
        </View>
      ) : null}
      <View style={styles.btnRow}>
        {recipe.dayOffset !== null && recipe.dayOffset !== undefined ? (
          <TouchableOpacity style={[styles.btn, styles.btnMain, done.plan && styles.btnDone]} onPress={() => run('plan')} disabled={!!busy}>
            {busy === 'plan' ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnMainText}>{done.plan ? t('option_planned') : t('option_plan_day', { day: dayLabel(recipe.dayOffset) })}</Text>}
          </TouchableOpacity>
        ) : null}
        {noDay ? (
          <TouchableOpacity style={[styles.btn, styles.btnAlt, done.plan && styles.btnDone]} onPress={() => (done.plan ? null : setPicking((v) => !v))} disabled={!!busy}>
            {busy === 'plan' ? <ActivityIndicator size="small" color={colors.forest} /> : <Text style={done.plan ? styles.btnMainText : styles.btnAltText}>{done.plan ? t('option_planned') : t('option_plan_pick')}</Text>}
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.btn, recipe.dayOffset !== null && recipe.dayOffset !== undefined ? styles.btnAlt : styles.btnMain, done.list && styles.btnDone]} onPress={openReview} disabled={!!busy}>
          {busy === 'list' ? <ActivityIndicator size="small" color={colors.forest} /> : <Text style={(recipe.dayOffset !== null && recipe.dayOffset !== undefined && !done.list) ? styles.btnAltText : styles.btnMainText}>{done.list ? t('option_added') : t('option_add_list')}</Text>}
        </TouchableOpacity>
        {!recipe.isSaved ? (
          <TouchableOpacity style={[styles.btn, styles.btnAlt]} onPress={() => run('save')} disabled={!!busy}>
            {busy === 'save' ? <ActivityIndicator size="small" color={colors.forest} /> : <Text style={styles.btnAltText}>{done.save ? t('option_saved') : t('option_save')}</Text>}
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.btn, styles.btnAlt]} onPress={() => setOpen((o) => !o)}>
          <Text style={styles.btnAltText}>{open ? t('option_hide') : t('option_preview')}</Text>
        </TouchableOpacity>
      </View>
      {noDay && picking && !done.plan ? (
        <View style={styles.askBox}>
          <Text style={styles.askText}>{t('option_pick_day')}</Text>
          <View style={styles.btnRow}>
            {[['Breakfast', 'meal_planner_slot_breakfast'], ['Lunch', 'meal_planner_slot_lunch'], ['Dinner', 'meal_planner_slot_dinner']].map(([k, key]) => (
              <TouchableOpacity key={k} style={[styles.btn, pickSlot === k ? styles.btnMain : styles.btnAlt]} onPress={() => setPickSlot(k)} disabled={!!busy}>
                <Text style={pickSlot === k ? styles.btnMainText : styles.btnAltText}>{t(key)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.btnRow}>
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <TouchableOpacity key={n} style={[styles.btn, styles.btnAlt]} onPress={() => run('plan', { dayOffset: n, slot: pickSlot })} disabled={!!busy}>
                <Text style={styles.btnAltText}>{n === 0 ? t('psp_today') : dayLabel(n)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
      {review && !done.list ? (
        <ListAddPreviewBody
          lines={review}
          t={t}
          busy={busy === 'list'}
          onConfirm={(skip) => run('list', { skip })}
          onCancel={() => setReview(null)}
        />
      ) : null}
      {ask && !done.list && !review ? (
        <View style={styles.askBox}>
          <Text style={styles.askText}>{t('option_ask_ingredients')}</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.btnMain]} onPress={openReview} disabled={!!busy}>
              {busy === 'list' ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnMainText}>{t('option_yes_add')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnAlt]} onPress={() => setAsk(false)} disabled={!!busy}>
              <Text style={styles.btnAltText}>{t('option_no_thanks')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function RecipeOptionCards({ options, onAction }) {
  const list = (Array.isArray(options) ? options : []).filter((o) => o && o.title).slice(0, 3);
  if (!list.length) return null;
  return (
    <View style={styles.wrap}>
      {list.map((o, i) => <OptionCard key={`${o.title}-${i}`} option={o} onAction={onAction} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 4, marginBottom: 8, gap: 8 },
  card: { backgroundColor: '#fff', borderRadius: radius?.md || 14, borderWidth: 1, borderColor: colors.border, padding: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emoji: { fontSize: 28 },
  title: { color: colors.forest, fontWeight: '800', fontSize: 15 },
  badge: { color: '#8a8a7a', fontSize: 11, fontWeight: '700', marginTop: 2 },
  chev: { color: colors.forest, fontSize: 16, paddingHorizontal: 4 },
  body: { marginTop: 8 },
  desc: { color: '#444', fontSize: 13, marginBottom: 6 },
  sub: { color: colors.forest, fontWeight: '800', fontSize: 12, marginTop: 6, marginBottom: 2 },
  line: { color: '#333', fontSize: 13, lineHeight: 19 },
  askBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  askText: { color: colors.forest, fontWeight: '800', fontSize: 14 },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  btn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, minHeight: 34, justifyContent: 'center', alignItems: 'center' },
  btnMain: { backgroundColor: '#D86D33' },
  btnDone: { backgroundColor: colors.forest },
  btnMainText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  btnAlt: { borderWidth: 1, borderColor: colors.forest },
  btnAltText: { color: colors.forest, fontWeight: '800', fontSize: 13 },
});
