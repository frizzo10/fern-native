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
import { fetchPlatingCoach } from '../../services/platingCoachService';

export default function RecipePlatingCoachModal({ visible, recipe, user, onClose }) {
  const { t, locale } = useLanguage();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [vibe, setVibe] = useState('');
  const [plateChoice, setPlateChoice] = useState('');
  const [composition, setComposition] = useState([]);
  const [garnishes, setGarnishes] = useState([]);
  const [sauceApplication, setSauceApplication] = useState('');

  useEffect(() => {
    if (!visible || !recipe) return;
    let cancelled = false;
    setIsLoading(true);
    setError('');
    setVibe('');
    setPlateChoice('');
    setComposition([]);
    setGarnishes([]);
    setSauceApplication('');

    fetchPlatingCoach({ userId: user?.id, recipe, locale, token: user?.token })
      .then((result) => {
        if (cancelled) return;
        setVibe(result.vibe);
        setPlateChoice(result.plateChoice);
        setComposition(result.composition);
        setGarnishes(result.garnishes);
        setSauceApplication(result.sauceApplication);
      })
      .catch(() => {
        if (cancelled) return;
        setError(t('plating_fetch_error'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, recipe?.id]);

  if (!visible || !recipe) return null;

  return (
    <View style={[styles.overlayRoot, { width: screenWidth, height: screenHeight }]}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTap} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>{t('recipe_plating_coach_title')}</Text>
              <Text style={styles.subtitle}>{t('recipe_plating_coach_subtitle')}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {isLoading ? (
              <View style={styles.loadingWrap}>
                <Text style={styles.loadingEmoji}>🎨</Text>
                <Text style={styles.loadingTitle}>{t('plating_loading_title')}</Text>
                <Text style={styles.loadingSubtitle}>{t('plating_loading_subtitle')}</Text>
                <ActivityIndicator size="small" color="#1C512A" style={{ marginTop: 14 }} />
              </View>
            ) : error ? (
              <View style={styles.loadingWrap}>
                <Text style={styles.loadingEmoji}>🎨</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <>
                {vibe ? (
                  <View style={styles.vibeBadgeWrap}>
                    <View style={styles.vibeBadge}>
                      <Text style={styles.vibeBadgeText}>{vibe.toUpperCase()}</Text>
                    </View>
                  </View>
                ) : null}

                {plateChoice ? (
                  <View style={styles.card}>
                    <Text style={styles.cardLabel}>{t('plating_plate_label')}</Text>
                    <Text style={styles.cardText}>{plateChoice}</Text>
                  </View>
                ) : null}

                {composition.length ? (
                  <View style={styles.card}>
                    <Text style={styles.cardLabel}>{t('plating_composition_label')}</Text>
                    {composition.map((step, index) => (
                      <View key={`plating-step-${index}`} style={styles.stepRow}>
                        <Text style={styles.stepNum}>{index + 1}.</Text>
                        <Text style={styles.stepText}>{step}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {garnishes.length ? (
                  <View style={styles.card}>
                    <Text style={styles.cardLabel}>{t('plating_garnishes_label')}</Text>
                    <View style={styles.chipRow}>
                      {garnishes.map((garnish, index) => (
                        <View key={`plating-garnish-${index}`} style={styles.chip}>
                          <Text style={styles.chipText}>{garnish}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {sauceApplication ? (
                  <View style={styles.card}>
                    <Text style={styles.cardLabel}>{t('plating_sauce_label')}</Text>
                    <Text style={styles.cardText}>{sauceApplication}</Text>
                  </View>
                ) : null}

                <TouchableOpacity style={styles.doneBtn} activeOpacity={0.85} onPress={onClose}>
                  <Text style={styles.doneBtnText}>{t('done_btn').toUpperCase()}</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
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
    paddingBottom: 30,
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
  vibeBadgeWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  vibeBadge: {
    borderRadius: 999,
    backgroundColor: '#1C512A',
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  vibeBadgeText: {
    color: '#F2F0E8',
    fontFamily: 'Jost-Bold',
    fontSize: 13,
    letterSpacing: 1.5,
  },
  card: {
    borderWidth: 1,
    borderColor: '#E0D4C4',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 14,
  },
  cardLabel: {
    color: '#8C6B3F',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  cardText: {
    color: '#2E2117',
    fontFamily: 'Jost-Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  stepNum: {
    color: '#2E2117',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
    lineHeight: 22,
  },
  stepText: {
    flex: 1,
    color: '#2E2117',
    fontFamily: 'Jost-Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    borderRadius: 999,
    backgroundColor: '#E4EEE1',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    color: '#1C512A',
    fontFamily: 'Jost-Bold',
    fontSize: 13,
  },
  doneBtn: {
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: '#E96B1E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  doneBtnText: {
    color: '#FFF5EC',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
});
