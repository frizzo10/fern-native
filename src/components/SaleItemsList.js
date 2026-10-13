import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { fetchDealRecipeIdeas, fetchFullRecipeForDealIdea } from '../services/scanCircularService';
import { colors, radius } from '../constants/tokens';
import { dealSaving, dedupeDeals, fmtMoney } from '../utils/savings';
import { dealKind, isFoodDeal, isUnreliableCategory } from '../utils/dealKind';
import MealPlannerImage from './MealPlannerImage';
import ListAddPreview from './ListAddPreview';
import { planShoppingAdditions } from '../utils/shoppingListSync';
import { buildRollingWeekDateKeys, parseDateKey } from '../utils/familyDates';

// Every item read off the flyer, grouped by aisle, with a one-tap "add to my list".
// Shared by the Personal Shopper scan check and the Shopping tab.
//   deals     [{ name, salePrice, originalPrice, category, isBogo, store, emoji }]
//   isOnList  (deal) => boolean   already on the shopping list / queued for it
//   onAdd     (deal) => void
//   token, locale, onAddRecipe(recipe, deal) — when given, each row gets a "Recipes" button:
//   3 dinner ideas for that item, a full preview on tap, and "Add ingredients to my list".
export default function SaleItemsList({ deals, isOnList, onAdd, t, token, locale, onAddRecipe, onPlanDay, shoppingItems }) {
  const [query, setQuery] = useState('');
  const [added, setAdded] = useState({});
  const [open, setOpen] = useState(null); // { key, loading, ideas, failed, idea, recipe, recipeLoading, done }

  const findRecipes = async (deal, key) => {
    if (open?.key === key) { setOpen(null); return; }
    setOpen({ key, loading: true, ideas: [] });
    try {
      const ideas = await fetchDealRecipeIdeas({ itemName: deal.name, locale, token });
      setOpen((p) => (p?.key === key ? { key, loading: false, ideas, failed: !ideas.length } : p));
    } catch (e) {
      setOpen((p) => (p?.key === key ? { key, loading: false, ideas: [], failed: true } : p));
    }
  };

  const previewIdea = async (deal, idea) => {
    setOpen((p) => (p ? { ...p, idea, recipe: null, recipeLoading: true, done: false, reviewing: false, saving: false } : p));
    try {
      const recipe = await fetchFullRecipeForDealIdea({ idea, itemName: deal.name, locale, token });
      setOpen((p) => (p?.idea === idea ? { ...p, recipe, recipeLoading: false } : p));
    } catch (e) {
      setOpen((p) => (p?.idea === idea ? { ...p, recipe: null, recipeLoading: false, recipeFailed: true } : p));
    }
  };

  // The recipe with its sides, as it would go on the list.
  const recipeForList = () => {
    const sides = Array.isArray(open?.idea?.sides) ? open.idea.sides : [];
    return { ...open.recipe, ingredients: [...(open.recipe.ingredients || []), ...sides] };
  };

  // Nothing is written until the preview is confirmed.
  const addRecipe = async (deal, skip) => {
    if (!open?.recipe) return;
    setOpen((p) => (p ? { ...p, saving: true } : p));
    try {
      await onAddRecipe?.(recipeForList(), deal, { skip });
      setOpen((p) => (p ? { ...p, done: true, saving: false, reviewing: false } : p));
    } catch (e) {
      setOpen((p) => (p ? { ...p, saving: false } : p));
    }
  };

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map();
    // The same item can be saved twice (own scan + shared flyer); show it once.
    dedupeDeals(deals).forEach((deal, i) => {
      const name = String(deal?.name || '').trim();
      if (!name) return;
      // The flyer reader files everything under Meat/Poultry/Seafood/Produce; fix the aisle by what the item is.
      const kind = dealKind(deal);
      const stored = String(deal?.category || '').trim();
      const cat = kind && isUnreliableCategory(stored) ? t(kind.labelKey) : (stored || t('sale_list_other'));
      if (q && !name.toLowerCase().includes(q) && !cat.toLowerCase().includes(q)) return;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push({ deal, key: `${name}-${deal?.store || ''}-${i}` });
    });
    // Biggest savers first inside each aisle.
    map.forEach((rows) => rows.sort((a, b) => dealSaving(b.deal).amount - dealSaving(a.deal).amount));
    return Array.from(map.entries());
  }, [deals, query, t]);

  return (
    <View>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder={t('sale_list_search')}
        placeholderTextColor="#9a8f84"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />
      {!groups.length ? <Text style={styles.empty}>{t('sale_list_none')}</Text> : null}
      {groups.map(([cat, rows]) => (
        <View key={cat} style={styles.group}>
          <Text style={styles.groupLabel}>{cat}</Text>
          {rows.map(({ deal, key }) => {
            const done = Boolean(added[key]) || Boolean(isOnList?.(deal));
            const saving = dealSaving(deal);
            const price = deal.isBogo ? 'BOGO' : deal.salePrice;
            const isOpen = open?.key === key;
            return (
              <View key={key}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.name} numberOfLines={2}>{`${deal.emoji ? `${deal.emoji} ` : ''}${deal.name}`}</Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {[price, deal.originalPrice ? t('sale_list_was', { price: deal.originalPrice }) : '', deal.store].filter(Boolean).join(' · ')}
                  </Text>
                  {saving.amount > 0 ? <Text style={styles.save}>{t('psp_save_amt', { amt: `${saving.est ? '~' : ''}${fmtMoney(saving.amount)}` })}</Text> : null}
                </View>
                {onAddRecipe && isFoodDeal(deal) ? (
                  <TouchableOpacity style={[styles.recipeBtn, open?.key === key ? styles.recipeBtnOn : null]} activeOpacity={0.85} onPress={() => findRecipes(deal, key)}>
                    <Text style={styles.recipeBtnText}>{open?.key === key ? t('sale_list_close') : t('sale_list_recipes')}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[styles.btn, done ? styles.btnOn : null]}
                  activeOpacity={0.85}
                  disabled={done}
                  onPress={() => {
                    setAdded((prev) => ({ ...prev, [key]: true }));
                    onAdd?.(deal);
                  }}
                >
                  <Text style={[styles.btnText, done ? styles.btnTextOn : null]}>{done ? t('sale_list_on_list') : t('sale_list_add')}</Text>
                </TouchableOpacity>
              </View>
              {isOpen ? (
                <View style={styles.ideas}>
                  {open.loading ? <ActivityIndicator color={colors?.orange || '#E8742A'} /> : null}
                  {open.failed ? <Text style={styles.sub}>{t('sale_list_recipes_failed')}</Text> : null}
                  {(open.ideas || []).map((idea, i) => (
                    <View key={`${idea.title}-${i}`}>
                      <TouchableOpacity style={styles.ideaRow} activeOpacity={0.85} onPress={() => (open.idea === idea ? setOpen((p) => ({ ...p, idea: null, recipe: null })) : previewIdea(deal, idea))}>
                        <MealPlannerImage title={idea.title} index={i} fallback={<Text style={styles.ideaEmoji}>{idea.emoji || '🍽️'}</Text>} />
                        <View style={styles.ideaText}>
                          <Text style={styles.ideaTitle}>{idea.title}</Text>
                          <Text style={styles.sub}>{[idea.time, idea.why].filter(Boolean).join(' · ')}</Text>
                        </View>
                      </TouchableOpacity>
                      {open.idea === idea ? (
                        <View style={styles.preview}>
                          {open.recipeLoading ? <ActivityIndicator color={colors?.orange || '#E8742A'} /> : null}
                          {open.recipeFailed && !open.recipe ? <Text style={styles.sub}>{t('sale_list_recipes_failed')}</Text> : null}
                          {open.recipe ? (
                            <View>
                              <TouchableOpacity onPress={() => setOpen((p) => ({ ...p, idea: null, recipe: null }))} activeOpacity={0.8} style={{ alignSelf: 'flex-end' }}>
                                <Text style={styles.hideLink}>{t('sale_list_hide_recipe')}</Text>
                              </TouchableOpacity>
                              <MealPlannerImage title={idea.title} index={i} variant="hero" />
                              <Text style={styles.sub}>{[open.recipe.time, open.recipe.difficulty].filter(Boolean).join(' · ')}</Text>
                              {open.recipe.description ? <Text style={styles.previewText}>{open.recipe.description}</Text> : null}
                              {(idea.sides || []).length ? <Text style={[styles.previewText, { fontWeight: '700' }]}>{t('trip_preview_sides', { sides: idea.sides.join(', ') })}</Text> : null}
                              {(open.recipe.ingredients || []).length ? <Text style={[styles.previewText, { fontWeight: '700' }]}>{t('trip_preview_ingredients')}</Text> : null}
                              {(open.recipe.ingredients || []).map((ing, n) => <Text key={`i${n}`} style={styles.previewText}>{`• ${ing}`}</Text>)}
                              {(open.recipe.instructions || []).map((step, n) => <Text key={n} style={styles.previewText}>{`${n + 1}. ${step}`}</Text>)}
                              {onPlanDay ? (
                                <View style={{ marginTop: 10 }}>
                                  <Text style={[styles.previewText, { fontWeight: '700' }]}>{open.plannedDay ? t('sale_list_planned_on', { day: open.plannedDay.label }) : t('sale_list_cook_on')}</Text>
                                  {open.plannedDay ? null : (
                                    <View style={styles.dayRow}>
                                      {buildRollingWeekDateKeys().map((dk) => {
                                        const label = parseDateKey(dk).toLocaleDateString(locale === 'es' ? 'es' : 'en-US', { weekday: 'short', day: 'numeric' });
                                        return (
                                          <TouchableOpacity key={dk} style={styles.dayChip} activeOpacity={0.85} onPress={async () => {
                                            try {
                                              await onPlanDay({ title: open.recipe.title || idea.title, emoji: idea.emoji }, dk);
                                              setOpen((p) => (p ? { ...p, plannedDay: { dk, label } } : p));
                                            } catch (e) {}
                                          }}>
                                            <Text style={styles.dayChipText}>{label}</Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </View>
                                  )}
                                </View>
                              ) : null}
                              {open.reviewing && !open.done ? (
                                <ListAddPreview
                                  lines={planShoppingAdditions([recipeForList()], shoppingItems)}
                                  t={t}
                                  busy={Boolean(open.saving)}
                                  onConfirm={(skip) => addRecipe(deal, skip)}
                                  onCancel={() => setOpen((p) => (p ? { ...p, reviewing: false } : p))}
                                />
                              ) : (
                                <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: 8 }, open.done ? styles.btnOn : null]} disabled={open.done} activeOpacity={0.85} onPress={() => setOpen((p) => (p ? { ...p, reviewing: true } : p))}>
                                  <Text style={[styles.btnText, open.done ? styles.btnTextOn : null]}>{open.done ? t('sale_list_recipe_added') : t('sale_list_recipe_add')}</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E4DCD2',
    borderRadius: radius?.md || 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#2D1B10',
    marginBottom: 6,
  },
  empty: { color: '#7a6d60', fontSize: 13, paddingVertical: 12, textAlign: 'center' },
  group: { marginTop: 8 },
  groupLabel: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#7a6d60', fontWeight: '700', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E4DCD2', gap: 10 },
  rowText: { flex: 1 },
  name: { fontSize: 14, color: '#2D1B10', fontWeight: '600' },
  sub: { fontSize: 12, color: '#7a6d60', marginTop: 1 },
  save: { fontSize: 12, color: '#2F7D4F', fontWeight: '700', marginTop: 1 },
  btn: { backgroundColor: colors?.orange || '#E8742A', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  recipeBtn: { borderWidth: 1, borderColor: colors?.orange || '#E8742A', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  recipeBtnOn: { backgroundColor: '#FFF1E6' },
  recipeBtnText: { color: colors?.orange || '#E8742A', fontSize: 12, fontWeight: '700' },
  ideas: { backgroundColor: '#FBF8F4', borderRadius: 10, padding: 10, marginBottom: 6, gap: 6 },
  ideaRow: { paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 10 },
  ideaText: { flex: 1 },
  ideaEmoji: { fontSize: 26 },
  ideaTitle: { fontSize: 14, fontWeight: '700', color: '#2D1B10' },
  preview: { paddingVertical: 6, paddingLeft: 6, borderLeftWidth: 2, borderLeftColor: '#E4DCD2' },
  previewText: { fontSize: 13, color: '#2D1B10', marginTop: 4, lineHeight: 18 },
  hideLink: { color: colors?.orange || '#E8742A', fontSize: 13, fontWeight: '700', paddingVertical: 4 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  dayChip: { borderWidth: 1, borderColor: '#E4DCD2', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  dayChipText: { fontSize: 13, color: '#2D1B10', fontWeight: '700' },
  btnOn: { backgroundColor: '#E6F1EA' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  btnTextOn: { color: '#2F7D4F' },
});
