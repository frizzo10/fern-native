// ImportScreen.js — Fern Native
// Import a recipe from a URL, a video link, pasted text, or a photo of a
// recipe card. Matches the web app's Import feature (index.html doImport())
// method-for-method -- this is the same feature, just previously missing
// from the native app entirely.

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useLanguage from '../hooks/useLanguage';
import { useSync } from '../hooks/useSync';
import { pickPhotoFromCamera, pickPhotoFromLibrary } from '../services/photoPickerService';
import { fetchRecipeImage } from '../utils/recipeImage';
import SaveToCookbookModal from '../components/modals/SaveToCookbookModal';
import UpgradeGateModal from '../components/UpgradeGateModal';
import useEntitlement from '../hooks/useEntitlement';
import { TIERS } from '../constants/tiers';
import { recipeLimitReached } from '../utils/freeLimits';
import { importFromUrl, importFromVideo, importFromCard, importFromText } from '../services/importService';

const C = {
  forest: '#1C3A1A',
  orange: '#E8651A',
  parch: '#FDFAF6',
  ink: '#1A0E05',
  brown: '#8C7A5F',
  card: '#FFFFFF',
  border: '#E8E0D0',
};

// Ingredients/steps can come back as plain strings or as {amount, unit, item} objects.
const lineText = (x) => {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  return [x.amount, x.unit, x.item || x.name || x.text].filter(Boolean).join(' ');
};

