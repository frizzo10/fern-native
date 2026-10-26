// Shopping mode: your list as a checklist, one store section at a time.
// Tap an item to check it off (Fern says so out loud in voice mode); finish a section and there is a short
// celebration before the next one appears. "Next section" moves on early: what is left in this section comes back
// at the end. The same item on the list twice (e.g. "Chicken" from two recipes) is one stop.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, SafeAreaView, Alert, Linking, Image } from 'react-native';
import { colors, radius } from '../../constants/tokens';
import { AISLES, aisleFor } from '../../utils/aisles';
import { useFernVoice } from '../../hooks/useFernVoice';
import useLanguage from '../../hooks/useLanguage';
import Confetti from '../Confetti';
import { code128Widths } from '../../utils/code128';

// A real, scannable Code 128 barcode drawn with plain Views (no library). Bars stretch to the card width.
function Barcode({ value }) {
  const widths = useMemo(() => code128Widths(value), [value]);
  if (!widths) return null;
  return (
    <View style={styles.barcodeWrap}>
      <View style={styles.barcodeRow}>
        {widths.map((w, i) => <View key={i} style={{ flex: w, backgroundColor: i % 2 === 0 ? '#000' : '#fff' }} />)}
      </View>
      <Text style={styles.barcodeText}>{value}</Text>
    </View>
  );
}

// Stores reported to take Coupons.com digital coupons (loaded to the store account). Anything else gets a "check first" note.
const DIGITAL_OK = /publix|kroger|albertsons|safeway|food lion|meijer|walgreens|dollar general/i;

