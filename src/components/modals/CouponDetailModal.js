import React, { useMemo } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../constants/tokens';
import useLanguage from '../../hooks/useLanguage';
import { code128Widths } from '../../utils/code128';
import DigitalCouponHowTo from '../trip/DigitalCouponHowTo';

export default function CouponDetailModal({ visible, coupon, isInWallet, onClose, onToggleWallet }) {
    const { t, locale } = useLanguage();

    // The catalog's expiry is a raw ISO timestamp; show it as a readable date.
    const expiryDate = coupon?.expiresAt ? new Date(coupon.expiresAt) : null;
    const expiryText = expiryDate && !Number.isNaN(expiryDate.getTime())
        ? expiryDate.toLocaleDateString(locale === 'es' ? 'es' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : coupon?.expiresAt;

    // Only a coupon that is really redeemed by a typed/scanned code gets a barcode. The
    // catalog's other codes are offer IDs, not register barcodes, so none is drawn for them.
    const barWidths = useMemo(
        () => (coupon?.redemption === 'code' && coupon?.realCode ? code128Widths(coupon.realCode) : null),
        [coupon?.redemption, coupon?.realCode]
    );

    if (!coupon) return null;

    return (
        <Modal
            transparent
            animationType="slide"
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.topBar}>
                        <View style={styles.headerTextWrap}>
                            <Text style={styles.title}>{coupon.title}</Text>
                            {coupon.store ? <Text style={styles.subtitle}>{coupon.store}</Text> : null}
                        </View>
                        <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
                            <Text style={styles.closeText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {coupon.image ? (
                            <Image source={{ uri: coupon.image }} style={styles.image} resizeMode="cover" />
                        ) : null}

                        {coupon.discountLabel ? (
                            <View style={styles.discountBar}>
                                <Text style={styles.discountText}>{coupon.discountLabel}</Text>
                            </View>
                        ) : null}

                        {coupon.category ? <Text style={styles.category}>{coupon.category}</Text> : null}
                        {coupon.description ? <Text style={styles.description}>{coupon.description}</Text> : null}

                        {barWidths ? (<View style={styles.barcodeBox}>
                            <View style={styles.barcodeRow}>
                                {barWidths.map((w, i) => (
                                    <View
                                        key={i}
                                        style={{ width: w, height: '100%', backgroundColor: i % 2 === 0 ? '#111111' : '#FFFFFF' }}
                                    />
                                ))}
                            </View>
                        </View>) : null}

                        <DigitalCouponHowTo coupon={coupon} t={t} />

                        {coupon.expiresAt ? (
                            <Text style={styles.expiry}>{t('coupon_detail_expires_label', { date: expiryText })}</Text>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.actionBtn, isInWallet ? styles.removeBtn : null]}
                            activeOpacity={0.85}
                            onPress={() => onToggleWallet(coupon)}
                        >
                            <Text style={[styles.actionBtnText, isInWallet ? styles.removeBtnText : null]}>
                                {isInWallet ? t('coupon_detail_remove_btn') : t('coupon_detail_add_btn')}
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.28)',
        justifyContent: 'flex-end',
    },
    sheet: {
        height: '88%',
        backgroundColor: '#FBF8F2',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        overflow: 'hidden',
    },
    topBar: {
        minHeight: 76,
        paddingHorizontal: 18,
        paddingTop: 14,
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: '#E0D4C4',
        gap: 12,
    },
    headerTextWrap: {
        flex: 1,
    },
    title: {
        color: '#2A1A11',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 17,
        lineHeight: 22,
    },
    subtitle: {
        marginTop: 4,
        color: '#8C6B46',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#D6C8B4',
        backgroundColor: '#F2ECE3',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeText: {
        color: '#8C6B46',
        fontFamily: 'Jost-Bold',
        fontSize: 22,
        lineHeight: 28,
    },
    scrollContent: {
        paddingHorizontal: 18,
        paddingTop: 20,
        paddingBottom: 30,
        alignItems: 'center',
    },
    image: {
        width: 220,
        height: 220,
        borderRadius: 16,
        marginBottom: 18,
    },
    discountBar: {
        width: '100%',
        borderRadius: 12,
        backgroundColor: '#7A3A1D',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    discountText: {
        color: '#FBF1E6',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 18,
    },
    category: {
        marginTop: 14,
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },
    description: {
        marginTop: 8,
        color: '#4A3D2E',
        fontFamily: 'Jost-Regular',
        fontSize: 12,
        lineHeight: 18,
        textAlign: 'center',
    },
    barcodeBox: {
        marginTop: 24,
        width: '100%',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        paddingHorizontal: 16,
    },
    barcodeRow: {
        flexDirection: 'row',
        height: 70,
        width: '100%',
        justifyContent: 'center',
    },
    expiry: {
        marginTop: 16,
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },
    actionBtn: {
        marginTop: 22,
        width: '100%',
        borderRadius: 14,
        backgroundColor: colors.forest,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    actionBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    removeBtn: {
        backgroundColor: '#FBF8F2',
        borderWidth: 1,
        borderColor: '#B3261E',
    },
    removeBtnText: {
        color: '#B3261E',
    },
});
