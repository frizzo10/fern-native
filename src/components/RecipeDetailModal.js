import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRecipePhoto } from './RecipePhoto';
import { trackEvent } from '../services/track';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getDifficultyLevel } from '../utils/recipeNormalize';
import useLanguage from '../hooks/useLanguage';
import { pickPhotoFromCamera, pickPhotoFromLibrary } from '../services/photoPickerService';
import { uploadPhoto } from '../services/uploadPhotoService';
import { createRecipeShareLink } from '../services/shareService';
import { translateRecipes } from '../services/translateService';
import ScaleRecipeModal from './modals/ScaleRecipeModal';
import RecipeWinePairingModal from './modals/RecipeWinePairingModal';
import RecipePlatingCoachModal from './modals/RecipePlatingCoachModal';
import CookModeModal from './modals/CookModeModal';
import SaveToCookbookModal from './modals/SaveToCookbookModal';
import IngredientSubstitutionModal from './modals/IngredientSubstitutionModal';
import UpgradeGateModal from './UpgradeGateModal';
import { ListAddPreviewBody } from './ListAddPreview';
import { planShoppingAdditions, setPendingSkip } from '../utils/shoppingListSync';
import AlexaHint from './AlexaHint';
import { copyAlexaPhrase } from '../services/alexaPromo';
import useEntitlement from '../hooks/useEntitlement';
import { TIERS } from '../constants/tiers';
import { recipeLimitReached } from '../utils/freeLimits';

