// Shopping mode: your list as a checklist by store section, one item at a time.
// Works without the AI chat so it never errors mid-trip: "Got it" checks the item off and says so, "Not here" skips it
// (skipped items come back at the end), and a section change is announced. In voice mode Fern reads each line out loud.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, SafeAreaView } from 'react-native';
import { colors, radius, shadow } from '../../constants/tokens';
import { AISLES, aisleFor } from '../../utils/aisles';
import { useFernVoice } from '../../hooks/useFernVoice';
import useLanguage from '../../hooks/useLanguage';

export default function ShoppingModeModal({ visible, items, onSetChecked, onClose, user, voice }) {
  const { t } = useLanguage();
  const { speakText, stopSpeaking } = useFernVoice({
    onError: (m) => console.warn('[ShoppingMode] voice error:', m),
    token: user?.token,
    enabled: Boolean(visible && voice),
  });
  const [skipped, setSkipped] = useState([]);
  const [status, setStatus] = useState('');
  const announced = useRef(false);

  const sections = useMemo(() => {
    const by = new Map(AISLES.map((a) => [a.key, []]));
    (items || []).forEach((it) => by.get(aisleFor(it.text).key).push(it));
    return AISLES.filter((a) => by.get(a.key).length)
      .map((a) => ({ key: a.key, emoji: a.emoji, name: t(a.labelKey), items: by.get(a.key) }));
  }, [items, t]);

  const flat = useMemo(() => sections.flatMap((s) => s.items.map((it) => ({ ...it, sectionKey: s.key }))), [sections]);
  const open = flat.filter((i) => !i.checked);
  const current = open.find((i) => !skipped.includes(i.id)) || null;
  const sectionOf = (key) => sections.find((s) => s.key === key);
  const openIn = (key) => open.filter((i) => i.sectionKey === key).length;

  const say = useCallback((text) => {
    setStatus(text);
    if (voice) speakText(text);
  }, [voice, speakText]);

  // "Produce, 4 left. Got the onions?"
  const intro = (item) => {
    const s = sectionOf(item.sectionKey);
    return `${t('shopmode_section_intro', { section: s?.name || '', n: openIn(item.sectionKey) })} ${t('shopmode_ask', { item: item.text })}`;
  };

  // Start fresh each time it opens, and read the first section + item.
  useEffect(() => {
    if (!visible) { announced.current = false; setSkipped([]); setStatus(''); stopSpeaking?.(); return; }
    if (announced.current || !current) return;
    announced.current = true;
    say(intro(current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, current?.id]);

  // Only skipped items are left: bring them back around.
  useEffect(() => {
    if (!visible || current || !open.length) return;
    setSkipped([]);
    say(t('shopmode_skipped_back'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, current, open.length]);

  const nextAfter = (item, extraSkipped = []) =>
    open.find((i) => i.id !== item.id && !skipped.includes(i.id) && !extraSkipped.includes(i.id));

  const got = async (item) => {
    const next = nextAfter(item);
    await onSetChecked(item.id, true);
    let msg = t('shopmode_checked', { item: item.text });
    if (next) {
      if (next.sectionKey !== item.sectionKey) {
        msg += ` ${t('shopmode_section_done', { section: sectionOf(item.sectionKey)?.name || '' })} ${intro(next)}`;
      } else {
        msg += ` ${t('shopmode_ask', { item: next.text })}`;
      }
    } else if (open.some((i) => i.id !== item.id)) {
      msg += ` ${t('shopmode_skipped_back')}`;
    } else {
      msg += ` ${t('shopmode_all_done')}`;
    }
    say(msg);
  };

  const skip = (item) => {
    const next = nextAfter(item, [item.id]);
    setSkipped((prev) => [...prev, item.id]);
    let msg = t('shopmode_skipping', { item: item.text });
    if (next) msg += ` ${next.sectionKey !== item.sectionKey ? intro(next) : t('shopmode_ask', { item: next.text })}`;
    say(msg);
  };

  const tapRow = (item) => {
    if (item.checked) { onSetChecked(item.id, false); return; }
    got({ ...item, sectionKey: aisleFor(item.text).key });
  };

  const currentSection = current ? sectionOf(current.sectionKey) : null;
  const allDone = flat.length > 0 && !open.length;

  return (
    <Modal visible={Boolean(visible)} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{`🌿 ${t('shopmode_title')}`}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.close}>{t('shopmode_close')}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, shadow.card]}>
          {allDone ? (
            <>
              <Text style={styles.cardLabel}>{t('shopmode_done_title')}</Text>
              <Text style={styles.cardSub}>{t('shopmode_all_done')}</Text>
            </>
          ) : current ? (
            <>
              <Text style={styles.cardLabel}>{`${currentSection?.emoji || ''} ${currentSection?.name || ''} · ${t('shopmode_left', { n: openIn(current.sectionKey) })}`}</Text>
              <Text style={styles.cardItem}>{current.text}</Text>
              <View style={styles.btnRow}>
                <TouchableOpacity style={[styles.btn, styles.btnGot]} activeOpacity={0.85} onPress={() => got(current)}>
                  <Text style={styles.btnGotText}>{`✓ ${t('shopmode_got')}`}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnSkip]} activeOpacity={0.85} onPress={() => skip(current)}>
                  <Text style={styles.btnSkipText}>{t('shopmode_skip')}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
          {status ? <Text style={styles.status}>{status}</Text> : null}
        </View>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {sections.map((s) => (
            <View key={s.key} style={styles.section}>
              <Text style={styles.sectionHeader}>{`${s.emoji} ${s.name}`}</Text>
              {s.items.map((it) => {
                const isCurrent = current && current.id === it.id;
                return (
                  <TouchableOpacity key={it.id} style={[styles.row, isCurrent && styles.rowCurrent]} activeOpacity={0.7} onPress={() => tapRow(it)}>
                    <View style={[styles.checkbox, it.checked && styles.checkboxChecked]}>
                      {it.checked ? <Text style={styles.checkmark}>✓</Text> : null}
                    </View>
                    <Text style={[styles.rowText, it.checked && styles.rowTextChecked]} numberOfLines={2}>{it.text}</Text>
                    {skipped.includes(it.id) && !it.checked ? <Text style={styles.skippedTag}>{t('shopmode_skip')}</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.parch },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  close: { fontSize: 15, fontWeight: '700', color: colors.bright },
  card: { margin: 16, padding: 18, borderRadius: radius.lg, backgroundColor: colors.forest },
  cardLabel: { color: colors.onFern, opacity: 0.85, fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  cardItem: { color: colors.onFern, fontSize: 28, fontWeight: '800', marginTop: 6, marginBottom: 14 },
  cardSub: { color: colors.onFern, fontSize: 15, marginTop: 6 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: radius.lg, alignItems: 'center' },
  btnGot: { backgroundColor: colors.orange },
  btnGotText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  btnSkip: { backgroundColor: 'rgba(255,255,255,0.14)' },
  btnSkipText: { color: colors.onFern, fontSize: 16, fontWeight: '700' },
  status: { color: colors.onFern, fontSize: 14, lineHeight: 20, marginTop: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 30 },
  section: { marginBottom: 14 },
  sectionHeader: { fontSize: 13, fontWeight: '800', color: colors.brown, letterSpacing: 0.6, marginBottom: 4, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: radius.sm },
  rowCurrent: { backgroundColor: colors.paper },
  checkbox: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  checkboxChecked: { backgroundColor: colors.bright, borderColor: colors.bright },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '900' },
  rowText: { flex: 1, fontSize: 15, color: colors.ink },
  rowTextChecked: { color: colors.muted, textDecorationLine: 'line-through' },
  skippedTag: { fontSize: 11, fontWeight: '700', color: colors.brown },
});
