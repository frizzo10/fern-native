import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import useLanguage from '../../hooks/useLanguage';
import { fetchTechniqueHelp } from '../../services/techniqueHelpService';

function youtubeSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export default function TechniqueHelpModal({ visible, recipeTitle, step, onClose }) {
  const { t, locale } = useLanguage();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [technique, setTechnique] = useState('');
  const [query, setQuery] = useState('');
  const [tip, setTip] = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setIsLoading(true);
    setError('');
    setTechnique('');
    setQuery('');
    setTip('');

    fetchTechniqueHelp({ recipeTitle, step, locale })
      .then((result) => {
        if (cancelled) return;
        setTechnique(result.technique);
        setQuery(result.query);
        setTip(result.tip);
      })
      .catch(() => {
        if (cancelled) return;
        setError(t('technique_help_fetch_error'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, step]);

  if (!visible) return null;

  const videoRows = (technique || query) ? [
    {
      title: technique || query,
      subtitle: query,
      searchQuery: query || technique,
    },
    {
      title: t('technique_help_full_recipe_row_title', { title: recipeTitle }),
      subtitle: t('technique_help_full_recipe_row_subtitle', { title: recipeTitle }),
      searchQuery: t('technique_help_full_recipe_row_subtitle', { title: recipeTitle }),
    },
    {
      title: t('technique_help_beginner_row_title', { technique: technique || query }),
      subtitle: t('technique_help_beginner_row_subtitle', { query: query || technique }),
      searchQuery: t('technique_help_beginner_row_subtitle', { query: query || technique }),
    },
  ] : [];

  return (
    <View style={[styles.overlayRoot, { width: screenWidth, height: screenHeight }]}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTap} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.headerIcon}>▶</Text>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>{t('technique_help_title')}</Text>
              <Text style={styles.subtitle}>{t('technique_help_subtitle')}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {isLoading ? (
              <View style={styles.loadingWrap}>
                <Text style={styles.loadingText}>⏳ {t('technique_help_loading_label')}</Text>
                <ActivityIndicator size="small" color="#D9C48F" style={{ marginTop: 14 }} />
              </View>
            ) : error ? (
              <View style={styles.loadingWrap}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionLabel}>{t('technique_help_current_step_label')}</Text>
                <Text style={styles.currentStepText}>{step}</Text>

                {tip ? (
                  <View style={styles.tipCard}>
                    <Text style={styles.tipLabel}>{t('technique_help_pro_tip_label')}</Text>
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ) : null}

                {videoRows.length ? (
                  <>
                    <Text style={styles.videoSectionLabel}>▶ {t('technique_help_find_video_label')}</Text>
                    {videoRows.map((row, index) => (
                      <TouchableOpacity
                        key={`technique-video-row-${index}`}
                        style={styles.videoRow}
                        activeOpacity={0.85}
                        onPress={() => Linking.openURL(youtubeSearchUrl(row.searchQuery))}
                      >
                        <View style={styles.videoRowIcon}>
                          <Text style={styles.videoRowIconText}>▶</Text>
                        </View>
                        <View style={styles.videoRowTextWrap}>
                          <Text style={styles.videoRowTitle} numberOfLines={1}>{row.title}</Text>
                          <Text style={styles.videoRowSubtitle} numberOfLines={1}>{row.subtitle}</Text>
                        </View>
                        <Text style={styles.videoRowExternal}>↗</Text>
                      </TouchableOpacity>
                    ))}

                    <TouchableOpacity
                      style={styles.searchAllWrap}
                      activeOpacity={0.85}
                      onPress={() => Linking.openURL(youtubeSearchUrl(query || technique))}
                    >
                      <Text style={styles.searchAllText}>{t('technique_help_search_all_link')} →</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
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
    zIndex: 20,
    elevation: 20,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    maxHeight: '80%',
    backgroundColor: '#241A10',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#3C2E1E',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#3C2E1E',
    gap: 10,
  },
  headerIcon: {
    color: '#D9C48F',
    fontSize: 16,
    marginTop: 4,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    color: '#F1E7D2',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 20,
  },
  subtitle: {
    marginTop: 4,
    color: '#B4A488',
    fontFamily: 'Jost-Regular',
    fontSize: 12,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#D9CFBF',
    fontSize: 18,
    lineHeight: 20,
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
  loadingText: {
    color: '#B4A488',
    fontFamily: 'Jost-Regular',
    fontSize: 14,
  },
  errorText: {
    color: '#E08A8A',
    fontFamily: 'Jost-Regular',
    fontSize: 13,
    textAlign: 'center',
  },
  sectionLabel: {
    color: '#B4A488',
    fontFamily: 'Jost-Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  currentStepText: {
    color: '#F1E7D2',
    fontFamily: 'PlayfairDisplay-Italic',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  tipCard: {
    borderWidth: 1,
    borderColor: '#4A3A24',
    borderRadius: 14,
    backgroundColor: 'rgba(217,196,143,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 22,
  },
  tipLabel: {
    color: '#D9A84E',
    fontFamily: 'Jost-Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  tipText: {
    color: '#E9DFC9',
    fontFamily: 'Jost-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  videoSectionLabel: {
    color: '#B4A488',
    fontFamily: 'Jost-Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#3C2E1E',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  videoRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#D9342B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoRowIconText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  videoRowTextWrap: {
    flex: 1,
  },
  videoRowTitle: {
    color: '#F1E7D2',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
  },
  videoRowSubtitle: {
    marginTop: 2,
    color: '#9C8C70',
    fontFamily: 'Jost-Regular',
    fontSize: 12,
  },
  videoRowExternal: {
    color: '#9C8C70',
    fontSize: 16,
  },
  searchAllWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchAllText: {
    color: '#D9C48F',
    fontFamily: 'Jost-Bold',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
