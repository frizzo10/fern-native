import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useLanguage from '../../hooks/useLanguage';
import { useFernVoice } from '../../hooks/useFernVoice';
import {
    fallbackListing,
    fetchPublishGuide,
    generateListing,
    clearPublishContext,
    getPublish,
    makeCookbookCover,
    setPublish,
    setPublishContext,
} from '../../services/publishService';

const INK = '#3F5645';
const DEEP = '#2F4535';
const ACCENT = '#4E7A54';
const CARD = '#ECF2E6';
const LINE = '#C8D6BE';
const MUTED = '#5C7262';
const VOICE_KEY = 'fern_publish_voice';

// Fern-led walkthrough for publishing a cookbook: one step at a time, spoken, with copy/open buttons.
//   book: { id, title, author, photoUrl, recipes: [{ title, chapter }] }
//   pdf:  { url, pages }
//   onStuck(): the parent closes this sheet and opens Ask Fern (which reads fern_publish_ctx)
export default function PublishGuideModal({ visible, onClose, onStuck, book, pdf, token }) {
    const { t, locale } = useLanguage();
    const { speakText, stopSpeaking } = useFernVoice({ allowFree: true, token });
    const [path, setPath] = useState(null);          // null = the "how do you want to share it?" screen
    const [steps, setSteps] = useState([]);
    const [idx, setIdx] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [listing, setListing] = useState(null);
    const [listingBusy, setListingBusy] = useState(false);
    const [listingNote, setListingNote] = useState('');
    const [coverUrl, setCoverUrl] = useState('');
    const [coverBusy, setCoverBusy] = useState(false);
    const [coverFailed, setCoverFailed] = useState(false);
    const [voiceOn, setVoiceOn] = useState(true);
    const [copied, setCopied] = useState('');
    const [ready, setReady] = useState(false);
    const coverStarted = useRef(false);
    const listingStarted = useRef(false);
    const bookId = book?.id;

    // Load saved progress each time the sheet opens.
    useEffect(() => {
        if (!visible || bookId == null) return undefined;
        let live = true;
        coverStarted.current = false;
        listingStarted.current = false;
        setReady(false);
        (async () => {
            const saved = await getPublish(bookId);
            let v = true;
            try { v = (await AsyncStorage.getItem(VOICE_KEY)) !== 'off'; } catch (e) { /* default on */ }
            if (!live) return;
            setVoiceOn(v);
            setPath(saved.path && !saved.finished ? saved.path : null);
            setIdx(saved.step || 0);
            setListing(saved.listing || null);
            setCoverUrl(saved.coverUrl || '');
            setCoverFailed(false);
            setListingNote('');
            setReady(true);
        })();
        return () => { live = false; };
    }, [visible, bookId]);

    const loadSteps = useCallback(async (p) => {
        setLoading(true);
        setLoadError(false);
        try {
            const s = await fetchPublishGuide(p, locale);
            setSteps(s);
        } catch (e) {
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [locale]);

    useEffect(() => {
        if (visible && ready && path) loadSteps(path);
    }, [visible, ready, path, loadSteps]);

    const step = path && steps.length ? steps[Math.min(idx, steps.length - 1)] : null;

    // Make the cover in the background as soon as the download path is chosen.
    useEffect(() => {
        if (!visible || !ready || path !== 'download' || coverUrl || coverStarted.current || !book) return;
        coverStarted.current = true;
        setCoverBusy(true);
        makeCookbookCover({ title: book.title, author: book.author, photoUrl: book.photoUrl, token })
            .then(async (url) => { setCoverUrl(url); await setPublish(bookId, { coverUrl: url }); })
            .catch(() => setCoverFailed(true))
            .finally(() => setCoverBusy(false));
    }, [visible, ready, path, coverUrl, book, bookId, token]);

    // Fern writes the listing the first time the listing step is reached.
    useEffect(() => {
        if (!visible || !step || step.kind !== 'listing' || listing || listingStarted.current || !book) return;
        listingStarted.current = true;
        setListingBusy(true);
        generateListing({ title: book.title, author: book.author, recipes: book.recipes, locale, token })
            .then(async (l) => { setListing(l); setListingNote(''); await setPublish(bookId, { listing: l }); })
            .catch(async () => {
                const l = fallbackListing({ title: book.title, recipes: book.recipes, locale });
                setListing(l);
                setListingNote(t('pub_listing_failed'));
                await setPublish(bookId, { listing: l });
            })
            .finally(() => setListingBusy(false));
    }, [visible, step, listing, book, bookId, locale, token, t]);

    // Remember the step, tell Ask Fern where the person is, and speak the step.
    useEffect(() => {
        if (!visible || !step) return undefined;
        setPublish(bookId, { path, step: idx });
        setPublishContext({ site: 'Lemon Squeezy', step: idx + 1, of: steps.length, title: step.title, say: step.say, body: step.body });
        if (voiceOn && step.say) speakText(step.say);
        return () => { stopSpeaking(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, step?.id, voiceOn]);

    useEffect(() => { if (!visible) stopSpeaking(); }, [visible, stopSpeaking]);

    const fieldValue = (field) => {
        if (field === 'store_name') return book?.author || book?.title || '';
        return String(listing?.[field] || '');
    };

    const doCopy = async (field) => {
        const val = fieldValue(field);
        if (!val) return;
        let ok = false;
        try {
            const Clipboard = require('expo-clipboard'); // guarded: an older binary without it falls back to the share sheet
            await Clipboard.setStringAsync(val);
            ok = true;
        } catch (e) { /* fall through */ }
        if (!ok) {
            try { await Share.share({ message: val }); } catch (e) { /* cancelled */ }
            return;
        }
        setCopied(field);
        setTimeout(() => setCopied((c) => (c === field ? '' : c)), 2000);
    };

    const doFile = (which) => {
        const url = which === 'pdf' ? pdf?.url : coverUrl;
        if (!url) { Alert.alert(t('pub_cover_busy'), t('pub_cover_failed')); return; }
        Linking.openURL(url).catch(() => {});
    };

    const doSendAll = async () => {
        const lines = [
            listing?.title || book?.title || '',
            listing?.subtitle || '',
            '',
            listing?.description || '',
            '',
            `${t('pub_send_price')}: $${listing?.price || ''}`,
            '',
            `${t('pub_send_pdf')}: ${pdf?.url || ''}`,
            `${t('pub_send_cover')}: ${coverUrl || ''}`,
        ];
        try { await Share.share({ message: lines.join('\n') }); } catch (e) { /* cancelled */ }
    };

    const runAction = (a) => {
        if (a.type === 'open') Linking.openURL(a.url).catch(() => {});
        else if (a.type === 'copy') doCopy(a.field);
        else if (a.type === 'file') doFile(a.which);
        else if (a.type === 'send_all') doSendAll();
    };

    const pickPath = async (p) => {
        setPath(p);
        setIdx(0);
        setSteps([]);
        await setPublish(bookId, { path: p, step: 0, finished: false });
    };

    const goBack = () => {
        if (idx > 0) setIdx(idx - 1);
        else { setPath(null); setSteps([]); setPublish(bookId, { path: null, step: 0 }); }
    };
    const goNext = async () => {
        if (idx >= steps.length - 1) {
            await setPublish(bookId, { finished: true });
            clearPublishContext();
            onClose();
            return;
        }
        setIdx(idx + 1);
    };

    const toggleVoice = async () => {
        const next = !voiceOn;
        setVoiceOn(next);
        if (!next) stopSpeaking();
        try { await AsyncStorage.setItem(VOICE_KEY, next ? 'on' : 'off'); } catch (e) { /* best effort */ }
    };

    const updateListing = (key, value) => setListing((l) => ({ ...(l || {}), [key]: value }));
    const saveListing = () => { if (listing) setPublish(bookId, { listing }); };

    const close = () => { stopSpeaking(); clearPublishContext(); onClose(); };
    const stuck = () => { stopSpeaking(); onStuck && onStuck(); };

    const isLast = steps.length > 0 && idx >= steps.length - 1;

    const renderChoice = () => (
        <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.h1}>{t('pub_choose_title')}</Text>
            <Text style={styles.body}>{t('pub_choose_sub')}</Text>
            <TouchableOpacity activeOpacity={0.85} style={styles.choiceCard} onPress={() => pickPath('download')} accessibilityRole="button">
                <Text style={styles.choiceEmoji}>💾</Text>
                <View style={{ flex: 1 }}>
                    <Text style={styles.choiceTitle}>{t('pub_dl_title')}</Text>
                    <Text style={styles.choiceSub}>{t('pub_dl_sub')}</Text>
                </View>
                <Text style={styles.chev}>›</Text>
            </TouchableOpacity>
            <View style={[styles.choiceCard, styles.choiceOff]}>
                <Text style={styles.choiceEmoji}>📦</Text>
                <View style={{ flex: 1 }}>
                    <Text style={styles.choiceTitle}>{t('pub_kdp_title')}</Text>
                    <Text style={styles.choiceSub}>{t('pub_kdp_sub')}</Text>
                </View>
            </View>
        </ScrollView>
    );

    const renderListing = () => (
        <View style={{ marginTop: 14 }}>
            {listingBusy || !listing ? (
                <View style={styles.busyRow}>
                    <ActivityIndicator color={ACCENT} />
                    <Text style={styles.busyText}>{t('pub_listing_busy')}</Text>
                </View>
            ) : (
                <View>
                    {listingNote ? <Text style={styles.note}>{listingNote}</Text> : null}
                    <Text style={styles.label}>{t('pub_field_title')}</Text>
                    <TextInput style={styles.input} value={listing.title} onChangeText={(v) => updateListing('title', v)} onBlur={saveListing} />
                    <Text style={styles.label}>{t('pub_field_sub')}</Text>
                    <TextInput style={styles.input} value={listing.subtitle} onChangeText={(v) => updateListing('subtitle', v)} onBlur={saveListing} />
                    <Text style={styles.label}>{t('pub_field_desc')}</Text>
                    <TextInput style={[styles.input, styles.inputTall]} multiline value={listing.description} onChangeText={(v) => updateListing('description', v)} onBlur={saveListing} textAlignVertical="top" />
                    <Text style={styles.label}>{t('pub_field_price')}</Text>
                    <TextInput style={[styles.input, { width: 120 }]} keyboardType="decimal-pad" value={String(listing.price || '')} onChangeText={(v) => updateListing('price', v.replace(/[^0-9.]/g, ''))} onBlur={saveListing} />
                </View>
            )}
        </View>
    );

    const renderStep = () => {
        if (loading) return <View style={styles.center}><ActivityIndicator color={ACCENT} /><Text style={styles.busyText}>{t('pub_loading')}</Text></View>;
        if (loadError || !step) {
            return (
                <View style={styles.center}>
                    <Text style={styles.body}>{t('pub_error')}</Text>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={() => loadSteps(path)}><Text style={styles.secondaryText}>{t('pub_retry')}</Text></TouchableOpacity>
                </View>
            );
        }
        return (
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.stepCount}>{t('pub_step_of', { n: idx + 1, total: steps.length })}</Text>
                <View style={styles.bar}><View style={[styles.barFill, { width: `${((idx + 1) / steps.length) * 100}%` }]} /></View>
                <Text style={styles.h1}>{step.title}</Text>
                {step.body ? <Text style={styles.body}>{step.body}</Text> : null}
                {step.seeing ? (
                    <View style={styles.seeing}>
                        <Text style={styles.seeingLabel}>{t('pub_seeing')}</Text>
                        <Text style={styles.seeingText}>{step.seeing}</Text>
                    </View>
                ) : null}
                {step.kind === 'listing' ? renderListing() : null}
                {step.kind === 'files' && coverBusy ? (
                    <View style={styles.busyRow}><ActivityIndicator color={ACCENT} /><Text style={styles.busyText}>{t('pub_cover_busy')}</Text></View>
                ) : null}
                {step.kind === 'files' && coverFailed && !coverUrl ? <Text style={styles.note}>{t('pub_cover_failed')}</Text> : null}
                <View style={{ marginTop: 16, gap: 10 }}>
                    {(step.actions || []).map((a, i) => {
                        const isCopied = a.type === 'copy' && copied === a.field;
                        return (
                            <TouchableOpacity
                                key={`${a.type}-${a.field || a.which || a.url || i}`}
                                activeOpacity={0.85}
                                style={[styles.actionBtn, i === 0 && a.type === 'open' ? styles.actionPrimary : null]}
                                onPress={() => runAction(a)}
                                accessibilityRole="button"
                            >
                                <Text style={[styles.actionText, i === 0 && a.type === 'open' ? styles.actionPrimaryText : null]}>
                                    {isCopied ? t('pub_copied') : a.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <View style={styles.helpRow}>
                    <TouchableOpacity onPress={() => step.say && speakText(step.say)} style={styles.helpBtn} accessibilityRole="button">
                        <Text style={styles.helpText}>{t('pub_hear')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={stuck} style={styles.helpBtn} accessibilityRole="button">
                        <Text style={styles.helpText}>{t('pub_stuck')}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={close}>
            <SafeAreaView style={styles.safe}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={close} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={t('close_btn')}>
                            <Text style={styles.iconText}>✕</Text>
                        </TouchableOpacity>
                        <Text style={styles.headerTitle} numberOfLines={1}>{t('pub_header')}</Text>
                        <TouchableOpacity onPress={toggleVoice} style={styles.iconBtn} accessibilityRole="button">
                            <Text style={styles.iconText}>{voiceOn ? '🔊' : '🔇'}</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                        {!ready ? <View style={styles.center}><ActivityIndicator color={ACCENT} /></View> : !path ? renderChoice() : renderStep()}
                    </View>
                    {path && step && !loading ? (
                        <View style={styles.footer}>
                            <TouchableOpacity onPress={goBack} style={styles.backBtn} accessibilityRole="button">
                                <Text style={styles.backText}>{t('pub_back')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={goNext}
                                disabled={step.kind === 'listing' && (listingBusy || !listing)}
                                style={[styles.nextBtn, step.kind === 'listing' && (listingBusy || !listing) ? { opacity: 0.5 } : null]}
                                accessibilityRole="button"
                            >
                                <Text style={styles.nextText}>{isLast ? t('pub_finish') : t('pub_next')}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F7FAF3' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: LINE, backgroundColor: '#F1F6EC' },
    headerTitle: { flex: 1, textAlign: 'center', color: DEEP, fontWeight: '700', fontSize: 16 },
    iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    iconText: { fontSize: 20, color: INK },
    scroll: { padding: 20, paddingBottom: 40 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    stepCount: { color: MUTED, fontSize: 13, fontWeight: '600', marginBottom: 8 },
    bar: { height: 6, borderRadius: 3, backgroundColor: LINE, marginBottom: 18, overflow: 'hidden' },
    barFill: { height: 6, backgroundColor: ACCENT },
    h1: { color: DEEP, fontSize: 24, fontWeight: '800', marginBottom: 10 },
    body: { color: INK, fontSize: 16, lineHeight: 24 },
    seeing: { marginTop: 14, backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: LINE, padding: 12 },
    seeingLabel: { color: MUTED, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 4 },
    seeingText: { color: INK, fontSize: 14, lineHeight: 20 },
    actionBtn: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: LINE, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
    actionPrimary: { backgroundColor: ACCENT, borderColor: ACCENT },
    actionText: { color: INK, fontWeight: '700', fontSize: 15 },
    actionPrimaryText: { color: '#FFFFFF' },
    helpRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 },
    helpBtn: { minHeight: 44, justifyContent: 'center' },
    helpText: { color: ACCENT, fontWeight: '700', fontSize: 14 },
    footer: { flexDirection: 'row', gap: 12, padding: 14, borderTopWidth: 1, borderTopColor: LINE, backgroundColor: '#F1F6EC' },
    backBtn: { minHeight: 52, paddingHorizontal: 20, borderRadius: 14, borderWidth: 1, borderColor: LINE, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
    backText: { color: INK, fontWeight: '700', fontSize: 15 },
    nextBtn: { flex: 1, minHeight: 52, borderRadius: 14, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
    nextText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
    choiceCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: LINE, backgroundColor: CARD },
    choiceOff: { opacity: 0.6 },
    choiceEmoji: { fontSize: 30 },
    choiceTitle: { color: DEEP, fontWeight: '800', fontSize: 17 },
    choiceSub: { color: MUTED, fontSize: 13, marginTop: 2 },
    chev: { color: ACCENT, fontSize: 28 },
    busyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
    busyText: { color: MUTED, fontSize: 14, marginTop: 8 },
    note: { color: MUTED, fontSize: 13, marginTop: 10, marginBottom: 4 },
    label: { color: MUTED, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginTop: 14, marginBottom: 6 },
    input: { borderWidth: 1, borderColor: LINE, borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: INK },
    inputTall: { minHeight: 200 },
    secondaryBtn: { marginTop: 14, minHeight: 44, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: LINE, alignItems: 'center', justifyContent: 'center', backgroundColor: CARD },
    secondaryText: { color: INK, fontWeight: '700' },
});
