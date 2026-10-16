import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

// A digital coupon (no barcode, no code, no link) only takes money off if the shopper
// first loads it to their own store account. Fern cannot do that for them, and adding
// it to Fern's wallet does not put it on a store card, so spell the steps out.
export function isDigitalCoupon(c) {
  return Boolean(c) && c.redemption !== 'code' && c.redemption !== 'link';
}

export function isWalmartCoupon(c) {
  return isDigitalCoupon(c) && /walmart/i.test(String(c.store || ''));
}

export default function DigitalCouponHowTo({ coupon, t }) {
  if (!isDigitalCoupon(coupon)) return null;
  if (isWalmartCoupon(coupon)) {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>{`⚠️ ${t('coupon_howto_walmart_title')}`}</Text>
        <Text style={styles.step}>{t('coupon_howto_walmart_body')}</Text>
      </View>
    );
  }
  const store = coupon.store ? coupon.store : t('coupon_howto_your_store');
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{`⚠️ ${t('coupon_howto_title')}`}</Text>
      <Text style={styles.step}>{`1. ${t('coupon_howto_step1', { store })}`}</Text>
      <Text style={styles.step}>{`2. ${t('coupon_howto_step2')}`}</Text>
      <Text style={styles.step}>{`3. ${t('coupon_howto_step3')}`}</Text>
      <Text style={styles.note}>{t('coupon_howto_note')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#FFF1DC', borderColor: '#E8B877', borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12 },
  title: { color: '#8A3F0C', fontSize: 15, fontFamily: 'Jost-Bold', marginBottom: 6 },
  step: { color: '#2B1E13', fontSize: 14, lineHeight: 20, fontFamily: 'Jost-Regular', marginTop: 3 },
  note: { color: '#7A5C3A', fontSize: 12, lineHeight: 17, fontFamily: 'Jost-Regular', marginTop: 8 },
});
