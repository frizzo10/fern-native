import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../constants/tokens';
import { AISLES } from '../utils/aisles';
import { showReview, hideReview, hasReviewHost } from '../services/reviewBus';

// The "here's what goes on your list" step, shown inline (not a Modal — iOS drops a Modal presented while
// another is closing) before anything is written. Items are grouped by store section; an item needed by
// more than one meal says to buy more. Un-tick anything you don't want.
//   lines     from planShoppingAdditions(): [{ key, text, aisle, meals, count, status }]
//   onConfirm (skip: Set<string>) => void    lower-cased names the user un-ticked
//   onCancel  () => void
export function ListAddPreviewBody({ lines, t, onConfirm, onCancel, busy, intro, flat }) {
  const [off, setOff] = useState(() => new Set());

  const groups = useMemo(() => {
    const map = new Map();
    (lines || []).forEach((line) => {
      if (!map.has(line.aisle.key)) map.set(line.aisle.key, []);
      map.get(line.aisle.key).push(line);
    });
    return AISLES.filter((a) => map.has(a.key)).map((a) => ({ aisle: a, rows: map.get(a.key) }));
  }, [lines]);

  // Items that change the list: new ones, and ones that now need more. "Already on your list" rows change nothing.
  const changing = (lines || []).filter((l) => l.status !== 'have' && !off.has(l.key));

  const toggle = (key) => setOff((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <View style={flat ? styles.flat : styles.wrap}>
      <Text style={[styles.title, flat ? { fontSize: 22 } : null]}>{t('list_preview_title')}</Text>
      {intro ? <Text style={styles.sub}>{intro}</Text> : null}
      {groups.map(({ aisle, rows }) => (
        <View key={aisle.key} style={styles.group}>
          <Text style={styles.groupLabel}>{`${aisle.emoji} ${t(aisle.labelKey)}`}</Text>
          {rows.map((line) => {
            const have = line.status === 'have';
            const on = have || !off.has(line.key);
            return (
              <TouchableOpacity key={line.key} style={styles.row} activeOpacity={0.8} disabled={have || busy} onPress={() => toggle(line.key)}>
                <View style={[styles.check, on ? styles.checkOn : null, have ? styles.checkHave : null]}>
                  <Text style={styles.checkMark}>{on ? '✓' : ''}</Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.name, !on ? styles.nameOff : null]}>{line.text}</Text>
                  {line.meals.length ? <Text style={styles.meals} numberOfLines={2}>{line.meals.join(' · ')}</Text> : null}
                  {line.status === 'more' ? <Text style={styles.more}>{t('list_preview_more', { n: line.count })}</Text> : null}
                  {have ? <Text style={styles.meals}>{t('list_preview_have')}</Text> : null}
                </View>
                {line.count > 1 ? <Text style={styles.badge}>{`×${line.count}`}</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primary, !changing.length || busy ? { opacity: 0.5 } : null]}
          disabled={!changing.length || busy}
          activeOpacity={0.88}
          onPress={() => onConfirm?.(off)}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('list_preview_add', { n: changing.length })}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancel} disabled={busy} activeOpacity={0.8} onPress={onCancel}>
          <Text style={styles.cancelText}>{t('list_preview_cancel')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// What callers render: the review opens as a separate full screen (see ShoppingScreen's overlay) when a host
// is mounted, so it can never be mistaken for part of the shopping list; otherwise it falls back to inline.
export default function ListAddPreview(props) {
  const [hosted] = useState(() => hasReviewHost());
  const latest = useRef(props);
  latest.current = props;
  // Only re-post when what is shown changes (the parent re-renders often; posting every time would loop).
  const sig = `${props.busy ? 1 : 0}|${props.intro || ''}|${(props.lines || []).map((l) => `${l.key}:${l.status}:${l.count}`).join(',')}`;
  useEffect(() => {
    if (!hosted) return;
    showReview({
      lines: latest.current.lines,
      intro: latest.current.intro,
      busy: latest.current.busy,
      onConfirm: (skip) => latest.current.onConfirm?.(skip),
      onCancel: () => latest.current.onCancel?.(),
    });
  }, [hosted, sig]);
  useEffect(() => () => { if (hosted) hideReview(); }, [hosted]);
  return hosted ? null : <ListAddPreviewBody {...props} />;
}

const styles = StyleSheet.create({
  flat: { backgroundColor: 'transparent' },
  wrap: { backgroundColor: '#ECF2E6', borderRadius: 10, padding: 10, marginTop: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#C8D6BE' },
  title: { fontSize: 14, fontWeight: '700', color: '#2F4535' },
  sub: { fontSize: 12, color: '#6B7F66', marginTop: 2 },
  group: { marginTop: 8 },
  groupLabel: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#6B7F66', fontWeight: '700', marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#C8D6BE' },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#C9BFB3', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkOn: { backgroundColor: colors?.orange || '#4E7A54', borderColor: colors?.orange || '#4E7A54' },
  checkHave: { backgroundColor: '#DDE7D5', borderColor: '#DDE7D5' },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  rowText: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: '#2F4535' },
  nameOff: { color: '#9a8f84', textDecorationLine: 'line-through' },
  meals: { fontSize: 12, color: '#6B7F66', marginTop: 1 },
  more: { fontSize: 12, color: '#3F6845', fontWeight: '700', marginTop: 1 },
  badge: { fontSize: 13, fontWeight: '800', color: colors?.orange || '#4E7A54' },
  actions: { marginTop: 10, gap: 6 },
  primary: { backgroundColor: colors?.orange || '#4E7A54', borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cancel: { paddingVertical: 8, alignItems: 'center' },
  cancelText: { color: '#6B7F66', fontSize: 13, fontWeight: '600' },
});
