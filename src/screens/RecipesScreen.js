import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, Modal, Alert,
} from 'react-native';
import { colors, radius, shadow } from '../constants/tokens';
import { useSync } from '../hooks/useSync';
import { useTranslation } from '../i18n/LocaleContext';

function RecipeRow({ recipe, onPress, t }) {
  return (
    <TouchableOpacity style={[styles.row, shadow.card]} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.rowTitle} numberOfLines={2}>{recipe.title}</Text>
      <View style={styles.rowMetaRow}>
        {recipe.minutes ? <Text style={styles.rowMeta}>⏱ {t('findMinutes', recipe.minutes)}</Text> : null}
        {recipe.servings ? <Text style={styles.rowMeta}>🍽 {t('findServings', recipe.servings)}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export default function RecipesScreen({ user }) {
  const { t } = useTranslation();
  const { data, push } = useSync(user);
  const [selected, setSelected] = useState(null);
  const [addedToShopping, setAddedToShopping] = useState(false);

  const recipes = data.recipes || [];

  const openRecipe = useCallback((recipe) => {
    setSelected(recipe);
    setAddedToShopping(false);
  }, []);

  const addIngredientsToShopping = useCallback(async () => {
    if (!selected) return;
    const existing = (data.shopping || []);
    const existingLower = new Set(existing.map(i => (typeof i === 'string' ? i : (i.name || '')).toLowerCase().trim()));
    const toAdd = (selected.ingredients || []).filter(
      ing => typeof ing === 'string' && !existingLower.has(ing.toLowerCase().trim())
    );
    if (!toAdd.length) { setAddedToShopping(true); return; }
    await push({ shopping: [...existing, ...toAdd] });
    setAddedToShopping(true);
  }, [selected, data.shopping, push]);

  const removeRecipe = useCallback((recipe) => {
    Alert.alert(
      t('removeConfirmTitle'),
      t('removeConfirmSub'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirmRemove'),
          style: 'destructive',
          onPress: async () => {
            const next = recipes.filter(r => r !== recipe);
            await push({ recipes: next });
            if (selected === recipe) setSelected(null);
          },
        },
      ]
    );
  }, [recipes, push, selected, t]);

  return (
    <SafeAreaView style={styles.container}>
      {recipes.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyEmoji}>📖</Text>
          <Text style={styles.stateTitle}>{t('myRecipesEmptyTitle')}</Text>
          <Text style={styles.stateText}>{t('myRecipesEmptySub')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {recipes.map((r, i) => (
            <RecipeRow key={i} recipe={r} t={t} onPress={() => openRecipe(r)} />
          ))}
        </ScrollView>
      )}

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          {selected ? (
            <View style={[styles.modalCard, shadow.strong]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>{selected.title}</Text>
                {selected.description ? <Text style={styles.modalDesc}>{selected.description}</Text> : null}
                <View style={styles.rowMetaRow}>
                  {selected.minutes ? <Text style={styles.rowMeta}>⏱ {t('findMinutes', selected.minutes)}</Text> : null}
                  {selected.servings ? <Text style={styles.rowMeta}>🍽 {t('findServings', selected.servings)}</Text> : null}
                </View>

                <Text style={styles.sectionHeader}>{t('findIngredientsHeader')}</Text>
                {(selected.ingredients || []).map((ing, i) => (
                  <Text key={i} style={styles.listItem}>•  {ing}</Text>
                ))}

                <Text style={styles.sectionHeader}>{t('findInstructionsHeader')}</Text>
                {(selected.instructions || []).map((step, i) => (
                  <Text key={i} style={styles.listItem}>{i + 1}.  {step}</Text>
                ))}
              </ScrollView>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.modalCloseBtnText}>{t('findCloseBtn')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalAddBtn, addedToShopping && styles.modalAddBtnDone]}
                  onPress={addIngredientsToShopping}
                  disabled={addedToShopping}
                >
                  <Text style={styles.modalAddBtnText}>
                    {addedToShopping ? t('addedToShoppingBtn') : t('addToShoppingBtn')}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.removeLink} onPress={() => removeRecipe(selected)}>
                <Text style={styles.removeLinkText}>{t('removeBtn')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.parch },

  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 44, marginBottom: 8 },
  stateTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, textAlign: 'center', marginBottom: 6 },
  stateText: { fontSize: 14, color: colors.brown, textAlign: 'center', lineHeight: 20 },

  list: { padding: 16, gap: 12 },
  row: {
    backgroundColor: colors.paper, borderRadius: radius.lg, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  rowTitle: { fontSize: 16, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  rowMetaRow: { flexDirection: 'row', gap: 14, marginTop: 4 },
  rowMeta: { fontSize: 12, color: colors.bright, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,14,5,0.55)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.parch, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: 22, maxHeight: '85%',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  modalDesc: { fontSize: 14, color: colors.brown, lineHeight: 20, marginBottom: 8 },
  sectionHeader: {
    fontSize: 13, fontWeight: '800', color: colors.forest, textTransform: 'uppercase',
    letterSpacing: 0.5, marginTop: 18, marginBottom: 8,
  },
  listItem: { fontSize: 14, color: colors.ink, lineHeight: 21 },

  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalCloseBtn: {
    flex: 1, paddingVertical: 13, borderRadius: radius.full, borderWidth: 1.5,
    borderColor: colors.border, alignItems: 'center',
  },
  modalCloseBtnText: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  modalAddBtn: {
    flex: 1.6, paddingVertical: 13, borderRadius: radius.full, backgroundColor: colors.orange,
    alignItems: 'center',
  },
  modalAddBtnDone: { backgroundColor: colors.bright },
  modalAddBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  removeLink: { alignItems: 'center', marginTop: 14, paddingBottom: 4 },
  removeLinkText: { color: colors.voiceRed, fontWeight: '700', fontSize: 13 },
});
