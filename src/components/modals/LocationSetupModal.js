import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Linking, ActivityIndicator, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useLanguage from '../../hooks/useLanguage';
import { getLocationSetupStatus, isSetupComplete, needsAlways, requestLocationSetup } from '../../services/locationSetup';

const C = { forest: '#8A4A4E', orange: '#D8607C', parch: '#FFFAF6', ink: '#5A3236', brown: '#9A7872', border: '#E8E0D0', green: '#C0475F' };

// First-run (and later, if something is missing) explanation + one button that runs
// the location / "Always" / notification prompts. onDone(status) fires on close.
export default function LocationSetupModal({ visible, onDone }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState({ foreground: false, always: false, notifications: false });
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;
    let alive = true;
    const refresh = async () => { const s = await getLocationSetupStatus(); if (alive) setStatus(s); };
    refresh();
    // Coming back from the Settings app: re-check.
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') refresh(); });
    return () => { alive = false; sub.remove(); };
  }, [visible]);

  const enable = async () => {
    setBusy(true);
    const s = await requestLocationSetup();
    setStatus(s);
    setAsked(true);
    setBusy(false);
    if (isSetupComplete(s)) onDone(s);
  };

  const complete = isSetupComplete(status);
  // iOS shows the "Always" question only once. If "While Using" is already granted but Always
  // isn't (e.g. from an earlier day), asking again does nothing, so go straight to Settings.
  const alwaysOnlyInSettings = needsAlways && status.foreground && !status.always;
  const needsSettings = (asked && !complete) || (alwaysOnlyInSettings && !complete);

  const rows = [
    { ok: status.foreground, label: t('loc_setup_row_loc') },
    ...(needsAlways ? [{ ok: status.always, label: t('loc_setup_row_always') }] : []),
    { ok: status.notifications, label: t('loc_setup_row_notif') },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => onDone(status)}>
      <SafeAreaView style={s.safe}>
        <View style={s.body}>
          <Text style={s.emoji}>📍</Text>
          <Text style={s.title}>{t('loc_setup_title')}</Text>
          <Text style={s.sub}>{t('loc_setup_sub')}</Text>

          <View style={s.card}>
            {rows.map((r) => (
              <View key={r.label} style={s.row}>
                <Text style={[s.check, r.ok && { color: C.green }]}>{r.ok ? '✓' : '○'}</Text>
                <Text style={s.rowText}>{r.label}</Text>
              </View>
            ))}
          </View>
          {needsAlways ? <Text style={s.hint}>{t('loc_setup_always_hint')}</Text> : null}
        </View>

        <View style={s.footer}>
          {complete ? (
            <TouchableOpacity style={s.primary} onPress={() => onDone(status)}>
              <Text style={s.primaryText}>{t('loc_setup_done')}</Text>
            </TouchableOpacity>
          ) : needsSettings ? (
            <TouchableOpacity style={s.primary} onPress={() => Linking.openSettings()}>
              <Text style={s.primaryText}>{t('loc_setup_settings')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.primary} onPress={enable} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>{t('loc_setup_enable')}</Text>}
            </TouchableOpacity>
          )}
          {needsSettings && <Text style={s.settingsNote}>{t('loc_setup_settings_note')}</Text>}
          {!complete && (
            <TouchableOpacity onPress={() => onDone(status)} style={s.later}>
              <Text style={s.laterText}>{t('loc_setup_later')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.parch },
  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  emoji: { fontSize: 44, textAlign: 'center', marginBottom: 12 },
  title: { fontSize: 26, fontFamily: 'Playfair-Bold', color: C.ink, textAlign: 'center' },
  sub: { fontSize: 16, fontFamily: 'Jost-Regular', color: C.brown, textAlign: 'center', marginTop: 10, lineHeight: 23 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  check: { fontSize: 20, width: 28, color: C.brown },
  rowText: { flex: 1, fontSize: 16, fontFamily: 'Jost-SemiBold', color: C.ink },
  hint: { fontSize: 13, fontFamily: 'Jost-Regular', color: C.brown, textAlign: 'center', marginTop: 14, lineHeight: 19 },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
  primary: { backgroundColor: C.orange, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 17, fontFamily: 'Jost-Bold' },
  settingsNote: { fontSize: 13, fontFamily: 'Jost-Regular', color: C.brown, textAlign: 'center', marginTop: 10, lineHeight: 19 },
  later: { alignItems: 'center', paddingVertical: 14 },
  laterText: { fontSize: 15, fontFamily: 'Jost-SemiBold', color: C.brown },
});
