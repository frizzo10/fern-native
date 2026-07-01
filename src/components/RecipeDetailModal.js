import React from 'react';
import {
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getDifficultyLevel } from '../utils/recipeNormalize';
import useLanguage from '../hooks/useLanguage';

export default function RecipeDetailModal({
  recipe,
  onClose,
  noteText,
  onChangeNoteText,
  isSaving,
  onSaveNote,
  isAlreadySaved = true,
  showSavedIndicator = false,
  onDeleteRecipe,
}) {
  const { t } = useLanguage();
  return (
    <Modal
      visible={!!recipe}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlayBackdrop}>
        <TouchableOpacity
          style={styles.overlayBackdropTap}
          activeOpacity={1}
          onPress={onClose}
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
                    source={recipe.image ? { uri: recipe.image } : require('../../assets/icon.png')}
                    style={styles.overlayImage}
                    imageStyle={styles.overlayImageInner}
                  />

                  <TouchableOpacity
                    style={styles.overlayCloseBtn}
                    onPress={onClose}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.overlayCloseBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.overlayBody}>
                  <Text style={styles.overlayFoodEmoji}>{recipe.emoji}</Text>
                  <Text style={styles.overlayTitle}>{recipe.title}</Text>
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

                  {showSavedIndicator && isAlreadySaved ? (
                    <Text style={styles.alreadySavedText}>{t('already_saved_indicator')}</Text>
                  ) : null}

                  <View style={styles.overlayDivider} />

                  <View style={styles.overlayDescriptionCard}>
                    <Text style={styles.overlayDescriptionText}>{recipe.description}</Text>
                  </View>

                  <View style={styles.overlayThumbsRow}>
                    <ImageBackground
                      source={recipe.image ? { uri: recipe.image } : require('../../assets/icon.png')}
                      style={styles.overlayThumbImage}
                      imageStyle={styles.overlayThumbImageInner}
                    />
                    <View style={styles.overlayCameraPlaceholder}>
                      <Text style={styles.overlayCameraIcon}>📷</Text>
                    </View>
                  </View>

                  <Text style={styles.overlaySectionTitle}>{t('ingredients_title')} <Text style={styles.overlayServings}>• {recipe.servings} {t('servings_label')}</Text></Text>

                  <View style={styles.overlayTopActionsRow}>
                    <TouchableOpacity style={styles.overlayActionPill}><Text style={styles.overlayActionText}>{t('action_scale')}</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.overlayActionPill}><Text style={styles.overlayActionText}>{t('action_pair')}</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.overlayActionPill}><Text style={styles.overlayActionText}>{t('action_plate')}</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.overlayActionPill, styles.overlayActionPillCook]}><Text style={styles.overlayActionText}>{t('action_cook')}</Text></TouchableOpacity>
                  </View>

                  <View style={styles.overlayDivider} />

                  <View style={styles.overlayIngredientsList}>
                    {recipe.ingredients.map((ingredient, idx) => (
                      <View key={`${recipe.id}-ing-${idx}`} style={styles.overlayIngredientItem}>
                        <Text style={styles.overlayIngredientText}>- {ingredient}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.overlayTipText}>{t('ingredient_tip')}</Text>

                  <Text style={styles.overlaySectionTitle}>{t('method_title')}</Text>
                  <View style={styles.overlayDivider} />

                  {recipe.methodSteps.map((step, idx) => (
                    <View key={`${recipe.id}-step-${idx}`} style={styles.overlayStepRow}>
                      <View style={styles.overlayStepNum}><Text style={styles.overlayStepNumText}>{idx + 1}</Text></View>
                      <Text style={styles.overlayStepText}>{step}</Text>
                    </View>
                  ))}

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
                    onPress={onSaveNote}
                    disabled={isSaving}
                  >
                    <Text style={styles.overlaySaveNoteBtnText}>{t('save_note_caps_btn')}</Text>
                  </TouchableOpacity>

                  <View style={styles.overlayDivider} />

                  <View style={styles.overlayBottomActionsWrap}>
                    <TouchableOpacity
                      style={[styles.overlayBottomBtn, styles.overlayBottomBtnDark, isSaving ? styles.disabledBtn : null]}
                      onPress={onSaveNote}
                      disabled={isSaving}
                    >
                      <Text style={styles.overlayBottomBtnTextLight}>
                        {isAlreadySaved ? t('save_short_btn') : t('save_to_recipes_btn')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.overlayBottomBtn, styles.overlayBottomBtnGreen]}><Text style={styles.overlayBottomBtnTextLight}>{t('share_sparkle_btn')}</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.overlayBottomBtn, styles.overlayBottomBtnDark]}><Text style={styles.overlayBottomBtnTextLight}>{t('list_btn')}</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.overlayBottomBtn, styles.overlayBottomBtnInstacart]}><Text style={styles.overlayBottomBtnTextLight}>{t('instacart_btn')}</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.overlayBottomBtn, styles.overlayBottomBtnEdit]}><Text style={styles.overlayBottomBtnTextLight}>{t('edit_btn_recipes')}</Text></TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.overlayBottomBtn, styles.overlayBottomBtnClose]}
                      onPress={onClose}
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
      </View>
    </Modal>
  );
}

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
    backgroundColor: '#F3EFE8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#D5C8B5',
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
    color: '#2D1A0F',
    fontSize: 22,
    lineHeight: 30,
    fontFamily: 'PlayfairDisplay-Bold',
  },
  overlayMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  overlayMetaText: {
    color: '#7F6547',
    fontSize: 12,
    fontFamily: 'Jost-Regular',
  },
  overlayDifficultyPill: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#D3BE96',
    borderRadius: 999,
    backgroundColor: '#F5EEDB',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
  },
  difficultyDotFilled: {
    backgroundColor: '#947117',
  },
  difficultyDotEmpty: {
    borderWidth: 1,
    borderColor: '#B99233',
    backgroundColor: 'transparent',
  },
  overlayDifficultyText: {
    marginLeft: 4,
    color: '#977110',
    fontSize: 10,
    fontFamily: 'Jost-Bold',
  },
  alreadySavedText: {
    marginTop: 10,
    color: '#2F6B2F',
    fontSize: 12,
    fontFamily: 'Jost-Bold',
  },
  overlayDivider: {
    marginTop: 10,
    marginBottom: 14,
    height: 1,
    backgroundColor: '#D8C8B0',
  },
  overlayLastDivider: {
    height: 100,
    backgroundColor: 'transparent',
  },
  overlayDescriptionCard: {
    borderRadius: 8,
    borderLeftWidth: 6,
    borderLeftColor: '#265A34',
    backgroundColor: '#D8E6D7',
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  overlayDescriptionText: {
    color: '#80623F',
    fontSize: 10,
    lineHeight: 16,
    fontFamily: 'PlayfairDisplay-Italic',
  },
  overlayThumbsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  overlayThumbImage: {
    width: 100,
    height: 100,
  },
  overlayThumbImageInner: {
    borderRadius: 10,
  },
  overlayCameraPlaceholder: {
    width: 100,
    height: 100,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D3BE96',
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
    color: '#214A2B',
    fontSize: 11,
    letterSpacing: 3,
    fontFamily: 'Jost-Bold',
  },
  overlayServings: {
    color: '#7B5D3C',
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
    backgroundColor: '#1C512A',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  overlayActionPillCook: {
    backgroundColor: '#E96B1E',
  },
  overlayActionText: {
    color: '#F2F0E8',
    fontSize: 10,
    fontFamily: 'Jost-Bold',
  },
  overlayIngredientsList: {
    gap: 8,
  },
  overlayIngredientItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5D8C8',
    paddingBottom: 4,
  },
  overlayIngredientText: {
    color: '#795A39',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Jost-Regular',
  },
  overlayTipText: {
    marginTop: 14,
    color: '#1F140C',
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
    borderBottomColor: '#E5D8C8',
  },
  overlayStepNum: {
    width: 28,
    height: 28,
    borderRadius: 99,
    backgroundColor: '#1C512A',
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
    color: '#7C5E3D',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Jost-Regular',
  },
  overlayNoteBox: {
    borderWidth: 1,
    borderColor: '#CDBA9F',
    borderRadius: 10,
    borderLeftWidth: 6,
    borderLeftColor: '#1C512A',
    backgroundColor: '#F8F5EF',
    minHeight: 100,
    marginLeft: -5,
    padding: 10,
  },
  overlayNoteInput: {
    color: '#1A0E05',
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
    borderColor: '#C0A987',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#F8F5EF',
  },
  overlaySaveNoteBtnText: {
    color: '#7B5D3C',
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
    backgroundColor: '#184626',
  },
  overlayBottomBtnGreen: {
    backgroundColor: '#2F6B2F',
  },
  overlayBottomBtnInstacart: {
    backgroundColor: '#0B9A4B',
  },
  overlayBottomBtnEdit: {
    backgroundColor: '#8A6538',
  },
  overlayBottomBtnClose: {
    backgroundColor: '#E5E4DD',
    borderWidth: 1,
    borderColor: '#D1C4AC',
  },
  overlayBottomBtnDelete: {
    backgroundColor: '#F7E7E9',
    borderWidth: 1,
    borderColor: '#EEB7C0',
  },
  overlayBottomBtnTextLight: {
    color: '#F1F1E8',
    fontSize: 10,
    fontFamily: 'Jost-Bold',
  },
  overlayBottomBtnTextDark: {
    color: '#21150D',
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
