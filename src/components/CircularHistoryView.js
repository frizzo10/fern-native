import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import useLanguage from '../hooks/useLanguage';
import { loadCircularHistory } from '../utils/circularHistory';

function formatDate(value, locale) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Scan history rendered inside the Scan Circular sheet (not a nested <Modal>,
// which breaks the native modal stack on iOS). Mirrors the web app's
// renderCircularHistoryList / openCircularHistoryDetail.
export default function CircularHistoryView({ onBack }) {
    const { t, locale } = useLanguage();
    const [history, setHistory] = useState(null); // null = loading
    const [openKey, setOpenKey] = useState(null);

    useEffect(() => {
        let cancelled = false;
        loadCircularHistory().then((list) => {
            if (!cancelled) setHistory(list);
        });
        return () => { cancelled = true; };
    }, []);

    const groups = useMemo(() => {
        const byStore = new Map();
        (history || []).forEach((entry) => {
            if (!entry?.storeId) return;
            if (!byStore.has(entry.storeId)) byStore.set(entry.storeId, { storeId: entry.storeId, storeName: entry.storeName, scans: [] });
            byStore.get(entry.storeId).scans.push(entry);
        });
        const latest = (group) => Math.max(...group.scans.map((scan) => new Date(scan.date).getTime() || 0));
        return [...byStore.values()]
            .map((group) => ({ ...group, scans: [...group.scans].sort((a, b) => new Date(b.date) - new Date(a.date)) }))
            .sort((a, b) => latest(b) - latest(a));
    }, [history]);

    const openEntry = openKey ? (history || []).find((entry) => entry?.key === openKey) : null;

    if (history === null) {
        return <ActivityIndicator style={styles.loading} color="#173E20" />;
    }

    if (openEntry) {
        return (
            <View>
                <TouchableOpacity activeOpacity={0.7} onPress={() => setOpenKey(null)}>
                    <Text style={styles.backLink}>{`← ${t('scan_history_back')}`}</Text>
                </TouchableOpacity>
                <Text style={styles.detailStore}>{`🏪 ${openEntry.storeName}`}</Text>
                <Text style={styles.detailDate}>{formatDate(openEntry.date, locale)}</Text>
                {(openEntry.items || []).map((item, index) => (
                    <View key={`${item.name}-${index}`} style={styles.itemRow}>
                        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                        <Text style={styles.itemPrice}>{item.salePrice || ''}</Text>
                    </View>
                ))}
            </View>
        );
    }

    return (
        <View>
            <TouchableOpacity activeOpacity={0.7} onPress={onBack}>
                <Text style={styles.backLink}>{`← ${t('scan_history_back_to_scan')}`}</Text>
            </TouchableOpacity>
            <Text style={styles.heading}>{`📜 ${t('scan_history_title')}`}</Text>

            {!groups.length ? (
                <View style={styles.emptyWrap}>
                    <Text style={styles.emptyEmoji}>📜</Text>
                    <Text style={styles.emptyText}>{t('scan_history_empty')}</Text>
                </View>
            ) : groups.map((group) => (
                <View key={group.storeId} style={styles.groupCard}>
                    <View style={styles.groupHeader}>
                        <Text style={styles.groupIcon}>🏪</Text>
                        <View style={styles.groupHeaderText}>
                            <Text style={styles.groupName}>{group.storeName}</Text>
                            <Text style={styles.groupCount}>
                                {t(group.scans.length === 1 ? 'scan_history_count_singular' : 'scan_history_count_plural', { count: group.scans.length })}
                            </Text>
                        </View>
                    </View>
                    {group.scans.map((scan) => (
                        <TouchableOpacity
                            key={scan.key}
                            style={styles.scanRow}
                            activeOpacity={0.7}
                            onPress={() => setOpenKey(scan.key)}
                        >
                            <Text style={styles.scanDate}>{formatDate(scan.date, locale)}</Text>
                            <Text style={styles.scanItems}>{`${t('scan_history_items', { count: (scan.items || []).length })} →`}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    loading: { paddingVertical: 40 },
    backLink: {
        fontFamily: 'Jost-SemiBold',
        fontSize: 13,
        color: '#8C6B46',
        marginBottom: 12,
    },
    heading: {
        fontFamily: 'Playfair-Bold',
        fontSize: 20,
        color: '#2A1A11',
        marginBottom: 14,
    },
    emptyWrap: { alignItems: 'center', paddingVertical: 32 },
    emptyEmoji: { fontSize: 40, opacity: 0.4, marginBottom: 10 },
    emptyText: { fontFamily: 'Jost-Regular', fontSize: 14, color: '#8C7355', textAlign: 'center' },
    groupCard: {
        backgroundColor: '#F2ECE3',
        borderWidth: 1.5,
        borderColor: '#E0D4C4',
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
    },
    groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
    groupIcon: { fontSize: 20 },
    groupHeaderText: { flex: 1 },
    groupName: { fontFamily: 'Jost-Bold', fontSize: 15, color: '#2A1A11' },
    groupCount: { fontFamily: 'Jost-Regular', fontSize: 12, color: '#8C7355' },
    scanRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#E0D4C4',
    },
    scanDate: { fontFamily: 'Jost-Regular', fontSize: 14, color: '#2A1A11' },
    scanItems: { fontFamily: 'Jost-Regular', fontSize: 12, color: '#8C7355' },
    detailStore: { fontFamily: 'Playfair-Bold', fontSize: 20, color: '#2A1A11' },
    detailDate: { fontFamily: 'Jost-Regular', fontSize: 12, color: '#8C7355', marginTop: 2, marginBottom: 12 },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E0D4C4',
    },
    itemName: { flex: 1, fontFamily: 'Jost-Regular', fontSize: 14, color: '#2A1A11' },
    itemPrice: { fontFamily: 'Jost-Bold', fontSize: 14, color: '#9B3A0F' },
});
