import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadow } from '../constants/tokens';
import { TIERS } from '../constants/tiers';
import useLanguage from '../hooks/useLanguage';
import { usePlansModal } from '../services/PlansModalContext';
import { useRevenueCat } from '../services/RevenueCatContext';
import { PAYWALL_RESULT } from '../services/purchasesService';
import { stopFernAudio } from '../utils/fernAudioBus';

// Shown in place of a feature's real modal when the current plan doesn't meet the
// tier that feature requires. Drop this in wherever a modal needs gating:
//
//   const { hasAccess } = useEntitlement();
//   if (visible && !hasAccess(REQUIRED_TIER)) {
//     return <UpgradeGateModal visible={visible} onClose={onClose} tier={REQUIRED_TIER} />;
//   }
export default function UpgradeGateModal({ visible, onClose, tier }) {
  const { t } = useLanguage();
  const { open: openPlans } = usePlansModal();
  const { presentPaywall, restore } = useRevenueCat();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const badgeLabel = tier === TIERS.PRO_MAX ? t('pro_max') : t('pro');
  const descKey = tier === TIERS.PRO_MAX ? 'upgrade_required_desc_pro_max' : 'upgrade_required_desc_pro';

  // A Fern voice reply can still be mid-playback (or queued) when this gate
  // pops up over it — cut it off so the upgrade prompt isn't talked over.
  useEffect(() => {
    if (visible) stopFernAudio();
  }, [visible]);

  const handleUpgrade = async () => {
    setPurchasing(true);
    try {
      const result = await presentPaywall();
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        onClose();
      }
    } catch (err) {
      Alert.alert(t('purchase_error_title'), t('purchase_error_desc'));
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const info = await restore();
      const hasEntitlement = Object.keys(info?.entitlements?.active || {}).length > 0;
      if (hasEntitlement) {
        Alert.alert(t('restore_success_title'), t('restore_success_desc'));
        onClose();
      } else {
        Alert.alert(t('restore_none_found_title'), t('restore_none_found_desc'));
      }
    } catch (err) {
      Alert.alert(t('restore_error_title'), t('restore_error_desc'));
    } finally {
      setRestoring(false);
    }
  };

  const handleSeePlans = () => {
    onClose();
    openPlans();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, shadow.strong]}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
          <Text style={styles.title}>{t('upgrade_required_title')}</Text>
          <Text style={styles.desc}>{t(descKey)}</Text>

          <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.9} onPress={handleUpgrade} disabled={purchasing}>
            {purchasing ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaBtnText}>{t('upgrade_required_cta')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} activeOpacity={0.8} onPress={handleSeePlans}>
            <Text style={styles.linkBtnText}>{t('upgrade_required_see_plans')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} activeOpacity={0.8} onPress={handleRestore} disabled={restoring}>
            {restoring ? <ActivityIndicator color={colors.onFern} /> : <Text style={styles.linkBtnText}>{t('upgrade_required_restore')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} activeOpacity={0.8} onPress={onClose}>
            <Text style={styles.closeBtnText}>{t('upgrade_required_close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,22,10,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    backgroundColor: colors.forest,
    borderRadius: radius.xl,
    padding: 24,
    alignItems: 'center',
  },
  badge: {
    backgroundColor: 'rgba(232,101,26,0.18)',
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  badgeText: { color: colors.orange, fontWeight: '800', fontSize: 12, letterSpacing: 0.6 },
  title: { color: '#fff', fontWeight: '800', fontSize: 20, textAlign: 'center', marginBottom: 10 },
  desc: { color: colors.onFern, fontSize: 15, lineHeight: 21, textAlign: 'center', marginBottom: 22 },
  ctaBtn: {
    backgroundColor: colors.orange,
    borderRadius: radius.full,
    paddingVertical: 15,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  ctaBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  linkBtn: { paddingVertical: 8 },
  linkBtnText: { color: colors.onFern, fontWeight: '700', fontSize: 13, textDecorationLine: 'underline' },
  closeBtn: { paddingVertical: 8 },
  closeBtnText: { color: 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: 13 },
});
