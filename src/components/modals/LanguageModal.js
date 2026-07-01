import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../constants/tokens';

export default function LanguageModal({ visible, onClose, currentLanguage, onSelectLanguage, t }) {
  const languages = [
    { code: 'en', label: 'English', detail: 'EN', flag: '🇬🇧' },
    { code: 'es', label: 'Español', detail: 'ES', flag: '🇪🇸' }
  ];

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('select_language')}</Text>
            <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.optionsWrap}>
            {languages.map((lang) => {
              const isSelected = currentLanguage === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  activeOpacity={0.88}
                  style={[styles.optionRow, isSelected ? styles.optionRowActive : null]}
                  onPress={() => {
                    onSelectLanguage(lang.code);
                    onClose();
                  }}
                >
                  <View style={styles.optionLeft}>
                    <Text style={styles.flag}>{lang.flag}</Text>
                    <View style={styles.langTexts}>
                      <Text style={[styles.langLabel, isSelected ? styles.langLabelActive : null]}>
                        {lang.label}
                      </Text>
                      <Text style={styles.langDetail}>{lang.detail}</Text>
                    </View>
                  </View>
                  {isSelected ? (
                    <View style={styles.checkmarkWrap}>
                      <Text style={styles.checkmark}>✓</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#F5F2ED',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: '#D9CFBF',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    color: '#20140B',
    fontFamily: 'Jost-Bold',
    fontSize: 18,
    lineHeight: 24,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D4C3AD',
    backgroundColor: '#EFE9DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 24,
    lineHeight: 26,
    color: '#8C6B46',
    marginTop: -2,
  },
  optionsWrap: {
    gap: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E6DCCF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionRowActive: {
    borderColor: colors.forest || '#1C3A1A',
    backgroundColor: '#EAF3E7',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  flag: {
    fontSize: 28,
  },
  langTexts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langLabel: {
    fontSize: 16,
    color: '#20140B',
    fontFamily: 'Jost-SemiBold',
  },
  langLabelActive: {
    color: colors.forest || '#1C3A1A',
  },
  langDetail: {
    fontSize: 12,
    color: '#9C835F',
    backgroundColor: '#F3EEE4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'Jost-Bold',
  },
  checkmarkWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.forest || '#1C3A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
