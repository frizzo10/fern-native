import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import useLanguage from '../../hooks/useLanguage';
import useEntitlement from '../../hooks/useEntitlement';
import { FEATURE_TIERS } from '../../constants/featureAccess';
import UpgradeGateModal from '../UpgradeGateModal';
import { fetchIngredientSubstitutions } from '../../services/substitutionService';

// Rendered as an absolute overlay (not a nested RN <Modal>) like ScaleRecipeModal,
// because nested native modals inside RecipeDetailModal get stuck on iOS.
export default function IngredientSubstitutionModal({ visible, recipe, ingredient, token, onClose }) {
  const { t, locale } = useLanguage();
  const { hasAccess } = useEntitlement();
  const { width, height } = useWindowDimensions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);

  const allowed = hasAccess(FEATURE_TIERS.ingredient_substitutions);

  useEffect(() => {
    if (!visible || !ingredient || !allowed) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setResults([]);
    fetchIngredientSubstitutions({ recipeTitle: recipe?.title, ingredient, locale, token })
      .then((rows) => {
        if (cancelled) return;
        if (!rows.length) setError(t('substitution_empty'));
        setResults(rows);
      })
      .catch(() => {
        if (!cancelled) setError(t('substitution_error'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ingredient, allowed]);

  if (!visible || !ingredient) return null;

  if (!allowed) {
    return <UpgradeGateModal visible={visible} onClose={onClose} tier={FEATURE_TIERS.ingredient_substitutions} />;
  }

  return (
    <View style={[styles.overlayRoot, { width, height }]}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>{t('substitution_title')}</Text>
              <Text style={styles.subtitle}>{ingredient}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {loading ? <ActivityIndicator color="#184029" style={styles.spinner} /> : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {results.map((row, idx) => (
              <View key={`sub-${idx}`} style={styles.card}>
                <Text style={styles.cardName}>{row.name}</Text>
                {row.amount ? <Text style={styles.cardAmount}>{row.amount}</Text> : null}
                {row.note ? <Text style={styles.cardNote}>{row.note}</Text> : null}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: { position: 'absolute', top: 0, left: 0, zIndex: 10, elevation: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.34)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '80%',
    backgroundColor: '#FBF8F2',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#D9CFBF',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E0D4C4',
    gap: 10,
  },
  headerTextWrap: { flex: 1 },
  title: { color: '#2A1A11', fontFamily: 'PlayfairDisplay-Bold', fontSize: 22 },
  subtitle: { marginTop: 4, color: '#8C7355', fontFamily: 'Jost-Regular', fontSize: 13 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E5E4DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#2A1A11', fontSize: 20, lineHeight: 22, fontFamily: 'Jost-Regular' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, gap: 10 },
  spinner: { marginVertical: 24 },
  errorText: { color: '#8C3B2A', fontFamily: 'Jost-Regular', fontSize: 14, textAlign: 'center', marginVertical: 16 },
  card: { borderRadius: 14, backgroundColor: '#EDEAE2', padding: 14 },
  cardName: { color: '#2A1A11', fontFamily: 'Jost-Medium', fontSize: 16 },
  cardAmount: { marginTop: 3, color: '#184029', fontFamily: 'Jost-Regular', fontSize: 13 },
  cardNote: { marginTop: 4, color: '#795A39', fontFamily: 'Jost-Regular', fontSize: 12, lineHeight: 17 },
});
