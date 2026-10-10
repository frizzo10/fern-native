import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { colors, radius, shadow } from '../../constants/tokens';
import { FEATURE_TIERS } from '../../constants/featureAccess';
import useLanguage from '../../hooks/useLanguage';
import useEntitlement from '../../hooks/useEntitlement';
import { fetchInsiderDeals } from '../../services/insiderDealsService';
import UpgradeGateModal from '../UpgradeGateModal';

// Only ever hand http(s) links to the OS — a deal row comes from the backend's
// brand_deals table, so don't trust it to be a safe URL.
function isWebUrl(value) {
    return /^https?:\/\//i.test(String(value || ''));
}

function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

// Pro "Insider Deals" — brand-partnership offers from the backend's
// brand_deals table. Mirrors the web app's overlay (openInsiderDeals).
export default function InsiderDealsModal({ visible, onClose, user }) {
    const { t } = useLanguage();
    const { hasAccess } = useEntitlement();
    const allowed = hasAccess(FEATURE_TIERS.insider_deals);
    const token = user?.token;

    const [status, setStatus] = useState('loading'); // loading | ready | proOnly | error
    const [deals, setDeals] = useState([]);

    const load = useCallback(async () => {
        setStatus('loading');
        try {
            const result = await fetchInsiderDeals({ token });
            if (result.proOnly) {
                setDeals([]);
                setStatus('proOnly');
                return;
            }
            setDeals(result.deals);
            setStatus('ready');
        } catch (e) {
            console.log('[insider-deals] load failed', e?.message || e);
            setStatus('error');
        }
    }, [token]);

    useEffect(() => {
        if (visible && allowed) load();
    }, [visible, allowed, load]);

    if (visible && !allowed) {
        return <UpgradeGateModal visible={visible} onClose={onClose} tier={FEATURE_TIERS.insider_deals} />;
    }

    return (
        <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.topBar}>
                        <Text style={styles.title}>{`💎 ${t('insider_deals_title')}`}</Text>
                        <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
                            <Text style={styles.closeText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                        {status === 'loading' ? (
                            <View style={styles.centerBlock}>
                                <ActivityIndicator size="large" color={colors.forest} />
                                <Text style={styles.mutedText}>{t('insider_deals_loading')}</Text>
                            </View>
                        ) : null}

                        {status === 'error' ? (
                            <View style={styles.centerBlock}>
                                <Text style={styles.heroEmoji}>⚠️</Text>
                                <Text style={styles.mutedText}>{t('insider_deals_load_error')}</Text>
                                <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={load}>
                                    <Text style={styles.primaryBtnText}>{t('insider_deals_retry_btn')}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        {status === 'proOnly' ? (
                            <View style={styles.centerBlock}>
                                <Text style={styles.heroEmoji}>💎</Text>
                                <Text style={styles.emptyTitle}>{t('insider_deals_pro_only_title')}</Text>
                                <Text style={styles.mutedText}>{t('insider_deals_pro_only_desc')}</Text>
                                <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={load}>
                                    <Text style={styles.primaryBtnText}>{t('insider_deals_retry_btn')}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        {status === 'ready' && !deals.length ? (
                            <View style={styles.centerBlock}>
                                <Text style={styles.heroEmoji}>🌱</Text>
                                <Text style={styles.emptyTitle}>{t('insider_deals_empty_title')}</Text>
                                <Text style={styles.mutedText}>{t('insider_deals_empty_desc')}</Text>
                                <View style={styles.notifyNote}>
                                    <Text style={styles.notifyNoteText}>{`💌 ${t('insider_deals_empty_notify')}`}</Text>
                                </View>
                            </View>
                        ) : null}

                        {status === 'ready' ? deals.map((deal) => (
                            <View key={deal.id} style={[styles.dealCard, shadow.card, deal.featured ? styles.dealCardFeatured : null]}>
                                {deal.featured ? (
                                    <Text style={styles.featuredLabel}>{`⭐ ${t('insider_deals_featured')}`}</Text>
                                ) : null}
                                {isWebUrl(deal.imageUrl) ? (
                                    <Image source={{ uri: deal.imageUrl }} style={styles.dealImage} resizeMode="cover" />
                                ) : null}
                                {deal.brand ? <Text style={styles.dealBrand}>{deal.brand.toUpperCase()}</Text> : null}
                                <Text style={styles.dealTitle}>{deal.title}</Text>
                                {deal.description ? <Text style={styles.dealDescription}>{deal.description}</Text> : null}
                                {deal.dealCode ? (
                                    <View style={styles.codeRow}>
                                        <Text style={styles.codeLabel}>{t('insider_deals_code_label')}</Text>
                                        <Text style={styles.codeText} selectable>{deal.dealCode}</Text>
                                    </View>
                                ) : null}
                                {deal.validUntil && formatDate(deal.validUntil) ? (
                                    <Text style={styles.validText}>
                                        {`${t('insider_deals_valid_through')} ${formatDate(deal.validUntil)}`}
                                    </Text>
                                ) : null}
                                {isWebUrl(deal.dealUrl) ? (
                                    <TouchableOpacity
                                        style={styles.primaryBtn}
                                        activeOpacity={0.85}
                                        onPress={() => Linking.openURL(deal.dealUrl).catch(() => {})}
                                    >
                                        <Text style={styles.primaryBtnText}>{t('insider_deals_get_deal_btn')}</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        )) : null}
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
        backgroundColor: '#F5F2ED',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 16,
        height: '82%',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    title: {
        flex: 1,
        fontFamily: 'serif',
        fontSize: 22,
        fontWeight: '700',
        color: colors.forest,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#D8D8D8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeText: {
        fontSize: 24,
        lineHeight: 26,
        color: '#F4F4F4',
    },
    content: {
        paddingBottom: 24,
    },
    centerBlock: {
        alignItems: 'center',
        paddingVertical: 36,
        paddingHorizontal: 12,
        gap: 10,
    },
    heroEmoji: {
        fontSize: 46,
    },
    emptyTitle: {
        fontFamily: 'serif',
        fontSize: 20,
        fontWeight: '700',
        color: colors.ink,
        textAlign: 'center',
    },
    mutedText: {
        fontSize: 14,
        lineHeight: 21,
        color: colors.brown,
        textAlign: 'center',
    },
    notifyNote: {
        marginTop: 10,
        backgroundColor: 'rgba(28,58,26,0.07)',
        borderRadius: radius.sm,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    notifyNoteText: {
        fontSize: 13,
        fontStyle: 'italic',
        color: colors.brown,
        textAlign: 'center',
    },
    dealCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        marginBottom: 12,
    },
    dealCardFeatured: {
        borderColor: '#D4A820',
    },
    featuredLabel: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.2,
        color: '#B8860B',
        marginBottom: 6,
    },
    dealImage: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: radius.sm,
        marginBottom: 10,
        backgroundColor: colors.paper,
    },
    dealBrand: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.2,
        color: colors.brown,
        marginBottom: 2,
    },
    dealTitle: {
        fontFamily: 'serif',
        fontSize: 18,
        fontWeight: '700',
        color: colors.ink,
        marginBottom: 6,
    },
    dealDescription: {
        fontSize: 14,
        lineHeight: 20,
        color: colors.ink,
        marginBottom: 8,
    },
    codeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.bright,
        backgroundColor: 'rgba(28,58,26,0.06)',
        borderRadius: radius.sm,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginBottom: 8,
    },
    codeLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        color: colors.brown,
    },
    codeText: {
        fontFamily: 'Courier',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1.5,
        color: colors.forest,
    },
    validText: {
        fontSize: 12,
        fontStyle: 'italic',
        color: colors.brown,
        marginBottom: 6,
    },
    primaryBtn: {
        backgroundColor: colors.forest,
        borderRadius: radius.md,
        paddingVertical: 12,
        paddingHorizontal: 18,
        alignItems: 'center',
        marginTop: 6,
    },
    primaryBtnText: {
        color: colors.sage,
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.6,
    },
});
