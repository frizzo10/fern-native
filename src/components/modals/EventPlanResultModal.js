import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { colors, radius } from '../../constants/tokens';
import useLanguage from '../../hooks/useLanguage';
import { useTour } from '../../services/TourContext';
import useEntitlement from '../../hooks/useEntitlement';
import { TIERS } from '../../constants/tiers';
import UpgradeGateModal from '../UpgradeGateModal';

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#F5F2ED',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: '#D9CFBF',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    maxHeight: '92%',
  },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    position: 'relative',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontFamily: 'PlayfairDisplay-Bold',
    color: '#1A0E05',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Jost-Regular',
    color: '#9B8B7E',
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E5E4DD',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  closeBtnText: {
    fontSize: 26,
    color: '#8C8B82',
    fontFamily: 'Jost-Bold',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  overviewCard: {
    backgroundColor: '#EC6518',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  overviewText: {
    fontSize: 14,
    fontFamily: 'Jost-Regular',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Jost-Bold',
    letterSpacing: 1.2,
    color: '#EC6518',
    marginTop: 20,
    marginBottom: 12,
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
    height: 80,
    backgroundColor: '#F0EBE3',
  },
  recipeContent: {
    flex: 1,
    padding: 12,
  },
  recipeTitle: {
    fontSize: 14,
    fontFamily: 'PlayfairDisplay-SemiBold',
    color: '#1A0E05',
    marginBottom: 4,
  },
  recipeDesc: {
    fontSize: 12,
    fontFamily: 'Jost-Regular',
    color: '#7B5E3E',
    marginBottom: 6,
    lineHeight: 16,
    numberOfLines: 2,
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recipeTime: {
    fontSize: 11,
    fontFamily: 'Jost-Regular',
    color: '#999',
  },
  aiBadge: {
    backgroundColor: '#F0EAE0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 10,
    fontFamily: 'Jost-Bold',
    color: '#7B5E3E',
  },
  tapForRecipe: {
    fontSize: 11,
    fontFamily: 'Jost-Bold',
    color: '#EC6518',
    marginTop: 6,
  },
  bottomButtonsWrap: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  bottomBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8C8B0',
    backgroundColor: '#FDFAF6',
  },
  bottomBtnPrimary: {
    backgroundColor: colors.orange || '#E8651A',
    borderColor: colors.orange || '#E8651A',
    flex: 1.2,
  },
  bottomBtnText: {
    fontSize: 12,
    fontFamily: 'Jost-Bold',
    color: '#5C4A3D',
  },
  bottomBtnTextPrimary: {
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Jost-Regular',
    color: '#7B5E3E',
  },
});

