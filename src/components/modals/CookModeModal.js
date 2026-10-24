import React, { useEffect, useRef, useState } from 'react';
import {
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import useLanguage from '../../hooks/useLanguage';
import TechniqueHelpModal from './TechniqueHelpModal';
import { useFernVoice } from '../../hooks/useFernVoice';

// Quiet background music while cooking (same three loops as the Alexa Cook Mode).
const MUSIC_BASE = 'https://app.clickpickandcook.com/assets/music/';
const MUSIC_ORDER = ['jazz', 'acoustic', 'lofi', 'off'];
const MUSIC_KEY = 'fern_cook_music';
const VOICE_KEY = 'fern_cook_voice'; // 'on' | 'off' (device-only): Fern reads each step aloud
const MUSIC_VOL = 0.3;
const MUSIC_VOL_DUCKED = 0.07;

export default function CookModeModal({ visible, recipe, user, onClose }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [stepIndex, setStepIndex] = useState(0);
  const [isIngredientsOpen, setIsIngredientsOpen] = useState(false);
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [music, setMusic] = useState('jazz');
  const [musicLoaded, setMusicLoaded] = useState(false);
  const playerRef = useRef(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [voiceLoaded, setVoiceLoaded] = useState(false);
  const voice = useFernVoice({});
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const rampRef = useRef(null);
  const prepCacheRef = useRef({});
  const volRef = useRef(MUSIC_VOL);

  // Smoothly move the music volume (fade down when Fern talks, back up after).
  const rampMusic = (target) => {
    if (rampRef.current) clearInterval(rampRef.current);
    rampRef.current = setInterval(() => {
      const pl = playerRef.current;
      const cur = volRef.current;
      const diff = target - cur;
      const next = Math.abs(diff) < 0.02 ? target : cur + diff * 0.35;
      volRef.current = next;
      if (pl) { try { pl.volume = next; } catch (e) {} }
      if (next === target) { clearInterval(rampRef.current); rampRef.current = null; }
    }, 80);
  };

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(VOICE_KEY)
      .then((v) => { if (alive && v === 'off') setVoiceOn(false); })
      .catch(() => {})
      .finally(() => { if (alive) setVoiceLoaded(true); });
    return () => { alive = false; };
  }, []);

  const toggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    AsyncStorage.setItem(VOICE_KEY, next ? 'on' : 'off').catch(() => {});
  };

  // Remembered choice (device-only)
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(MUSIC_KEY)
      .then((v) => { if (alive && MUSIC_ORDER.includes(v)) setMusic(v); })
      .catch(() => {})
      .finally(() => { if (alive) setMusicLoaded(true); });
    return () => { alive = false; };
  }, []);

  // Play the chosen loop while Cook Mode is open; stop on close, switch or off.
  useEffect(() => {
    const stopPlayer = () => {
      const pl = playerRef.current;
      playerRef.current = null;
      if (pl) {
        try { pl.pause(); } catch (e) {}
        try { pl.remove(); } catch (e) {}
      }
    };
    if (!visible || !musicLoaded || music === 'off') {
      stopPlayer();
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: 'mixWithOthers' });
        if (cancelled) return;
        stopPlayer();
        const pl = createAudioPlayer({ uri: MUSIC_BASE + music + '.mp3' });
        pl.loop = true;
        pl.volume = volRef.current;
        playerRef.current = pl;
        pl.play();
      } catch (e) {
        // Music is a nicety: never break Cook Mode if it can't load.
      }
    })();
    return () => { cancelled = true; stopPlayer(); };
  }, [visible, music, musicLoaded]);

  // Fern reads the current step aloud; the music fades down while she talks and back up when she is done.
  const recipeId = recipe?.id;
  const recipeTitle = recipe?.title;
  const stepsKey = Array.isArray(recipe?.methodSteps) ? recipe.methodSteps.join('|') : '';
  useEffect(() => {
    const stepList = Array.isArray(recipe?.methodSteps) ? recipe.methodSteps : [];
    if (!visible || !voiceLoaded || !voiceOn || !stepList.length) return undefined;
    let cancelled = false;
    const lineFor = (i) => {
      const body = String(stepList[i] || '').trim();
      if (!body) return '';
      const parts = [];
      if (i === 0) parts.push(t('cook_voice_start', { title: recipeTitle || '' }));
      parts.push(t('cook_voice_step', { n: i + 1 }));
      parts.push(body);
      if (i === stepList.length - 1) parts.push(t('cook_voice_done'));
      return parts.join(' ');
    };
    const getUri = (i) => {
      if (i < 0 || i >= stepList.length) return Promise.resolve(null);
      const cache = prepCacheRef.current;
      if (!cache[i]) cache[i] = voiceRef.current.prepareSpeech(lineFor(i)).catch(() => null);
      return cache[i];
    };
    (async () => {
      const uri = await getUri(stepIndex);
      getUri(stepIndex + 1); // have the next one ready
      if (cancelled || !uri) return;
      rampMusic(MUSIC_VOL_DUCKED);
      const started = voiceRef.current.playPrepared(uri, () => { if (!cancelled) rampMusic(MUSIC_VOL); });
      if (!started) rampMusic(MUSIC_VOL);
    })();
    return () => {
      cancelled = true;
      try { voiceRef.current.stopSpeaking(); } catch (e) {}
      rampMusic(MUSIC_VOL);
    };
  }, [visible, voiceLoaded, voiceOn, stepIndex, recipeId, recipeTitle, stepsKey]);

  // Fresh cache per recipe / each time Cook Mode opens; make sure the ramp timer never outlives the modal.
  useEffect(() => {
    prepCacheRef.current = {};
    return () => {
      if (rampRef.current) { clearInterval(rampRef.current); rampRef.current = null; }
      volRef.current = MUSIC_VOL;
    };
  }, [visible, recipeId]);

  const cycleMusic = () => {
    const next = MUSIC_ORDER[(MUSIC_ORDER.indexOf(music) + 1) % MUSIC_ORDER.length];
    setMusic(next);
    AsyncStorage.setItem(MUSIC_KEY, next).catch(() => {});
  };

  useEffect(() => {
    if (visible) {
      setStepIndex(0);
      setIsIngredientsOpen(false);
      setIsHelpVisible(false);
    }
  }, [visible, recipe?.id]);

  if (!visible || !recipe) return null;

  const steps = Array.isArray(recipe.methodSteps) ? recipe.methodSteps : [];
  const total = steps.length;
  const currentStep = steps[stepIndex] || '';
  const isLastStep = stepIndex >= total - 1;
  const progressPct = total ? ((stepIndex + 1) / total) * 100 : 0;

  const handleClose = () => {
    setIsHelpVisible(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <ImageBackground
        source={recipe.image ? { uri: recipe.image } : require('../../../assets/icon.png')}
        style={styles.background}
      >
        <View style={[styles.darkPanel, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle} numberOfLines={1}>{recipe.title}</Text>
            <TouchableOpacity style={styles.musicBtn} activeOpacity={0.85} onPress={toggleVoice}>
              <Text style={styles.musicBtnText}>{voiceOn ? '🗣' : '🔇'} {t(voiceOn ? 'cook_voice_on' : 'cook_voice_off')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.musicBtn} activeOpacity={0.85} onPress={cycleMusic}>
              <Text style={styles.musicBtnText}>{music === 'off' ? '🔇' : '🎵'} {t('cook_music_' + music)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={handleClose}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.ingredientsBar}
            activeOpacity={0.85}
            onPress={() => setIsIngredientsOpen((prev) => !prev)}
          >
            <Text style={styles.ingredientsBarText}>📋 {t('ingredients_title').toUpperCase()}</Text>
            <Text style={styles.ingredientsChevron}>{isIngredientsOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {isIngredientsOpen ? (
            <ScrollView style={styles.ingredientsList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {(recipe.ingredients || []).map((ingredient, idx) => (
                <Text key={`cook-ing-${idx}`} style={styles.ingredientItemText}>- {ingredient}</Text>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>

          <Text style={styles.stepCounter}>{t('cook_mode_step_of', { current: stepIndex + 1, total })}</Text>
          <Text style={styles.stepText}>{currentStep}</Text>

          <View style={[styles.controlsRow, { paddingBottom: insets.bottom + 14 }]}>
            <TouchableOpacity
              style={[styles.controlBtn, stepIndex === 0 ? styles.controlBtnDisabled : null]}
              activeOpacity={0.85}
              disabled={stepIndex === 0}
              onPress={() => setStepIndex((prev) => Math.max(0, prev - 1))}
            >
              <Text style={styles.controlBtnText}>{t('cook_mode_back_btn')}</Text>
            </TouchableOpacity>

            <Text style={styles.stepFraction}>{stepIndex + 1} / {total}</Text>

            <TouchableOpacity
              style={styles.helpBtn}
              activeOpacity={0.85}
              onPress={() => setIsHelpVisible(true)}
            >
              <Text style={styles.helpBtnText}>{t('cook_mode_help_video_btn')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.finishBtn}
              activeOpacity={0.85}
              onPress={() => {
                if (isLastStep) {
                  handleClose();
                } else {
                  setStepIndex((prev) => Math.min(total - 1, prev + 1));
                }
              }}
            >
              <Text style={styles.finishBtnText}>
                {isLastStep ? t('cook_mode_finish_btn') : t('cook_mode_next_btn')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>

      <TechniqueHelpModal
        visible={isHelpVisible}
        recipeTitle={recipe.title}
        step={currentStep}
        user={user}
        onClose={() => setIsHelpVisible(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  musicBtn: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  background: {
    flex: 1,
    backgroundColor: '#000000',
  },
  darkPanel: {
    backgroundColor: 'rgba(10,16,10,0.86)',
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    color: '#F1E7D2',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 20,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#F1E7D2',
    fontSize: 20,
    lineHeight: 22,
  },
  ingredientsBar: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 12,
  },
  ingredientsBarText: {
    color: '#D9CFBF',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  ingredientsChevron: {
    color: '#D9CFBF',
    fontSize: 12,
  },
  ingredientsList: {
    maxHeight: 160,
    marginTop: 4,
  },
  ingredientItemText: {
    color: '#D9CFBF',
    fontFamily: 'Jost-Regular',
    fontSize: 13,
    lineHeight: 22,
  },
  progressTrack: {
    marginTop: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3F9142',
    borderRadius: 2,
  },
  stepCounter: {
    marginTop: 14,
    textAlign: 'center',
    color: '#5FBF63',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
    letterSpacing: 2,
  },
  stepText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#F1E7D2',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 20,
    lineHeight: 28,
  },
  controlsRow: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  controlBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  controlBtnDisabled: {
    opacity: 0.4,
  },
  controlBtnText: {
    color: '#F1E7D2',
    fontFamily: 'Jost-Bold',
    fontSize: 13,
  },
  stepFraction: {
    color: '#B4A488',
    fontFamily: 'Jost-Regular',
    fontSize: 13,
  },
  helpBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  helpBtnText: {
    color: '#F1E7D2',
    fontFamily: 'Jost-Bold',
    fontSize: 13,
  },
  finishBtn: {
    borderRadius: 999,
    backgroundColor: '#E96B1E',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  finishBtnText: {
    color: '#FFF5EC',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
  },
});
