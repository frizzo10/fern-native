import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../constants/tokens';
import { useFernVoice } from '../../hooks/useFernVoice';
import { spokenSummary } from '../../utils/spokenSummary';

// "Fern guides your week": a bar pinned above the Shopping screen that walks through
// scan → dinner ideas → coupons → your list, one step at a time. Fern speaks each step's line
// (unless muted) and the same text is shown on screen. The screen decides which section shows.
export default function GuideBar({ t, token, stepIndex, stepCount, title, line, nextLabel, onBack, onNext, onExit }) {
  const [muted, setMuted] = useState(false);
  const { speakText, stopSpeaking, isSpeaking } = useFernVoice({
    onError: (m) => console.warn('[GuideBar] voice error:', m),
    token,
    enabled: true,
  });
  const lastSpoken = useRef('');

  // Speak whenever the line changes (a new step, or the flyer finishing loading).
  useEffect(() => {
    if (muted || !line || lastSpoken.current === line) return;
    lastSpoken.current = line;
    speakText(spokenSummary(line, 260));
  }, [line, muted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { stopSpeaking(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute = () => {
    if (muted) { setMuted(false); lastSpoken.current = ''; } else { setMuted(true); stopSpeaking(); }
  };

  return (
    <View style={styles.bar}>
      <View style={styles.top}>
        <Text style={styles.step}>{t('guide_step_label', { n: stepIndex + 1, total: stepCount })}</Text>
        <View style={styles.topRight}>
          <TouchableOpacity onPress={toggleMute} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button">
            <Text style={styles.icon}>{muted ? '🔇' : isSpeaking ? '🔊' : '🔈'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onExit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button">
            <Text style={styles.exit}>{t('guide_exit')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.title}>{`🌿 ${title}`}</Text>
      {line ? <Text style={styles.line}>{line}</Text> : null}
      <View style={styles.btnRow}>
        {stepIndex > 0 ? (
          <TouchableOpacity style={styles.backBtn} activeOpacity={0.85} onPress={onBack}>
            <Text style={styles.backText}>{t('guide_back')}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.nextBtn} activeOpacity={0.88} onPress={onNext}>
          <Text style={styles.nextText}>{nextLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: '#8A4A4E', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  step: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: '#EBCFC6', textTransform: 'uppercase' },
  icon: { fontSize: 20 },
  exit: { fontSize: 13, fontWeight: '700', color: '#EBCFC6' },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 6 },
  line: { fontSize: 15, color: '#FBD9CE', lineHeight: 21, marginTop: 6 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  backBtn: { borderRadius: 999, borderWidth: 1.5, borderColor: '#EBCFC6', paddingHorizontal: 18, paddingVertical: 11 },
  backText: { fontSize: 15, fontWeight: '700', color: '#FBD9CE' },
  nextBtn: { flex: 1, borderRadius: 999, backgroundColor: '#D8607C', paddingVertical: 12, alignItems: 'center' },
  nextText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
