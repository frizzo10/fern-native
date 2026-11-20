// Home card for households. Not in one: "Cooking for someone? Invite them." (one tap makes the household quietly and
// opens the share sheet with a link) plus a small "Have a code?" box. In one: shows who is at the table.
import React, { useCallback, useEffect, useState } from 'react';
import { Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import useLanguage from '../../hooks/useLanguage';
import { householdCall, saveHouseholdLocally, getCachedHousehold } from '../../services/householdService';
import { startJoin, JOIN_SITE } from '../../services/householdJoin';
import { discardPendingPull } from '../../hooks/useSync';

export default function HouseholdHomeCard({ user, pull, onOpenAccount }) {
  const { t } = useLanguage();
  const [hh, setHh] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  const refresh = useCallback(async () => {
    setHh(await getCachedHousehold());
    if (!user?.token) return;
    try {
      const r = await householdCall(user.token, 'status');
      await saveHouseholdLocally(r.household || null);
      setHh(r.household || null);
    } catch (e) { /* keep the cached view */ }
  }, [user?.token]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  useEffect(() => { refresh(); }, [refresh]);

  const invite = async () => {
    if (busy || !user?.token) return;
    setBusy(true); setErr('');
    try {
      let h = hh;
      if (!h) {
        const r = await householdCall(user.token, 'create');
        h = r.household;
        await saveHouseholdLocally(h || null);
        setHh(h || null);
        discardPendingPull();
        try { await pull?.(); } catch (e) { /* ignore */ }
      }
      if (h?.code) {
        await Share.share({ message: t('hh_invite_msg', { link: JOIN_SITE + h.code, code: h.code }) });
      }
    } catch (e) {
      setErr(String(e?.message || t('hh_err_body')));
    } finally {
      setBusy(false);
    }
  };

  const join = () => {
    const c = code;
    setCode(''); setCodeOpen(false);
    startJoin({ token: user?.token, code: c, t, onJoined: async (h) => { setHh(h || null); try { await pull?.(); } catch (e) { /* ignore */ } } });
  };

  if (hh === undefined || !user?.token) return null;

  if (hh) {
    const others = (Array.isArray(hh.members) ? hh.members : []).filter((m) => !m.isMe).map((m) => m.name || t('hh_someone'));
    const line = others.length ? t('hh_home_with', { names: others.join(', ') }) : t('hh_home_alone');
    return (
      <View style={s.card}>
        <TouchableOpacity activeOpacity={0.85} onPress={onOpenAccount} accessibilityRole="button" style={s.rowTop}>
          <Text style={s.title}>🏡 {line}</Text>
          <Text style={s.link}>{t('hh_home_manage')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.ghost} activeOpacity={0.85} onPress={invite} disabled={busy} accessibilityRole="button">
          <Text style={s.ghostText}>{t('hh_invite_more')}</Text>
        </TouchableOpacity>
        {err ? <Text style={s.err}>{err}</Text> : null}
      </View>
    );
  }

  return (
    <View style={s.card}>
      <Text style={s.title}>🏡 {t('hh_invite_title')}</Text>
      <Text style={s.body}>{t('hh_invite_sub')}</Text>
      <TouchableOpacity style={[s.primary, busy && { opacity: 0.6 }]} activeOpacity={0.85} onPress={invite} disabled={busy} accessibilityRole="button">
        <Text style={s.primaryText}>{t('hh_invite_btn')}</Text>
      </TouchableOpacity>
      {err ? <Text style={s.err}>{err}</Text> : null}
      {codeOpen ? (
        <View style={s.row}>
          <TextInput
            style={s.input}
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
            placeholder={t('hh_code_placeholder')}
            placeholderTextColor="#8FA08A"
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={join}
          />
          <TouchableOpacity style={[s.ghost, { marginTop: 0, opacity: code.length >= 6 ? 1 : 0.5 }]} onPress={join} disabled={code.length < 6}>
            <Text style={s.ghostText}>{t('hh_join_btn')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setCodeOpen(true)} style={s.codeLink} accessibilityRole="button">
          <Text style={s.link}>{t('hh_have_code')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#ECF2E6', borderRadius: 16, borderWidth: 1, borderColor: '#C8D6BE', padding: 16, marginBottom: 14 },
  rowTop: { minHeight: 44, justifyContent: 'center' },
  title: { color: '#2F4535', fontFamily: 'Jost-SemiBold', fontSize: 18 },
  body: { color: '#2F4535', fontFamily: 'Jost-Regular', fontSize: 15, lineHeight: 21, marginTop: 6 },
  primary: { backgroundColor: '#3F5645', borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryText: { color: '#FFFFFF', fontFamily: 'Jost-SemiBold', fontSize: 16 },
  ghost: { borderWidth: 1, borderColor: '#3F5645', borderRadius: 12, minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  ghostText: { color: '#3F5645', fontFamily: 'Jost-SemiBold', fontSize: 15 },
  link: { color: '#3F5645', fontFamily: 'Jost-SemiBold', fontSize: 14, textDecorationLine: 'underline' },
  codeLink: { minHeight: 44, justifyContent: 'center', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  input: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C8D6BE', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 18, letterSpacing: 3, color: '#2F4535', fontFamily: 'Jost-SemiBold', minHeight: 48 },
  err: { color: '#B3473F', fontFamily: 'Jost-Regular', fontSize: 14, marginTop: 8 },
});
