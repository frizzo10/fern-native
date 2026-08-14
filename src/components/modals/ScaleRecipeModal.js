import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import useLanguage from '../../hooks/useLanguage';
import { fetchScaledRecipe } from '../../services/scaleRecipeService';

const QUICK_SERVINGS = [1, 2, 3, 4, 6, 8, 10, 12, 16];

export default function ScaleRecipeModal({ visible, recipe, token, onClose }) {
  const { t, locale } = useLanguage();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const currentServings = Number(recipe?.servings) || 4;

  const [target, setTarget] = useState(null);
  const [customServings, setCustomServings] = useState('');
  const [isScaling, setIsScaling] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (visible) {
      setTarget(null);
      setCustomServings('');
      setIsScaling(false);
      setError('');
      setResult(null);
    }
  }, [visible, recipe?.id]);

  const handlePickQuick = (value) => {
    setTarget(value);
    setCustomServings('');
  };

  const handleChangeCustom = (value) => {
    const digitsOnly = value.replace(/[^0-9]/g, '');
    setCustomServings(digitsOnly);
    const parsed = parseInt(digitsOnly, 10);
    setTarget(digitsOnly && parsed >= 1 && parsed <= 50 ? parsed : null);
  };

  const handleScale = async () => {
    if (!target || isScaling) return;
    setIsScaling(true);
    setError('');
    try {
      const { scaledIngredients } = await fetchScaledRecipe({
        ingredients: recipe?.ingredients || [],
        current: currentServings,
        target,
        locale,
        token,
      });
      setResult({ from: currentServings, to: target, ingredients: scaledIngredients });
    } catch (e) {
      setError(t('scale_recipe_error'));
    } finally {
      setIsScaling(false);
    }
  };

  if (!visible || !recipe) return null;

  return (
    <View style={[styles.overlayRoot, { width: screenWidth, height: screenHeight }]}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.sheet}>
            <View style={styles.headerRow}>
              <View style={styles.headerTextWrap}>
                <Text style={styles.title}>{t('scale_recipe_title')}</Text>
                <Text style={styles.subtitle}>{t('scale_recipe_subtitle')}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              <View style={styles.currentCard}>
                <Text style={styles.currentLabel}>{t('current_recipe_label')}</Text>
                <Text style={styles.currentTitle}>{recipe.title}</Text>
                <Text style={styles.currentServes}>
                  {t('currently_serves_label', { count: currentServings })}
                </Text>
              </View>

              <Text style={styles.pickLabel}>{t('scale_to_serve_label')}</Text>
              <View style={styles.quickGrid}>
                {QUICK_SERVINGS.map((value) => {
                  const isCurrent = value === currentServings;
                  const isSelected = value === target;
                  return (
                    <TouchableOpacity
                      key={`serving-${value}`}
                      style={[
                        styles.quickBtn,
                        isSelected ? styles.quickBtnSelected : null,
                        isCurrent && !isSelected ? styles.quickBtnCurrent : null,
                      ]}
                      activeOpacity={0.85}
                      onPress={() => handlePickQuick(value)}
                    >
                      <Text style={styles.quickBtnText}>{value}</Text>
                      {isCurrent ? <Text style={styles.quickBtnTag}>{t('current_serving_tag')}</Text> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.orCustomLabel}>{t('or_custom_label')}</Text>
              <TextInput
                value={customServings}
                onChangeText={handleChangeCustom}
                placeholder={t('custom_serving_placeholder')}
                placeholderTextColor="#B0AEA9"
                keyboardType="number-pad"
                style={styles.customInput}
              />

              <TouchableOpacity
                style={[styles.scaleBtn, (!target || isScaling) ? styles.scaleBtnDisabled : null]}
                activeOpacity={0.85}
                onPress={handleScale}
                disabled={!target || isScaling}
              >
                <Text style={styles.scaleBtnText}>
                  {isScaling ? t('scaling_ellipsis_btn') : t('scale_recipe_btn')}
                </Text>
              </TouchableOpacity>

              {isScaling ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="small" color="#E96B1E" />
                  <Text style={styles.loadingText}>{t('adjusting_quantities_label')}</Text>
                </View>
              ) : null}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {result ? (
                <View>
                  <View style={styles.resultCard}>
                    <Text style={styles.resultLabel}>{t('scaled_recipe_label')}</Text>
                    <Text style={styles.resultServings}>
                      {t('servings_arrow_label', { from: result.from, to: result.to })}
                    </Text>
                  </View>

                  <View style={styles.ingredientsCard}>
                    <Text style={styles.ingredientsLabel}>{t('scaled_ingredients_label')}</Text>
                    {result.ingredients.map((row, idx) => (
                      <View
                        key={`scaled-ing-${idx}`}
                        style={[
                          styles.ingredientRow,
                          idx === result.ingredients.length - 1 ? styles.ingredientRowLast : null,
                        ]}
                      >
                        {row.was ? (
                          <Text style={styles.wasText}>{t('was_prefix_label')} {row.was}</Text>
                        ) : null}
                        <Text style={styles.nowText}>{t('now_prefix_label')} {row.now}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10,
    elevation: 10,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.34)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: '#FBF8F2',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#D9CFBF',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E0D4C4',
    gap: 10,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    color: '#2A1A11',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 22,
  },
  subtitle: {
    marginTop: 4,
    color: '#8C7355',
    fontFamily: 'Jost-Regular',
    fontSize: 12,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E5E4DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#2A1A11',
    fontSize: 20,
    lineHeight: 22,
    fontFamily: 'Jost-Regular',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
  },
  currentCard: {
    borderRadius: 14,
    backgroundColor: '#EDEAE2',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 14,
  },
  currentLabel: {
    color: '#8C7355',
    fontFamily: 'Jost-Bold',
    fontSize: 11,
    letterSpacing: 1.5,
  },
  currentTitle: {
    marginTop: 8,
    textAlign: 'center',
    color: '#2A1A11',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 18,
  },
  currentServes: {
    marginTop: 6,
    color: '#7B5E3E',
    fontFamily: 'Jost-Regular',
    fontSize: 13,
  },
  pickLabel: {
    marginTop: 24,
    marginBottom: 12,
    color: '#7B5C3A',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickBtn: {
    width: '30%',
    borderWidth: 1,
    borderColor: '#D9CFBF',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  quickBtnCurrent: {
    backgroundColor: '#F1E9D8',
    borderColor: '#D3BE96',
  },
  quickBtnSelected: {
    borderColor: '#E96B1E',
    borderWidth: 2,
    backgroundColor: '#FCEEE3',
  },
  quickBtnText: {
    color: '#2A1A11',
    fontFamily: 'Jost-Bold',
    fontSize: 18,
  },
  quickBtnTag: {
    marginTop: 2,
    color: '#8C7355',
    fontFamily: 'Jost-Bold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  orCustomLabel: {
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
    color: '#8C7355',
    fontFamily: 'PlayfairDisplay-Italic',
    fontSize: 13,
  },
  customInput: {
    borderWidth: 1,
    borderColor: '#D9CFBF',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    color: '#2A1A11',
    fontFamily: 'Jost-Regular',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    textAlign: 'center',
  },
  scaleBtn: {
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: '#E96B1E',
    borderBottomWidth: 3,
    borderBottomColor: '#184626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  scaleBtnDisabled: {
    opacity: 0.55,
  },
  scaleBtnText: {
    color: '#FFF5EC',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  loadingWrap: {
    marginTop: 22,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#8C7355',
    fontFamily: 'PlayfairDisplay-Italic',
    fontSize: 14,
  },
  errorText: {
    marginTop: 16,
    textAlign: 'center',
    color: '#B03A3A',
    fontFamily: 'Jost-Regular',
    fontSize: 12,
  },
  resultCard: {
    marginTop: 22,
    borderRadius: 14,
    backgroundColor: '#EDEAE2',
    alignItems: 'center',
    paddingVertical: 16,
  },
  resultLabel: {
    color: '#E96B1E',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  resultServings: {
    marginTop: 6,
    color: '#2A1A11',
    fontFamily: 'Jost-Bold',
    fontSize: 15,
  },
  ingredientsCard: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#D9CFBF',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  ingredientsLabel: {
    color: '#7B5C3A',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 8,
  },
  ingredientRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5D8C8',
    paddingVertical: 10,
    gap: 4,
  },
  ingredientRowLast: {
    borderBottomWidth: 0,
  },
  wasText: {
    color: '#9A8D7F',
    fontFamily: 'Jost-Regular',
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  nowText: {
    color: '#184626',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
  },
});