export default function EventPlanResultModal({
  visible,
  planResult,
  onClose,
  onRecipeSelect,
  user,
}) {
  const { t } = useLanguage();
  const { maybeAutoStart } = useTour();
  const { hasAccess } = useEntitlement();

  useEffect(() => {
    if (visible) maybeAutoStart('dinner_party');
  }, [visible]);

  const handleShareShoppingList = async () => {
    if (!planResult?.shoppingList) return;
    const listText = planResult.shoppingList
      .map((cat) => `${cat.category}\n${cat.items.join('\n')}`)
      .join('\n\n');
    try {
      await Share.share({
        message: `${t('shopping_list_for')} ${planResult.title}\n\n${listText}`,
        title: t('shopping_list'),
      });
    } catch (e) {
      console.warn('Share failed:', e);
    }
  };

  if (visible && !hasAccess(TIERS.PRO_MAX)) {
    return <UpgradeGateModal visible={visible} onClose={onClose} tier={TIERS.PRO_MAX} />;
  }

  if (!planResult) return null;

  const { menu = {} } = planResult;
  const sections = [
    { title: t('appetizers').toUpperCase(), key: 'appetizers', recipes: menu.appetizers || [] },
    { title: t('main_courses').toUpperCase(), key: 'mains', recipes: menu.mains || [] },
    { title: t('sides').toUpperCase(), key: 'sides', recipes: menu.sides || [] },
    { title: t('desserts').toUpperCase(), key: 'desserts', recipes: menu.desserts || [] },
  ];

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ width: '100%' }}
        >
          <View style={styles.sheet}>
            <View style={styles.headerWrap}>
              <View style={styles.headerContent}>
                <Text style={styles.title}>{planResult.title || t('event_plan')}</Text>
                <Text style={styles.subtitle}>{t('pro_max_ai_plans_every_detail')}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
                <Text style={styles.closeBtnText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              showsVerticalScrollIndicator={false}
            >
              {planResult.overview && (
                <View style={styles.overviewCard}>
                  <Text style={styles.overviewText}>{planResult.overview}</Text>
                </View>
              )}

              <Text style={{ ...styles.sectionTitle, marginTop: 12 }}>📋 {t('menu')}</Text>

              {sections.map((section) => (
                <View key={section.key}>
                  {section.recipes.length > 0 && (
                    <>
                      <Text style={styles.sectionTitle}>{section.title}</Text>
                      {section.recipes.map((recipe, idx) => (
                        <TouchableOpacity
                          key={`${section.key}-${idx}`}
                          style={styles.recipeCard}
                          onPress={() => onRecipeSelect(recipe)}
                          activeOpacity={0.85}
                        >
                          {recipe.image && (
                            <Image
                              source={{ uri: recipe.image }}
                              style={styles.recipeImage}
                              resizeMode="cover"
                            />
                          )}
                          {!recipe.image && <View style={styles.recipeImage} />}
                          <View style={styles.recipeContent}>
                            <Text style={styles.recipeTitle}>{recipe.title}</Text>
                            <Text
                              style={styles.recipeDesc}
                              numberOfLines={2}
                              ellipsizeMode="tail"
                            >
                              {recipe.description}
                            </Text>
                            <View style={styles.recipeMeta}>
                              <View>
                                {recipe.time && (
                                  <Text style={styles.recipeTime}>⏱ {recipe.time}</Text>
                                )}
                                <Text style={styles.tapForRecipe}>{t('tap_for_full_recipe')}</Text>
                              </View>
                              <Text style={styles.aiBadge}>✨ {t('ai')}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </View>
              ))}

              {planResult.drinks && planResult.drinks.length > 0 && (
                <View>
                  <Text style={styles.sectionTitle}>🍷 {t('beverages').toUpperCase()}</Text>
                  {planResult.drinks.map((drink, idx) => (
                    <View key={idx} style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'Jost-SemiBold', color: '#1A0E05' }}>
                        {drink.name}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: 'Jost-Regular', color: '#7B5E3E' }}>
                        {drink.notes}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {planResult.hostTips && planResult.hostTips.length > 0 && (
                <View>
                  <Text style={styles.sectionTitle}>💡 {t('host_tips').toUpperCase()}</Text>
                  {planResult.hostTips.map((tip, idx) => (
                    <Text
                      key={idx}
                      style={{
                        fontSize: 12,
                        fontFamily: 'Jost-Regular',
                        color: '#7B5E3E',
                        marginBottom: 8,
                        lineHeight: 18,
                      }}
                    >
                      • {tip}
                    </Text>
                  ))}
                </View>
              )}

              <View style={styles.bottomButtonsWrap}>
                <TouchableOpacity
                  style={styles.bottomBtn}
                  onPress={handleShareShoppingList}
                  activeOpacity={0.85}
                >
                  <Text style={styles.bottomBtnText}>📋 {t('copy_list')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.bottomBtn}
                  activeOpacity={0.85}
                >
                  <Text style={styles.bottomBtnText}>🎵 {t('music')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bottomBtn, styles.bottomBtnPrimary]}
                  onPress={onClose}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.bottomBtnText, styles.bottomBtnTextPrimary]}>
                    ✨ {t('new_plan')}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
