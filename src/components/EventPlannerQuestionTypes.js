import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius } from '../constants/tokens';

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  questionLabel: {
    fontSize: 12,
    fontFamily: 'Jost-Bold',
    letterSpacing: 1.2,
    color: '#9B8B7E',
    marginBottom: 16,
    textAlign: 'center',
  },
  questionTitle: {
    fontSize: 32,
    fontFamily: 'PlayfairDisplay-Bold',
    color: '#1A0E05',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputWrap: {
    marginVertical: 12,
  },
  textInput: {
    borderWidth: 2,
    borderColor: '#4A8FD8',
    borderRadius: radius.lg,
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Jost-Regular',
    color: '#1A0E05',
    minHeight: 48,
  },
  textInputPlaceholder: {
    color: '#B0AEA9',
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  button: {
    borderWidth: 1.5,
    borderColor: '#D8C8B0',
    backgroundColor: '#FDFAF6',
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 6,
    marginVertical: 6,
  },
  buttonActive: {
    backgroundColor: colors.orange || '#E8651A',
    borderColor: colors.orange || '#E8651A',
  },
  buttonText: {
    fontSize: 14,
    fontFamily: 'Jost-SemiBold',
    color: '#5C4A3D',
  },
  buttonTextActive: {
    color: '#FFFFFF',
  },
  checkmarkWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.forest || '#1C3A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Jost-Bold',
  },
  multiSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D8C8B0',
    backgroundColor: '#FDFAF6',
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginHorizontal: 4,
    marginVertical: 6,
  },
  multiSelectButtonActive: {
    backgroundColor: '#EAF3E7',
    borderColor: colors.forest || '#1C3A1A',
  },
  multiSelectButtonText: {
    fontSize: 13,
    fontFamily: 'Jost-Regular',
    color: '#5C4A3D',
  },
  multiSelectButtonTextActive: {
    color: colors.forest || '#1C3A1A',
    fontFamily: 'Jost-SemiBold',
  },
});

export function TextInputQuestion({ question, value, onChange, placeholder }) {
  return (
    <View style={styles.container}>
      <Text style={styles.questionTitle}>{question}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.textInput}
          placeholder={placeholder}
          placeholderTextColor="#B0AEA9"
          value={value}
          onChangeText={onChange}
          returnKeyType="done"
        />
      </View>
    </View>
  );
}

export function ButtonSelectionQuestion({ question, options, selected, onChange }) {
  return (
    <View style={styles.container}>
      <Text style={styles.questionTitle}>{question}</Text>
      <View style={styles.buttonGrid}>
        {options.map((option) => {
          const isSelected = selected === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.button, isSelected ? styles.buttonActive : null]}
              onPress={() => onChange(option.value)}
              activeOpacity={0.85}
            >
              <Text style={[styles.buttonText, isSelected ? styles.buttonTextActive : null]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function MultiSelectQuestion({ question, options, selected, onChange }) {
  const toggleOption = (value) => {
    const isCurrentlySelected = selected.includes(value);
    if (isCurrentlySelected) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.questionTitle}>{question}</Text>
      <View style={styles.buttonGrid}>
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.multiSelectButton, isSelected ? styles.multiSelectButtonActive : null]}
              onPress={() => toggleOption(option.value)}
              activeOpacity={0.85}
            >
              {isSelected && (
                <View style={styles.checkmarkWrap}>
                  <Text style={styles.checkmark}>✓</Text>
                </View>
              )}
              <Text
                style={[
                  styles.multiSelectButtonText,
                  isSelected ? styles.multiSelectButtonTextActive : null,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
