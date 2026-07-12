import React, { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Clipboard,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../../constants/tokens';
import useLanguage from '../../hooks/useLanguage';
import { useSync } from '../../hooks/useSync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EventPlannerQuestionFlow from '../EventPlannerQuestionFlow';
import RecipeDetailModal from '../RecipeDetailModal';
import { generateEventPlan } from '../../services/eventPlannerService';
import { addRecipeIngredientsToShoppingList } from '../../utils/shoppingListSync';

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#F5F2ED',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: '#D9CFBF',
    maxHeight: '90%',
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
  },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontFamily: 'PlayfairDisplay-Bold',
    color: '#1A0E05',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Jost-Regular',
    color: '#9B8B7E',
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E5E4DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 26,
    color: '#8C8B82',
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  loadingIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  loadingTitle: {
    fontSize: 20,
    fontFamily: 'PlayfairDisplay-Bold',
    color: '#1A0E05',
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'Jost-Regular',
    color: '#7B5E3E',
    textAlign: 'center',
    lineHeight: 18,
  },
  resultWrap: {
    minHeight: 400,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Jost-Bold',
    letterSpacing: 1.2,
    color: '#EC6518',
    marginTop: 20,
    marginBottom: 12,
  },
  overviewCard: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  overviewGradient: {
    borderRadius: 14,
    padding: 16,
  },
  overviewText: {
    fontSize: 14,
    fontFamily: 'Jost-Regular',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  menuHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDFAF6',
    borderWidth: 1,
    borderColor: '#E6DCCF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: 14,
  },
  menuHeaderText: {
    fontSize: 13,
    fontFamily: 'Jost-Bold',
    color: '#1A0E05',
    letterSpacing: 1,
  },
  recipeCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6DCCF',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  recipeImage: {
    width: 80,
    backgroundColor: '#F0EBE3',
    alignSelf: 'stretch',
  },
  recipeContent: {
    flex: 1,
    padding: 12,
  },
  recipeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  recipeTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlayfairDisplay-SemiBold',
    color: '#1A0E05',
  },
  aiBadge: {
    backgroundColor: '#F0EAE0',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 9,
    fontFamily: 'Jost-Bold',
    color: '#7B5E3E',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F2ED',
    borderWidth: 1,
    borderColor: '#E6DCCF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  timeBadgeText: {
    fontSize: 9,
    fontFamily: 'Jost-Regular',
    color: '#7B5E3E',
  },
  chevron: {
    fontSize: 16,
    color: '#C8B49A',
    marginLeft: 2,
  },
  recipeDesc: {
    fontSize: 12,
    fontFamily: 'Jost-Regular',
    color: '#7B5E3E',
    marginBottom: 8,
    lineHeight: 17,
  },
  tapRecipeText: {
    fontSize: 10,
    fontFamily: 'Jost-Bold',
    color: '#EC6518',
    letterSpacing: 0.3,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D8C8B0',
    backgroundColor: '#FDFAF6',
  },
  actionBtnPrimary: {
    backgroundColor: colors.orange || '#E8651A',
    borderColor: colors.orange || '#E8651A',
  },
  actionBtnText: {
    fontSize: 11,
    fontFamily: 'Jost-Bold',
    color: '#5C4A3D',
  },
  actionBtnTextPrimary: {
    color: '#FFFFFF',
  },
});