export default function ShoppingModeModal({ visible, items, onSetChecked, onClose, user, voice, coupons: allCoupons = [], usedIds, onToggleCouponUsed, onClearChecked, storeName = '', onPickVoice }) {
  const { t } = useLanguage();
  const { prepareSpeech, playPrepared, stopSpeaking, isSpeaking } = useFernVoice({
    onError: (m) => console.warn('[ShoppingMode] voice error:', m),
    token: user?.token,
    enabled: Boolean(visible && voice),
  });
  const [skipped, setSkipped] = useState([]); // group ids left behind with "Next section"
  const [status, setStatus] = useState('');
  const announced = useRef(false);
  const [celebrate, setCelebrate] = useState(null); // { section, next } while a finished section is celebrated
  const [confettiKey, setConfettiKey] = useState(0);
  const celebrateTimer = useRef(null);
  // Digital coupons (the catalog's "code" is only an offer id, not a register barcode) come off with the phone number / loyalty card.
  // Only coupons whose redemption is a real code get a barcode.
  const coupons = useMemo(() => (allCoupons || []).filter((m) => m && m.coupon), [allCoupons]);
  const [showCoupons, setShowCoupons] = useState(false); // the full-page coupon list for the register
  const [picked, setPicked] = useState(false); // the "on my own or with Fern" choice has been made
  const [showRecap, setShowRecap] = useState(false); // the "what you bought + coupons for the register" screen

  const sections = useMemo(() => {
    const by = new Map(AISLES.map((a) => [a.key, []]));
    const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
      .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)).join(' ');
    (items || []).forEach((it) => {
      const bucket = by.get(aisleFor(it.text).key);
      const key = norm(it.text);
      const same = key ? bucket.find((g) => g.key === key) : null;
      if (same) {
        same.ids.push(it.id);
        same.checked = same.checked && Boolean(it.checked);
      } else {
        bucket.push({ ...it, key, ids: [it.id], checked: Boolean(it.checked) });
      }
    });
    return AISLES.filter((a) => by.get(a.key).length)
      .map((a) => ({ key: a.key, emoji: a.emoji, name: t(a.labelKey), items: by.get(a.key) }));
  }, [items, t]);

  const flat = useMemo(() => sections.flatMap((s) => s.items.map((it) => ({ ...it, sectionKey: s.key }))), [sections]);
  const open = flat.filter((i) => !i.checked);
  // The section you are in = the first section that still has something to get (and was not left behind).
  const current = open.find((i) => !skipped.includes(i.id)) || null;
  const sectionOf = (key) => sections.find((s) => s.key === key);
  const openIn = (key) => open.filter((i) => i.sectionKey === key).length;
  const nameOf = (key) => sectionOf(key)?.name || '';

  useEffect(() => () => { if (celebrateTimer.current) clearTimeout(celebrateTimer.current); }, []);

  // A short celebration when a section is finished, then the next section's items appear.
  const celebrateSection = (sectionName, nextName) => {
    if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
    setConfettiKey((k) => k + 1);
    setCelebrate({ section: sectionName, next: nextName || '' });
    celebrateTimer.current = setTimeout(() => setCelebrate(null), 1900);
  };

  // Fern never talks over herself: a line that is being spoken (or fetched) is allowed to finish, and the next one
  // waits its turn. Before, every new line stopped the one before it, so a quick tap on the next item (or a second
  // announcement) cut the section change off mid-sentence. Only the newest plain line waits; lines flagged `keep`
  // (section changes, skipped items coming back) are never dropped.
  // Spoken lines are small, stable pieces ("Checked off Milk.", "3 left in Dairy.") that are fetched ahead of time while the
  // list is on screen, so a tap plays instantly from the phone instead of waiting on a round trip to the speech server.
  // lineCache: text -> Promise<uri>. A line nobody prefetched is simply fetched live (same as before).
  const prepareRef = useRef(prepareSpeech);
  prepareRef.current = prepareSpeech;
  const playPreparedRef = useRef(playPrepared);
  playPreparedRef.current = playPrepared;
  const lineCache = useRef(new Map());
  const getLine = useCallback((text) => {
    const cache = lineCache.current;
    if (cache.has(text)) return cache.get(text);
    const p = Promise.resolve(prepareRef.current(text)).then((uri) => { if (!uri) cache.delete(text); return uri; }).catch(() => { cache.delete(text); return null; });
    cache.set(text, p);
    return p;
  }, []);
  const speechRef = useRef({ busy: false, heard: false, pending: [], timer: null });
  const playNext = useRef(null);
  playNext.current = () => {
    const sp = speechRef.current;
    clearTimeout(sp.timer);
    const next = sp.pending.shift();
    if (!next) { sp.busy = false; return; }
    sp.busy = true;
    sp.heard = false;
    sp.timer = setTimeout(() => playNext.current(), 20000); // safety: never get stuck waiting on a line that did not play
    const gen = sp.gen || 0;
    getLine(next.text).then((uri) => {
      if ((sp.gen || 0) !== gen) return; // closed / reset while the line was loading
      if (!uri || !playPreparedRef.current(uri)) playNext.current();
    }).catch(() => playNext.current());
  };
  const resetSpeech = () => {
    const sp = speechRef.current;
    clearTimeout(sp.timer);
    sp.busy = false;
    sp.heard = false;
    sp.pending = [];
    sp.gen = (sp.gen || 0) + 1;
  };
  useEffect(() => {
    const sp = speechRef.current;
    if (!sp.busy) return;
    if (isSpeaking) { sp.heard = true; return; }
    if (sp.heard) { sp.heard = false; playNext.current(); }
  }, [isSpeaking]);

  // `lines` is one string or a list of short pieces that are spoken back to back (each piece is cached on its own).
  const say = useCallback((lines, { keep = false } = {}) => {
    const parts = (Array.isArray(lines) ? lines : [lines]).map((x) => String(x || '').trim()).filter(Boolean);
    const text = parts.join(' ');
    setStatus(text);
    if (!voice || !parts.length) return;
    const sp = speechRef.current;
    if (sp.lastText === text && Date.now() - (sp.lastAt || 0) < 3000) return; // same line twice in a row: say it once
    sp.lastText = text;
    sp.lastAt = Date.now();
    sp.pending = sp.pending.filter((p) => p.keep);
    parts.forEach((part) => sp.pending.push({ text: part, keep }));
    if (!sp.busy) playNext.current();
  }, [voice]);

  const intro = (sectionKey) => t('shopmode_section_intro', { section: nameOf(sectionKey), n: openIn(sectionKey) });

  // Start fresh each time it opens, and read the first section.
  useEffect(() => {
    if (!visible) { announced.current = false; setPicked(false); setSkipped([]); setStatus(''); setCelebrate(null); setShowRecap(false); setShowCoupons(false); resetSpeech(); stopSpeaking?.(); return; }
    if (!picked || announced.current || !current) return;
    announced.current = true;
    say([t(storeName ? 'shopmode_start_store' : 'shopmode_start', { store: storeName, n: open.length }), intro(current.sectionKey)], { keep: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, current?.id, picked]);

  // Only left-behind items remain: bring them back around.
  useEffect(() => {
    if (!visible || !picked || current || !open.length) return;
    setSkipped([]);
    say(t('shopmode_skipped_back'), { keep: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, picked, current, open.length]);

  // "Read the list ahead of time": when it opens with voice on, fetch every line Fern is likely to say (opening, each
  // section intro, each item's "checked off", the countdown, section done) a few at a time, in the order they will be needed.
  const prefetched = useRef(false);
  useEffect(() => {
    if (!visible) { prefetched.current = false; lineCache.current = new Map(); return; }
    if (!picked || !voice || prefetched.current || !flat.length) return;
    prefetched.current = true;
    const lines = [];
    const add = (x) => { if (x && !lines.includes(x)) lines.push(x); };
    const first = open[0];
    add(t(storeName ? 'shopmode_start_store' : 'shopmode_start', { store: storeName, n: open.length }));
    if (first) add(t('shopmode_section_intro', { section: nameOf(first.sectionKey), n: openIn(first.sectionKey) }));
    sections.forEach((s, si) => {
      const n = s.items.filter((i) => !i.checked).length;
      if (!n) return;
      s.items.filter((i) => !i.checked).forEach((i) => add(t('shopmode_checked', { item: i.text })));
      for (let k = 1; k < n; k += 1) add(t('shopmode_remaining', { n: k, section: s.name }));
      add(t('shopmode_section_done', { section: s.name }));
      const nextSec = sections.slice(si + 1).find((x) => x.items.some((i) => !i.checked));
      if (nextSec) add(t('shopmode_section_intro', { section: nextSec.name, n: nextSec.items.filter((i) => !i.checked).length }));
    });
    add(t('shopmode_all_done'));
    const queue = lines.slice(0, 60);
    let idx = 0;
    const worker = async () => {
      while (idx < queue.length && prefetched.current) {
        const text = queue[idx]; idx += 1;
        await getLine(text);
      }
    };
    worker(); worker(); worker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, voice, picked, flat.length]);

  const gotRef = useRef({});
  const got = async (item) => {
    // A double tap / double event on the same item must announce it once.
    const key = item.id;
    if (gotRef.current[key]) return;
    gotRef.current[key] = true;
    setTimeout(() => { delete gotRef.current[key]; }, 1500);
    const others = open.filter((i) => i.id !== item.id);
    const sameSection = others.filter((i) => i.sectionKey === item.sectionKey);
    const msg = [t('shopmode_checked', { item: item.text })];
    let sectionChange = false;
    if (sameSection.length) {
      msg.push(t('shopmode_remaining', { n: sameSection.length, section: nameOf(item.sectionKey) }));
    } else {
      const next = others.find((i) => !skipped.includes(i.id));
      if (next) {
        celebrateSection(nameOf(item.sectionKey), nameOf(next.sectionKey));
        const nextCount = others.filter((i) => i.sectionKey === next.sectionKey).length;
        msg.push(t('shopmode_section_done', { section: nameOf(item.sectionKey) }), t('shopmode_section_intro', { section: nameOf(next.sectionKey), n: nextCount }));
        sectionChange = true;
      } else if (others.length) {
        // Only skipped items are left: the effect above says "now back to the ones you skipped" once, after this line.
      } else {
        celebrateSection(nameOf(item.sectionKey), '');
        msg.push(t('shopmode_all_done'));
      }
    }
    say(msg, { keep: sectionChange });
    // Save last: the announcement/celebration above must show first, otherwise the next section's list flashes
    // on screen while the save finishes.
    await onSetChecked(item.ids || [item.id], true);
  };

  const tapRow = (item) => {
    if (item.checked) { onSetChecked(item.ids || [item.id], false); return; }
    got(flat.find((f) => f.id === item.id) || { ...item, sectionKey: aisleFor(item.text).key });
  };

  const laterOpen = current ? open.some((i) => i.sectionKey !== current.sectionKey && !skipped.includes(i.id)) : false;

  const moveOn = () => {
    if (!current) return;
    const key = current.sectionKey;
    const left = open.filter((i) => i.sectionKey === key);
    const next = open.find((i) => i.sectionKey !== key && !skipped.includes(i.id));
    const go = () => {
      setSkipped((prev) => [...prev, ...left.map((i) => i.id)]);
      if (next) say([t('shopmode_moving', { section: nameOf(next.sectionKey) }), intro(next.sectionKey)], { keep: true });
    };
    Alert.alert(
      t('shopmode_move_title'),
      t('shopmode_move_body', { n: left.length, section: nameOf(key) }),
      [
        { text: t('cancel_btn'), style: 'cancel' },
        { text: t('shopmode_move_yes'), onPress: go },
      ]
    );
  };

  const currentSection = current ? sectionOf(current.sectionKey) : null;
  const allDone = flat.length > 0 && !open.length;
  const bought = sections.map((s) => ({ ...s, items: s.items.filter((i) => i.checked) })).filter((s) => s.items.length);
  const boughtCount = bought.reduce((n, s) => n + s.items.reduce((m, i) => m + (i.ids ? i.ids.length : 1), 0), 0);
  const recapOn = showRecap || (allDone && !celebrate);

  // Finish: with things checked off, show the recap + coupons first; the second tap closes.
  const finish = () => {
    if (showCoupons) { setShowCoupons(false); return; }
    if (!recapOn && boughtCount > 0) { resetSpeech(); stopSpeaking?.(); setShowRecap(true); return; }
    onClose();
  };

  const choose = (withFern) => { onPickVoice?.(withFern); setPicked(true); };

  if (visible && !picked) {
    return (
      <Modal visible animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{`🌿 ${t('shopmode_title')}`}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.close}>{t('shopmode_close')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.choiceWrap}>
            <Text style={styles.choiceTitle}>{t('shopmode_choice_title')}</Text>
            <TouchableOpacity style={styles.choiceBtn} activeOpacity={0.85} onPress={() => choose(false)}>
              <Text style={styles.choiceBtnText}>{`🛒 ${t('shopmode_choice_own')}`}</Text>
              <Text style={styles.choiceBtnSub}>{t('shopmode_choice_own_sub')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.choiceBtn, styles.choiceBtnFern]} activeOpacity={0.85} onPress={() => choose(true)}>
              <Text style={[styles.choiceBtnText, { color: '#fff' }]}>{`🌿 ${t('shopmode_choice_fern')}`}</Text>
              <Text style={[styles.choiceBtnSub, { color: '#E8F0E4' }]}>{t('shopmode_choice_fern_sub')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={Boolean(visible)} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{`🌿 ${t('shopmode_title')}`}</Text>
          <TouchableOpacity onPress={finish} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.close}>{t('shopmode_close')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {celebrate ? (
            <View style={styles.celebrate}>
              <Text style={styles.celebrateEmoji}>🎉</Text>
              <Text style={styles.celebrateTitle}>{t('shopmode_celebrate', { section: celebrate.section })}</Text>
              {celebrate.next ? <Text style={styles.celebrateSub}>{t('shopmode_next_up', { section: celebrate.next })}</Text> : null}
            </View>
          ) : showCoupons ? (
            <View>
              <Text style={styles.sectionHeader}>{`🎟 ${t('shopmode_register_title')}`}</Text>
              <Text style={styles.status}>{t('shopmode_coupons_hint')}</Text>
              {coupons.map((m) => {
                const c = m.coupon;
                const used = Boolean(usedIds && usedIds.has(`k:${c.id}`));
                const hasCode = c.redemption === 'code' && Boolean(c.realCode) && Boolean(code128Widths(c.realCode));
                return (
                  <View key={c.id} style={[styles.couponCard, used && { opacity: 0.55 }]}>
                    <Text style={styles.couponTitle} numberOfLines={3}>{c.title || c.discountLabel}</Text>
                    <Text style={styles.couponMeta}>
                      {[c.discountLabel, c.store, t('sav_for_item', { item: m.itemText })].filter(Boolean).join(' · ')}
                    </Text>
                    {m.level === 'possible' ? <Text style={styles.couponMeta}>{t('sav_possible')}</Text> : null}
                    {hasCode ? <Barcode value={c.realCode} /> : (
                      <>
                        {c.image ? <Image source={{ uri: c.image }} style={styles.couponImg} resizeMode="contain" /> : null}
                        {c.redemption === 'link' && c.url ? (
                          <TouchableOpacity onPress={() => Linking.openURL(c.url)} activeOpacity={0.8}>
                            <Text style={styles.couponLink}>{t('sav_open_link')}</Text>
                          </TouchableOpacity>
                        ) : (
                          <>
                            <Text style={styles.couponMeta}>{t('sav_digital')}</Text>
                            {!storeName || !DIGITAL_OK.test(storeName) ? (
                              <Text style={styles.couponWarn}>{storeName ? t('shopmode_check_store', { store: storeName }) : t('shopmode_check_any')}</Text>
                            ) : null}
                          </>
                        )}
                      </>
                    )}
                    {m.value && m.value.percent && !m.value.amount ? <Text style={styles.couponMeta}>{t('sav_pct_note')}</Text> : null}
                    {onToggleCouponUsed ? (
                      <TouchableOpacity style={[styles.usedBtn, used && styles.usedBtnOn]} onPress={() => onToggleCouponUsed(m)} activeOpacity={0.85}>
                        <Text style={[styles.usedBtnText, used && { color: '#fff' }]}>{used ? t('sav_used') : t('sav_mark_used')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
              <TouchableOpacity style={styles.backBtn} onPress={() => setShowCoupons(false)} activeOpacity={0.8}>
                <Text style={styles.backBtnText}>{t('shopmode_back_recap')}</Text>
              </TouchableOpacity>
            </View>
          ) : recapOn ? (
            <View>
              <View style={styles.recapHead}>
                <Text style={styles.celebrateEmoji}>🎉</Text>
                <Text style={styles.celebrateTitle}>{t('shopmode_recap_title', { n: boughtCount })}</Text>
                {!open.length ? <Text style={styles.celebrateSub}>{t('shopmode_all_done')}</Text> : null}
              </View>
              {bought.map((sec) => (
                <View key={sec.key} style={styles.recapSection}>
                  <Text style={styles.sectionHeader}>{`${sec.emoji} ${sec.name}`}</Text>
                  <Text style={styles.recapItems}>
                    {sec.items.map((i) => (i.ids && i.ids.length > 1 ? `${i.text} ×${i.ids.length}` : i.text)).join(' · ')}
                  </Text>
                </View>
              ))}
              <Text style={[styles.sectionHeader, { marginTop: 22 }]}>{`🎟 ${t('shopmode_register_title')}`}</Text>
              <Text style={styles.status}>
                {coupons.length ? t('shopmode_scan_sub', { n: coupons.length }) : t('shopmode_scan_none')}
              </Text>
              {coupons.length ? (
                <TouchableOpacity style={styles.nextBtn} activeOpacity={0.85} onPress={() => setShowCoupons(true)}>
                  <Text style={styles.nextBtnText}>{t('shopmode_open_coupons', { n: coupons.length })}</Text>
                </TouchableOpacity>
              ) : null}
              {onClearChecked && boughtCount > 0 ? (
                <TouchableOpacity style={styles.clearBtn} activeOpacity={0.85} onPress={() => Alert.alert(t('clear_list_title'), t('shopmode_clear_body'), [
                  { text: t('cancel_btn'), style: 'cancel' },
                  { text: t('shopmode_clear_yes'), style: 'destructive', onPress: async () => { await onClearChecked(); onClose(); } },
                ])}>
                  <Text style={styles.clearBtnText}>{`🗑 ${t('shopmode_clear_btn')}`}</Text>
                </TouchableOpacity>
              ) : null}
              {open.length ? (
                <TouchableOpacity style={styles.backBtn} onPress={() => setShowRecap(false)} activeOpacity={0.8}>
                  <Text style={styles.backBtnText}>{t('shopmode_keep_shopping')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : currentSection ? (
            <View>
              <Text style={styles.sectionHeader}>{`${currentSection.emoji} ${currentSection.name} · ${t('shopmode_left', { n: openIn(currentSection.key) })}`}</Text>
              {status ? <Text style={styles.status}>{status}</Text> : null}
              {currentSection.items.map((it) => (
                <TouchableOpacity key={it.id} style={styles.row} activeOpacity={0.7} onPress={() => tapRow(it)}>
                  <View style={[styles.checkbox, it.checked && styles.checkboxChecked]}>
                    {it.checked ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowText, it.checked && styles.rowTextChecked]} numberOfLines={2}>
                      {it.ids && it.ids.length > 1 ? `${it.text} ×${it.ids.length}` : it.text}
                    </Text>
                    {/* Where it came from: the recipe(s) that need it (not for plain manual adds). */}
                    {it.recipe && !/^(manual add|fern starter|fern suggestion|coupon deal)$/i.test(String(it.recipe).trim()) ? (
                      <Text style={styles.rowFor} numberOfLines={1}>{t('shopmode_for', { recipe: it.recipe })}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </ScrollView>

        {!celebrate && !recapOn && !showCoupons && laterOpen ? (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.nextBtn} activeOpacity={0.85} onPress={moveOn}>
              <Text style={styles.nextBtnText}>{t('shopmode_next_section')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {celebrate ? <Confetti key={confettiKey} /> : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  choiceWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, gap: 14 },
  choiceTitle: { fontSize: 24, fontWeight: '800', color: colors.ink, textAlign: 'center', marginBottom: 10 },
  choiceBtn: { backgroundColor: colors.paper, borderWidth: 2, borderColor: colors.border, borderRadius: 18, paddingVertical: 22, paddingHorizontal: 18, alignItems: 'center' },
  choiceBtnFern: { backgroundColor: colors.bright, borderColor: colors.bright },
  choiceBtnText: { fontSize: 20, fontWeight: '800', color: colors.ink },
  choiceBtnSub: { fontSize: 14, color: colors.brown, marginTop: 6, textAlign: 'center' },
  container: { flex: 1, backgroundColor: colors.parch },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  close: { fontSize: 15, fontWeight: '700', color: colors.bright },
  list: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 30, flexGrow: 1 },
  sectionHeader: { fontSize: 15, fontWeight: '800', color: colors.brown, letterSpacing: 0.6, textTransform: 'uppercase' },
  status: { fontSize: 14, color: colors.brown, marginTop: 6, marginBottom: 6, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 8 },
  checkbox: { width: 28, height: 28, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  checkboxChecked: { backgroundColor: colors.bright, borderColor: colors.bright },
  checkmark: { color: '#fff', fontSize: 16, fontWeight: '900' },
  rowText: { fontSize: 18, color: colors.ink },
  rowFor: { fontSize: 13, color: colors.muted, marginTop: 2 },
  rowTextChecked: { color: colors.muted, textDecorationLine: 'line-through' },
  celebrate: { alignItems: 'center', justifyContent: 'center', paddingVertical: 70 },
  celebrateEmoji: { fontSize: 56 },
  celebrateTitle: { fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: 10, textAlign: 'center' },
  celebrateSub: { fontSize: 16, color: colors.brown, marginTop: 8, textAlign: 'center' },
  recapHead: { alignItems: 'center', paddingVertical: 14 },
  recapSection: { marginTop: 14 },
  recapItems: { fontSize: 16, color: colors.ink, lineHeight: 23, marginTop: 4 },
  couponCard: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, marginTop: 10 },
  couponTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  couponMeta: { fontSize: 13, color: colors.brown, marginTop: 3 },
  couponCodeBig: { fontSize: 26, fontWeight: '900', color: colors.ink, letterSpacing: 3, textAlign: 'center', marginTop: 10, paddingVertical: 10, backgroundColor: '#fff', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  couponWarn: { fontSize: 13, fontWeight: '700', color: '#B23A2A', marginTop: 6 },
  couponLink: { fontSize: 14, fontWeight: '800', color: colors.bright, marginTop: 6 },
  usedBtn: { alignSelf: 'flex-start', marginTop: 10, borderWidth: 1.5, borderColor: '#2A6A2A', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  usedBtnOn: { backgroundColor: '#2A6A2A' },
  usedBtnText: { color: '#2A6A2A', fontSize: 13, fontWeight: '800' },
  clearBtn: { alignItems: 'center', marginTop: 22, paddingVertical: 14, borderRadius: radius.lg, borderWidth: 1.5, borderColor: '#B23A2A' },
  clearBtnText: { color: '#B23A2A', fontSize: 16, fontWeight: '800' },
  backBtn: { alignItems: 'center', paddingVertical: 18 },
  backBtnText: { color: colors.bright, fontSize: 15, fontWeight: '700' },
  barcodeWrap: { backgroundColor: '#fff', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: 12, marginTop: 12 },
  barcodeRow: { flexDirection: 'row', height: 90 },
  barcodeText: { textAlign: 'center', fontSize: 15, fontWeight: '800', color: '#000', letterSpacing: 2, marginTop: 6 },
  couponImg: { width: '100%', height: 140, marginTop: 10 },
  footer: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.parch },
  nextBtn: { backgroundColor: colors.orange, paddingVertical: 15, borderRadius: radius.lg, alignItems: 'center' },
  nextBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