export default function RecipeDetailModal({
  recipe,
  onClose,
  noteText,
  onChangeNoteText,
  isSaving,
  onSaveNote,
  onSaveCopy,
  isAlreadySaved = true,
  showSavedIndicator = false,
  onDeleteRecipe,
  onAddToList,
  onSaveEdits,
  onUpdateImage,
  onSetPhotos,
  books,
  onSaveToCookbook,
  user,
}) {
  const { t } = useLanguage();
  const photoUrl = useRecipePhoto(recipe?.title, recipe?.image);
  // Reader text size for ingredients + method (A-/A+ buttons). Device-only, remembered.
  const [textLevel, setTextLevel] = useState(0);
  useEffect(() => {
    AsyncStorage.getItem(TEXT_LEVEL_KEY).then((v) => {
      const n = parseInt(v, 10);
      if (n >= 0 && n < TEXT_SCALES.length) setTextLevel(n);
    }).catch(() => {});
  }, []);
  const changeTextLevel = (delta) => {
    const next = Math.max(0, Math.min(TEXT_SCALES.length - 1, textLevel + delta));
    setTextLevel(next);
    AsyncStorage.setItem(TEXT_LEVEL_KEY, String(next)).catch(() => {});
  };
  const textScale = TEXT_SCALES[textLevel];
  const [photoTrace, setPhotoTrace] = useState([]);
  const tr = (m) => setPhotoTrace((a) => [...a.slice(-7), m]);
  const [isScaleModalVisible, setIsScaleModalVisible] = useState(false);
  const [isWinePairingVisible, setIsWinePairingVisible] = useState(false);
  const [isPlatingCoachVisible, setIsPlatingCoachVisible] = useState(false);
  const [isCookModeVisible, setIsCookModeVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [isSavingEdits, setIsSavingEdits] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSaveToCookbookVisible, setIsSaveToCookbookVisible] = useState(false);
  const [isSavingToCookbook, setIsSavingToCookbook] = useState(false);
  const [substitutionIngredient, setSubstitutionIngredient] = useState(null);
  const [substitutionIdx, setSubstitutionIdx] = useState(-1);
  // Ingredient lines the user swapped from the substitutions sheet, by index. Shown right away;
  // also saved into the recipe when this screen allows edits (onSaveEdits).
  const [ingredientOverrides, setIngredientOverrides] = useState({});
  useEffect(() => { setIngredientOverrides({}); }, [recipe?.id, recipe?.title]);
  useEffect(() => { if (recipe?.title) trackEvent('recipe_view', recipe.title); }, [recipe?.id, recipe?.title]);
  const [isSharing, setIsSharing] = useState(false);

  const handleSubstitute = async (sub) => {
    const idx = substitutionIdx;
    const name = String(sub?.name || '').trim();
    if (idx < 0 || !name) return;
    const amount = String(sub?.amount || '').trim();
    // Use the amount only when it reads like a quantity ("1 cup", "1/2 tsp"); "same amount" etc. is dropped.
    const line = /^[\d½¼¾⅓⅔]/.test(amount) ? `${amount} ${name}` : name;
    const nextOverrides = { ...ingredientOverrides, [idx]: line };
    setIngredientOverrides(nextOverrides);
    setSubstitutionIngredient(null);
    setSubstitutionIdx(-1);
    if (onSaveEdits) {
      try {
        await onSaveEdits({
          title: (recipe.title || '').trim(),
          category: (recipe.category || '').trim(),
          meal: (recipe.meal || '').trim(),
          time: String(recipe.time || '').trim(),
          difficulty: (recipe.difficulty || '').trim(),
          description: (recipe.description || '').trim(),
          servings: String(recipe.servings ?? '').trim(),
          ingredients: (recipe.ingredients || []).map((ing, i) => (nextOverrides[i] ?? ing)),
          methodSteps: recipe.methodSteps || [],
        });
      } catch (e) {
        console.warn('Save substitution failed:', e);
        setTimeout(() => Alert.alert(t('substitution_swapped_title'), t('substitution_save_failed')), 300);
        return;
      }
    }
    setTimeout(() => Alert.alert(t('substitution_swapped_title'), t('substitution_swapped_desc', { item: line })), 300);
  };

  const handleClose = () => {
    setSubstitutionIdx(-1);
    setIsScaleModalVisible(false);
    setIsWinePairingVisible(false);
    setIsPlatingCoachVisible(false);
    setIsCookModeVisible(false);
    setSubstitutionIngredient(null);
    setIsEditMode(false);
    setEditForm(null);
    setIsSaveToCookbookVisible(false);
    onClose();
  };

  // Creates a hosted share link (same `share` function the web app uses) and
  // hands it to the OS share sheet. No second <Modal> here on purpose —
  // nesting one inside this Modal is what broke touch handling on iOS before.
  const doShareRecipe = async (lang) => {
    if (isSharing || !recipe) return;
    setIsSharing(true);
    try {
      // Spanish: only the shared copy is translated; the saved recipe is untouched.
      const toShare = lang === 'es' ? (await translateRecipes([recipe], 'es', user?.token))[0] : recipe;
      const url = await createRecipeShareLink({ recipe: toShare, senderName: user?.name || '', message: '', token: user?.token });
      // iOS: share the bare link (same as cookbooks) so it stays a tappable
      // link when pasted; "Title: url" got pasted into Google as a search.
      if (Platform.OS === 'ios') await Share.share({ url });
      else await Share.share({ message: `${toShare.title}\n${url}` });
    } catch (e) {
      console.warn('Share recipe failed:', e);
      Alert.alert(t('share_link_error_title'), t('share_link_error'));
    } finally {
      setIsSharing(false);
    }
  };

  // Asks the language first with a native Alert (not a second Modal, see above).
  const handleShareRecipe = () => {
    if (isSharing || !recipe) return;
    Alert.alert(t('share_recipe_lang_title'), '', [
      { text: t('share_lang_orig'), onPress: () => doShareRecipe('') },
      { text: t('share_lang_es'), onPress: () => doShareRecipe('es') },
      { text: t('cancel_btn'), style: 'cancel' },
    ]);
  };

  // Free plan: a recipe that isn't saved yet can't be added once the box holds 20.
  const { hasAccess } = useEntitlement();
  const [limitGate, setLimitGate] = useState(false);
  // "List" button: show which ingredients will be added (un-tick what you already have) before anything is written.
  const [listReview, setListReview] = useState(null); // lines, or null
  const [listBusy, setListBusy] = useState(false);
  const openListReview = async () => {
    const ingredients = (Array.isArray(recipe?.ingredients) ? recipe.ingredients : []).map((ing, idx) => ingredientOverrides[idx] ?? ing);
    if (!ingredients.length) { onAddToList?.(); return; }
    let existing = [];
    try { existing = JSON.parse((await AsyncStorage.getItem('rv4_master_shop')) || '[]'); } catch (e) { existing = []; }
    setListReview(planShoppingAdditions([{ id: recipe?.id, title: recipe?.title, ingredients }], existing));
  };
  const confirmListReview = async (skip) => {
    if (listBusy) return;
    setListBusy(true);
    try {
      setPendingSkip(skip);
      await Promise.resolve(onAddToList?.());
    } finally {
      setPendingSkip(null);
      setListBusy(false);
      setListReview(null);
    }
  };
  useEffect(() => { setListReview(null); }, [recipe?.id, recipe?.title]);
  const blockedByLimit = async () => {
    if (isAlreadySaved || hasAccess(TIERS.PRO)) return false;
    if (!(await recipeLimitReached())) return false;
    setLimitGate(true);
    return true;
  };
  const guardedSaveNote = async () => {
    if (await blockedByLimit()) return;
    if (!isAlreadySaved) { onSaveNote?.(); return; }
    // Already saved: Save never silently adds a duplicate. Ask what to do (a copy is
    // only offered where the screen supplies onSaveCopy), otherwise just explain.
    const updateNote = () => {
      onSaveNote?.();
      // Delayed because iOS drops an Alert shown while a modal is still dismissing.
      setTimeout(() => Alert.alert(t('already_saved_title'), t('already_saved_note_updated')), 600);
    };
    if (!onSaveCopy) { updateNote(); return; }
    Alert.alert(t('already_saved_title'), t('already_saved_ask_copy'), [
      {
        text: t('save_second_copy_btn'),
        onPress: async () => {
          const ok = await onSaveCopy();
          if (ok) setTimeout(() => Alert.alert(t('copy_saved_title'), t('copy_saved_desc')), 400);
        },
      },
      { text: t('update_note_only_btn'), onPress: updateNote },
      { text: t('cancel_btn'), style: 'cancel' },
    ]);
  };

  const handleOpenSaveToCookbook = async () => {
    if (!onSaveToCookbook) return;
    if (await blockedByLimit()) return;
    setIsSaveToCookbookVisible(true);
  };

  const handleConfirmSaveToCookbook = async (selection) => {
    setIsSavingToCookbook(true);
    try {
      await onSaveToCookbook(selection);
      setIsSaveToCookbookVisible(false);
    } catch (e) {
      console.warn('Save to cookbook failed:', e);
    } finally {
      setIsSavingToCookbook(false);
    }
  };

  const handleToggleEdit = () => {
    if (!onSaveEdits) return;
    if (!isEditMode) {
      setEditForm({
        title: recipe.title || '',
        category: recipe.category || '',
        meal: recipe.meal || '',
        time: recipe.time || '',
        difficulty: recipe.difficulty || '',
        description: recipe.description || '',
        servings: String(recipe.servings ?? ''),
        ingredientsText: (recipe.ingredients || []).join('\n'),
        methodStepsText: (recipe.methodSteps || []).join('\n'),
      });
      setIsEditMode(true);
    } else {
      setIsEditMode(false);
      setEditForm(null);
    }
  };

  const updateEditField = (field, value) => {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSaveEdits = async () => {
    if (!onSaveEdits || !editForm) return;
    setIsSavingEdits(true);
    try {
      await onSaveEdits({
        title: editForm.title.trim(),
        category: editForm.category.trim(),
        meal: editForm.meal.trim(),
        time: editForm.time.trim(),
        difficulty: editForm.difficulty.trim(),
        description: editForm.description.trim(),
        servings: editForm.servings.trim(),
        ingredients: editForm.ingredientsText.split('\n').map((line) => line.trim()).filter(Boolean),
        methodSteps: editForm.methodStepsText.split('\n').map((line) => line.trim()).filter(Boolean),
      });
      setIsEditMode(false);
      setEditForm(null);
    } catch (e) {
      console.warn('Save recipe edits failed:', e);
      Alert.alert(t('recipe_edit_save_failed_title'), t('recipe_edit_save_failed_desc'));
    } finally {
      setIsSavingEdits(false);
    }
  };

  const uploadAndSetRecipeImage = async (pickerResult) => {
    tr(`6. pick returned: canceled=${pickerResult?.canceled} denied=${pickerResult?.permissionDenied} base64=${pickerResult?.photo?.base64 ? Math.round(pickerResult.photo.base64.length / 1024) + 'KB' : 'NONE'} w=${pickerResult?.photo?.width}`);
    const why = (m) => Alert.alert(t('recipe_image_update_failed_title'), `${t('recipe_image_update_failed_desc')}\n\n${m}`);
    if (!pickerResult) return why('The photo picker gave no answer.');
    if (pickerResult.permissionDenied) return why('Photo permission is off. Turn it on in Settings > Fern.');
    if (pickerResult.canceled) return;
    if (!pickerResult.photo?.base64) return why('The picked photo had no picture data (try another photo, or take a new one).');
    setIsUploadingImage(true);
    try {
      const dataUri = `data:${pickerResult.photo.mimeType || 'image/jpeg'};base64,${pickerResult.photo.base64}`;
      tr('7. uploading...');
      const url = await uploadPhoto(dataUri, `recipe_${recipe.id}_${Date.now()}.jpg`);
      tr(`8. upload answer: ${url ? 'got link' : 'NO LINK'}`);
      if (url) { await onUpdateImage(url); tr('9. saved to recipe + pushed'); }
    } catch (e) {
      tr(`X. error: ${String(e?.message || e)}`);
      console.warn('Recipe image upload failed:', e);
      Alert.alert(t('recipe_image_update_failed_title'), `${t('recipe_image_update_failed_desc')}\n\n${String(e?.message || e)}`);
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Tap a photo in the row: make it the main one, or remove it.
  const handlePhotoMenu = (photoIdx) => {
    const list = Array.isArray(recipe?.photos) ? recipe.photos : [];
    if (!onSetPhotos || !list[photoIdx]) return;
    const buttons = [];
    if (photoIdx > 0) {
      buttons.push({
        text: t('photo_make_main'),
        onPress: () => onSetPhotos([list[photoIdx], ...list.filter((_, i) => i !== photoIdx)]),
      });
    }
    buttons.push({
      text: t('photo_remove'),
      style: 'destructive',
      onPress: () => onSetPhotos(list.filter((_, i) => i !== photoIdx)),
    });
    buttons.push({ text: t('cancel_btn'), style: 'cancel' });
    Alert.alert(t('photo_menu_title'), '', buttons);
  };

  const handlePickRecipeImage = () => {
    tr(`0. camera box tapped (onUpdateImage=${!!onUpdateImage}, uploading=${isUploadingImage})`);
    if (!onUpdateImage || isUploadingImage) return;
    Alert.alert(
      t('recipe_image_picker_title'),
      '',
      [
        { text: t('take_photo_btn'), onPress: () => pickPhotoFromCamera({ maxWidth: 1600, quality: 0.6, onStage: tr }).then(uploadAndSetRecipeImage).catch((e) => { tr(`X. picker error: ${String(e?.message || e)}`); Alert.alert(t('recipe_image_update_failed_title'), String(e?.message || e)); }) },
        { text: t('upload_image_btn'), onPress: () => pickPhotoFromLibrary({ maxWidth: 1600, quality: 0.6, onStage: tr }).then(uploadAndSetRecipeImage).catch((e) => { tr(`X. picker error: ${String(e?.message || e)}`); Alert.alert(t('recipe_image_update_failed_title'), String(e?.message || e)); }) },
        { text: t('cancel_btn'), style: 'cancel' },
      ]
    );
  };
  return (
    <Modal
      visible={!!recipe}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlayBackdrop}>
        <TouchableOpacity
          style={styles.overlayBackdropTap}
          activeOpacity={1}
          onPress={handleClose}
        />

        {recipe ? (
          <KeyboardAvoidingView
            style={styles.overlaySheetKeyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <View style={styles.overlaySheet}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                contentContainerStyle={styles.overlayContent}
              >
                <View style={styles.overlayImageWrap}>
                  <ImageBackground
                    source={photoUrl ? { uri: photoUrl } : require('../../assets/icon.png')}
                    style={styles.overlayImage}
                    imageStyle={styles.overlayImageInner}
                  />

                  <TouchableOpacity
                    style={styles.overlayCloseBtn}
                    onPress={handleClose}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.overlayCloseBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.overlayBody}>
                  <Text style={styles.overlayFoodEmoji}>{recipe.emoji}</Text>

                  {isEditMode ? (
                    <TextInput
                      value={editForm?.title}
                      onChangeText={(v) => updateEditField('title', v)}
                      style={styles.overlayTitleInput}
                      placeholder={t('edit_recipe_title_label')}
                      placeholderTextColor="#A9A9A9"
                    />
                  ) : (
                    <Text style={styles.overlayTitle}>{recipe.title}</Text>
                  )}

                  {isEditMode ? (
                    <View style={styles.editFieldsGrid}>
                      <View style={styles.editFieldCol}>
                        <Text style={styles.editFieldLabel}>{t('edit_recipe_cuisine_label')}</Text>
                        <TextInput
                          value={editForm?.category}
                          onChangeText={(v) => updateEditField('category', v)}
                          style={styles.editFieldInput}
                          placeholderTextColor="#A9A9A9"
                        />
                      </View>
                      <View style={styles.editFieldCol}>
                        <Text style={styles.editFieldLabel}>{t('edit_recipe_meal_label')}</Text>
                        <TextInput
                          value={editForm?.meal}
                          onChangeText={(v) => updateEditField('meal', v)}
                          style={styles.editFieldInput}
                          placeholderTextColor="#A9A9A9"
                        />
                      </View>
                      <View style={styles.editFieldCol}>
                        <Text style={styles.editFieldLabel}>{t('edit_recipe_time_label')}</Text>
                        <TextInput
                          value={editForm?.time}
                          onChangeText={(v) => updateEditField('time', v)}
                          style={styles.editFieldInput}
                          placeholderTextColor="#A9A9A9"
                        />
                      </View>
                      <View style={styles.editFieldCol}>
                        <Text style={styles.editFieldLabel}>{t('edit_recipe_difficulty_label')}</Text>
                        <TextInput
                          value={editForm?.difficulty}
                          onChangeText={(v) => updateEditField('difficulty', v)}
                          style={styles.editFieldInput}
                          placeholderTextColor="#A9A9A9"
                        />
                      </View>
                      <View style={styles.editFieldCol}>
                        <Text style={styles.editFieldLabel}>{t('edit_recipe_servings_label')}</Text>
                        <TextInput
                          value={editForm?.servings}
                          onChangeText={(v) => updateEditField('servings', v)}
                          style={styles.editFieldInput}
                          keyboardType="numeric"
                          placeholderTextColor="#A9A9A9"
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.overlayMetaRow}>
                      <Text style={styles.overlayMetaText}>🌍 {recipe.category}</Text>
                      <Text style={styles.overlayMetaText}>🍽 {recipe.meal}</Text>
                      {recipe.time ? <Text style={styles.overlayMetaText}>⏱ {recipe.time}</Text> : null}

                      <View style={styles.overlayDifficultyPill}>
                        {Array.from({ length: 3 }, (_, i) => {
                          const dotIdx = i + 1;
                          const isFilled = dotIdx <= getDifficultyLevel(recipe.difficulty);
                          return (
                            <View
                              key={`detail-dot-${dotIdx}`}
                              style={[
                                styles.difficultyDot,
                                isFilled ? styles.difficultyDotFilled : styles.difficultyDotEmpty,
                              ]}
                            />
                          );
                        })}
                        <Text style={styles.overlayDifficultyText}>{recipe.difficulty}</Text>
                      </View>
                    </View>
                  )}

                  {showSavedIndicator && isAlreadySaved ? (
                    <Text style={styles.alreadySavedText}>{t('already_saved_indicator')}</Text>
                  ) : null}

                  <View style={styles.overlayDivider} />

                  {isEditMode ? (
                    <View style={styles.editFieldFull}>
                      <Text style={styles.editFieldLabel}>{t('edit_recipe_description_label')}</Text>
                      <TextInput
                        multiline
                        value={editForm?.description}
                        onChangeText={(v) => updateEditField('description', v)}
                        style={[styles.editFieldInput, styles.editFieldInputMultiline]}
                        placeholderTextColor="#A9A9A9"
                      />
                    </View>
                  ) : (
                    <View style={styles.overlayDescriptionCard}>
                      <Text style={styles.overlayDescriptionText}>{recipe.description}</Text>
                    </View>
                  )}

                  {photoTrace.length > 0 ? (
                    <View style={{ backgroundColor: '#000', padding: 8, borderRadius: 8, marginTop: 10 }}>
                      {photoTrace.map((m, i) => (
                        <Text key={i} style={{ color: '#7CFC9A', fontSize: 11 }}>{m}</Text>
                      ))}
                    </View>
                  ) : null}
                  <View style={styles.overlayThumbsRow}>
                    {Array.isArray(recipe?.photos) && recipe.photos.length > 0 ? (
                      recipe.photos.map((uri, photoIdx) => (
                        <TouchableOpacity
                          key={`recipe-photo-${photoIdx}`}
                          activeOpacity={onSetPhotos ? 0.7 : 1}
                          disabled={!onSetPhotos}
                          onPress={() => handlePhotoMenu(photoIdx)}
                        >
                          <ImageBackground
                            source={{ uri }}
                            style={styles.overlayThumbImage}
                            imageStyle={styles.overlayThumbImageInner}
                          >
                            {photoIdx === 0 && recipe.photos.length > 1 ? (
                              <View style={styles.photoMainTag}>
                                <Text style={styles.photoMainTagText}>{t('photo_main_tag')}</Text>
                              </View>
                            ) : null}
                            {onSetPhotos ? (
                              <View style={styles.photoMoreBtn}>
                                <Text style={styles.photoMoreBtnText}>⋯</Text>
                              </View>
                            ) : null}
                          </ImageBackground>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <ImageBackground
                        source={photoUrl ? { uri: photoUrl } : require('../../assets/icon.png')}
                        style={styles.overlayThumbImage}
                        imageStyle={styles.overlayThumbImageInner}
                      />
                    )}
                    <TouchableOpacity
                      style={styles.overlayCameraPlaceholder}
                      activeOpacity={onUpdateImage ? 0.7 : 1}
                      onPress={handlePickRecipeImage}
                      disabled={!onUpdateImage}
                    >
                      {isUploadingImage ? (
                        <ActivityIndicator color="#8A5A5C" />
                      ) : (
                        <Text style={styles.overlayCameraIcon}>📷</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {onSetPhotos && Array.isArray(recipe?.photos) && recipe.photos.length > 0 ? (
                    <Text style={styles.photoHint}>{t('photo_hint')}</Text>
                  ) : null}

                  <View style={styles.textSizeRow}>
                    <TouchableOpacity
                      style={[styles.textSizeBtn, textLevel === 0 ? styles.textSizeBtnOff : null]}
                      onPress={() => changeTextLevel(-1)}
                      disabled={textLevel === 0}
                      accessibilityLabel={t('text_smaller_a11y')}
                    >
                      <Text style={styles.textSizeBtnTextSmall}>A</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.textSizeBtn, textLevel === TEXT_SCALES.length - 1 ? styles.textSizeBtnOff : null]}
                      onPress={() => changeTextLevel(1)}
                      disabled={textLevel === TEXT_SCALES.length - 1}
                      accessibilityLabel={t('text_larger_a11y')}
                    >
                      <Text style={styles.textSizeBtnTextBig}>A</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.overlaySectionTitle}>{t('ingredients_title')} <Text style={styles.overlayServings}>• {recipe.servings} {t('servings_label')}</Text></Text>

                  <View style={styles.overlayTopActionsRow}>
                    <TouchableOpacity
                      style={styles.overlayActionPill}
                      onPress={() => setIsScaleModalVisible(true)}
                    >
                      <Text style={styles.overlayActionText}>{t('action_scale')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.overlayActionPill}
                      onPress={() => setIsWinePairingVisible(true)}
                    >
                      <Text style={styles.overlayActionText}>{t('action_pair')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.overlayActionPill}
                      onPress={() => setIsPlatingCoachVisible(true)}
                    >
                      <Text style={styles.overlayActionText}>{t('action_plate')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.overlayActionPill, styles.overlayActionPillCook]}
                      onPress={() => setIsCookModeVisible(true)}
                    >
                      <Text style={styles.overlayActionText}>{t('action_cook')}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Not a second Modal: tapping copies the phrase and shows a native Alert (nested modals stick on iOS). */}
                  <AlexaHint
                    text={t('alexa_hint_cook')}
                    onPress={async () => { await copyAlexaPhrase(); Alert.alert(t('alexa_copied')); }}
                  />

                  <View style={styles.overlayDivider} />

                  {isEditMode ? (
                    <View style={styles.editFieldFull}>
                      <Text style={styles.editFieldHint}>{t('edit_recipe_ingredients_hint')}</Text>
                      <TextInput
                        multiline
                        value={editForm?.ingredientsText}
                        onChangeText={(v) => updateEditField('ingredientsText', v)}
                        style={[styles.editFieldInput, styles.editFieldInputMultiline]}
                        placeholderTextColor="#A9A9A9"
                      />
                    </View>
                  ) : (
                    <View style={styles.overlayIngredientsList}>
                      {recipe.ingredients.map((ingredient, idx) => (
                        <View key={`${recipe.id}-ing-${idx}`} style={styles.overlayIngredientItem}>
                          <TouchableOpacity activeOpacity={0.6} onPress={() => { setSubstitutionIdx(idx); setSubstitutionIngredient(ingredientOverrides[idx] ?? ingredient); }}>
                            <Text style={[styles.overlayIngredientText, { fontSize: 12 * textScale, lineHeight: 16 * textScale }]}>- {ingredientOverrides[idx] ?? ingredient}</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  <Text style={styles.overlayTipText}>{t('ingredient_tip')}</Text>

                  <Text style={styles.overlaySectionTitle}>{t('method_title')}</Text>
                  <View style={styles.overlayDivider} />

                  {isEditMode ? (
                    <View style={styles.editFieldFull}>
                      <Text style={styles.editFieldHint}>{t('edit_recipe_steps_hint')}</Text>
                      <TextInput
                        multiline
                        value={editForm?.methodStepsText}
                        onChangeText={(v) => updateEditField('methodStepsText', v)}
                        style={[styles.editFieldInput, styles.editFieldInputMultiline]}
                        placeholderTextColor="#A9A9A9"
                      />
                    </View>
                  ) : (
                    recipe.methodSteps.map((step, idx) => (
                      <View key={`${recipe.id}-step-${idx}`} style={styles.overlayStepRow}>
                        <View style={styles.overlayStepNum}><Text style={styles.overlayStepNumText}>{idx + 1}</Text></View>
                        <Text style={[styles.overlayStepText, { fontSize: 12 * textScale, lineHeight: 18 * textScale }]}>{step}</Text>
                      </View>
                    ))
                  )}

                  {isEditMode ? (
                    <View style={styles.editActionsRow}>
                      <TouchableOpacity
                        style={[styles.editSaveBtn, isSavingEdits ? styles.disabledBtn : null]}
                        activeOpacity={0.85}
                        onPress={handleSaveEdits}
                        disabled={isSavingEdits}
                      >
                        {isSavingEdits ? (
                          <ActivityIndicator color="#FDE8E0" />
                        ) : (
                          <Text style={styles.overlayBottomBtnTextLight}>{t('save_changes_btn')}</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.editCancelBtn}
                        activeOpacity={0.85}
                        onPress={handleToggleEdit}
                        disabled={isSavingEdits}
                      >
                        <Text style={styles.overlayBottomBtnTextDark}>{t('cancel_btn')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <Text style={styles.overlaySectionTitle}>{t('my_note_title')}</Text>
                  <View style={styles.overlayDivider} />

                  <View style={styles.overlayNoteBox}>
                    <TextInput
                      multiline
                      placeholder={t('own_note_placeholder')}
                      placeholderTextColor="#A9A9A9"
                      value={noteText}
                      onChangeText={onChangeNoteText}
                      style={styles.overlayNoteInput}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.overlaySaveNoteBtn, isSaving ? styles.disabledBtn : null]}
                    activeOpacity={0.85}
                    onPress={guardedSaveNote}
                    disabled={isSaving}
                  >
                    <Text style={styles.overlaySaveNoteBtnText}>{t('save_note_caps_btn')}</Text>
                  </TouchableOpacity>

                  <View style={styles.overlayDivider} />

                  {listReview ? (
                    <ListAddPreviewBody
                      lines={listReview}
                      t={t}
                      busy={listBusy}
                      onConfirm={confirmListReview}
                      onCancel={() => setListReview(null)}
                    />
                  ) : null}

                  <View style={styles.overlayBottomActionsWrap}>
                    <TouchableOpacity
                      style={[
                        styles.overlayBottomBtn,
                        styles.overlayBottomBtnDark,
                        onSaveToCookbook ? styles.overlayBottomBtnSplit : null,
                        isSaving ? styles.disabledBtn : null,
                      ]}
                      // A recipe that isn't saved yet asks which cookbook first (like the web
                      // app); an already-saved one keeps updating its note in place.
                      onPress={!isAlreadySaved && onSaveToCookbook ? handleOpenSaveToCookbook : guardedSaveNote}
                      onLongPress={onSaveToCookbook ? handleOpenSaveToCookbook : undefined}
                      disabled={isSaving}
                    >
                      <Text style={styles.overlayBottomBtnTextLight}>
                        {isAlreadySaved ? t('save_short_btn') : t('save_to_recipes_btn')}
                      </Text>
                      {onSaveToCookbook ? (
                        <>
                          <View style={styles.overlaySaveDropdownDivider} />
                          <TouchableOpacity
                            style={styles.overlaySaveDropdownChevronBtn}
                            hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
                            onPress={handleOpenSaveToCookbook}
                            disabled={isSaving}
                          >
                            <Text style={styles.overlaySaveDropdownChevron}>▾</Text>
                          </TouchableOpacity>
                        </>
                      ) : null}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.overlayBottomBtn, styles.overlayBottomBtnGreen, isSharing ? styles.disabledBtn : null]}
                      onPress={handleShareRecipe}
                      disabled={isSharing}
                    >
                      <Text style={styles.overlayBottomBtnTextLight}>
                        {isSharing ? t('share_link_creating') : t('share_sparkle_btn')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.overlayBottomBtn, styles.overlayBottomBtnDark]} onPress={openListReview}>
                      <Text style={styles.overlayBottomBtnTextLight}>{t('list_btn')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.overlayBottomBtn, styles.overlayBottomBtnInstacart]}><Text style={styles.overlayBottomBtnTextLight}>{t('instacart_btn')}</Text></TouchableOpacity>
                    {onSaveEdits ? (
                      <TouchableOpacity
                        style={[styles.overlayBottomBtn, styles.overlayBottomBtnEdit]}
                        onPress={handleToggleEdit}
                      >
                        <Text style={styles.overlayBottomBtnTextLight}>
                          {isEditMode ? t('cancel_btn') : t('edit_btn_recipes')}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.overlayBottomBtn, styles.overlayBottomBtnClose]}
                      onPress={handleClose}
                    >
                      <Text style={styles.overlayBottomBtnTextDark}>{t('close_btn')}</Text>
                    </TouchableOpacity>
                    {onDeleteRecipe ? (
                      <TouchableOpacity
                        style={[styles.overlayBottomBtn, styles.overlayBottomBtnDelete, isSaving ? styles.disabledBtn : null]}
                        onPress={onDeleteRecipe}
                        disabled={isSaving}
                      >
                        <Text style={styles.overlayBottomBtnTextDelete}>{t('delete_short_btn')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={styles.overlayLastDivider} />
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        ) : null}

        <ScaleRecipeModal
          visible={isScaleModalVisible && !!recipe}
          recipe={recipe}
          token={user?.token}
          onClose={() => setIsScaleModalVisible(false)}
        />

        <IngredientSubstitutionModal
          visible={!!substitutionIngredient && !!recipe}
          recipe={recipe}
          ingredient={substitutionIngredient}
          token={user?.token}
          onClose={() => { setSubstitutionIngredient(null); setSubstitutionIdx(-1); }}
          onSelect={handleSubstitute}
        />

        <RecipeWinePairingModal
          visible={isWinePairingVisible && !!recipe}
          recipe={recipe}
          user={user}
          onClose={() => setIsWinePairingVisible(false)}
        />

        <RecipePlatingCoachModal
          visible={isPlatingCoachVisible && !!recipe}
          recipe={recipe}
          user={user}
          onClose={() => setIsPlatingCoachVisible(false)}
        />

        <CookModeModal
          visible={isCookModeVisible && !!recipe}
          recipe={recipe}
          user={user}
          onClose={() => setIsCookModeVisible(false)}
        />

        <SaveToCookbookModal
          visible={isSaveToCookbookVisible && !!recipe}
          books={books}
          initialBookId={recipe?.bookIds?.[0] || ''}
          initialCuisine={recipe?.category || ''}
          initialMealType={recipe?.meal || ''}
          isSaving={isSavingToCookbook}
          onCancel={() => setIsSaveToCookbookVisible(false)}
          onSave={handleConfirmSaveToCookbook}
        />

        <UpgradeGateModal
          visible={limitGate}
          onClose={() => setLimitGate(false)}
          tier={TIERS.PRO}
          title={t('recipe_limit_title')}
          desc={t('recipe_limit_desc')}
        />
      </View>
    </Modal>
  );
}

const TEXT_LEVEL_KEY = 'fern_recipe_text_level';
const TEXT_SCALES = [1, 1.3, 1.6, 2];

const styles = StyleSheet.create({
  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.34)',
    justifyContent: 'flex-end',
  },
  overlaySheetKeyboardAvoid: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  overlayBackdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  overlaySheet: {
    maxHeight: '92%',
    backgroundColor: '#FDE8E0',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#F3C9BD',
    overflow: 'hidden',
  },
  overlayContent: {
    paddingBottom: 30,
  },
  overlayImageWrap: {
    overflow: 'hidden',
    height: 300,
  },
  overlayImage: {
    flex: 1,
  },
  overlayImageInner: {
    borderRadius: 22,
  },
  overlayCloseBtn: {
    position: 'absolute',
    right: 14,
    top: 14,
    width: 34,
    height: 34,
    borderRadius: 99,
    backgroundColor: 'rgba(26,14,5,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCloseBtnText: {
    color: '#fff',
    fontSize: 19,
    lineHeight: 20,
    fontFamily: 'Jost-Regular',
  },
  overlayBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  overlayFoodEmoji: {
    fontSize: 30,
  },
  overlayTitle: {
    marginTop: 8,
    color: '#5A3236',
    fontSize: 22,
    lineHeight: 30,
    fontFamily: 'PlayfairDisplay-Bold',
  },
  overlayTitleInput: {
    marginTop: 8,
    color: '#5A3236',
    fontSize: 20,
    lineHeight: 26,
    fontFamily: 'PlayfairDisplay-Bold',
    borderWidth: 1,
    borderColor: '#F3C9BD',
    borderRadius: 10,
    backgroundColor: '#FDE8E0',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editFieldsGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  editFieldCol: {
    width: '31%',
  },
  editFieldFull: {
    marginTop: 14,
  },
  editFieldLabel: {
    marginBottom: 6,
    color: '#8A5A5C',
    fontSize: 10,
    letterSpacing: 0.6,
    fontFamily: 'Jost-Bold',
  },
  editFieldHint: {
    marginBottom: 6,
    color: '#9A7872',
    fontSize: 11,
    fontFamily: 'Jost-Regular',
    fontStyle: 'italic',
  },
  editFieldInput: {
    borderWidth: 1,
    borderColor: '#F3C9BD',
    borderRadius: 10,
    backgroundColor: '#FDE8E0',
    color: '#5A3236',
    fontSize: 13,
    fontFamily: 'Jost-Regular',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editFieldInputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  editActionsRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  editSaveBtn: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#8A4A4E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  editCancelBtn: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#F3C9BD',
    borderWidth: 1,
    borderColor: '#F3C9BD',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  overlayMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  overlayMetaText: {
    color: '#8A5A5C',
    fontSize: 12,
    fontFamily: 'Jost-Regular',
  },
  overlayDifficultyPill: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#F3C9BD',
    borderRadius: 999,
    backgroundColor: '#FDE8E0',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
  },
  difficultyDotFilled: {
    backgroundColor: '#C0475F',
  },
  difficultyDotEmpty: {
    borderWidth: 1,
    borderColor: '#C0475F',
    backgroundColor: 'transparent',
  },
  overlayDifficultyText: {
    marginLeft: 4,
    color: '#C0475F',
    fontSize: 10,
    fontFamily: 'Jost-Bold',
  },
  alreadySavedText: {
    marginTop: 10,
    color: '#C0475F',
    fontSize: 12,
    fontFamily: 'Jost-Bold',
  },
  overlayDivider: {
    marginTop: 10,
    marginBottom: 14,
    height: 1,
    backgroundColor: '#F3C9BD',
  },
  overlayLastDivider: {
    height: 100,
    backgroundColor: 'transparent',
  },
  overlayDescriptionCard: {
    borderRadius: 8,
    borderLeftWidth: 6,
    borderLeftColor: '#8A4A4E',
    backgroundColor: '#FBD9CE',
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  overlayDescriptionText: {
    color: '#8A5A5C',
    fontSize: 10,
    lineHeight: 16,
    fontFamily: 'PlayfairDisplay-Italic',
  },
  overlayThumbsRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  overlayThumbImage: {
    width: 100,
    height: 100,
  },
  photoMainTag: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: 'rgba(138,74,78,0.9)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  photoMainTagText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  photoMoreBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoMoreBtnText: { color: '#8A4A4E', fontSize: 18, fontWeight: '800', marginTop: -6 },
  photoHint: { marginTop: 8, color: '#A9756F', fontSize: 12 },
  overlayThumbImageInner: {
    borderRadius: 10,
  },
  overlayCameraPlaceholder: {
    width: 100,
    height: 100,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#F3C9BD',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCameraIcon: {
    fontSize: 30,
    opacity: 0.65,
  },
  overlaySectionTitle: {
    marginTop: 26,
    color: '#8A4A4E',
    fontSize: 11,
    letterSpacing: 3,
    fontFamily: 'Jost-Bold',
  },
  overlayServings: {
    color: '#8A5A5C',
    letterSpacing: 0,
    fontFamily: 'Jost-Regular',
  },
  overlayTopActionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  overlayActionPill: {
    backgroundColor: '#8A4A4E',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  overlayActionPillCook: {
    backgroundColor: '#D8607C',
  },
  overlayActionText: {
    color: '#FDE8E0',
    fontSize: 10,
    fontFamily: 'Jost-Bold',
  },
  overlayIngredientsList: {
    gap: 8,
  },
  textSizeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  textSizeBtn: {
    marginLeft: 8,
    minWidth: 44,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3C9BD',
    backgroundColor: '#FDE8E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textSizeBtnOff: {
    opacity: 0.35,
  },
  textSizeBtnTextSmall: {
    color: '#8A4A4E',
    fontSize: 13,
    fontFamily: 'Jost-Bold',
  },
  textSizeBtnTextBig: {
    color: '#8A4A4E',
    fontSize: 22,
    fontFamily: 'Jost-Bold',
  },
  overlayIngredientItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3C9BD',
    paddingBottom: 4,
  },
  overlayIngredientText: {
    color: '#8A5A5C',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Jost-Regular',
  },
  overlayTipText: {
    marginTop: 14,
    color: '#5A3236',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'PlayfairDisplay-BoldItalic',
  },
  overlayStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3C9BD',
  },
  overlayStepNum: {
    width: 28,
    height: 28,
    borderRadius: 99,
    backgroundColor: '#8A4A4E',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  overlayStepNumText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Jost-Bold',
  },
  overlayStepText: {
    flex: 1,
    color: '#8A5A5C',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Jost-Regular',
  },
  overlayNoteBox: {
    borderWidth: 1,
    borderColor: '#F3C9BD',
    borderRadius: 10,
    borderLeftWidth: 6,
    borderLeftColor: '#8A4A4E',
    backgroundColor: '#FDE8E0',
    minHeight: 100,
    marginLeft: -5,
    padding: 10,
  },
  overlayNoteInput: {
    color: '#5A3236',
    fontSize: 12,
    lineHeight: 18,
    minHeight: 80,
    textAlignVertical: 'top',
    fontFamily: 'Jost-Regular',
  },
  overlaySaveNoteBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#C3A29B',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#FDE8E0',
  },
  overlaySaveNoteBtnText: {
    color: '#8A5A5C',
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: 'Jost-Bold',
  },
  overlayBottomActionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  overlayBottomBtn: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  overlayBottomBtnDark: {
    backgroundColor: '#8A4A4E',
  },
  overlayBottomBtnSplit: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlaySaveDropdownDivider: {
    width: 1,
    height: 14,
    marginHorizontal: 10,
    backgroundColor: 'rgba(241,241,232,0.4)',
  },
  overlaySaveDropdownChevronBtn: {
    paddingVertical: 2,
  },
  overlaySaveDropdownChevron: {
    color: '#FDE8E0',
    fontSize: 12,
  },
  overlayBottomBtnGreen: {
    backgroundColor: '#C0475F',
  },
  overlayBottomBtnInstacart: {
    backgroundColor: '#0B9A4B',
  },
  overlayBottomBtnEdit: {
    backgroundColor: '#8A5A5C',
  },
  overlayBottomBtnClose: {
    backgroundColor: '#F3C9BD',
    borderWidth: 1,
    borderColor: '#F3C9BD',
  },
  overlayBottomBtnDelete: {
    backgroundColor: '#F7E7E9',
    borderWidth: 1,
    borderColor: '#EEB7C0',
  },
  overlayBottomBtnTextLight: {
    color: '#FDE8E0',
    fontSize: 10,
    fontFamily: 'Jost-Bold',
  },
  overlayBottomBtnTextDark: {
    color: '#5A3236',
    fontSize: 10,
    fontFamily: 'Jost-Bold',
  },
  overlayBottomBtnTextDelete: {
    color: '#D34157',
    fontSize: 10,
    fontFamily: 'Jost-Bold',
  },
  disabledBtn: {
    opacity: 0.55,
  },
});
