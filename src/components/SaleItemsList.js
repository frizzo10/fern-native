import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { fetchDealRecipeIdeas, fetchFullRecipeForDealIdea } from '../services/scanCircularService';
import { fetchMealPlanRecipeDetail } from '../services/mealPlanRecipeService';
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
export default function SaleItemsList({ deals, isOnList, onAdd, t, token, locale, onAddRecipe, onPlanDay, shoppingItems, openRequest }) {
  const [query, setQuery] = useState('');
  const [added, setAdded] = useState({});
  const [open, setOpen] = useState(null); // { key, loading, ideas, failed, idea, recipe, recipeLoading, done }
  const [sidePreviews, setSidePreviews] = useState({}); // `${idea.title}::${side}` -> { loading | failed | recipe }
  const [sideAdds, setSideAdds] = useState({}); // `${idea.title}::${side}` -> { reviewing, saving, done }
  const setSideAdd = (k, patch) => setSideAdds((p) => ({ ...p, [k]: { ...(p[k] || {}), ...patch } }));
  const [meal, setMeal] = useState('Dinner'); // which meal "Cook it on" puts the dish in

  // Tap a side to see how to make it (same lookup the Shopping week-of-dinners cards use).
  const previewSide = async (idea, side) => {
    const key = `${idea.title}::${side}`;
    if (sidePreviews[key]) { setSidePreviews((p) => ({ ...p, [key]: undefined })); return; }
    setSidePreviews((p) => ({ ...p, [key]: { loading: true } }));
    try {
      const recipe = await fetchMealPlanRecipeDetail({ title: side, locale, token });
      setSidePreviews((p) => ({ ...p, [key]: { recipe } }));
    } catch (e) {
      setSidePreviews((p) => ({ ...p, [key]: { failed: true } }));
    }
  };

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

  // Fern, in the circular chat: "find a recipe for the Wagyu beef". Narrow the list to that item and open its recipes.
  useEffect(() => {
    const wanted = String(openRequest?.name || '').trim();
    if (!wanted) return;
    const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    const list = dedupeDeals(deals);
    const w = norm(wanted);
    let best = -1;
    let bestScore = 0;
    list.forEach((d, i) => {
      const n = norm(d?.name);
      const score = n.join(' ') === w.join(' ') ? 1000 : n.filter((x) => w.includes(x)).length;
      if (score > bestScore) { best = i; bestScore = score; }
    });
    if (best < 0) return;
    const deal = list[best];
    setQuery(String(deal.name || '').trim());
    findRecipes(deal, `${String(deal?.name || '').trim()}-${deal?.store || ''}-${best}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest?.nonce]);

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
                              {(idea.sides || []).length ? <Text style={[styles.previewText, { fontWeight: '700' }]}>{t('trip_preview_sides_label')}</Text> : null}
                              {(idea.sides || []).map((side, si) => {
                                const sp = sidePreviews[`${idea.title}::${side}`];
                                return (
                                  <View key={`side-${si}`}>
                                    <TouchableOpacity onPress={() => previewSide(idea, side)} activeOpacity={0.8}>
                                      <Text style={[styles.previewText, { marginTop: 4, textDecorationLine: 'underline', color: colors?.orange || '#E8742A' }]}>{`${sp ? '▾' : '▸'} ${side}`}</Text>
                                    </TouchableOpacity>
                                    {sp?.loading ? <ActivityIndicator color={colors?.orange || '#E8742A'} style={{ marginTop: 4, alignSelf: 'flex-start' }} /> : null}
                                    {sp?.failed ? <Text style={styles.sub}>{t('sale_list_recipes_failed')}</Text> : null}
                                    {sp?.recipe ? (
                                      <View style={{ marginLeft: 8 }}>
                                        <Text style={styles.sub}>{[sp.recipe.time, sp.recipe.servings ? t('trip_side_servings', { n: sp.recipe.servings }) : ''].filter(Boolean).join(' · ')}</Text>
                                        {(sp.recipe.ingredients || []).map((ing, n) => <Text key={`si${n}`} style={styles.previewText}>{`• ${ing}`}</Text>)}
                                        {(sp.recipe.directions || []).map((st, n) => <Text key={`sd${n}`} style={styles.previewText}>{`${n + 1}. ${st}`}</Text>)}
                                        {(() => {
                                          const sk = `${idea.title}::${side}`;
                                          const sa = sideAdds[sk] || {};
                                          const sideList = { title: side, ingredients: sp.recipe.ingredients || [] };
                                          return sa.reviewing && !sa.done ? (
                                            <ListAddPreview
                                              lines={planShoppingAdditions([sideList], shoppingItems)}
                                              t={t}
                                              busy={Boolean(sa.saving)}
                                              onConfirm={async (skip) => {
                                                setSideAdd(sk, { saving: true });
                                                try {
                                                  await onAddRecipe?.(sideList, deal, { skip });
                                                  setSideAdd(sk, { done: true, saving: false, reviewing: false });
                                                } catch (e) { setSideAdd(sk, { saving: false }); }
                                              }}
                                              onCancel={() => setSideAdd(sk, { reviewing: false })}
                                            />
                                          ) : (
                                            <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: 8 }, sa.done ? styles.btnOn : null]} disabled={Boolean(sa.done)} activeOpacity={0.85} onPress={() => setSideAdd(sk, { reviewing: true })}>
                                              <Text style={[styles.btnText, sa.done ? styles.btnTextOn : null]}>{sa.done ? t('sale_list_recipe_added') : t('sale_list_recipe_add')}</Text>
                                            </TouchableOpacity>
                                          );
                                        })()}
                                      </View>
                                    ) : null}
                                  </View>
                                );
                              })}
                              {(open.recipe.ingredients || []).length ? <Text style={[styles.previewText, { fontWeight: '700' }]}>{t('trip_preview_ingredients')}</Text> : null}
                              {(open.recipe.ingredients || []).map((ing, n) => <Text key={`i${n}`} style={styles.previewText}>{`• ${ing}`}</Text>)}
                              {(open.recipe.instructions || []).map((step, n) => <Text key={n} style={styles.previewText}>{`${n + 1}. ${step}`}</Text>)}
                              {onPlanDay ? (
                                <View style={{ marginTop: 10 }}>
                                  <Text style={[styles.previewText, { fontWeight: '700' }]}>{open.plannedDay ? t('sale_list_planned_on', { day: open.plannedDay.label }) : t('sale_list_cook_on')}</Text>
                                  {open.plannedDay ? null : (
                                    <View style={styles.dayRow}>
                                      {[['Breakfast', 'meal_planner_slot_breakfast'], ['Lunch', 'meal_planner_slot_lunch'], ['Dinner', 'meal_planner_slot_dinner']].map(([slot, key]) => (
                                        <TouchableOpacity key={slot} style={[styles.dayChip, meal === slot ? styles.mealChipOn : null]} activeOpacity={0.85} onPress={() => setMeal(slot)}>
                                          <Text style={[styles.dayChipText, meal === slot ? { color: '#fff' } : null]}>{t(key)}</Text>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  )}
                                  {open.plannedDay ? null : (
                                    <View style={styles.dayRow}>
                                      {buildRollingWeekDateKeys().map((dk) => {
                                        const label = parseDateKey(dk).toLocaleDateString(locale === 'es' ? 'es' : 'en-US', { weekday: 'short', day: 'numeric' });
                                        return (
                                          <TouchableOpacity key={dk} style={styles.dayChip} activeOpacity={0.85} onPress={async () => {
                                            try {
                                              await onPlanDay({ title: open.recipe.title || idea.title, emoji: idea.emoji, slot: meal, sides: idea.sides || [] }, dk);
                                              setOpen((p) => (p ? { ...p, plannedDay: { dk, label: `${label} · ${t(`meal_planner_slot_${meal.toLowerCase()}`)}` } } : p));
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
  mealChipOn: { backgroundColor: '#2D1B10', borderColor: '#2D1B10' },
  dayChipText: { fontSize: 13, color: '#2D1B10', fontWeight: '700' },
  btnOn: { backgroundColor: '#E6F1EA' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  btnTextOn: { color: '#2F7D4F' },
});
