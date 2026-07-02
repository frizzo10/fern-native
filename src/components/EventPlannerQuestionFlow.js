import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import useLanguage from '../hooks/useLanguage';
import { colors, radius } from '../constants/tokens';
import { TextInputQuestion, ButtonSelectionQuestion, MultiSelectQuestion } from './EventPlannerQuestionTypes';

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  progressBarWrap: {
    height: 4,
    backgroundColor: '#E8D5C4',
    borderRadius: 2,
    marginBottom: 18,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.orange || '#E8651A',
    borderRadius: 2,
  },
  questionLabel: {
    fontSize: 11,
    fontFamily: 'Jost-Bold',
    letterSpacing: 1,
    color: '#9B8B7E',
    marginBottom: 14,
    textAlign: 'center',
  },
  controlsWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 28,
    gap: 8,
  },
  controlBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#D8C8B0',
    backgroundColor: '#FDFAF6',
  },
  controlBtnNext: {
    flex: 1.2,
    backgroundColor: colors.orange || '#E8651A',
    borderColor: colors.orange || '#E8651A',
  },
  controlBtnDisabled: {
    opacity: 0.4,
  },
  controlBtnText: {
    fontSize: 11,
    fontFamily: 'Jost-Bold',
    color: '#5C4A3D',
    letterSpacing: 0.5,
  },
  controlBtnTextNext: {
    color: '#FFFFFF',
  },
});

const QUESTIONS = [
  {
    id: 1,
    field: 'occasion',
    type: 'text',
    placeholder: 'e.g. anniversary, catching up with old friends, work impress',
  },
  {
    id: 2,
    field: 'guests',
    type: 'buttons',
    options: [
      { label: '2', value: 2 },
      { label: '4', value: 4 },
      { label: '6', value: 6 },
      { label: '8', value: 8 },
      { label: '10', value: 10 },
      { label: '12', value: 12 },
    ],
  },
  {
    id: 3,
    field: 'budget_per_person',
    type: 'buttons',
    options: [
      { label: '$15', value: 15 },
      { label: '$25', value: 25 },
      { label: '$40', value: 40 },
      { label: '$60', value: 60 },
      { label: '$100', value: 100 },
    ],
  },
  {
    id: 4,
    field: 'skill_level',
    type: 'buttons',
    options: [
      { label: 'Beginner', value: 'beginner' },
      { label: 'Intermediate', value: 'intermediate' },
      { label: 'Advanced', value: 'advanced' },
    ],
  },
  {
    id: 5,
    field: 'cook_time_available',
    type: 'buttons',
    options: [
      { label: '1 Hour', value: '1 hour' },
      { label: '2 Hours', value: '2 hours' },
      { label: '3+ Hours', value: '3+ hours' },
      { label: 'Whole Day', value: 'whole day' },
    ],
  },
  {
    id: 6,
    field: 'cuisine_preference',
    type: 'buttons',
    options: [
      { label: 'Surprise Me', value: 'surprise_me' },
      { label: 'Italian', value: 'Italian' },
      { label: 'French', value: 'French' },
      { label: 'American', value: 'American' },
      { label: 'Asian', value: 'Asian' },
      { label: 'Mediterranean', value: 'Mediterranean' },
      { label: 'Mexican', value: 'Mexican' },
      { label: 'Comfort Food', value: 'comfort_food' },
    ],
  },
  {
    id: 7,
    field: 'mood',
    type: 'buttons',
    options: [
      { label: 'Casual', value: 'casual' },
      { label: 'Elegant', value: 'elegant' },
      { label: 'Celebratory', value: 'celebratory' },
      { label: 'Intimate', value: 'intimate' },
    ],
  },
  {
    id: 8,
    field: 'season',
    type: 'buttons',
    options: [
      { label: 'Spring', value: 'spring' },
      { label: 'Summer', value: 'summer' },
      { label: 'Fall', value: 'fall' },
      { label: 'Winter', value: 'winter' },
    ],
  },
  {
    id: 9,
    field: 'dietary',
    type: 'multiselect',
    options: [
      { label: 'none', value: 'none' },
      { label: 'vegetarian', value: 'vegetarian' },
      { label: 'vegan', value: 'vegan' },
      { label: 'gluten-free', value: 'gluten-free' },
      { label: 'dairy-free', value: 'dairy-free' },
      { label: 'nut allergy', value: 'nut_allergy' },
      { label: 'shellfish allergy', value: 'shellfish_allergy' },
      { label: 'pescatarian', value: 'pescatarian' },
    ],
  },
];

export default function EventPlannerQuestionFlow({ onComplete, onClose }) {
  const { t } = useLanguage();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [intake, setIntake] = useState({
    occasion: '',
    guests: null,
    budget_per_person: null,
    skill_level: null,
    cook_time_available: null,
    cuisine_preference: null,
    mood: null,
    season: null,
    dietary: [],
  });

  const currentQuestion = QUESTIONS[currentIdx];
  const progress = (currentIdx + 1) / QUESTIONS.length;
  const isAnswered =
    currentQuestion.type === 'multiselect'
      ? true
      : intake[currentQuestion.field] !== null && intake[currentQuestion.field] !== '';

  const handleNext = () => {
    if (currentIdx < QUESTIONS.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      onComplete(intake);
    }
  };

  const handleBack = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  const handleSkip = () => {
    if (currentIdx < QUESTIONS.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      onComplete(intake);
    }
  };

  const handleValueChange = (value) => {
    setIntake((prev) => ({
      ...prev,
      [currentQuestion.field]: value,
    }));
  };

  const getQuestionTitle = () => {
    const key = `event_planner_q${currentQuestion.id}`;
    return t(key) || `Question ${currentQuestion.id}?`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.progressBarWrap}>
        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
      </View>

      <Text style={styles.questionLabel}>
        QUESTION {currentQuestion.id} OF 9
      </Text>

      {currentQuestion.type === 'text' && (
        <TextInputQuestion
          question={getQuestionTitle()}
          value={intake[currentQuestion.field]}
          onChange={handleValueChange}
          placeholder={currentQuestion.placeholder}
        />
      )}

      {currentQuestion.type === 'buttons' && (
        <ButtonSelectionQuestion
          question={getQuestionTitle()}
          options={currentQuestion.options}
          selected={intake[currentQuestion.field]}
          onChange={handleValueChange}
        />
      )}

      {currentQuestion.type === 'multiselect' && (
        <MultiSelectQuestion
          question={getQuestionTitle()}
          options={currentQuestion.options}
          selected={intake[currentQuestion.field]}
          onChange={handleValueChange}
        />
      )}

      <View style={styles.controlsWrap}>
        <TouchableOpacity
          style={[styles.controlBtn, currentIdx === 0 && styles.controlBtnDisabled]}
          onPress={handleBack}
          disabled={currentIdx === 0}
          activeOpacity={0.85}
        >
          <Text style={styles.controlBtnText}>← Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, currentIdx === QUESTIONS.length - 1 && styles.controlBtnDisabled]}
          onPress={handleSkip}
          disabled={currentIdx === QUESTIONS.length - 1}
          activeOpacity={0.85}
        >
          <Text style={styles.controlBtnText}>Skip →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlBtn,
            styles.controlBtnNext,
            !isAnswered && styles.controlBtnDisabled,
          ]}
          onPress={handleNext}
          disabled={!isAnswered}
          activeOpacity={0.85}
        >
          <Text style={[styles.controlBtnText, styles.controlBtnTextNext]}>
            {currentIdx === QUESTIONS.length - 1 ? '✨ BUILD' : 'NEXT →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
