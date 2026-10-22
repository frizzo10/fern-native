import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadow } from '../../constants/tokens';
import { scanCircular } from '../../services/scanCircularService';
import { discardLatestScan, fetchStoreDeals } from '../../services/storeDealsService';
import { pickPhotoFromCamera, pickPhotoFromLibrary } from '../../services/photoPickerService';
import { zipsByStoreName } from '../../utils/storeZip';
import { dealsForStore } from '../../utils/flyerStore';
import { loadWeekDeals, replaceWeekDeals, saveWeekDeals } from '../../utils/savings';

// Step 2 of the shopping trip: get this week's flyer into the app. Either reuse the ad other
// Fern shoppers already scanned for the user's saved stores, or scan a photo of the paper/online flyer.
// Whatever is read is remembered for the week (fern_week_deals) and shown in "This week's sales".
// Kept at module level so the "Read N items / Wrong photo" line survives the card swapping into the circular.
let lastScanMemo = null;

export default function FlyerSection({ user, stores, t, weekDeals, onDealsChanged, onScanned, embedded }) {
  const [shared, setShared] = useState([]); // [{ store, scannedAt, itemCount, items }]
  const [busy, setBusy] = useState(false);
  const [last, setLastState] = useState(lastScanMemo); // { store, validDates, count, before }
  const setLast = (v) => { lastScanMemo = v; setLastState(v); };
  // The remembered scan line belongs to one store; never show Publix's "Read 8 items" while looking at Harris Teeter.
  const chainOf = (n) => String(n || '').toLowerCase().split(/ - |#/)[0].replace(/[^a-z0-9]/g, '');
  const hereKeys = Array.from(new Set((stores || []).map((x) => chainOf(x?.name)).filter(Boolean)));
  const lastHere = last && (hereKeys.length !== 1 || !chainOf(last.store) || chainOf(last.store).includes(hereKeys[0]) || hereKeys[0].includes(chainOf(last.store))) ? last : null;
  const [secs, setSecs] = useState(0); // seconds since the scan started, shown while Fern reads the flyer
  useEffect(() => {
    if (!busy) { setSecs(0); return undefined; }
    const id = setInterval(() => setSecs((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);
  const triedShared = useRef(false);

  // Look for a flyer that is already on file, once per visit, when nothing is loaded yet.
  useEffect(() => {
    if (triedShared.current || weekDeals.length || !user?.token || !stores?.length) return;
    triedShared.current = true;
    fetchStoreDeals({ token: user.token, stores: stores.map((s) => s?.name), zips: zipsByStoreName(stores) })
      .then(setShared)
      .catch(() => {});
  }, [weekDeals.length, user?.token, stores]);

  const useShared = async () => {
    const deals = shared.flatMap((k) => k.items.map((it) => ({
      name: it.name,
      salePrice: it.price || '',
      originalPrice: it.originalPrice || '',
      savings: it.savings || '',
      category: it.category || '',
      cookable: Boolean(it.cookable),
      isBogo: Boolean(it.isBogo),
      store: k.store,
    })));
    await saveWeekDeals(deals);
    setShared([]);
    await onDealsChanged?.();
    onScanned?.();
  };

  const scan = async (fromCamera) => {
    const picked = fromCamera ? await pickPhotoFromCamera({ quality: 0.5, maxWidth: 1800 }) : await pickPhotoFromLibrary({ quality: 0.5, maxWidth: 1800 });
    if (picked.permissionDenied) {
      Alert.alert(t('permission_needed_title'), t('photo_permission_denied_desc'));
      return;
    }
    if (!picked.photo?.base64) return;
    setBusy(true);
    const before = await loadWeekDeals();
    try {
      const result = await scanCircular({ userId: user?.id, base64: picked.photo.base64, mimeType: picked.photo.mimeType, token: user?.token, storeName: stores?.length === 1 ? String(stores[0]?.name || '').split(/ - |#/)[0].trim() : undefined });
      const items = (result.items || []).filter((i) => i.name);
      if (!items.length) {
        Alert.alert(t('trip_flyer_none'));
        return;
      }
      setShared([]);
      await onDealsChanged?.();
      const after = await loadWeekDeals();
      // Count only the scanned store's items (week deals hold every store), so "in all" matches that store's circular.
      const scanStore = String(result.store || '').trim() || String(stores?.[0]?.name || '').trim();
      const sameStore = (list) => (scanStore ? dealsForStore(list, scanStore) : list);
      const beforeN = sameStore(before).length;
      const afterN = sameStore(after).length;
      const added = Math.max(0, afterN - beforeN); // items this page really added (repeats are merged away)
      setLast({ store: String(result.store || '').trim(), validDates: String(result.validDates || '').trim(), count: items.length, before, added, total: afterN });
      onScanned?.();
    } catch (e) {
      console.log('[trip] flyer scan failed', e?.message || e);
      Alert.alert(t('scan_circular_scan_failed_title'), t('scan_circular_scan_failed_desc'));
    } finally {
      setBusy(false);
    }
  };

  const retake = async () => {
    if (last?.before) await replaceWeekDeals(last.before);
    discardLatestScan({ token: user?.token });
    setLast(null);
    onDealsChanged?.();
  };

  const whenText = (iso) => {
    const ts = new Date(iso).getTime();
    const days = ts ? Math.max(0, Math.floor((Date.now() - ts) / 86400000)) : 0;
    return days === 0 ? t('psp_when_today') : days === 1 ? t('psp_when_yesterday') : t('psp_when_days_ago', { n: days });
  };

  return (
    <View style={embedded ? styles.embedded : [styles.card, shadow.card]}>
      {embedded ? (
        <Text style={styles.moreTitle}>{`📷 ${t('trip_flyer_more')}`}</Text>
      ) : (
        <>
          <Text style={styles.title}>{`📰 ${t('trip_flyer_title')}`}</Text>
          <Text style={styles.sub}>{weekDeals.length ? t('trip_flyer_have', { n: weekDeals.length }) : t('trip_flyer_sub')}</Text>
        </>
      )}

      {shared.length > 0 && !weekDeals.length ? (
        <View style={styles.sharedBox}>
          <Text style={styles.sharedText}>
            {t('trip_flyer_shared', { stores: shared.map((k) => k.store).join(', '), n: shared.reduce((a, k) => a + (k.itemCount || k.items.length), 0), when: whenText(shared[0].scannedAt) })}
          </Text>
          <TouchableOpacity style={styles.primary} activeOpacity={0.88} onPress={useShared}>
            <Text style={styles.primaryText}>{t('trip_flyer_use')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {busy ? (
        <View style={styles.busyBox}>
          <ActivityIndicator size="large" color={colors.orange} />
          <Text style={styles.busyTitle}>{t('trip_flyer_scanning_title')}</Text>
          <Text style={styles.busyTime}>{`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}</Text>
          <Text style={styles.busyHint}>{t('trip_flyer_scanning_hint')}</Text>
        </View>
      ) : (
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.ghost} activeOpacity={0.88} onPress={() => scan(true)}>
            <Text style={styles.ghostText}>{t('trip_flyer_camera')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghost} activeOpacity={0.88} onPress={() => scan(false)}>
            <Text style={styles.ghostText}>{t('trip_flyer_library')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {lastHere ? (
        <View style={styles.readBox}>
          <Text style={styles.readText}>{t('trip_flyer_read', { n: lastHere.count, store: lastHere.store || t('trip_flyer_unknown_store') })}{lastHere.validDates ? ` · ${lastHere.validDates}` : ''}</Text>
          {typeof lastHere.added === 'number' ? (
            <Text style={styles.addedText}>{lastHere.added > 0 ? `✓ ${t('trip_flyer_added', { added: lastHere.added, total: lastHere.total })}` : t('trip_flyer_added_none')}</Text>
          ) : null}
          <TouchableOpacity onPress={retake} activeOpacity={0.8}>
            <Text style={styles.retake}>{t('trip_flyer_wrong')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.lg || 16, padding: 16, marginBottom: 14 },
  embedded: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0E3D2' },
  moreTitle: { fontSize: 14, fontWeight: '800', color: '#2D1B10' },
  title: { fontSize: 16, fontWeight: '800', color: '#2D1B10' },
  sub: { fontSize: 13, color: '#7a6d60', marginTop: 3 },
  sharedBox: { backgroundColor: '#E6F1EA', borderRadius: 12, padding: 12, marginTop: 10, gap: 8 },
  sharedText: { fontSize: 13, color: '#1d4d34', lineHeight: 18 },
  primary: { backgroundColor: colors.orange, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  ghost: { flex: 1, borderWidth: 1, borderColor: colors.orange, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  ghostText: { color: colors.orange, fontWeight: '700', fontSize: 14 },
  busyBox: { alignItems: 'center', gap: 6, marginTop: 12, paddingVertical: 18, paddingHorizontal: 14, borderRadius: 14, borderWidth: 2, borderColor: colors.orange, backgroundColor: '#FFF4E8' },
  busyTitle: { fontSize: 17, fontWeight: '800', color: '#2D1B10', textAlign: 'center' },
  busyTime: { fontSize: 22, fontWeight: '800', color: colors.orange },
  busyHint: { fontSize: 13, color: '#7a6d60', textAlign: 'center', lineHeight: 18 },
  readBox: { marginTop: 10, gap: 4 },
  readText: { fontSize: 13, color: '#2D1B10', fontWeight: '600' },
  addedText: { fontSize: 14, color: '#1d7a46', fontWeight: '800' },
  retake: { fontSize: 13, color: colors.orange, fontWeight: '700' },
});
