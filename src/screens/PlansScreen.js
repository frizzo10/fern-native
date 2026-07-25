import React from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadow } from '../constants/tokens';
import useLanguage from '../hooks/useLanguage';
import useEntitlement from '../hooks/useEntitlement';
import { TIERS } from '../constants/tiers';
import { TOUR_LIST } from '../constants/tourContent';
import { useTour } from '../services/TourContext';

const ICON_PALETTE = ['#1C3A1A', '#2D5A27', '#E8651A'];
const ICON_OVERRIDES = { alexa_skill: '#16324F' };

function iconColorFor(key, index) {
    return ICON_OVERRIDES[key] || ICON_PALETTE[index % ICON_PALETTE.length];
}

const PRO_FEATURES = TOUR_LIST.filter((item) => item.tier === TIERS.PRO && item.planDescKey);
const PRO_MAX_FEATURES = TOUR_LIST.filter((item) => item.tier === TIERS.PRO_MAX && item.planDescKey);

export default function PlansScreen({ visible, onClose, onAfterStartTour }) {
    const { t } = useLanguage();
    const { tier, hasAccess } = useEntitlement();
    const { startTour } = useTour();

    const bannerEyebrowKey = tier === TIERS.PRO_MAX
        ? 'plans_banner_pro_max_eyebrow'
        : tier === TIERS.PRO
            ? 'plans_banner_pro_eyebrow'
            : 'plans_banner_free_eyebrow';
    const bannerTitleKey = tier === TIERS.PRO_MAX
        ? 'plans_banner_pro_max_title'
        : tier === TIERS.PRO
            ? 'plans_banner_pro_title'
            : 'plans_banner_free_title';
    const bannerSubtitleKey = tier === TIERS.PRO_MAX
        ? 'plans_banner_pro_max_subtitle'
        : tier === TIERS.PRO
            ? 'plans_banner_pro_subtitle'
            : 'plans_banner_free_subtitle';

    const handleStart = (item) => {
        if (!hasAccess(item.tier)) {
            Alert.alert(t('plans_locked_alert_title'), t('plans_locked_alert_desc'));
            return;
        }
        onClose();
        startTour(item.key);
        onAfterStartTour?.();
    };

    const renderSection = (features, sectionTier) => (
        <>
            <View style={styles.tierRow}>
                <View style={[styles.tierPill, sectionTier === TIERS.PRO_MAX ? styles.tierPillOrange : styles.tierPillGreen]}>
                    <Text style={[styles.tierPillText, sectionTier === TIERS.PRO_MAX ? styles.tierPillTextOrange : styles.tierPillTextGreen]}>
                        {sectionTier === TIERS.PRO_MAX ? '✦✦ PRO MAX' : '✦ PRO'}
                    </Text>
                </View>
                <Text style={styles.tierPrice}>{t(sectionTier === TIERS.PRO_MAX ? 'plans_pro_max_price' : 'plans_pro_price')}</Text>
            </View>

            {features.map((item, index) => (
                <TouchableOpacity
                    key={item.key}
                    style={styles.card}
                    activeOpacity={0.85}
                    onPress={() => handleStart(item)}
                >
                    <View style={[styles.cardIcon, { backgroundColor: iconColorFor(item.key, index) }]}>
                        <Text style={styles.cardIconEmoji}>{item.icon}</Text>
                    </View>
                    <View style={styles.cardTextWrap}>
                        <Text style={styles.cardTitle}>{t(item.labelKey)}</Text>
                        <Text style={styles.cardDesc}>{t(item.planDescKey)}</Text>
                    </View>
                    <Text style={[styles.cardStart, sectionTier === TIERS.PRO_MAX ? styles.cardStartOrange : styles.cardStartGreen]}>
                        {t('account_tour_start')} →
                    </Text>
                </TouchableOpacity>
            ))}
        </>
    );

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.screen}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    <View style={[styles.banner, shadow.strong]}>
                        <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
                            <Text style={styles.closeText}>×</Text>
                        </TouchableOpacity>
                        <Text style={styles.bannerEyebrow}>{t(bannerEyebrowKey)}</Text>
                        <Text style={styles.bannerTitle}>{t(bannerTitleKey)}</Text>
                        <Text style={styles.bannerSubtitle}>{t(bannerSubtitleKey)}</Text>
                    </View>

                    <View style={styles.body}>
                        {renderSection(PRO_FEATURES, TIERS.PRO)}
                        {renderSection(PRO_MAX_FEATURES, TIERS.PRO_MAX)}
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.parch,
    },
    scrollContent: {
        paddingBottom: 40,
    },

    banner: {
        backgroundColor: colors.forest,
        paddingTop: 64,
        paddingBottom: 28,
        paddingHorizontal: 24,
        borderBottomLeftRadius: radius.xl,
        borderBottomRightRadius: radius.xl,
        position: 'relative',
    },
    closeBtn: {
        position: 'absolute',
        top: 56,
        right: 20,
        width: 36,
        height: 36,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    closeText: {
        fontSize: 22,
        color: '#fff',
        lineHeight: 24,
        marginTop: -2,
    },
    bannerEyebrow: {
        color: colors.orange,
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 1.5,
        marginBottom: 10,
    },
    bannerTitle: {
        color: '#fff',
        fontFamily: 'Jost-Bold',
        fontSize: 26,
        lineHeight: 32,
        marginBottom: 8,
        paddingRight: 40,
    },
    bannerSubtitle: {
        color: colors.onFern,
        fontFamily: 'Jost-Regular',
        fontSize: 14,
        lineHeight: 20,
        opacity: 0.85,
    },

    body: {
        paddingHorizontal: 16,
        paddingTop: 20,
    },

    tierRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
        marginTop: 6,
    },
    tierPill: {
        borderRadius: radius.full,
        borderWidth: 1.5,
        paddingHorizontal: 12,
        paddingVertical: 5,
    },
    tierPillGreen: {
        backgroundColor: '#EEF6EA',
        borderColor: colors.bright,
    },
    tierPillOrange: {
        backgroundColor: 'rgba(232,101,26,0.10)',
        borderColor: colors.orange,
    },
    tierPillText: {
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 0.6,
    },
    tierPillTextGreen: { color: colors.bright },
    tierPillTextOrange: { color: colors.orange },
    tierPrice: {
        color: colors.brown,
        fontFamily: 'Jost-SemiBold',
        fontSize: 13,
    },

    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.paper,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: '#EEE3D1',
        padding: 12,
        marginBottom: 10,
    },
    cardIcon: {
        width: 48,
        height: 48,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    cardIconEmoji: { fontSize: 22 },
    cardTextWrap: { flex: 1, paddingRight: 10 },
    cardTitle: {
        color: '#2F2015',
        fontFamily: 'Jost-Bold',
        fontSize: 15,
        lineHeight: 19,
        marginBottom: 3,
    },
    cardDesc: {
        color: colors.brown,
        fontFamily: 'Jost-Regular',
        fontSize: 12,
        lineHeight: 17,
    },
    cardStart: {
        fontFamily: 'Jost-Bold',
        fontSize: 13,
        alignSelf: 'center',
    },
    cardStartGreen: { color: '#2F2015' },
    cardStartOrange: { color: colors.orange },
});
