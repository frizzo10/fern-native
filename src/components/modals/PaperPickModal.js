import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useLanguage from '../../hooks/useLanguage';
import PaperChips from '../trip/PaperChips';

// One-time "Pick your paper" screen shown after sign-in. onDone(id) gets the chosen stationery id ('' = plain / skipped).
export default function PaperPickModal({ visible, onDone }) {
  const { t } = useLanguage();
  const [value, setValue] = useState('');
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => onDone('')}>
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          <Text style={s.emoji}>🎨</Text>
          <Text style={s.title}>{t('paper_pick_title')}</Text>
          <Text style={s.sub}>{t('paper_pick_sub')}</Text>
          <PaperChips t={t} value={value} onPick={setValue} wrap />
        </ScrollView>
        <View style={s.footer}>
          <TouchableOpacity style={s.useBtn} activeOpacity={0.88} onPress={() => onDone(value)}>
            <Text style={s.useText}>{t('paper_pick_use')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.skipBtn} activeOpacity={0.7} onPress={() => onDone('')}>
            <Text style={s.skipText}>{t('paper_pick_skip')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFAF6' },
  body: { padding: 24, alignItems: 'center' },
  emoji: { fontSize: 44, marginTop: 12 },
  title: { fontSize: 28, color: '#8A4A4E', fontFamily: 'Jost-Bold', marginTop: 8, textAlign: 'center' },
  sub: { fontSize: 16, lineHeight: 23, color: '#8A5A5C', fontFamily: 'Jost-Medium', textAlign: 'center', marginTop: 8, marginBottom: 22 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#F3C9BD' },
  useBtn: { backgroundColor: '#C0475F', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  useText: { color: '#FFFFFF', fontSize: 17, fontFamily: 'Jost-Bold' },
  skipBtn: { paddingVertical: 12, alignItems: 'center' },
  skipText: { color: '#8A5A5C', fontSize: 15, fontFamily: 'Jost-SemiBold' },
});
