import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, shadow } from '../constants/tokens';
import useLanguage from '../hooks/useLanguage';
import { useFernVoice } from '../hooks/useFernVoice';

export default function TourModal({ visible, tour, storageKey, onClose, token, stepIndex, setStepIndex }) {
  const { t } = useLanguage();
  const { speakText, stopSpeaking } = useFernVoice({ token, enabled: visible, allowFree: true });

  const step = tour?.steps?.[stepIndex];
  // A step with `pointer: 'leaf'` shows a copy of the floating leaf button (same spot as App.js `chatFab`) with a pulsing ring and an arrow,
  // and lifts the card so it doesn't cover it.
  const pointLeaf = step?.pointer === 'leaf';
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible || !pointLeaf) return undefined;
    pulse.setValue(0);
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [visible, pointLeaf, pulse]);
  const isLast = tour ? stepIndex === tour.steps.length - 1 : false;
  const title = tour ? t(tour.titleKey) : '';
  const body = step ? t(step.textKey) : '';

  // Speak the current step's text on open and every "Next" — speakText
  // already stops any in-progress playback before starting the new one, so
  // moving to the next step naturally cuts off the previous line. Gated on
  // `fern_voice_enabled` inside useFernVoice, same as the rest of the app.
  useEffect(() => {
    if (visible && body) {
      speakText(body);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, stepIndex, body]);

  const finish = useCallback(() => {
    stopSpeaking();
    if (storageKey) AsyncStorage.setItem(storageKey, '1').catch(() => {});
    setStepIndex(0);
    onClose();
  }, [storageKey, onClose, stopSpeaking]);

  if (!tour?.steps?.length) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={finish}>
      <View style={styles.overlay}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(10,22,10,0)', 'rgba(10,22,10,0.55)', 'rgba(10,22,10,0.86)']}
          locations={[0, 0.55, 1]}
          style={styles.scrim}
        />

        <View style={styles.skipWrap}>
          <TouchableOpacity style={styles.skipBtn} activeOpacity={0.8} onPress={finish}>
            <Text style={styles.skipText}>{t('tour_skip')}</Text>
          </TouchableOpacity>
        </View>

        {pointLeaf ? (
          <View pointerEvents="none" style={styles.leafSpot}>
            <Text style={styles.leafArrow}>▼</Text>
            <View style={styles.leafBtnWrap}>
              <Animated.View
                style={[styles.leafRing, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }] }]}
              />
              <View style={styles.leafBtn}><Text style={styles.leafBtnText}>🌿</Text></View>
            </View>
          </View>
        ) : null}

        <View style={[styles.cardOuter, pointLeaf && styles.cardOuterLifted]}>
          <View style={styles.fernAvatar}>
            <Text style={styles.fernAvatarEmoji}>🌳</Text>
          </View>

          <View style={[styles.card, shadow.strong]}>
            <View style={styles.bubble}>
              <Text style={styles.eyebrow}>
                {title.toUpperCase()} · {t('tour_of', { current: stepIndex + 1, total: tour.steps.length })}
              </Text>
              <Text style={styles.body}>{body}</Text>
              <View style={styles.bubbleTail} />
            </View>

            <View style={styles.dotsRow}>
              {tour.steps.map((_, i) => (
                <View key={i} style={[styles.dot, i === stepIndex && styles.dotActive]} />
              ))}
            </View>

            <TouchableOpacity
              style={styles.nextBtn}
              activeOpacity={0.9}
              onPress={() => (isLast ? finish() : setStepIndex((i) => i + 1))}
            >
              <Text style={styles.nextBtnText}>{isLast ? t('tour_done') : t('tour_next')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,22,10,0.12)',
    justifyContent: 'space-between',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
  },
  skipWrap: { alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 56 },
  skipBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  skipText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  cardOuter: { paddingHorizontal: 16, paddingBottom: 24, position: 'relative' },
  cardOuterLifted: { paddingBottom: 176 },
  // Same spot and size as App.js `chatFab` (right 18, bottom 86, 56x56); the arrow sits just above it.
  leafSpot: { position: 'absolute', right: 18, bottom: 86, width: 56, alignItems: 'center', zIndex: 5 },
  leafArrow: { position: 'absolute', top: -26, color: colors.orange, fontSize: 20, fontWeight: '900' },
  leafBtnWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  leafRing: { position: 'absolute', width: 56, height: 56, borderRadius: 28, borderWidth: 3, borderColor: colors.orange },
  leafBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', ...shadow.strong },
  leafBtnText: { fontSize: 26 },

  fernAvatar: {
    position: 'absolute',
    left: -22,
    bottom: 92,
    width: 68,
    height: 68,
    borderRadius: 999,
    backgroundColor: 'rgba(168,213,162,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  fernAvatarEmoji: { fontSize: 28, opacity: 0.9 },

  card: {
    backgroundColor: colors.forest,
    borderRadius: radius.xl,
    padding: 12,
  },

  bubble: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: 14,
    position: 'relative',
  },
  bubbleTail: {
    position: 'absolute',
    left: 28,
    bottom: -12,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#fff',
  },

  eyebrow: {
    color: colors.orange,
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  body: { fontSize: 14, color: colors.ink, lineHeight: 19 },

  dotsRow: { flexDirection: 'row', gap: 5, marginTop: 16, marginBottom: 12 },
  dot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { backgroundColor: colors.orange },

  nextBtn: {
    backgroundColor: colors.orange,
    borderRadius: radius.full,
    paddingVertical: 12,
    alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
