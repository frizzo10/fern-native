import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import useLanguage from '../../hooks/useLanguage';
import { fetchWinePairingsForRecipe } from '../../services/winePairingService';

function iconForCategory(category) {
  const normalized = String(category || '').toLowerCase();
  if (normalized.includes('beer')) return '🍺';
  if (normalized.includes('non-alcoholic') || normalized.includes('nonalcoholic') || normalized.includes('mocktail')) return '💧';
  if (normalized.includes('cocktail')) return '🍸';
  if (normalized.includes('spirit') || normalized.includes('whiskey') || normalized.includes('whisky')) return '🥃';
  return '🍷';
}

export default function RecipeWinePairingModal({ visible, recipe, user, onClose }) {
  const { t, locale } = useLanguage();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  const [pairings, setPairings] = useState([]);
  const [didCopy, setDidCopy] = useState(false);

  useEffect(() => {
    if (!visible || !recipe) return;
    let cancelled = false;
    setIsLoading(true);
    setError('');
    setSummary('');
    setPairings([]);
    setDidCopy(false);

    fetchWinePairingsForRecipe({ userId: user?.id, recipe, locale, token: user?.token })
      .then(({ summary: nextSummary, pairings: nextPairings }) => {
        if (cancelled) return;
        setSummary(nextSummary);
        setPairings(nextPairings);
      })
      .catch(() => {
        if (cancelled) return;
        setError(t('wine_pairing_fetch_error'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, recipe?.id]);

  const handleCopy = () => {
    const lines = pairings.map((item) => `${item.name}${item.price ? ` (${item.price})` : ''} — ${item.description}`);
    const text = [summary, ...lines].filter(Boolean).join('\n\n');
    Clipboard.setString(text);
    setDidCopy(true);
  };

  if (!visible || !recipe) return null;

  return (
    <View style={[styles.overlayRoot, { width: screenWidth, height: screenHeight }]}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTap} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>{t('recipe_wine_pairing_title')}</Text>
              <Text style={styles.subtitle}>{t('recipe_wine_pairing_subtitle')}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {isLoading ? (
              <View style={styles.loadingWrap}>
                <Text style={styles.loadingEmoji}>🍷</Text>
                <Text style={styles.loadingTitle}>{t('wine_pairing_loading_title')}</Text>
                <Text style={styles.loadingSubtitle}>{t('wine_pairing_loading_subtitle')}</Text>
                <ActivityIndicator size="small" color="#7B1E3A" style={{ marginTop: 14 }} />
              </View>
            ) : error ? (
              <View style={styles.loadingWrap}>
                <Text style={styles.loadingEmoji}>🍷</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <>
                {summary ? <Text style={styles.summaryText}>"{summary}"</Text> : null}
                {pairings.map((item, index) => (
                  <View key={`recipe-wine-pairing-${index}`} style={styles.card}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardIcon}>{iconForCategory(item.category)}</Text>
                      <View style={styles.cardTitleWrap}>
                        <Text style={styles.cardTitle}>{item.name}</Text>
                        <Text style={styles.cardCategory}>{(item.category || item.type || '').toUpperCase()}</Text>
                      </View>
                      {item.price ? (
                        <View style={styles.priceBadge}>
                          <Text style={styles.priceBadgeText}>{item.price}</Text>
                        </View>
                      ) : null}
                    </View>
                    {item.description ? <Text style={styles.cardDescription}>{item.description}</Text> : null}
                  </View>
                ))}
              </>
            )}
          </ScrollView>

          {!isLoading && !error ? (
            <View style={styles.footerRow}>
              <TouchableOpacity style={styles.copyBtn} activeOpacity={0.85} onPress={handleCopy}>
                <Text style={styles.copyBtnText}>{didCopy ? t('copied_btn') : t('copy_btn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.doneBtn} activeOpacity={0.85} onPress={onClose}>
                <Text style={styles.doneBtnText}>{t('done_btn')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10,
    elevation: 10,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.34)',
    justifyContent: 'flex-end',
  },
  backdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    maxHeight: '88%',
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
  headerTextWrap: {
    flex: 1,
  },
  title: {
    color: '#2A1A11',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 22,
    lineHeight: 28,
  },
  subtitle: {
    marginTop: 4,
    color: '#8C7355',
    fontFamily: 'Jost-Regular',
    fontSize: 12,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E5E4DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#2A1A11',
    fontSize: 20,
    lineHeight: 22,
    fontFamily: 'Jost-Regular',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingEmoji: {
    fontSize: 44,
    marginBottom: 14,
  },
  loadingTitle: {
    color: '#2A1A11',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 18,
  },
  loadingSubtitle: {
    marginTop: 6,
    color: '#8C7355',
    fontFamily: 'PlayfairDisplay-Italic',
    fontSize: 13,
    textAlign: 'center',
  },
  errorText: {
    marginTop: 6,
    color: '#B03A3A',
    fontFamily: 'Jost-Regular',
    fontSize: 13,
    textAlign: 'center',
  },
  summaryText: {
    color: '#2E2117',
    fontFamily: 'Jost-Italic',
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: '#E0D4C4',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardIcon: {
    fontSize: 24,
    lineHeight: 28,
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    color: '#2A1A11',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 16,
    lineHeight: 22,
  },
  cardCategory: {
    marginTop: 2,
    color: '#7B1E3A',
    fontFamily: 'Jost-Bold',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  priceBadge: {
    borderRadius: 8,
    backgroundColor: '#F3E4E8',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  priceBadgeText: {
    color: '#7B1E3A',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
  },
  cardDescription: {
    marginTop: 10,
    color: '#7B5E3E',
    fontFamily: 'PlayfairDisplay-Italic',
    fontSize: 13,
    lineHeight: 20,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: '#E0D4C4',
  },
  copyBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D9CFBF',
    borderRadius: 14,
    backgroundColor: '#F3EFE8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  copyBtnText: {
    color: '#2A1A11',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
  },
  doneBtn: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#E96B1E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  doneBtnText: {
    color: '#FFF5EC',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
  },
});