export default function ImportScreen({ user, onBack, onImported }) {
  const { t, locale } = useLanguage();
  const { pushChangedFromStorage, pull, data } = useSync(user);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { hasAccess } = useEntitlement();
  const [limitGate, setLimitGate] = useState(false);
  async function openSavePicker() {
    if (!hasAccess(TIERS.PRO) && (await recipeLimitReached())) { setLimitGate(true); return; }
    setPickerOpen(true);
  }

  const [mode, setMode] = useState('url'); // 'url' | 'video' | 'text' | 'card'
  const [url, setUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [text, setText] = useState('');
  const [cardPhoto, setCardPhoto] = useState(null); // {uri, base64, mimeType}
  const [loading, setLoading] = useState(false);
  const [previewRecipe, setPreviewRecipe] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  async function handleImport() {
    setLoading(true);
    try {
      let recipe;
      if (mode === 'url') {
        if (!url.trim()) return Alert.alert(t('import_enter_url'));
        let u = url.trim();
        if (!u.startsWith('http')) u = 'https://' + u;
        recipe = await importFromUrl(u);
        recipe.sourceUrl = recipe.sourceUrl || u;
      } else if (mode === 'video') {
        if (!videoUrl.trim()) return Alert.alert(t('import_enter_video'));
        let u = videoUrl.trim();
        if (!u.startsWith('http')) u = 'https://' + u;
        recipe = await importFromVideo(u, locale);
        recipe.sourceUrl = recipe.sourceUrl || u;
      } else if (mode === 'card') {
        if (!cardPhoto) return Alert.alert(t('import_take_photo_first'));
        recipe = await importFromCard({ base64: cardPhoto.base64, mimeType: cardPhoto.mimeType, locale });
      } else {
        if (!text.trim()) return Alert.alert(t('import_paste_text'));
        recipe = await importFromText(text.trim(), locale);
      }
      // Photo for the recipe (the web import does the same): keep one the source gave us,
      // else look one up by title. Best-effort; a missing photo never blocks the import.
      if (!recipe.image) {
        const img = await fetchRecipeImage(`${recipe.title || ''} ${recipe.mealType || ''} food`.trim(), user?.token);
        if (img) recipe.image = img;
      }
      setPreviewRecipe(recipe);
    } catch (e) {
      Alert.alert(t('import_failed_title'), e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePickPhoto(fromCamera) {
    const result = fromCamera ? await pickPhotoFromCamera() : await pickPhotoFromLibrary();
    if (result.permissionDenied) {
      Alert.alert(t('import_permission_needed'));
      return;
    }
    if (result.canceled || !result.photo) return;
    setCardPhoto(result.photo);
  }

  // Which cookbook / cuisine / meal type, like the web app's save dialog.
  async function handleSave({ bookId, cuisine, mealType } = {}) {
    if (!previewRecipe) {
      setSaveError('Nothing to save - the recipe was lost. Please scan it again.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const storedSaved = JSON.parse((await AsyncStorage.getItem('rv4_saved')) || '[]');
      const baseSaved = Array.isArray(storedSaved) ? storedSaved : [];
      const updatedSaved = [
        ...baseSaved,
        {
          id: `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: previewRecipe.title,
          emoji: previewRecipe.emoji || '🍽️',
          image: previewRecipe.image || null,
          cuisine: cuisine || previewRecipe.cuisine,
          mealType: mealType || previewRecipe.mealType,
          ...(bookId ? { _bookIds: [bookId] } : {}),
          time: previewRecipe.time,
          difficulty: previewRecipe.difficulty,
          description: previewRecipe.description,
          ingredients: previewRecipe.ingredients || [],
          instructions: previewRecipe.instructions || [],
          servings: previewRecipe.servings || undefined,
          note: previewRecipe.notes || '',
          sourceUrl: previewRecipe.sourceUrl || '',
          photoSearch: previewRecipe.photoSearch || '',
        },
      ];
      await AsyncStorage.setItem('rv4_saved', JSON.stringify(updatedSaved));

      // Push first and CHECK it worked. Pulling after a failed push replaces the
      // phone's list with the server's old one, which silently erased the recipe.
      const pushResult = await pushChangedFromStorage();
      if (!pushResult || pushResult.error) {
        throw new Error(
          (pushResult && pushResult.error) ||
          'Could not reach the server to sync. The recipe is kept on this phone - tap Save again to retry.'
        );
      }
      await pull();

      setPreviewRecipe(null);
      setUrl(''); setVideoUrl(''); setText(''); setCardPhoto(null);
      if (onImported) onImported();
      Alert.alert(t('import_saved_title'));
    } catch (e) {
      // Shown on the page itself: iOS drops an Alert raised right after a Modal closes.
      setSaveError(String((e && e.message) || e));
    } finally {
      setSaving(false);
    }
  }

  // Same look as the More menu: line icons instead of the emoji that the
  // translated labels start with (the labels themselves are unchanged).
  const stripEmoji = (label) => String(label).replace(/^[^\p{L}\p{N}]+/u, '').trim();
  const tabs = [
    { key: 'url', label: stripEmoji(t('import_tab_url')), icon: 'link-outline' },
    { key: 'video', label: stripEmoji(t('import_tab_video')), icon: 'videocam-outline' },
    { key: 'text', label: stripEmoji(t('import_tab_text')), icon: 'document-text-outline' },
    { key: 'card', label: stripEmoji(t('import_tab_scan')), icon: 'camera-outline' },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>{'‹ ' + t('back')}</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('import_page_title')}</Text>
        <View style={{ width: 50 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {previewRecipe ? (
            <View style={s.previewCard}>
              {previewRecipe.image ? (
                <Image source={{ uri: previewRecipe.image }} style={s.previewImg} />
              ) : (
                <Text style={s.previewEmoji}>{previewRecipe.emoji || '🍽️'}</Text>
              )}
              <Text style={s.previewTitle}>{previewRecipe.title}</Text>
              <Text style={s.previewMeta}>
                {[previewRecipe.cuisine, previewRecipe.mealType, previewRecipe.time].filter(Boolean).join(' · ')}
              </Text>
              <Text style={s.previewCount}>
                {(previewRecipe.ingredients || []).length} {t('ingredientsHdr')} · {(previewRecipe.instructions || []).length} {t('instructionsHdr')}
              </Text>
              <Text style={s.listHdr}>{t('ingredientsHdr')}</Text>
              {(previewRecipe.ingredients || []).map((ing, i) => (
                <Text key={`ing-${i}`} style={s.listItem}>• {lineText(ing)}</Text>
              ))}
              <Text style={s.listHdr}>{t('instructionsHdr')}</Text>
              {(previewRecipe.instructions || []).map((step, i) => (
                <Text key={`step-${i}`} style={s.listItem}>{i + 1}. {lineText(step)}</Text>
              ))}
              {previewRecipe.notes ? <Text style={s.listNote}>{previewRecipe.notes}</Text> : null}
              {saveError ? <Text style={s.saveErrorText}>{saveError}</Text> : null}
              <View style={s.previewActions}>
                <TouchableOpacity style={s.discardBtn} onPress={() => setPreviewRecipe(null)} disabled={saving}>
                  <Text style={s.discardBtnText}>{t('discard')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={openSavePicker} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{t('saveToCookbookBtn')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <View style={s.tabs}>
                {tabs.map((tb) => (
                  <TouchableOpacity
                    key={tb.key}
                    style={[s.tab, mode === tb.key && s.tabActive]}
                    onPress={() => setMode(tb.key)}
                  >
                    <Ionicons name={tb.icon} size={20} color={mode === tb.key ? '#F0E0B0' : C.orange} />
                    <Text style={[s.tabText, mode === tb.key && s.tabTextActive]}>{tb.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {mode === 'url' && (
                <>
                  <Text style={s.helper}>{t('import_url_helper')}</Text>
                  <TextInput
                    style={s.input}
                    placeholder={t('import_url_placeholder')}
                    placeholderTextColor={C.brown}
                    value={url}
                    onChangeText={setUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                </>
              )}

              {mode === 'video' && (
                <>
                  <Text style={s.helper}>{t('import_video_helper')}</Text>
                  <TextInput
                    style={s.input}
                    placeholder={t('import_video_placeholder')}
                    placeholderTextColor={C.brown}
                    value={videoUrl}
                    onChangeText={setVideoUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                </>
              )}

              {mode === 'text' && (
                <>
                  <Text style={s.helper}>{t('import_text_helper')}</Text>
                  <TextInput
                    style={[s.input, s.textArea]}
                    placeholder={t('import_text_placeholder')}
                    placeholderTextColor={C.brown}
                    value={text}
                    onChangeText={setText}
                    multiline
                    textAlignVertical="top"
                  />
                </>
              )}

              {mode === 'card' && (
                <>
                  <Text style={s.helper}>{t('import_card_helper')}</Text>
                  {cardPhoto ? (
                    <Image source={{ uri: cardPhoto.uri }} style={s.cardPreviewImg} />
                  ) : (
                    <View style={s.cardPlaceholder}>
                      <Text style={s.cardPlaceholderText}>📷</Text>
                    </View>
                  )}
                  <View style={s.photoBtnRow}>
                    <TouchableOpacity style={s.photoBtn} onPress={() => handlePickPhoto(true)}>
                      <Text style={s.photoBtnText}>{t('takeAPhotoBtn')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.photoBtnOutline} onPress={() => handlePickPhoto(false)}>
                      <Text style={s.photoBtnOutlineText}>{t('uploadFromLibraryBtn')}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <TouchableOpacity style={s.importBtn} onPress={handleImport} disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.importBtnText}>{t('importRecipeBtn')}</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <SaveToCookbookModal
        visible={pickerOpen && !!previewRecipe}
        books={data?.books || []}
        initialCuisine={previewRecipe?.cuisine || ''}
        initialMealType={previewRecipe?.mealType || ''}
        isSaving={saving}
        onCancel={() => setPickerOpen(false)}
        // iOS drops an Alert shown while a Modal is still closing, so close first, then save.
        onSave={(choice) => { setPickerOpen(false); setTimeout(() => handleSave(choice), 450); }}
      />
      <UpgradeGateModal
        visible={limitGate}
        onClose={() => setLimitGate(false)}
        tier={TIERS.PRO}
        title={t('recipe_limit_title')}
        desc={t('recipe_limit_desc')}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  previewImg: { width: '100%', height: 180, borderRadius: 12, marginBottom: 12 },
  safe: { flex: 1, backgroundColor: C.parch },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 50 },
  backText: { color: C.forest, fontSize: 15, fontFamily: 'Jost-SemiBold' },
  headerTitle: { color: C.ink, fontSize: 16, fontFamily: 'Playfair-Bold' },
  content: { padding: 20, paddingBottom: 60 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  tab: {
    width: '48%', minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: '#E6DCCF', backgroundColor: '#FFF',
    paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  tabActive: { backgroundColor: C.forest, borderColor: C.forest },
  tabText: { fontSize: 13, color: '#20140B', fontFamily: 'Jost-Bold' },
  tabTextActive: { color: '#F0E0B0' },
  helper: { color: C.brown, fontSize: 13, fontFamily: 'Jost-Regular', marginBottom: 10, lineHeight: 18 },
  input: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.ink, marginBottom: 16,
  },
  textArea: { minHeight: 140 },
  cardPreviewImg: { width: '100%', height: 220, borderRadius: 12, marginBottom: 12 },
  cardPlaceholder: {
    width: '100%', height: 180, borderRadius: 12, backgroundColor: '#F1EBDD',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  cardPlaceholderText: { fontSize: 40 },
  photoBtnRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  photoBtn: { flex: 1, backgroundColor: C.forest, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  photoBtnText: { color: '#fff', fontFamily: 'Jost-Bold', fontSize: 13 },
  photoBtnOutline: { flex: 1, borderWidth: 1, borderColor: C.forest, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  photoBtnOutlineText: { color: C.forest, fontFamily: 'Jost-Bold', fontSize: 13 },
  importBtn: { backgroundColor: C.orange, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  importBtnText: { color: '#fff', fontFamily: 'Jost-Bold', fontSize: 15 },
  previewCard: {
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    padding: 20, alignItems: 'center',
  },
  previewEmoji: { fontSize: 40, marginBottom: 8 },
  previewTitle: { fontSize: 18, fontFamily: 'Playfair-Bold', color: C.ink, textAlign: 'center', marginBottom: 6 },
  previewMeta: { fontSize: 13, color: C.brown, fontFamily: 'Jost-Medium', marginBottom: 4 },
  listHdr: { alignSelf: 'stretch', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: C.forest, fontFamily: 'Jost-Bold', marginTop: 6, marginBottom: 8 },
  listItem: { alignSelf: 'stretch', fontSize: 15, lineHeight: 22, color: C.ink, fontFamily: 'Jost-Regular', marginBottom: 6 },
  listNote: { alignSelf: 'stretch', fontSize: 13, lineHeight: 19, color: C.brown, fontFamily: 'Jost-Regular', fontStyle: 'italic', marginTop: 6 },
  previewCount: { fontSize: 12, color: C.brown, fontFamily: 'Jost-Regular', marginBottom: 18 },
  previewActions: { flexDirection: 'row', gap: 12, width: '100%' },
  discardBtn: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  discardBtnText: { color: C.brown, fontFamily: 'Jost-SemiBold', fontSize: 13 },
  saveErrorText: { color: '#B8411A', fontFamily: 'Jost-Bold', fontSize: 13, marginTop: 12, textAlign: 'center' },
  saveBtn: { flex: 1, backgroundColor: C.forest, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontFamily: 'Jost-Bold', fontSize: 13 },
});
