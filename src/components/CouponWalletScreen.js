import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import useLanguage from '../hooks/useLanguage';
import { groupCouponsByCategory, groupCouponsByStore } from '../utils/couponNormalize';

// Client-side pagination for now — available_coupons has no page/cursor param
// yet. Once a real coupons endpoint exists, swap this for a "fetch next page"
// call keyed off the same PAGE_SIZE instead of slicing the already-fetched array.
const PAGE_SIZE = 10;

const PAGE_WINDOW_SIZE = 7;

// A sliding window of page numbers centered on the current page, instead of
// listing every page — so page 7 of 19 shows ~4-10, not all 19 at once.
function getPageWindow(page, totalPages, windowSize = PAGE_WINDOW_SIZE) {
    if (totalPages <= windowSize) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = start + windowSize - 1;
    if (end > totalPages) {
        end = totalPages;
        start = end - windowSize + 1;
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function PageNumbers({ page, totalPages, onChangePage }) {
    if (totalPages <= 1) return null;

    const pages = getPageWindow(page, totalPages);

    return (
        <View style={styles.pageNumberRow}>
            <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.pageArrowBtn, page === 1 ? styles.pageArrowBtnDisabled : null]}
                disabled={page === 1}
                onPress={() => onChangePage(page - 1)}
            >
                <Text style={styles.pageArrowText}>‹</Text>
            </TouchableOpacity>

            {pages.map((p) => (
                <TouchableOpacity
                    key={p}
                    activeOpacity={0.85}
                    style={[styles.pageNumberBtn, p === page ? styles.pageNumberBtnActive : null]}
                    onPress={() => onChangePage(p)}
                >
                    <Text style={[styles.pageNumberText, p === page ? styles.pageNumberTextActive : null]}>{p}</Text>
                </TouchableOpacity>
            ))}

            <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.pageArrowBtn, page === totalPages ? styles.pageArrowBtnDisabled : null]}
                disabled={page === totalPages}
                onPress={() => onChangePage(page + 1)}
            >
                <Text style={styles.pageArrowText}>›</Text>
            </TouchableOpacity>
        </View>
    );
}

