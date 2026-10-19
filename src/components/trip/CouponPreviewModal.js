import React, { useEffect } from 'react';
import { Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DigitalCouponHowTo from './DigitalCouponHowTo';
import { trackEvent, couponMeta } from '../../services/track';

// Full details of one coupon, shown before the shopper accepts it (adds it to the wallet / list).
//   preview   { coupon, itemText?, level? } — a match from ShoppingScreen's coupon cards
//   done      already accepted (button shows the done label and is disabled)
//   confirmLabel / doneLabel  the accept button text
export default function CouponPreviewModal({ preview, onClose, onConfirm, confirmLabel, doneLabel, done, t, locale }) {
  const c = preview?.coupon;
  useEffect(() => { if (c?.id) trackEvent('coupon_view', c.id, couponMeta(c)); }, [c?.id]);
  if (!c) return null;
  const expiry = c.expiresAt ? new Date(c.expiresAt) : null;
  const expiryText = expiry && !Number.isNaN(expiry.getTime())
    ? expiry.toLocaleDateString(locale === 'es' ? 'es' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={{ paddingBottom: 6 }}>
            {c.image ? <Image source={{ uri: c.image }} style={styles.img} resizeMode="contain" /> : null}
            {c.discountLabel ? <Text style={styles.value}>{c.discountLabel}</Text> : null}
            <Text style={styles.title}>{c.title}</Text>
            {c.store ? <Text style={styles.meta}>{c.store}</Text> : null}
            {preview.itemText ? <Text style={styles.forItem}>{t('sav_for_item', { item: preview.itemText })}</Text> : null}
            {preview.level === 'possible' ? <Text style={styles.possible}>{t('sav_possible')}</Text> : null}
            {c.description ? <Text style={styles.desc}>{c.description}</Text> : null}
            {expiryText ? <Text style={styles.meta}>{t('sav_prev_expires', { date: expiryText })}</Text> : null}
            {c.redemption === 'code' && c.realCode ? <Text style={styles.code}>{t('sav_use_code', { code: c.realCode })}</Text> : null}
            {c.redemption === 'link' && c.url ? (
              <TouchableOpacity onPress={() => Linking.openURL(c.url)} activeOpacity={0.8}>
                <Text style={styles.link}>{t('sav_open_link')}</Text>
              </TouchableOpacity>
            ) : null}
            <DigitalCouponHowTo coupon={c} t={t} />
          </ScrollView>
          <TouchableOpacity style={[styles.btn, done ? styles.btnOn : null]} disabled={done} activeOpacity={0.88} onPress={onConfirm}>
            <Text style={[styles.btnText, done ? styles.btnTextOn : null]}>{done ? doneLabel : confirmLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} activeOpacity={0.8} onPress={onClose}>
            <Text style={styles.closeText}>{t('sav_prev_close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF8EC', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '85%' },
  img: { width: '100%', height: 150, marginBottom: 10 },
  value: { color: '#C25A12', fontSize: 26, fontFamily: 'Jost-Bold' },
  title: { color: '#2B1E13', fontSize: 18, lineHeight: 24, fontFamily: 'Jost-Bold', marginTop: 2 },
  meta: { color: '#7A5C3A', fontSize: 13, lineHeight: 18, fontFamily: 'Jost-Regular', marginTop: 4 },
  forItem: { color: '#2A6A2A', fontSize: 13, fontFamily: 'Jost-SemiBold', marginTop: 6 },
  possible: { color: '#C25A12', fontSize: 12, fontFamily: 'Jost-Bold', marginTop: 3 },
  desc: { color: '#2B1E13', fontSize: 14, lineHeight: 20, fontFamily: 'Jost-Regular', marginTop: 10 },
  code: { color: '#2B1E13', fontSize: 15, fontFamily: 'Jost-Bold', marginTop: 8, letterSpacing: 1 },
  link: { color: '#2A6A2A', fontSize: 14, fontFamily: 'Jost-Bold', marginTop: 8, textDecorationLine: 'underline' },
  btn: { borderWidth: 1.5, borderColor: '#2A6A2A', backgroundColor: '#2A6A2A', borderRadius: 24, paddingVertical: 13, alignItems: 'center', marginTop: 14 },
  btnOn: { backgroundColor: 'transparent' },
  btnText: { color: '#F7F5F0', fontSize: 15, fontFamily: 'Jost-Bold' },
  btnTextOn: { color: '#2A6A2A' },
  closeBtn: { alignItems: 'center', paddingVertical: 12 },
  closeText: { color: '#7A5C3A', fontSize: 14, fontFamily: 'Jost-SemiBold' },
});
