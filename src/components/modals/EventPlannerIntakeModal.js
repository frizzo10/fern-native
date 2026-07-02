import React, { useState } from 'react';
import {
  Modal,
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
import { colors, radius } from '../../constants/tokens';
import useLanguage from '../../hooks/useLanguage';
import EventPlannerQuestionFlow from '../EventPlannerQuestionFlow';
import RecipeDetailModal from '../RecipeDetailModal';
import { generateEventPlan } from '../../services/eventPlannerService';

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
    backgroundColor: '#EC6518',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  overviewText: {
    fontSize: 13,
    fontFamily: 'Jost-Regular',
    color: '#FFFFFF',
    lineHeight: 18,
  },
  recipeCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6DCCF',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  recipeImage: {
    width: 70,
    height: 70,
    backgroundColor: '#F0EBE3',
  },
  recipeContent: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  recipeTitle: {
    fontSize: 13,
    fontFamily: 'PlayfairDisplay-SemiBold',
    color: '#1A0E05',
    marginBottom: 2,
  },
  recipeDesc: {
    fontSize: 11,
    fontFamily: 'Jost-Regular',
    color: '#7B5E3E',
    marginBottom: 4,
    lineHeight: 14,
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recipeTime: {
    fontSize: 10,
    fontFamily: 'Jost-Regular',
    color: '#999',
  },
  aiBadge: {
    backgroundColor: '#F0EAE0',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    fontSize: 9,
    fontFamily: 'Jost-Bold',
    color: '#7B5E3E',
  },
  tapRecipeText: {
    fontSize: 10,
    fontFamily: 'Jost-Bold',
    color: '#EC6518',
    marginTop: 3,
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

export default function EventPlannerIntakeModal({ visible, onClose, user, locale }) {
  const { t } = useLanguage();
  const [screen, setScreen] = useState('intake');
  const [planResult, setPlanResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [noteText, setNoteText] = useState('');

  const handleCompleteIntake = async (intake) => {
    if (!user?.id || !user?.token) {
      Alert.alert('Error', 'User not authenticated');
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
        Alert.alert('Error', 'No plan data received');
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
      Alert.alert('Unable to generate plan', e.message || 'Please check your connection and try again.');
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
      Alert.alert('Copied', 'Plan overview copied to clipboard');
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
        <View style={styles.backdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleClose}
          />

          <View style={styles.sheetContainer}>
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.headerWrap}>
                <View style={styles.headerContent}>
                  <Text style={styles.title}>Dinner Party</Text>
                  <Text style={styles.subtitle}>Pro Max • AI plans every detail</Text>
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
                  <Text style={styles.loadingTitle}>Designing your event...</Text>
                  <Text style={styles.loadingText}>
                    Building the menu, shopping list, timing schedule, and host tips.{'\n'}This usually takes 30-45 seconds.
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
                      <Text style={styles.overviewText}>{planResult.overview}</Text>
                    </View>
                  )}

                  <Text style={styles.sectionTitle}>📋 MENU</Text>

                  {/* Appetizers */}
                  {planResult.menu?.appetizers?.length > 0 && (
                    <>
                      <Text style={[styles.sectionTitle, { marginTop: 10 }]}>APPETIZERS</Text>
                      {planResult.menu.appetizers.map((recipe, idx) => (
                        <TouchableOpacity
                          key={`app-${idx}`}
                          style={styles.recipeCard}
                          onPress={() => handleRecipeSelect(recipe)}
                          activeOpacity={0.85}
                        >
                          {recipe.image ? (
                            <Image
                              source={{ uri: recipe.image }}
                              style={styles.recipeImage}
                            />
                          ) : (
                            <View style={[styles.recipeImage, { backgroundColor: '#F0EBE3', justifyContent: 'center', alignItems: 'center' }]}>
                              <Text style={{ fontSize: 28 }}>🍽️</Text>
                            </View>
                          )}
                          <View style={styles.recipeContent}>
                            <Text style={styles.recipeTitle} numberOfLines={1}>{recipe.title}</Text>
                            <Text style={styles.recipeDesc} numberOfLines={1}>{recipe.description}</Text>
                            <View style={styles.recipeMeta}>
                              <View>
                                {recipe.time && <Text style={styles.recipeTime}>⏱ {recipe.time}</Text>}
                                <Text style={styles.tapRecipeText}>TAP FOR RECIPE →</Text>
                              </View>
                              <Text style={styles.aiBadge}>✨ AI</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}

                  {/* Mains */}
                  {planResult.menu?.mains?.length > 0 && (
                    <>
                      <Text style={[styles.sectionTitle, { marginTop: 10 }]}>MAIN COURSES</Text>
                      {planResult.menu.mains.map((recipe, idx) => (
                        <TouchableOpacity
                          key={`main-${idx}`}
                          style={styles.recipeCard}
                          onPress={() => handleRecipeSelect(recipe)}
                          activeOpacity={0.85}
                        >
                          {recipe.image ? (
                            <Image
                              source={{ uri: recipe.image }}
                              style={styles.recipeImage}
                            />
                          ) : (
                            <View style={[styles.recipeImage, { backgroundColor: '#F0EBE3', justifyContent: 'center', alignItems: 'center' }]}>
                              <Text style={{ fontSize: 28 }}>🍽️</Text>
                            </View>
                          )}
                          <View style={styles.recipeContent}>
                            <Text style={styles.recipeTitle} numberOfLines={1}>{recipe.title}</Text>
                            <Text style={styles.recipeDesc} numberOfLines={1}>{recipe.description}</Text>
                            <View style={styles.recipeMeta}>
                              <View>
                                {recipe.time && <Text style={styles.recipeTime}>⏱ {recipe.time}</Text>}
                                <Text style={styles.tapRecipeText}>TAP FOR RECIPE →</Text>
                              </View>
                              <Text style={styles.aiBadge}>✨ AI</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}

                  {/* Sides */}
                  {planResult.menu?.sides?.length > 0 && (
                    <>
                      <Text style={[styles.sectionTitle, { marginTop: 10 }]}>SIDES</Text>
                      {planResult.menu.sides.map((recipe, idx) => (
                        <TouchableOpacity
                          key={`side-${idx}`}
                          style={styles.recipeCard}
                          onPress={() => handleRecipeSelect(recipe)}
                          activeOpacity={0.85}
                        >
                          {recipe.image ? (
                            <Image
                              source={{ uri: recipe.image }}
                              style={styles.recipeImage}
                            />
                          ) : (
                            <View style={[styles.recipeImage, { backgroundColor: '#F0EBE3', justifyContent: 'center', alignItems: 'center' }]}>
                              <Text style={{ fontSize: 28 }}>🍽️</Text>
                            </View>
                          )}
                          <View style={styles.recipeContent}>
                            <Text style={styles.recipeTitle} numberOfLines={1}>{recipe.title}</Text>
                            <Text style={styles.recipeDesc} numberOfLines={1}>{recipe.description}</Text>
                            <View style={styles.recipeMeta}>
                              <View>
                                {recipe.time && <Text style={styles.recipeTime}>⏱ {recipe.time}</Text>}
                                <Text style={styles.tapRecipeText}>TAP FOR RECIPE →</Text>
                              </View>
                              <Text style={styles.aiBadge}>✨ AI</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}

                  {/* Desserts */}
                  {planResult.menu?.desserts?.length > 0 && (
                    <>
                      <Text style={[styles.sectionTitle, { marginTop: 10 }]}>DESSERTS</Text>
                      {planResult.menu.desserts.map((recipe, idx) => (
                        <TouchableOpacity
                          key={`des-${idx}`}
                          style={styles.recipeCard}
                          onPress={() => handleRecipeSelect(recipe)}
                          activeOpacity={0.85}
                        >
                          {recipe.image ? (
                            <Image
                              source={{ uri: recipe.image }}
                              style={styles.recipeImage}
                            />
                          ) : (
                            <View style={[styles.recipeImage, { backgroundColor: '#F0EBE3', justifyContent: 'center', alignItems: 'center' }]}>
                              <Text style={{ fontSize: 28 }}>🍽️</Text>
                            </View>
                          )}
                          <View style={styles.recipeContent}>
                            <Text style={styles.recipeTitle} numberOfLines={1}>{recipe.title}</Text>
                            <Text style={styles.recipeDesc} numberOfLines={1}>{recipe.description}</Text>
                            <View style={styles.recipeMeta}>
                              <View>
                                {recipe.time && <Text style={styles.recipeTime}>⏱ {recipe.time}</Text>}
                                <Text style={styles.tapRecipeText}>TAP FOR RECIPE →</Text>
                              </View>
                              <Text style={styles.aiBadge}>✨ AI</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}

                  {/* Beverages */}
                  {planResult.drinks?.length > 0 && (
                    <View>
                      <Text style={styles.sectionTitle}>🍷 BEVERAGES</Text>
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
                      <Text style={styles.sectionTitle}>💡 HOST TIPS</Text>
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
                      <Text style={styles.actionBtnText}>📋 Copy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => Alert.alert('Coming Soon', 'Music feature coming soon')}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.actionBtnText}>🎵 Music</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnPrimary]}
                      onPress={handleNewPlan}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>✨ NEW PLAN</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <RecipeDetailModal
        recipe={selectedRecipe}
        onClose={handleCloseRecipe}
        noteText={noteText}
        onChangeNoteText={setNoteText}
        isSaving={false}
        onSaveNote={() => handleCloseRecipe()}
        isAlreadySaved={false}
        showSavedIndicator={false}
      />
    </>
  );
}
