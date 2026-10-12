import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadow } from '../../constants/tokens';
import { scanCircular } from '../../services/scanCircularService';
import { discardLatestScan, fetchStoreDeals } from '../../services/storeDealsService';
import { pickPhotoFromCamera, pickPhotoFromLibrary } from '../../services/photoPickerService';
import { zipsByStoreName } from '../../utils/storeZip';
import { loadWeekDeals, replaceWeekDeals, saveWeekDeals } from '../../utils/savings';

// Step 2 of the shopping trip: get this week's flyer into the app. Either reuse the ad other
// Fern shoppers already scanned for the user's saved stores, or scan a photo of the paper/online flyer.
// Whatever is read is remembered for the week (fern_week_deals) and shown in "This week's sales".
export default function FlyerSection({ user, stores, t, weekDeals, onDealsChanged, onScanned }) {
  const [shared, setShared] = useState([]); // [{ store, scannedAt, itemCount, items }]
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null); // { store, validDates, count, before }
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
    const picked = fromCamera ? await pickPhotoFromCamera() : await pickPhotoFromLibrary();
    if (picked.permissionDenied) {
      Alert.alert(t('permission_needed_title'), t('photo_permission_denied_desc'));
      return;
    }
    if (!picked.photo?.base64) return;
    setBusy(true);
    const before = await loadWeekDeals();
    try {
      const result = await scanCircular({ userId: user?.id, base64: picked.photo.base64, mimeType: picked.photo.mimeType, token: user?.token });
      const items = (result.items || []).filter((i) => i.name);
      if (!items.length) {
        Alert.alert(t('trip_flyer_none'));
        return;
      }
      setLast({ store: String(result.store || '').trim(), validDates: String(result.validDates || '').trim(), count: items.length, before });
      setShared([]);
      await onDealsChanged?.();
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
    <View style={[styles.card, shadow.card]}>
      <Text style={styles.title}>{`📰 ${t('trip_flyer_title')}`}</Text>
      <Text style={styles.sub}>{weekDeals.length ? t('trip_flyer_have', { n: weekDeals.length }) : t('trip_flyer_sub')}</Text>

      {shared.length && !weekDeals.length ? (
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
        <View style={styles.busy}>
          <ActivityIndicator color={colors.orange} />
          <Text style={styles.sub}>{t('trip_flyer_scanning')}</Text>
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

      {last ? (
        <View style={styles.readBox}>
          <Text style={styles.readText}>{t('trip_flyer_read', { n: last.count, store: last.store || t('trip_flyer_unknown_store') })}{last.validDates ? ` · ${last.validDates}` : ''}</Text>
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
  title: { fontSize: 16, fontWeight: '800', color: '#2D1B10' },
  sub: { fontSize: 13, color: '#7a6d60', marginTop: 3 },
  sharedBox: { backgroundColor: '#E6F1EA', borderRadius: 12, padding: 12, marginTop: 10, gap: 8 },
  sharedText: { fontSize: 13, color: '#1d4d34', lineHeight: 18 },
  primary: { backgroundColor: colors.orange, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  ghost: { flex: 1, borderWidth: 1, borderColor: colors.orange, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  ghostText: { color: colors.orange, fontWeight: '700', fontSize: 14 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  readBox: { marginTop: 10, gap: 4 },
  readText: { fontSize: 13, color: '#2D1B10', fontWeight: '600' },
  retake: { fontSize: 13, color: colors.orange, fontWeight: '700' },
});
