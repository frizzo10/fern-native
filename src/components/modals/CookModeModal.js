import React, { useEffect, useState } from 'react';
import {
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useLanguage from '../../hooks/useLanguage';
import TechniqueHelpModal from './TechniqueHelpModal';

export default function CookModeModal({ visible, recipe, user, onClose }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [stepIndex, setStepIndex] = useState(0);
  const [isIngredientsOpen, setIsIngredientsOpen] = useState(false);
  const [isHelpVisible, setIsHelpVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setStepIndex(0);
      setIsIngredientsOpen(false);
      setIsHelpVisible(false);
    }
  }, [visible, recipe?.id]);

  if (!visible || !recipe) return null;

  const steps = Array.isArray(recipe.methodSteps) ? recipe.methodSteps : [];
  const total = steps.length;
  const currentStep = steps[stepIndex] || '';
  const isLastStep = stepIndex >= total - 1;
  const progressPct = total ? ((stepIndex + 1) / total) * 100 : 0;

  const handleClose = () => {
    setIsHelpVisible(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <ImageBackground
        source={recipe.image ? { uri: recipe.image } : require('../../../assets/icon.png')}
        style={styles.background}
      >
        <View style={[styles.darkPanel, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle} numberOfLines={1}>{recipe.title}</Text>
            <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={handleClose}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.ingredientsBar}
            activeOpacity={0.85}
            onPress={() => setIsIngredientsOpen((prev) => !prev)}
          >
            <Text style={styles.ingredientsBarText}>📋 {t('ingredients_title').toUpperCase()}</Text>
            <Text style={styles.ingredientsChevron}>{isIngredientsOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {isIngredientsOpen ? (
            <ScrollView style={styles.ingredientsList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {(recipe.ingredients || []).map((ingredient, idx) => (
                <Text key={`cook-ing-${idx}`} style={styles.ingredientItemText}>- {ingredient}</Text>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>

          <Text style={styles.stepCounter}>{t('cook_mode_step_of', { current: stepIndex + 1, total })}</Text>
          <Text style={styles.stepText}>{currentStep}</Text>

          <View style={[styles.controlsRow, { paddingBottom: insets.bottom + 14 }]}>
            <TouchableOpacity
              style={[styles.controlBtn, stepIndex === 0 ? styles.controlBtnDisabled : null]}
              activeOpacity={0.85}
              disabled={stepIndex === 0}
              onPress={() => setStepIndex((prev) => Math.max(0, prev - 1))}
            >
              <Text style={styles.controlBtnText}>{t('cook_mode_back_btn')}</Text>
            </TouchableOpacity>

            <Text style={styles.stepFraction}>{stepIndex + 1} / {total}</Text>

            <TouchableOpacity
              style={styles.helpBtn}
              activeOpacity={0.85}
              onPress={() => setIsHelpVisible(true)}
            >
              <Text style={styles.helpBtnText}>{t('cook_mode_help_video_btn')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.finishBtn}
              activeOpacity={0.85}
              onPress={() => {
                if (isLastStep) {
                  handleClose();
                } else {
                  setStepIndex((prev) => Math.min(total - 1, prev + 1));
                }
              }}
            >
              <Text style={styles.finishBtnText}>
                {isLastStep ? t('cook_mode_finish_btn') : t('cook_mode_next_btn')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>

      <TechniqueHelpModal
        visible={isHelpVisible}
        recipeTitle={recipe.title}
        step={currentStep}
        user={user}
        onClose={() => setIsHelpVisible(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#000000',
  },
  darkPanel: {
    backgroundColor: 'rgba(10,16,10,0.86)',
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    color: '#F1E7D2',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 20,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#F1E7D2',
    fontSize: 20,
    lineHeight: 22,
  },
  ingredientsBar: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 12,
  },
  ingredientsBarText: {
    color: '#D9CFBF',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  ingredientsChevron: {
    color: '#D9CFBF',
    fontSize: 12,
  },
  ingredientsList: {
    maxHeight: 160,
    marginTop: 4,
  },
  ingredientItemText: {
    color: '#D9CFBF',
    fontFamily: 'Jost-Regular',
    fontSize: 13,
    lineHeight: 22,
  },
  progressTrack: {
    marginTop: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3F9142',
    borderRadius: 2,
  },
  stepCounter: {
    marginTop: 14,
    textAlign: 'center',
    color: '#5FBF63',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
    letterSpacing: 2,
  },
  stepText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#F1E7D2',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 20,
    lineHeight: 28,
  },
  controlsRow: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  controlBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  controlBtnDisabled: {
    opacity: 0.4,
  },
  controlBtnText: {
    color: '#F1E7D2',
    fontFamily: 'Jost-Bold',
    fontSize: 13,
  },
  stepFraction: {
    color: '#B4A488',
    fontFamily: 'Jost-Regular',
    fontSize: 13,
  },
  helpBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  helpBtnText: {
    color: '#F1E7D2',
    fontFamily: 'Jost-Bold',
    fontSize: 13,
  },
  finishBtn: {
    borderRadius: 999,
    backgroundColor: '#E96B1E',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  finishBtnText: {
    color: '#FFF5EC',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
  },
});
