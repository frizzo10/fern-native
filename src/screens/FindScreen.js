import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, Modal,
} from 'react-native';
import { colors, radius, shadow } from '../constants/tokens';
import { useSync } from '../hooks/useSync';
import { useTranslation } from '../i18n/LocaleContext';

const AI_URL = 'https://app.clickpickandcook.com/.netlify/functions/ai';

// Build a prompt that asks the model for strict JSON so we can parse it
// reliably — same pattern the web app uses for its AI-generated recipe
// features (see fridge-challenge.js / whats-for-dinner.js system prompts).
function buildSystemPrompt() {
  return `You are Fern, a recipe suggestion engine. Given a craving or ingredient from the user, respond with ONLY a JSON array (no prose, no markdown fences) of 4 recipe objects, each shaped exactly like:
{"title": "string", "description": "one sentence", "minutes": number, "servings": number, "ingredients": ["string", ...], "instructions": ["string", ...]}
Keep ingredients and instructions concise (5-9 ingredients, 4-7 steps). Return valid JSON only.`;
}

function parseRecipes(text) {
  if (!text) return [];
  // The model sometimes wraps JSON in ```json fences despite instructions —
  // strip those defensively before parsing.
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed.filter(r => r && r.title) : [];
  } catch (e) {
    return [];
  }
}

function RecipeCard({ recipe, onPress, t }) {
  return (
    <TouchableOpacity style={[styles.card, shadow.card]} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.cardTitle} numberOfLines={2}>{recipe.title}</Text>
      {recipe.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>{recipe.description}</Text>
      ) : null}
      <View style={styles.cardMetaRow}>
        {recipe.minutes ? <Text style={styles.cardMeta}>⏱ {t('findMinutes', recipe.minutes)}</Text> : null}
        {recipe.servings ? <Text style={styles.cardMeta}>🍽 {t('findServings', recipe.servings)}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

function RecipeDetailModal({ recipe, visible, onClose, onSave, isSaved, t }) {
  if (!recipe) return null;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, shadow.strong]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{recipe.title}</Text>
            {recipe.description ? <Text style={styles.modalDesc}>{recipe.description}</Text> : null}
            <View style={styles.cardMetaRow}>
              {recipe.minutes ? <Text style={styles.cardMeta}>⏱ {t('findMinutes', recipe.minutes)}</Text> : null}
              {recipe.servings ? <Text style={styles.cardMeta}>🍽 {t('findServings', recipe.servings)}</Text> : null}
            </View>

            <Text style={styles.sectionHeader}>{t('findIngredientsHeader')}</Text>
            {(recipe.ingredients || []).map((ing, i) => (
              <Text key={i} style={styles.listItem}>•  {ing}</Text>
            ))}

            <Text style={styles.sectionHeader}>{t('findInstructionsHeader')}</Text>
            {(recipe.instructions || []).map((step, i) => (
              <Text key={i} style={styles.listItem}>{i + 1}.  {step}</Text>
            ))}
          </ScrollView>

          <View style={styles.modalBtnRow}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Text style={styles.modalCloseBtnText}>{t('findCloseBtn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveBtn, isSaved && styles.modalSaveBtnDone]}
              onPress={onSave}
              disabled={isSaved}
            >
              <Text style={styles.modalSaveBtnText}>{isSaved ? t('findSavedBtn') : t('findSaveBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function FindScreen({ user }) {
  const { t, locale } = useTranslation();
  const { data, push } = useSync(user);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(null);
  const [savedTitles, setSavedTitles] = useState(new Set());

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(false);
    setResults([]);
    try {
      const res = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: buildSystemPrompt(),
          messages: [{ role: 'user', content: query.trim() }],
          feature: 'find_recipes',
          locale,
        }),
      });
      const d = await res.json();
      const text = (d.content && d.content[0] && d.content[0].text) || '';
      const recipes = parseRecipes(text);
      if (!recipes.length) { setError(true); return; }
      setResults(recipes);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [query, locale]);

  const saveRecipe = useCallback(async (recipe) => {
    const already = (data.recipes || []).some(r => r.title === recipe.title);
    if (already) return;
    const nextRecipes = [...(data.recipes || []), recipe];
    setSavedTitles(prev => new Set(prev).add(recipe.title));
    await push({ recipes: nextRecipes });
  }, [data.recipes, push]);

  const isRecipeSaved = useCallback((recipe) => {
    return savedTitles.has(recipe.title) || (data.recipes || []).some(r => r.title === recipe.title);
  }, [savedTitles, data.recipes]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t('findSearchPlaceholder')}
          placeholderTextColor={colors.brown}
          onSubmitEditing={search}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={search} activeOpacity={0.8}>
          <Text style={styles.searchBtnText}>🔍</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.forest} size="large" />
          <Text style={styles.stateText}>{t('findLoading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>{t('findErrorTitle')}</Text>
          <Text style={styles.stateText}>{t('findErrorSub')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={search}>
            <Text style={styles.retryBtnText}>{t('findTryAgain')}</Text>
          </TouchableOpacity>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.emptyEmoji}>🌿</Text>
          <Text style={styles.stateTitle}>{t('findEmptyTitle')}</Text>
          <Text style={styles.stateText}>{t('findEmptySub')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.resultsList} showsVerticalScrollIndicator={false}>
          {results.map((r, i) => (
            <RecipeCard key={i} recipe={r} t={t} onPress={() => setSelected(r)} />
          ))}
        </ScrollView>
      )}

      <RecipeDetailModal
        recipe={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
        onSave={() => selected && saveRecipe(selected)}
        isSaved={selected ? isRecipeSaved(selected) : false}
        t={t}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.parch },

  searchRow: { flexDirection: 'row', gap: 10, padding: 16 },
  searchInput: {
    flex: 1, backgroundColor: colors.paper, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, color: colors.ink,
  },
  searchBtn: {
    width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.forest,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBtnText: { fontSize: 18 },

  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 44, marginBottom: 8 },
  stateTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, textAlign: 'center', marginBottom: 6 },
  stateText: { fontSize: 14, color: colors.brown, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  retryBtn: {
    marginTop: 18, backgroundColor: colors.orange, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: radius.full,
  },
  retryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  resultsList: { padding: 16, gap: 12 },
  card: {
    backgroundColor: colors.paper, borderRadius: radius.lg, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: colors.brown, lineHeight: 18, marginBottom: 8 },
  cardMetaRow: { flexDirection: 'row', gap: 14, marginTop: 4 },
  cardMeta: { fontSize: 12, color: colors.bright, fontWeight: '700' },

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
  modalSaveBtn: {
    flex: 1.4, paddingVertical: 13, borderRadius: radius.full, backgroundColor: colors.orange,
    alignItems: 'center',
  },
  modalSaveBtnDone: { backgroundColor: colors.bright },
  modalSaveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