function RecipeCard({ recipe, onPress, styles, t }) {
  return (
    <TouchableOpacity style={styles.recipeCard} onPress={onPress} activeOpacity={0.85}>
      {recipe.image ? (
        <Image source={{ uri: recipe.image }} style={styles.recipeImage} />
      ) : (
        <View style={[styles.recipeImage, { justifyContent: 'center', alignItems: 'center', minHeight: 110 }]}>
          <Text style={{ fontSize: 28 }}>🍽️</Text>
        </View>
      )}
      <View style={styles.recipeContent}>
        <View style={styles.recipeTitleRow}>
          <Text style={styles.recipeTitle} numberOfLines={2}>{recipe.title}</Text>
          <Text style={styles.aiBadge}>✨ {t('ai')}</Text>
          {recipe.time && (
            <View style={styles.timeBadge}>
              <Text style={styles.timeBadgeText}>⏱ {recipe.time}</Text>
            </View>
          )}
          <Text style={styles.chevron}>›</Text>
        </View>
        {recipe.description ? (
          <Text style={styles.recipeDesc} numberOfLines={3}>{recipe.description}</Text>
        ) : null}
        <Text style={styles.tapRecipeText}>{t('tap_for_recipe').toUpperCase()} →</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function EventPlannerIntakeModal({ visible, onClose, user, locale }) {
  const { t } = useLanguage();
  const { data, pull, pushAllFromStorage, pushChangedFromStorage } = useSync(user);
  const [screen, setScreen] = useState('intake');
  const [planResult, setPlanResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleCompleteIntake = async (intake) => {
    if (!user?.id || !user?.token) {
      Alert.alert(t('error'), t('user_not_authenticated'));
      return;
    }

    setIsGenerating(true);
    setScreen('loading');
    console.log('[EventPlanner] Starting plan generation with locale:', locale);

    try {
      console.log('[EventPlanner] Calling generateEventPlan with intake:', JSON.stringify(intake, null, 2));
      const result = await generateEventPlan(user.id, locale, intake);
      console.log('[EventPlanner] Got result from service:', result);

      if (!result) {
        console.error('[EventPlanner] Result is null!');
        Alert.alert(t('error'), t('no_plan_data_received'));
        setScreen('intake');
        setIsGenerating(false);
        return;
      }

      console.log('[EventPlanner] Result structure check:', {
        has_title: !!result.title,
        has_overview: !!result.overview,
        has_menu: !!result.menu,
        menu_keys: result.menu ? Object.keys(result.menu) : [],
        appetizers_count: result.menu?.appetizers?.length || 0,
        mains_count: result.menu?.mains?.length || 0,
        sides_count: result.menu?.sides?.length || 0,
        desserts_count: result.menu?.desserts?.length || 0,
      });

      console.log('[EventPlanner] Setting planResult and transitioning to results screen');
      setPlanResult(result);
      setScreen('results');
      console.log('[EventPlanner] Screen set to results, planResult now set');
    } catch (e) {
      console.warn('[EventPlanner] Plan generation failed:', e);
      console.log('[EventPlanner] Error details:', {
        message: e.message,
        stack: e.stack,
      });
      Alert.alert(t('unable_to_generate_plan'), e.message || t('check_connection_try_again'));
      setScreen('intake');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRecipeSelect = (recipe) => {
    setSelectedRecipe(recipe);
    setNoteText('');
  };

  const handleCloseRecipe = () => {
    setSelectedRecipe(null);
    setNoteText('');
  };

  const handleClose = () => {
    setScreen('intake');
    setPlanResult(null);
    setSelectedRecipe(null);
    onClose();
  };

  const handleNewPlan = () => {
    setScreen('intake');
    setPlanResult(null);
    setSelectedRecipe(null);
  };

  const handleCopyOverview = async () => {
    if (planResult?.overview) {
      await Clipboard.setString(planResult.overview);
      Alert.alert(t('copied'), t('plan_overview_copied'));
    }
  };

  const handleSaveRecipe = async () => {
    if (!selectedRecipe) return;
    if (!user?.id || !user?.token) {
      Alert.alert(t('error'), t('user_not_authenticated'));
      return;
    }
    setIsSaving(true);
    try {
      const stored = JSON.parse(await AsyncStorage.getItem('rv4_saved') || '[]');
      const alreadySaved = stored.some(
        (r) => String(r.id) === String(selectedRecipe.id) ||
          String(r.title || '').trim().toLowerCase() === String(selectedRecipe.title || '').trim().toLowerCase()
      );
      if (alreadySaved) {
        Alert.alert(t('already_saved_indicator'), selectedRecipe.title);
        return;
      }
      const recipeToSave = { ...selectedRecipe, note: noteText.trim() };
      const nextSaved = [recipeToSave, ...stored];
      await AsyncStorage.setItem('rv4_saved', JSON.stringify(nextSaved));
      const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
      await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({ ...cache, recipes: nextSaved }));
      await pushChangedFromStorage({ saved: nextSaved });
      Alert.alert(t('saved_title'), selectedRecipe.title);
    } catch (e) {
      console.warn('[EventPlanner] Save recipe failed:', e);
      Alert.alert(t('error'), t('save_error_desc'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToList = async () => {
    if (!selectedRecipe) return;
    if (!user?.id || !user?.token) {
      Alert.alert(t('error'), t('user_not_authenticated'));
      return;
    }
    const ingredients = Array.isArray(selectedRecipe.ingredients) ? selectedRecipe.ingredients : [];
    if (!ingredients.length) {
      Alert.alert(t('no_items'), t('no_items_desc'));
      return;
    }
    setIsSaving(true);
    try {
      const existingItems = Array.isArray(data.shopping) ? data.shopping : [];
      const { addedCount, checkedCount } = await addRecipeIngredientsToShoppingList(selectedRecipe, existingItems);

      await pushAllFromStorage();
      await pull();

      Alert.alert(t('added_title'), t('shopping_list_updated_desc', { added: addedCount, checked: checkedCount }));
    } catch (e) {
      console.warn('[EventPlanner] Add to list failed:', e);
      Alert.alert(t('error'), t('save_error_desc'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Modal
        transparent
        animationType="slide"
        visible={visible && selectedRecipe === null}
        onRequestClose={handleClose}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              handleClose();
            }}
          />

          <View style={styles.sheetContainer}>
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.headerWrap}>
                <View style={styles.headerContent}>
                  <Text style={styles.title}>{t('tool_dinner_party')}</Text>
                  <Text style={styles.subtitle}>{t('tool_ai_plan')}</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={handleClose}
                  activeOpacity={0.85}
                >
                  <Text style={styles.closeBtnText}>×</Text>
                </TouchableOpacity>
              </View>

              {screen === 'intake' && (
                <EventPlannerQuestionFlow
                  onComplete={handleCompleteIntake}
                  onClose={handleClose}
                />
              )}

              {screen === 'loading' && (
                <View style={styles.loadingWrap}>
                  <Text style={styles.loadingIcon}>🎉</Text>
                  <Text style={styles.loadingTitle}>{t('designing_label')}</Text>
                  <Text style={styles.loadingText}>
                    {t('designing_sub_label')}
                  </Text>
                  <ActivityIndicator
                    size="large"
                    color={colors.orange || '#E8651A'}
                    style={{ marginTop: 16 }}
                  />
                </View>
              )}

              {screen === 'results' && planResult && (
                <View style={styles.resultWrap}>
                  {planResult.overview && (
                    <View style={styles.overviewCard}>
                      <LinearGradient
                        colors={['#EC6518', '#3A4A22']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.overviewGradient}
                      >
                        <Text style={styles.overviewText}>{planResult.overview}</Text>
                      </LinearGradient>
                    </View>
                  )}

                  <View style={styles.menuHeaderCard}>
                    <Text style={styles.menuHeaderText}>📋  {t('menu').toUpperCase()}</Text>
                  </View>

                  {/* Appetizers */}
                  {planResult.menu?.appetizers?.length > 0 && (
                    <>
                      <Text style={[styles.sectionTitle, { marginTop: 6 }]}>{t('appetizers').toUpperCase()}</Text>
                      {planResult.menu.appetizers.map((recipe, idx) => (
                        <RecipeCard key={`app-${idx}`} recipe={recipe} onPress={() => handleRecipeSelect(recipe)} styles={styles} t={t} />
                      ))}
                    </>
                  )}

                  {/* Mains */}
                  {planResult.menu?.mains?.length > 0 && (
                    <>
                      <Text style={[styles.sectionTitle, { marginTop: 6 }]}>{t('main_courses').toUpperCase()}</Text>
                      {planResult.menu.mains.map((recipe, idx) => (
                        <RecipeCard key={`main-${idx}`} recipe={recipe} onPress={() => handleRecipeSelect(recipe)} styles={styles} t={t} />
                      ))}
                    </>
                  )}

                  {/* Sides */}
                  {planResult.menu?.sides?.length > 0 && (
                    <>
                      <Text style={[styles.sectionTitle, { marginTop: 6 }]}>{t('sides').toUpperCase()}</Text>
                      {planResult.menu.sides.map((recipe, idx) => (
                        <RecipeCard key={`side-${idx}`} recipe={recipe} onPress={() => handleRecipeSelect(recipe)} styles={styles} t={t} />
                      ))}
                    </>
                  )}

                  {/* Desserts */}
                  {planResult.menu?.desserts?.length > 0 && (
                    <>
                      <Text style={[styles.sectionTitle, { marginTop: 6 }]}>{t('desserts').toUpperCase()}</Text>
                      {planResult.menu.desserts.map((recipe, idx) => (
                        <RecipeCard key={`des-${idx}`} recipe={recipe} onPress={() => handleRecipeSelect(recipe)} styles={styles} t={t} />
                      ))}
                    </>
                  )}

                  {/* Beverages */}
                  {planResult.drinks?.length > 0 && (
                    <View>
                      <Text style={styles.sectionTitle}>🍷 {t('beverages').toUpperCase()}</Text>
                      {planResult.drinks.map((drink, idx) => (
                        <View key={idx} style={{ marginBottom: 8 }}>
                          <Text style={{ fontSize: 12, fontFamily: 'Jost-SemiBold', color: '#1A0E05' }}>
                            {drink.name}
                          </Text>
                          <Text style={{ fontSize: 11, fontFamily: 'Jost-Regular', color: '#7B5E3E' }}>
                            {drink.notes}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Host Tips */}
                  {planResult.hostTips?.length > 0 && (
                    <View>
                      <Text style={styles.sectionTitle}>💡 {t('host_tips').toUpperCase()}</Text>
                      {planResult.hostTips.map((tip, idx) => (
                        <Text
                          key={idx}
                          style={{
                            fontSize: 11,
                            fontFamily: 'Jost-Regular',
                            color: '#7B5E3E',
                            marginBottom: 6,
                            lineHeight: 16,
                          }}
                        >
                          • {tip}
                        </Text>
                      ))}
                    </View>
                  )}

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={handleCopyOverview}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.actionBtnText}>📋 {t('copy')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => Alert.alert(t('coming_soon'), t('music_feature_coming_soon'))}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.actionBtnText}>🎵 {t('music')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnPrimary]}
                      onPress={handleNewPlan}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>✨ {t('new_plan')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <RecipeDetailModal
        recipe={selectedRecipe}
        onClose={handleCloseRecipe}
        noteText={noteText}
        onChangeNoteText={setNoteText}
        isSaving={isSaving}
        onSaveNote={handleSaveRecipe}
        onAddToList={handleAddToList}
        isAlreadySaved={false}
        showSavedIndicator={false}
      />
    </>
  );
}
