import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import useLanguage from '../../hooks/useLanguage';

export default function LeftoverMagicModal({
  visible,
  onClose,
  ingredientsInput,
  setIngredientsInput,
  isSearching,
  onSearch,
  recipes,
  onViewRecipe,
  onAskFern,
}) {
  const { t } = useLanguage();

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.leftoverBackdrop}>
        <View style={styles.leftoverSheet}>
          <View style={styles.leftoverTopBar}>
            <Text style={styles.leftoverTitle}>{`📸 ${t('leftover_magic_title')}`}</Text>
            <TouchableOpacity style={styles.leftoverAskFernBtn} activeOpacity={0.85} onPress={onAskFern}>
              <Text style={styles.leftoverAskFernText}>{t('leftover_ask_fern_btn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.leftoverCloseBtn} activeOpacity={0.85} onPress={onClose}>
              <Text style={styles.leftoverCloseText}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.leftoverScrollContent}
          >
            {!recipes.length ? (
              <View>
                <Text style={styles.leftoverHeroEmoji}>📸</Text>
                <Text style={styles.leftoverHeading}>{t('leftover_whats_in_fridge')}</Text>
                <Text style={styles.leftoverSubheading}>{t('leftover_subtitle')}</Text>

                <TouchableOpacity
                  style={styles.leftoverPrimaryAction}
                  activeOpacity={0.85}
                  onPress={onSearch}
                  disabled={isSearching}
                >
                  <Text style={styles.leftoverPrimaryActionText}>
                    {isSearching ? t('searching_ellipsis') : t('leftover_take_photo_btn')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.leftoverSecondaryAction}
                  activeOpacity={0.85}
                  onPress={onSearch}
                  disabled={isSearching}
                >
                  <Text style={styles.leftoverSecondaryActionText}>{t('leftover_upload_library_btn')}</Text>
                </TouchableOpacity>

                <View style={styles.leftoverDividerRow}>
                  <View style={styles.leftoverDivider} />
                  <Text style={styles.leftoverDividerText}>{t('leftover_or_tell_fern')}</Text>
                  <View style={styles.leftoverDivider} />
                </View>

                <View style={styles.leftoverInputRow}>
                  <TextInput
                    value={ingredientsInput}
                    onChangeText={setIngredientsInput}
                    placeholder={t('leftover_input_placeholder')}
                    placeholderTextColor="#9A8D7F"
                    style={styles.leftoverInput}
                  />
                  <TouchableOpacity
                    style={[styles.leftoverGoBtn, isSearching ? styles.leftoverGoBtnDisabled : null]}
                    activeOpacity={0.85}
                    onPress={onSearch}
                    disabled={isSearching}
                  >
                    <Text style={styles.leftoverGoBtnText}>{isSearching ? t('searching_ellipsis') : t('leftover_go_btn')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.leftoverResultsTitle}>{t('leftover_results_title')}</Text>

                {recipes.map((recipe, index) => (
                  <View key={recipe.id || `leftover-card-${index}`} style={styles.recipeCard}>
                    <View style={styles.recipeHeader}>
                      <Text style={styles.recipeTitle} numberOfLines={2}>{`${recipe.emoji} ${recipe.title}`}</Text>
                      <View style={[styles.difficultyPill, recipe.difficulty === 'Easy'
                        ? styles.difficultyEasy
                        : recipe.difficulty === 'Medium'
                          ? styles.difficultyMedium
                          : styles.difficultyAmbitious
                      ]}>
                        <Text style={styles.difficultyText}>{recipe.difficulty}</Text>
                      </View>
                    </View>

                    <Text style={styles.recipeDescription}>{recipe.description}</Text>
                    <Text style={styles.recipeTime}>{`⏱ ${recipe.time}`}</Text>

                    <TouchableOpacity
                      style={styles.viewRecipeBtn}
                      activeOpacity={0.85}
                      onPress={() => onViewRecipe(recipe)}
                    >
                      <Text style={styles.viewRecipeBtnText}>{t('leftover_view_recipe_btn')}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  leftoverBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  leftoverSheet: {
    maxHeight: '94%',
    backgroundColor: '#FBF8F2',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D9CFBF',
    overflow: 'hidden',
  },
  leftoverTopBar: {
    minHeight: 70,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0D4C4',
    gap: 10,
  },
  leftoverTitle: {
    flex: 1,
    color: '#2A1A11',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 24,
  },
  leftoverAskFernBtn: {
    backgroundColor: '#E96B1E',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  leftoverAskFernText: {
    color: '#FFF5EC',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
  },
  leftoverCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D6C8B4',
    backgroundColor: '#F2ECE3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftoverCloseText: {
    color: '#8C6B46',
    fontFamily: 'Jost-Bold',
    fontSize: 28,
    lineHeight: 30,
  },
  leftoverScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  leftoverHeroEmoji: {
    textAlign: 'center',
    fontSize: 64,
  },
  leftoverHeading: {
    marginTop: 14,
    textAlign: 'center',
    color: '#2A1A11',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 42,
    lineHeight: 52,
  },
  leftoverSubheading: {
    marginTop: 8,
    textAlign: 'center',
    color: '#7B5E3E',
    fontFamily: 'Jost-Medium',
    fontSize: 18,
  },
  leftoverPrimaryAction: {
    marginTop: 26,
    borderRadius: 16,
    backgroundColor: '#173E20',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  leftoverPrimaryActionText: {
    color: '#F1F7F1',
    fontFamily: 'Jost-Bold',
    fontSize: 18,
  },
  leftoverSecondaryAction: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CFBEA7',
    backgroundColor: '#F8F5EF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  leftoverSecondaryActionText: {
    color: '#2B2017',
    fontFamily: 'Jost-Bold',
    fontSize: 18,
  },
  leftoverDividerRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  leftoverDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#D9CDBD',
  },
  leftoverDividerText: {
    color: '#9B7E5F',
    fontFamily: 'Jost-Medium',
    fontSize: 15,
  },
  leftoverInputRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  leftoverInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#174025',
    backgroundColor: '#FFFFFF',
    color: '#2A1A11',
    fontFamily: 'Jost-Regular',
    fontSize: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  leftoverGoBtn: {
    backgroundColor: '#174025',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  leftoverGoBtnDisabled: {
    opacity: 0.65,
  },
  leftoverGoBtnText: {
    color: '#EDF6EA',
    fontFamily: 'Jost-Bold',
    fontSize: 34,
    lineHeight: 36,
  },
  leftoverResultsTitle: {
    color: '#2A1A11',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 50,
    lineHeight: 58,
    marginBottom: 14,
  },
  recipeCard: {
    borderWidth: 1,
    borderColor: '#CFBEA7',
    borderRadius: 18,
    backgroundColor: '#FBF8F2',
    padding: 14,
    marginBottom: 12,
  },
  recipeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recipeTitle: {
    flex: 1,
    color: '#2A1A11',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 24,
    lineHeight: 30,
  },
  difficultyPill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  difficultyEasy: {
    backgroundColor: '#2A7A56',
  },
  difficultyMedium: {
    backgroundColor: '#C34B1B',
  },
  difficultyAmbitious: {
    backgroundColor: '#5A2C0F',
  },
  difficultyText: {
    color: '#FFF9ED',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
  },
  recipeDescription: {
    marginTop: 8,
    color: '#7B5E3E',
    fontFamily: 'Jost-Medium',
    fontSize: 16,
    lineHeight: 24,
  },
  recipeTime: {
    marginTop: 4,
    color: '#755A3C',
    fontFamily: 'Jost-Bold',
    fontSize: 16,
  },
  viewRecipeBtn: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#173E20',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  viewRecipeBtnText: {
    color: '#F2F8F2',
    fontFamily: 'Jost-Bold',
    fontSize: 18,
    letterSpacing: 0.4,
  },
});