function CouponCard({ coupon, isInWallet, onPress, onAdd }) {
    const { t } = useLanguage();
    return (
        <TouchableOpacity style={styles.couponCard} activeOpacity={0.85} onPress={() => onPress(coupon)}>
            {coupon.image ? (
                <Image source={{ uri: coupon.image }} style={styles.couponImage} />
            ) : null}

            {coupon.discountLabel ? (
                <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>{coupon.discountLabel}</Text>
                </View>
            ) : null}

            <View style={styles.couponInfo}>
                <Text style={styles.couponTitle} numberOfLines={2}>
                    {coupon.title}{coupon.store ? ` · ${coupon.store}` : ''}
                </Text>
                {coupon.description ? (
                    <Text style={styles.couponDescription} numberOfLines={1}>{coupon.description}</Text>
                ) : coupon.category ? (
                    <Text style={styles.couponDescription} numberOfLines={1}>{coupon.category}</Text>
                ) : null}
            </View>

            {!isInWallet ? (
                <TouchableOpacity
                    style={styles.addBtn}
                    activeOpacity={0.85}
                    onPress={(e) => {
                        e.stopPropagation?.();
                        onAdd(coupon);
                    }}
                >
                    <Text style={styles.addBtnText}>{t('coupon_wallet_add_btn')}</Text>
                </TouchableOpacity>
            ) : (
                <View style={styles.addedBadge}>
                    <Text style={styles.addedBadgeText}>{t('coupon_wallet_added_badge')}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

export default function CouponWalletScreen({ onBack, availableCoupons, walletCoupons, onAddToWallet, onViewCoupon }) {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'wallet'
    const [browseSubTab, setBrowseSubTab] = useState('store'); // 'store' | 'category'
    const [browsePage, setBrowsePage] = useState(1);
    const [walletPage, setWalletPage] = useState(1);

    useEffect(() => {
        setBrowsePage(1);
    }, [browseSubTab, activeTab]);

    useEffect(() => {
        setWalletPage(1);
    }, [activeTab]);

    const walletIds = useMemo(() => new Set((walletCoupons || []).map((c) => c.id)), [walletCoupons]);

    const totalBrowsePages = Math.max(1, Math.ceil((availableCoupons || []).length / PAGE_SIZE));
    const visibleAvailableCoupons = useMemo(() => (
        (availableCoupons || []).slice((browsePage - 1) * PAGE_SIZE, browsePage * PAGE_SIZE)
    ), [availableCoupons, browsePage]);

    const totalWalletPages = Math.max(1, Math.ceil((walletCoupons || []).length / PAGE_SIZE));
    const visibleWalletCoupons = useMemo(() => (
        (walletCoupons || []).slice((walletPage - 1) * PAGE_SIZE, walletPage * PAGE_SIZE)
    ), [walletCoupons, walletPage]);

    // Group headers show the true total for that store/category (not just
    // what's on this page) — grouping the full list gives the real counts,
    // grouping the paginated slice gives which cards actually render.
    const fullGroupCounts = useMemo(() => {
        const grouped = browseSubTab === 'store'
            ? groupCouponsByStore(availableCoupons)
            : groupCouponsByCategory(availableCoupons);
        return new Map(grouped.map((g) => [g.key, g.coupons.length]));
    }, [availableCoupons, browseSubTab]);

    const groupedBrowse = useMemo(() => (
        browseSubTab === 'store'
            ? groupCouponsByStore(visibleAvailableCoupons)
            : groupCouponsByCategory(visibleAvailableCoupons)
    ), [visibleAvailableCoupons, browseSubTab]);

    return (
        <View style={styles.wrap}>
            <TouchableOpacity style={styles.backLink} activeOpacity={0.7} onPress={onBack}>
                <Text style={styles.backLinkText}>{t('back_btn')}</Text>
            </TouchableOpacity>

            <Text style={styles.title}>{`🎟️ ${t('coupon_wallet_title')}`}</Text>
            <Text style={styles.subtitle}>{t('coupon_wallet_subtitle')}</Text>

            <View style={styles.tabRow}>
                <TouchableOpacity activeOpacity={0.85} style={styles.tab} onPress={() => setActiveTab('browse')}>
                    <Text style={[styles.tabText, activeTab === 'browse' ? styles.tabTextActive : null]}>
                        {t('coupon_wallet_browse_tab')}{availableCoupons?.length ? ` (${availableCoupons.length})` : ''}
                    </Text>
                    <View style={[styles.tabUnderline, activeTab === 'browse' ? styles.tabUnderlineActive : null]} />
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.85} style={styles.tab} onPress={() => setActiveTab('wallet')}>
                    <Text style={[styles.tabText, activeTab === 'wallet' ? styles.tabTextActive : null]}>
                        {t('coupon_wallet_my_wallet_tab')}
                    </Text>
                    <View style={[styles.tabUnderline, activeTab === 'wallet' ? styles.tabUnderlineActive : null]} />
                </TouchableOpacity>
            </View>

            {activeTab === 'browse' ? (
                <View>
                    <View style={styles.segmentRow}>
                        <TouchableOpacity
                            activeOpacity={0.85}
                            style={[styles.segment, browseSubTab === 'store' ? styles.segmentActive : null]}
                            onPress={() => setBrowseSubTab('store')}
                        >
                            <Text style={[styles.segmentText, browseSubTab === 'store' ? styles.segmentTextActive : null]}>
                                {t('coupon_wallet_by_store')}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.85}
                            style={[styles.segment, browseSubTab === 'category' ? styles.segmentActive : null]}
                            onPress={() => setBrowseSubTab('category')}
                        >
                            <Text style={[styles.segmentText, browseSubTab === 'category' ? styles.segmentTextActive : null]}>
                                {t('coupon_wallet_by_category')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {groupedBrowse.length ? (
                        groupedBrowse.map((group) => (
                            <View key={group.key} style={styles.groupBlock}>
                                <View style={styles.groupHeaderRow}>
                                    <Text style={styles.groupLabel}>{group.key}</Text>
                                    <Text style={styles.groupCount}>{`(${fullGroupCounts.get(group.key) ?? group.coupons.length})`}</Text>
                                </View>

                                {group.coupons.map((coupon) => (
                                    <CouponCard
                                        key={coupon.id}
                                        coupon={coupon}
                                        isInWallet={walletIds.has(coupon.id)}
                                        onPress={onViewCoupon}
                                        onAdd={onAddToWallet}
                                    />
                                ))}
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyEmoji}>🎟️</Text>
                            <Text style={styles.emptyTitle}>{t('coupon_wallet_empty_browse_title')}</Text>
                            <Text style={styles.emptyText}>{t('coupon_wallet_empty_browse_desc')}</Text>
                        </View>
                    )}

                    <PageNumbers page={browsePage} totalPages={totalBrowsePages} onChangePage={setBrowsePage} />
                </View>
            ) : (
                visibleWalletCoupons.length ? (
                    <View style={styles.groupBlock}>
                        {visibleWalletCoupons.map((coupon) => (
                            <CouponCard
                                key={coupon.id}
                                coupon={coupon}
                                isInWallet
                                onPress={onViewCoupon}
                                onAdd={onAddToWallet}
                            />
                        ))}

                        <PageNumbers page={walletPage} totalPages={totalWalletPages} onChangePage={setWalletPage} />
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>🗂️</Text>
                        <Text style={styles.emptyTitle}>{t('coupon_wallet_empty_wallet_title')}</Text>
                        <Text style={styles.emptyText}>{t('coupon_wallet_empty_wallet_desc')}</Text>
                    </View>
                )
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    backLink: {
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
    backLinkText: {
        color: '#7B5E3E',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    title: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 20,
    },
    subtitle: {
        marginTop: 8,
        color: '#8C7A5F',
        fontFamily: 'Jost-Italic',
        fontStyle: 'italic',
        fontSize: 12,
        lineHeight: 17,
    },
    tabRow: {
        marginTop: 22,
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#E5DCCB',
    },
    tab: {
        marginRight: 28,
        paddingBottom: 12,
        alignItems: 'center',
    },
    tabText: {
        color: '#9A8D7F',
        fontFamily: 'Playfair-Bold',
        fontSize: 14,
    },
    tabTextActive: {
        color: '#2A1A11',
    },
    tabUnderline: {
        marginTop: 10,
        height: 2,
        width: '100%',
        backgroundColor: 'transparent',
    },
    tabUnderlineActive: {
        backgroundColor: '#173E20',
    },
    segmentRow: {
        marginTop: 20,
        flexDirection: 'row',
        gap: 10,
    },
    segment: {
        flex: 1,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#D9CDBD',
        backgroundColor: '#FBF8F2',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    segmentActive: {
        backgroundColor: '#173E20',
        borderColor: '#173E20',
    },
    segmentText: {
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    segmentTextActive: {
        color: '#F1F7F1',
    },
    groupBlock: {
        marginTop: 24,
    },
    groupHeaderRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#E5DCCB',
        paddingBottom: 8,
    },
    groupLabel: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 15,
    },
    groupCount: {
        color: '#9A8D7F',
        fontFamily: 'Jost-Medium',
        fontSize: 11,
    },
    couponCard: {
        marginTop: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: '#E5DCCB',
        backgroundColor: '#F1EEE7',
        borderRadius: 14,
        padding: 12,
    },
    couponImage: {
        width: 52,
        height: 52,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
    },
    discountBadge: {
        backgroundColor: '#6B3419',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    discountBadgeText: {
        color: '#FBF1E6',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
        textAlign: 'center',
    },
    couponInfo: {
        flex: 1,
    },
    couponTitle: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 13,
        lineHeight: 18,
    },
    couponDescription: {
        marginTop: 3,
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 11,
    },
    addBtn: {
        backgroundColor: '#173E20',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    addBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
    },
    addedBadge: {
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#173E20',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    addedBadgeText: {
        color: '#173E20',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
    },
    emptyState: {
        marginTop: 60,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    emptyEmoji: {
        fontSize: 34,
    },
    emptyTitle: {
        marginTop: 14,
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 16,
        textAlign: 'center',
    },
    emptyText: {
        marginTop: 8,
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
        lineHeight: 17,
        textAlign: 'center',
    },
    pageNumberRow: {
        marginTop: 20,
        marginBottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    pageArrowBtn: {
        minWidth: 38,
        height: 38,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#D9CDBD',
        backgroundColor: '#FBF8F2',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    pageArrowBtnDisabled: {
        opacity: 0.4,
    },
    pageArrowText: {
        color: '#5D4F42',
        fontFamily: 'Jost-Bold',
        fontSize: 16,
    },
    pageNumberBtn: {
        minWidth: 38,
        height: 38,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#D9CDBD',
        backgroundColor: '#FBF8F2',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    pageNumberBtnActive: {
        backgroundColor: '#173E20',
        borderColor: '#173E20',
    },
    pageNumberText: {
        color: '#5D4F42',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    pageNumberTextActive: {
        color: '#F1F7F1',
    },
});
