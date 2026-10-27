import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, shadow } from '../constants/tokens';
import useLanguage from '../hooks/useLanguage';
import { useFernVoice } from '../hooks/useFernVoice';
import { measureTourTarget } from '../services/tourTargets';

const PAD = 6; // breathing room around a highlighted element

export default function TourModal({ visible, tour, storageKey, onClose, onDone, token, stepIndex, setStepIndex }) {
  const { t } = useLanguage();
  const { prepareSpeech, playPrepared, stopSpeaking } = useFernVoice({ token, enabled: visible, allowFree: true });

  const step = tour?.steps?.[stepIndex];
  // A step with `pointer: 'leaf'` shows a copy of the floating leaf button (same spot as App.js `chatFab`) with a pulsing ring and an arrow,
  // and lifts the card so it doesn't cover it.
  const pointLeaf = step?.pointer === 'leaf';
  // A step with `target: '<name>'` (see src/services/tourTargets.js) dims everything except that real element and rings it.
  const targetName = step?.target || null;
  const [rect, setRect] = useState(null);
  // For a step with `parts` (the bottom tabs): which part Fern is on right now, so its text shows and that tab is lit.
  const [partIndex, setPartIndex] = useState(null);
  const [cardH, setCardH] = useState(0); // height of the card block, so the More preview can sit right above it
  const runRef = useRef(0);
  const cacheRef = useRef({});
  const pulse = useRef(new Animated.Value(0)).current;
  const animate = pointLeaf || !!targetName;
  useEffect(() => {
    if (!visible || !animate) return undefined;
    pulse.setValue(0);
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [visible, animate, pulse]);
  // Measure after the screen has finished scrolling to the section this step narrates (Home scrolls on step change).
  useEffect(() => {
    setRect(null);
    if (!visible || !targetName) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const r = await measureTourTarget(targetName, Dimensions.get('window'));
      if (!cancelled) setRect(r);
    }, targetName === 'tabs' ? 150 : 700);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [visible, targetName, stepIndex]);
  const isLast = tour ? stepIndex === tour.steps.length - 1 : false;
  const title = tour ? t(tour.titleKey) : '';
  const activePart = step?.parts && partIndex != null ? step.parts[partIndex] : null;
  const body = step ? t(activePart ? activePart.textKey : step.textKey) : '';
  // While a part is spoken only that tab (one fifth of the bar) is lit.
  const shownRect = rect && activePart
    ? { x: rect.x + (activePart.tab * rect.width) / step.parts.length, y: rect.y, width: rect.width / step.parts.length, height: rect.height }
    : rect;

  // Fetch a line's speech once and remember it, so a step's voice is already waiting when the person gets there.
  const prep = useCallback((text) => {
    if (!text) return Promise.resolve(null);
    if (!cacheRef.current[text]) {
      cacheRef.current[text] = prepareSpeech(text).then((uri) => { if (!uri) delete cacheRef.current[text]; return uri; });
    }
    return cacheRef.current[text];
  }, [prepareSpeech]);

  const textsOf = useCallback((s) => (s?.parts ? s.parts.map((p) => t(p.textKey)) : s ? [t(s.textKey)] : []), [t]);

  // Start fetching speech for this step and the next two as soon as the tour opens or moves on (the first lines used to wait on a
  // fresh network round trip each, so Fern came in late).
  useEffect(() => {
    if (!visible) { cacheRef.current = {}; return; }
    const steps = tour?.steps || [];
    for (let i = stepIndex; i < Math.min(steps.length, stepIndex + 3); i += 1) textsOf(steps[i]).forEach((x) => { prep(x); });
  }, [visible, stepIndex, tour, prep, textsOf]);

  // Speak the current step. A step with `parts` speaks them one after another (all fetched at once, so no gap) and lights the tab for each.
  // Moving on or closing cancels via the run counter. Gated on `fern_voice_enabled` inside useFernVoice; with voice off the parts still
  // advance on a reading timer so the highlighting works.
  useEffect(() => {
    if (!visible || !step) return undefined;
    runRef.current += 1;
    const run = runRef.current;
    const texts = textsOf(step);
    setPartIndex(step.parts ? 0 : null);
    stopSpeaking();
    (async () => {
      for (let i = 0; i < texts.length; i += 1) {
        if (runRef.current !== run) return;
        if (step.parts) setPartIndex(i);
        const uri = await prep(texts[i]);
        if (runRef.current !== run) return;
        await new Promise((resolve) => {
          const ok = uri ? playPrepared(uri, resolve) : null;
          if (!ok) setTimeout(resolve, 3500);
          else setTimeout(resolve, 60000);
        });
      }
    })();
    return () => { runRef.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, stepIndex]);

  const finish = useCallback((completed) => {
    stopSpeaking();
    if (storageKey) AsyncStorage.setItem(storageKey, '1').catch(() => {});
    setStepIndex(0);
    onClose();
    // Reached the last step and tapped Done (not Skip): let the app take the person into the feature.
    if (completed === true) onDone?.();
  }, [storageKey, onClose, onDone, stopSpeaking]);

  if (!tour?.steps?.length) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={finish}>
      <View style={styles.overlay}>
        {/* The bottom shading is skipped while a spotlight is showing: it would darken the very element being highlighted (the tab bar). */}
        {rect ? null : (
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(30,50,36,0)', 'rgba(30,50,36,0.55)', 'rgba(30,50,36,0.86)']}
            locations={[0, 0.55, 1]}
            style={styles.scrim}
          />
        )}

        {shownRect ? (
          <>
            <View pointerEvents="none" style={[styles.dim, { left: 0, right: 0, top: 0, height: Math.max(0, shownRect.y - PAD) }]} />
            <View pointerEvents="none" style={[styles.dim, { left: 0, right: 0, top: shownRect.y + shownRect.height + PAD, bottom: 0 }]} />
            <View pointerEvents="none" style={[styles.dim, { left: 0, width: Math.max(0, shownRect.x - PAD), top: shownRect.y - PAD, height: shownRect.height + PAD * 2 }]} />
            <View pointerEvents="none" style={[styles.dim, { left: shownRect.x + shownRect.width + PAD, right: 0, top: shownRect.y - PAD, height: shownRect.height + PAD * 2 }]} />
            {Math.abs(shownRect.width - shownRect.height) < 8 ? (() => {
              // Round target (the scan circle): the four rectangles leave its square un-dimmed, so the corners showed as a lighter box.
              // Dim them with a ring clipped to that square whose hole is the circle.
              const side = shownRect.width + PAD * 2;
              const B = Math.ceil(side * 0.5);
              const S = side + B * 2;
              return (
                <View pointerEvents="none" style={{ position: 'absolute', left: shownRect.x - PAD, top: shownRect.y - PAD, width: side, height: shownRect.height + PAD * 2, overflow: 'hidden' }}>
                  <View style={{ position: 'absolute', left: -B, top: -B, width: S, height: S, borderRadius: S / 2, borderWidth: B, borderColor: 'rgba(30,50,36,0.55)' }} />
                </View>
              );
            })() : null}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.spot,
                { left: shownRect.x - PAD, top: shownRect.y - PAD, width: shownRect.width + PAD * 2, height: shownRect.height + PAD * 2, borderRadius: Math.abs(shownRect.width - shownRect.height) < 8 ? 999 : 18 },
                { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) },
              ]}
            />
          </>
        ) : null}

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

        {targetName === 'tools' ? (
          // While Fern summarizes the tools button, show everything the menu holds (same tools as Home's menu; keep in step).
          <View pointerEvents="none" style={[styles.morePreview, { top: rect ? rect.y + rect.height + 10 : 120 }]}>
            <Text style={styles.morePreviewTitle}>{t('tour_tools_list_title')}</Text>
            <View style={styles.morePreviewGrid}>
              {[
                ['📖', 'stat_recipes_saved'], ['📚', 'stat_cookbooks'], ['👥', 'stat_bloggers'], ['🎟️', 'stat_coupons'],
                ['💡', 'suggested_meals_title'], ['💳', 'loyalty_card_title'], ['📰', 'tool_circulars'], ['🛒', 'tool_personal_shopper'],
                ['🧊', 'tool_fridge_challenge'], ['🧙', 'tool_leftover_magic'], ['⚡', 'tool_20min_dinner'], ['💰', 'tool_budget_planner'],
                ['🗓️', 'tool_ai_meal_planner'], ['🥫', 'tool_semi_homemade'], ['🎉', 'tool_dinner_party'], ['🧀', 'tool_charcuterie'],
                ['🍷', 'tool_wine_pairing'], ['🥗', 'tool_weekly_nutrition'], ['🔊', 'tool_alexa'], ['📔', 'tool_family_vault'],
                ['💎', 'tool_insider_deals'],
              ].map(([emoji, key]) => (
                <View key={key} style={styles.toolsPreviewItem}>
                  <Text style={styles.toolsPreviewEmoji}>{emoji}</Text>
                  <Text style={styles.toolsPreviewText} numberOfLines={1} adjustsFontSizeToFit>{t(key)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {(step?.morePreview || (activePart && activePart.tab === 4)) ? (
          // While Fern talks about More, show what is inside it (same buttons as the real More sheet in App.js; keep them in step).
          <View pointerEvents="none" style={[styles.morePreview, { bottom: cardH + 8 }]}>
            <Text style={styles.morePreviewTitle}>{t('more_title')}</Text>
            <View style={styles.morePreviewGrid}>
              {[
                ['🎟️', 'more_coupon_wallet'], ['📥', 'importNavText'], ['❓', 'more_help'],
              ].map(([emoji, key], idx) => (
                <View
                  key={key}
                  style={[
                    styles.morePreviewItem,
                    step?.morePreview && step.morePreview.length > 0 && (step.morePreview.includes(idx)
                      ? styles.morePreviewItemLit
                      : styles.morePreviewItemDim),
                  ]}
                >
                  <Text style={styles.morePreviewEmoji}>{emoji}</Text>
                  <Text style={styles.morePreviewText} numberOfLines={1} adjustsFontSizeToFit>{t(key)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View onLayout={(e) => setCardH(e.nativeEvent.layout.height)} style={[styles.cardOuter, (pointLeaf || targetName === 'tabs') && styles.cardOuterLifted]}>
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
              onPress={() => (isLast ? finish(true) : setStepIndex((i) => i + 1))}
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
    backgroundColor: 'rgba(30,50,36,0.12)',
    justifyContent: 'space-between',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
  },
  dim: { position: 'absolute', backgroundColor: 'rgba(30,50,36,0.55)' },
  spot: { position: 'absolute', borderWidth: 3, borderColor: '#4E7A54' },
  skipWrap: { alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 56 },
  skipBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  skipText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  cardOuter: { paddingHorizontal: 16, paddingBottom: 24, position: 'relative' },
  morePreview: { position: 'absolute', left: 16, right: 16, backgroundColor: '#fff', borderRadius: 20, padding: 14, ...shadow.strong },
  morePreviewTitle: { color: '#3F5645', fontWeight: '800', fontSize: 15, marginBottom: 10 },
  morePreviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  morePreviewItem: { width: '31%', backgroundColor: '#3F5645', borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  morePreviewItemLit: { borderWidth: 3, borderColor: '#4E7A54' },
  morePreviewItemDim: { opacity: 0.35 },
  morePreviewEmoji: { fontSize: 22 },
  toolsPreviewItem: { width: '31%', backgroundColor: '#3F5645', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center' },
  toolsPreviewEmoji: { fontSize: 14, marginRight: 4 },
  toolsPreviewText: { flex: 1, color: '#F5F0E7', fontWeight: '700', fontSize: 10 },
  morePreviewText: { color: '#F5F0E7', fontWeight: '700', fontSize: 11, marginTop: 4, paddingHorizontal: 4 },
  cardOuterLifted: { paddingBottom: 176 },
  // Same spot and size as App.js `chatFab` (right 18, bottom 86, 56x56); the arrow sits just above it.
  leafSpot: { position: 'absolute', right: 18, bottom: 86, width: 56, alignItems: 'center', zIndex: 5 },
  leafArrow: { position: 'absolute', top: -26, color: '#4E7A54', fontSize: 20, fontWeight: '900' },
  leafBtnWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  leafRing: { position: 'absolute', width: 56, height: 56, borderRadius: 28, borderWidth: 3, borderColor: '#4E7A54' },
  leafBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#4E7A54', alignItems: 'center', justifyContent: 'center', ...shadow.strong },
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
    backgroundColor: '#3F5645',
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
    color: '#4E7A54',
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  body: { fontSize: 14, color: colors.ink, lineHeight: 19 },

  dotsRow: { flexDirection: 'row', gap: 5, marginTop: 16, marginBottom: 12 },
  dot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { backgroundColor: '#4E7A54' },

  nextBtn: {
    backgroundColor: '#4E7A54',
    borderRadius: radius.full,
    paddingVertical: 12,
    alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
