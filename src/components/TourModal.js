import React, { useCallback, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, shadow } from '../constants/tokens';
import useLanguage from '../hooks/useLanguage';

export default function TourModal({ visible, tour, storageKey, onClose }) {
  const { t } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);

  const finish = useCallback(() => {
    if (storageKey) AsyncStorage.setItem(storageKey, '1').catch(() => {});
    setStepIndex(0);
    onClose();
  }, [storageKey, onClose]);

  if (!tour?.steps?.length) return null;

  const step = tour.steps[stepIndex];
  const isLast = stepIndex === tour.steps.length - 1;
  const title = t(tour.titleKey);
  const body = t(step.textKey);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={finish}>
      <View style={styles.overlay}>
        <View style={styles.skipWrap}>
          <TouchableOpacity style={styles.skipBtn} activeOpacity={0.8} onPress={finish}>
            <Text style={styles.skipText}>{t('tour_skip')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardOuter}>
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
    backgroundColor: 'rgba(10,22,10,0.72)',
    justifyContent: 'space-between',
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
