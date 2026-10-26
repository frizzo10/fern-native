import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../constants/tokens';
import useLanguage from '../../hooks/useLanguage';
import { fetchCircularItems, fetchCircularStores } from '../../services/circularsService';
import { zipsByStoreName } from '../../utils/storeZip';

// The caller's own ZIP (first saved store that has one) keeps regional flyers regional.
async function myZip() {
    try {
        const raw = await AsyncStorage.getItem('cpc_user_stores');
        return Object.values(zipsByStoreName(raw ? JSON.parse(raw) : []))[0] || '';
    } catch (e) {
        return '';
    }
}

// Every store's current weekly circular that anyone on Fern has scanned. Pick a store, see its sale items.
export default function CircularsBrowseModal({ visible, onClose, user }) {
    const { t } = useLanguage();
    const token = user?.token;
    const [status, setStatus] = useState('loading'); // loading | ready | error
    const [stores, setStores] = useState([]);
    const [picked, setPicked] = useState(null); // { storeKey, store }
    const [detail, setDetail] = useState(null); // { loading, failed, items, validDates }
    const [query, setQuery] = useState('');

    const loadStores = useCallback(async () => {
        setStatus('loading');
        try {
            setStores(await fetchCircularStores({ token, zip: await myZip() }));
            setStatus('ready');
        } catch (e) {
            console.log('[circulars] load failed', e?.message || e);
            setStatus('error');
        }
    }, [token]);

    useEffect(() => {
        if (visible) { setPicked(null); setDetail(null); setQuery(''); loadStores(); }
    }, [visible, loadStores]);

    const openStore = async (s) => {
        setPicked(s);
        setQuery('');
        setDetail({ loading: true });
        try {
            const d = await fetchCircularItems({ token, storeKey: s.storeKey, zip: await myZip() });
            setDetail({ loading: false, items: d.items, validDates: d.validDates });
        } catch (e) {
            setDetail({ loading: false, failed: true, items: [] });
        }
    };

    // Items grouped by aisle (the server already ranks food and real savings first).
    const sections = useMemo(() => {
        const q = query.trim().toLowerCase();
        const items = (detail?.items || []).filter((i) => !q || `${i.name} ${i.brand}`.toLowerCase().includes(q));
        const groups = new Map();
        items.forEach((i) => {
            const k = i.category || t('circulars_other');
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(i);
        });
        return [...groups.entries()];
    }, [detail, query, t]);

    const when = (iso) => {
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
    };

    return (
        <Modal transparent animationType="slide" visible={visible} onRequestClose={picked ? () => setPicked(null) : onClose}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.topBar}>
                        {picked ? (
                            <TouchableOpacity onPress={() => { setPicked(null); setDetail(null); }} style={styles.backBtn} activeOpacity={0.8}>
                                <Text style={styles.backText}>{`‹ ${t('circulars_back')}`}</Text>
                            </TouchableOpacity>
                        ) : (
                            <Text style={styles.title}>{`📰 ${t('circulars_title')}`}</Text>
                        )}
                        <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
                            <Text style={styles.closeText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    {!picked ? (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                            <Text style={styles.sub}>{t('circulars_sub')}</Text>
                            {status === 'loading' ? (
                                <View style={styles.center}><ActivityIndicator size="large" color={'#8A4A4E'} /></View>
                            ) : null}
                            {status === 'error' ? (
                                <View style={styles.center}>
                                    <Text style={styles.muted}>{t('circulars_error')}</Text>
                                    <TouchableOpacity style={styles.primaryBtn} onPress={loadStores} activeOpacity={0.85}>
                                        <Text style={styles.primaryBtnText}>{t('circulars_retry')}</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : null}
                            {status === 'ready' && stores.length === 0 ? <Text style={styles.muted}>{t('circulars_empty')}</Text> : null}
                            {status === 'ready' ? stores.map((s) => (
                                <TouchableOpacity key={s.storeKey} style={styles.storeCard} activeOpacity={0.85} onPress={() => openStore(s)}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.storeName}>{s.store}</Text>
                                        <Text style={styles.storeMeta}>
                                            {t('circulars_n_items', { n: s.itemCount })}
                                            {s.validDates ? ` · ${s.validDates}` : ` · ${when(s.scannedAt)}`}
                                        </Text>
                                    </View>
                                    <Text style={styles.chev}>›</Text>
                                </TouchableOpacity>
                            )) : null}
                        </ScrollView>
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                            <Text style={styles.detailTitle}>{picked.store}</Text>
                            {detail?.validDates ? <Text style={styles.sub}>{detail.validDates}</Text> : null}
                            {detail?.loading ? <View style={styles.center}><ActivityIndicator size="large" color={'#8A4A4E'} /></View> : null}
                            {detail?.failed ? <Text style={styles.muted}>{t('circulars_error')}</Text> : null}
                            {!detail?.loading && !detail?.failed ? (
                                <TextInput
                                    style={styles.search}
                                    value={query}
                                    onChangeText={setQuery}
                                    placeholder={t('circulars_search_ph')}
                                    placeholderTextColor={'#8A5A5C'}
                                />
                            ) : null}
                            {!detail?.loading && !detail?.failed && sections.length === 0 ? <Text style={styles.muted}>{t('circulars_no_match')}</Text> : null}
                            {sections.map(([cat, items]) => (
                                <View key={cat} style={{ marginTop: 10 }}>
                                    <Text style={styles.aisle}>{cat.toUpperCase()}</Text>
                                    {items.map((i, idx) => (
                                        <View key={`${i.name}-${i.price}-${idx}`} style={styles.itemRow}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.itemName}>{i.name}</Text>
                                                {i.brand ? <Text style={styles.itemMeta}>{i.brand}</Text> : null}
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.itemPrice}>{`${i.price || ''}${i.unit ? ` ${i.unit}` : ''}`.trim() || (i.isBogo ? 'BOGO' : '')}</Text>
                                                {i.originalPrice ? <Text style={styles.itemWas}>{t('circulars_was', { price: i.originalPrice })}</Text> : null}
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.28)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#FDE8E0', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: '#F3C9BD',
        paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, height: '85%',
    },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    title: { flex: 1, fontFamily: 'Playfair-Bold', fontSize: 22, color: '#8A4A4E' },
    backBtn: { paddingVertical: 6, paddingRight: 12 },
    backText: { fontSize: 17, color: '#8A4A4E', fontWeight: '700' },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#D8D8D8', alignItems: 'center', justifyContent: 'center' },
    closeText: { fontSize: 24, lineHeight: 26, color: '#F4F4F4' },
    content: { paddingBottom: 30 },
    sub: { fontSize: 14, color: '#8A5A5C', marginBottom: 10 },
    center: { alignItems: 'center', paddingVertical: 30, gap: 12 },
    muted: { fontSize: 15, color: '#8A5A5C', textAlign: 'center', paddingVertical: 16 },
    primaryBtn: { backgroundColor: '#8A4A4E', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 22 },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    storeCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E4DCCD',
        padding: 14, marginBottom: 10,
    },
    storeName: { fontSize: 18, fontWeight: '700', color: '#8A4A4E' },
    storeMeta: { fontSize: 13, color: '#8A5A5C', marginTop: 2 },
    chev: { fontSize: 28, color: '#8A5A5C', marginLeft: 8 },
    detailTitle: { fontFamily: 'Playfair-Bold', fontSize: 24, color: '#8A4A4E' },
    search: {
        backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E4DCCD', paddingHorizontal: 14, paddingVertical: 10,
        fontSize: 16, color: '#8A4A4E', marginTop: 6,
    },
    aisle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: '#8A5A5C', marginBottom: 4 },
    itemRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#EEE7DA',
        paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6,
    },
    itemName: { fontSize: 15.5, color: '#8A4A4E', fontWeight: '600' },
    itemMeta: { fontSize: 12.5, color: '#8A5A5C' },
    itemPrice: { fontSize: 16, fontWeight: '800', color: '#D8607C' },
    itemWas: { fontSize: 12, color: '#8A5A5C', textDecorationLine: 'line-through' },
});
