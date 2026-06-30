import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/tokens';
import { useTranslation } from '../i18n/LocaleContext';

export default function RecipesScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{t('myRecipesTitle')}</Text>
      <Text style={styles.sub}>{t('comingSoon')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor: colors.parch, alignItems:'center', justifyContent:'center' },
  text:      { fontSize:24, fontWeight:'800', color: colors.ink, fontFamily:'serif' },
  sub:       { fontSize:14, color: colors.brown, marginTop:6 },
});
