import React, { useMemo } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../constants/tokens';
import useLanguage from '../../hooks/useLanguage';

// No barcode-rendering library in this app — this draws a deterministic
// bar pattern from the coupon code so it reads as "a barcode" without
// pulling in a native dependency for what is, functionally, a static prop.
function generateBarcodeWidths(seed) {
    const str = String(seed || 'coupon');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }

    const widths = [];
    for (let i = 0; i < 50; i++) {
        hash = (hash * 1103515245 + 12345) >>> 0;
        widths.push(2 + (hash % 5));
    }
    return widths;
}

export default function CouponDetailModal({ visible, coupon, isInWallet, onClose, onToggleWallet }) {
    const { t } = useLanguage();

    const barWidths = useMemo(() => generateBarcodeWidths(coupon?.code || coupon?.id), [coupon?.code, coupon?.id]);

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

                        <View style={styles.barcodeBox}>
                            <View style={styles.barcodeRow}>
                                {barWidths.map((w, i) => (
                                    <View
                                        key={i}
                                        style={{ width: w, height: '100%', backgroundColor: i % 2 === 0 ? '#111111' : '#FFFFFF' }}
                                    />
                                ))}
                            </View>
                        </View>

                        {coupon.expiresAt ? (
                            <Text style={styles.expiry}>{t('coupon_detail_expires_label', { date: coupon.expiresAt })}</Text>
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
