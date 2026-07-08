import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import useLanguage from '../../hooks/useLanguage';

function formatIngredient(ingredient) {
  const amount = String(ingredient?.amount || '').trim();
  const unit = String(ingredient?.unit || '').trim();
  const item = String(ingredient?.item || '').trim();
  return [amount, unit, item].filter(Boolean).join(' ');
}

export default function LeftoverRecipeDetailModal({
  recipe,
  onClose,
}) {
  const { t } = useLanguage();

  return (
    <Modal
      transparent
      animationType="slide"
      visible={Boolean(recipe)}
      onRequestClose={onClose}
    >
      <View style={styles.detailBackdrop}>
        <TouchableOpacity style={styles.detailBackdropTap} activeOpacity={1} onPress={onClose} />
        {recipe ? (
          <View style={styles.detailSheet}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
              <View style={styles.detailHeaderRow}>
                <Text style={styles.detailTitle}>{`${recipe.emoji} ${recipe.title}`}</Text>
                <TouchableOpacity style={styles.detailCloseBtn} activeOpacity={0.85} onPress={onClose}>
                  <Text style={styles.detailCloseText}>×</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.detailMetaRow}>
                <Text style={styles.detailMetaText}>{`🌍 ${recipe.cuisine || t('leftover_unknown_cuisine')}`}</Text>
                <Text style={styles.detailMetaText}>{`⏱ ${recipe.time || t('leftover_unknown_time')}`}</Text>
                <View style={styles.detailDifficultyPill}>
                  <Text style={styles.detailDifficultyText}>{recipe.difficulty || 'Medium'}</Text>
                </View>
              </View>

              <Text style={styles.detailDescription}>{recipe.description}</Text>

              <Text style={styles.sectionTitle}>{t('ingredients_title')}</Text>
              <View style={styles.sectionDivider} />
              {(Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map((ingredient, index) => (
                <Text key={`leftover-ingredient-${index}`} style={styles.sectionItemText}>{`• ${formatIngredient(ingredient)}`}</Text>
              ))}

              <Text style={styles.sectionTitle}>{t('instructions_title')}</Text>
              <View style={styles.sectionDivider} />
              {(Array.isArray(recipe.instructions) ? recipe.instructions : []).map((step, index) => (
                <View key={`leftover-step-${index}`} style={styles.stepRow}>
                  <View style={styles.stepNumWrap}>
                    <Text style={styles.stepNumText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}

              <TouchableOpacity style={styles.doneBtn} activeOpacity={0.85} onPress={onClose}>
                <Text style={styles.doneBtnText}>{t('done_btn')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  detailBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.34)',
    justifyContent: 'flex-end',
  },
  detailBackdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  detailSheet: {
    maxHeight: '88%',
    backgroundColor: '#F5F2ED',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#D4C8B7',
    overflow: 'hidden',
  },
  detailContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 26,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  detailTitle: {
    flex: 1,
    color: '#2A1A11',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 28,
    lineHeight: 35,
  },
  detailCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9E2D8',
  },
  detailCloseText: {
    color: '#8C6B46',
    fontFamily: 'Jost-Bold',
    fontSize: 24,
    lineHeight: 24,
  },
  detailMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailMetaText: {
    color: '#7B5E3E',
    fontFamily: 'Jost-Medium',
    fontSize: 12,
  },
  detailDifficultyPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C9B394',
    backgroundColor: '#EFE7D7',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  detailDifficultyText: {
    color: '#6A4F2E',
    fontFamily: 'Jost-Bold',
    fontSize: 11,
  },
  detailDescription: {
    marginTop: 12,
    color: '#3B2A1B',
    fontFamily: 'Jost-Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  sectionTitle: {
    marginTop: 16,
    color: '#4C3A2B',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
    letterSpacing: 1.2,
  },
  sectionDivider: {
    marginTop: 6,
    height: 1,
    backgroundColor: '#D9CCBA',
  },
  sectionItemText: {
    marginTop: 8,
    color: '#2A1A11',
    fontFamily: 'Jost-Regular',
    fontSize: 14,
    lineHeight: 21,
  },
  stepRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNumWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#184D22',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: {
    color: '#F3F8F2',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
  },
  stepText: {
    flex: 1,
    color: '#2C1E12',
    fontFamily: 'Jost-Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  doneBtn: {
    marginTop: 18,
    backgroundColor: '#184D22',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  doneBtnText: {
    color: '#EBF4E8',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
  },
});
