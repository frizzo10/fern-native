// Account > "Your household": people who eat together share one week, shopping list, family calendar, stores and
// recipe library (the server keeps one shared copy; see householdService.js). Create one, or join with a code.
// Only native Alerts are used for confirmations (a second Modal inside the Account Modal gets dropped on iOS).
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import useLanguage from '../hooks/useLanguage';
import { householdCall, saveHouseholdLocally } from '../services/householdService';

export default function HouseholdCard({ user, onChanged }) {
  const { t } = useLanguage();
  const [hh, setHh] = useState(undefined); // undefined = loading, null = none
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');

  const load = useCallback(async () => {
    if (!user?.token) return;
    try {
      const r = await householdCall(user.token, 'status');
      setHh(r.household || null);
      await saveHouseholdLocally(r.household || null);
    } catch (e) {
      setHh((cur) => (cur === undefined ? null : cur));
    }
  }, [user?.token]);
  useEffect(() => { load(); }, [load]);

  const fail = (e) => Alert.alert(t('hh_err_title'), String(e?.message || t('hh_err_body')));
  const run = async (action, extra, after) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await householdCall(user.token, action, extra);
      if (action !== 'preview') {
        setHh(r.household || null);
        await saveHouseholdLocally(r.household || null);
        await onChanged?.();
      }
      if (after) after(r);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const create = () => Alert.alert(t('hh_create_confirm_title'), t('hh_create_confirm_body'), [
    { text: t('cancel_btn'), style: 'cancel' },
    { text: t('hh_create'), onPress: () => run('create') },
  ]);

  const join = async () => {
    const c = code.trim();
    if (c.length < 6 || busy) return;
    setBusy(true);
    try {
      const r = await householdCall(user.token, 'preview', { code: c });
      const n = r.counts || {};
      const parts = [
        n.recipes ? t('hh_n_recipes', { n: n.recipes }) : '',
        n.books ? t('hh_n_books', { n: n.books }) : '',
        n.list ? t('hh_n_list', { n: n.list }) : '',
        n.activities ? t('hh_n_acts', { n: n.activities }) : '',
        n.stores ? t('hh_n_stores', { n: n.stores }) : '',
      ].filter(Boolean);
      const who = (r.with || []).join(', ') || t('hh_someone');
      const body = parts.length ? t('hh_join_confirm_body', { who, adds: parts.join(', ') }) : t('hh_join_confirm_none', { who });
      setBusy(false);
      Alert.alert(t('hh_join_confirm_title'), body, [
        { text: t('cancel_btn'), style: 'cancel' },
        { text: t('hh_join_btn'), onPress: () => run('join', { code: c }, () => setCode('')) },
      ]);
    } catch (e) {
      setBusy(false);
      fail(e);
    }
  };

  const leave = () => Alert.alert(t('hh_leave_confirm_title'), t('hh_leave_confirm_body'), [
    { text: t('cancel_btn'), style: 'cancel' },
    { text: t('hh_leave'), style: 'destructive', onPress: () => run('leave') },
  ]);
  const newCode = () => Alert.alert(t('hh_new_code'), t('hh_new_code_confirm'), [
    { text: t('cancel_btn'), style: 'cancel' },
    { text: t('hh_new_code'), onPress: () => run('new_code') },
  ]);
  const shareCode = () => {
    try { Share.share({ message: t('hh_share_msg', { code: hh.code }) }); } catch (e) { /* closed */ }
  };

  if (hh === undefined) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>{t('hh_title').toUpperCase()}</Text>
        <ActivityIndicator color="#3F5645" style={{ marginTop: 10 }} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t('hh_title').toUpperCase()}</Text>
      {!hh ? (
        <View>
          <Text style={styles.sub}>{t('hh_sub')}</Text>
          <TouchableOpacity style={styles.primary} activeOpacity={0.85} onPress={create} disabled={busy}>
            <Text style={styles.primaryText}>{t('hh_create')}</Text>
          </TouchableOpacity>
          <Text style={[styles.sub, { marginTop: 16 }]}>{t('hh_join_label')}</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
              placeholder={t('hh_code_placeholder')}
              placeholderTextColor="#8FA08A"
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={join}
            />
            <TouchableOpacity style={[styles.primary, { marginTop: 0, opacity: code.length >= 6 ? 1 : 0.5 }]} activeOpacity={0.85} onPress={join} disabled={busy || code.length < 6}>
              <Text style={styles.primaryText}>{t('hh_join_btn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View>
          <Text style={styles.sub}>{t('hh_member_sub')}</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>{t('hh_code_label')}</Text>
            <Text style={styles.code} selectable>{hh.code}</Text>
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.primary, { marginTop: 0, flex: 1 }]} activeOpacity={0.85} onPress={shareCode}>
              <Text style={styles.primaryText}>{t('hh_share_code')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghost} activeOpacity={0.85} onPress={newCode} disabled={busy}>
              <Text style={styles.ghostText}>{t('hh_new_code')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.label, { marginTop: 18 }]}>{t('hh_members').toUpperCase()}</Text>
          {(hh.members || []).map((m) => (
            <View key={m.id} style={styles.member}>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>
                  {(m.name || t('hh_someone')) + (m.isMe ? ` (${t('hh_you')})` : '')}
                </Text>
                {m.avoids ? <Text style={styles.memberAvoids}>{t('hh_avoids', { foods: m.avoids })}</Text> : null}
              </View>
              {m.isShopper ? (
                <View style={styles.badge}><Text style={styles.badgeText}>{t('hh_shopper')}</Text></View>
              ) : (
                <TouchableOpacity style={styles.ghostSmall} activeOpacity={0.85} onPress={() => run('set_shopper', { userId: m.id })} disabled={busy}>
                  <Text style={styles.ghostText}>{t('hh_make_shopper')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          <Text style={[styles.sub, { marginTop: 8 }]}>{t('hh_shopper_note')}</Text>
          <TouchableOpacity onPress={leave} disabled={busy} style={{ marginTop: 14, minHeight: 44, justifyContent: 'center' }}>
            <Text style={styles.leave}>{t('hh_leave')}</Text>
          </TouchableOpacity>
        </View>
      )}
      {busy ? <ActivityIndicator color="#3F5645" style={{ marginTop: 10 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#C8D6BE', padding: 18, marginBottom: 14 },
  label: { color: '#5C7262', fontFamily: 'Jost-SemiBold', fontSize: 12, letterSpacing: 1.2 },
  sub: { color: '#2F4535', fontFamily: 'Jost-Regular', fontSize: 15, lineHeight: 21, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  input: { backgroundColor: '#F7FAF3', borderWidth: 1, borderColor: '#C8D6BE', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, letterSpacing: 3, color: '#2F4535', fontFamily: 'Jost-SemiBold', minHeight: 48 },
  primary: { backgroundColor: '#3F5645', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', marginTop: 12, minHeight: 48 },
  primaryText: { color: '#FFFFFF', fontFamily: 'Jost-SemiBold', fontSize: 16 },
  ghost: { borderWidth: 1, borderColor: '#3F5645', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  ghostSmall: { borderWidth: 1, borderColor: '#3F5645', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
  ghostText: { color: '#3F5645', fontFamily: 'Jost-SemiBold', fontSize: 14 },
  codeBox: { backgroundColor: '#ECF2E6', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  codeLabel: { color: '#5C7262', fontFamily: 'Jost-Regular', fontSize: 13 },
  code: { color: '#2F4535', fontFamily: 'Jost-SemiBold', fontSize: 30, letterSpacing: 6, marginTop: 2 },
  member: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#ECF2E6', gap: 10 },
  memberName: { color: '#2F4535', fontFamily: 'Jost-SemiBold', fontSize: 16 },
  memberAvoids: { color: '#5C7262', fontFamily: 'Jost-Regular', fontSize: 13, marginTop: 2 },
  badge: { backgroundColor: '#4E7A54', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  badgeText: { color: '#FFFFFF', fontFamily: 'Jost-SemiBold', fontSize: 13 },
  leave: { color: '#B3473F', fontFamily: 'Jost-SemiBold', fontSize: 15 },
});
