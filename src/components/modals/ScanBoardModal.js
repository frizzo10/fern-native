import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../../constants/tokens';
import useLanguage from '../../hooks/useLanguage';
import { fetchBoard, saveBoardName } from '../../services/scanBoardService';

// This week's top scanners. You only appear if you choose a name; leaving the board removes the name.
export default function ScanBoardModal({ visible, onClose, user }) {
    const { t } = useLanguage();
    const token = user?.token;
    const [status, setStatus] = useState('loading'); // loading | ready | error
    const [board, setBoard] = useState({ top: [], me: { pages: 0, items: 0, rank: null, name: '' } });
    const [nameInput, setNameInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [nameErr, setNameErr] = useState('');

    const load = useCallback(async () => {
        setStatus('loading');
        try {
            const b = await fetchBoard(token);
            setBoard(b);
            setNameInput(b.me.name || '');
            setStatus('ready');
        } catch (e) {
            setStatus('error');
        }
    }, [token]);

    useEffect(() => { if (visible) { setNameErr(''); load(); } }, [visible, load]);

    const save = async (name) => {
        Keyboard.dismiss();
        setBusy(true);
        setNameErr('');
        try {
            await saveBoardName(token, name);
            await load();
        } catch (e) {
            setNameErr(t('scan_board_name_failed'));
        }
        setBusy(false);
    };

    const me = board.me;
    const joined = Boolean(me.name);

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.page}>
                <View style={styles.bar}>
                    <Text style={styles.title}>{`🏆 ${t('scan_board_title')}`}</Text>
                    <TouchableOpacity onPress={onClose} accessibilityRole="button" hitSlop={10}>
                        <Text style={styles.close}>✕</Text>
                    </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                    <Text style={styles.sub}>{t('scan_board_sub')}</Text>

                    {status === 'loading' ? <ActivityIndicator style={{ marginTop: 24 }} color={'#3F5645' || '#3F5645'} /> : null}
                    {status === 'error' ? (
                        <TouchableOpacity style={styles.retry} onPress={load}><Text style={styles.retryText}>{t('scan_board_retry')}</Text></TouchableOpacity>
                    ) : null}

                    {status === 'ready' ? (
                        <>
                            <View style={styles.meCard}>
                                <Text style={styles.meLine}>
                                    {me.pages > 0 ? t('scan_board_me', { pages: me.pages, items: me.items }) : t('scan_board_me_none')}
                                </Text>
                                {me.rank ? <Text style={styles.meRank}>{t('scan_board_rank', { n: me.rank })}</Text> : null}
                            </View>

                            {board.top.length ? board.top.map((r, i) => (
                                <View key={`${r.name}-${i}`} style={[styles.row, r.me && styles.rowMe]}>
                                    <Text style={styles.rowNo}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</Text>
                                    <Text style={styles.rowName} numberOfLines={1}>{r.name}</Text>
                                    <Text style={styles.rowPages}>{t('scan_board_row', { n: r.pages })}</Text>
                                </View>
                            )) : <Text style={styles.empty}>{t('scan_board_empty')}</Text>}

                            <View style={styles.nameCard}>
                                <Text style={styles.nameTitle}>{joined ? t('scan_board_you_are', { name: me.name }) : t('scan_board_join_title')}</Text>
                                <Text style={styles.nameHint}>{t('scan_board_name_hint')}</Text>
                                <TextInput
                                    style={styles.input}
                                    value={nameInput}
                                    onChangeText={setNameInput}
                                    placeholder={t('scan_board_name_ph')}
                                    placeholderTextColor="#9AA39A"
                                    maxLength={20}
                                    autoCorrect={false}
                                />
                                {nameErr ? <Text style={styles.err}>{nameErr}</Text> : null}
                                <TouchableOpacity
                                    style={[styles.btn, (busy || nameInput.trim().length < 2) && { opacity: 0.5 }]}
                                    disabled={busy || nameInput.trim().length < 2}
                                    onPress={() => save(nameInput)}
                                    accessibilityRole="button"
                                >
                                    <Text style={styles.btnText}>{joined ? t('scan_board_update') : t('scan_board_join')}</Text>
                                </TouchableOpacity>
                                {joined ? (
                                    <TouchableOpacity style={styles.leave} disabled={busy} onPress={() => save('')} accessibilityRole="button">
                                        <Text style={styles.leaveText}>{t('scan_board_leave')}</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        </>
                    ) : null}
                </ScrollView>
            </View>
        </Modal>
    );
}

const FOREST = '#3F5645';
const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: '#FAF6EE' },
    bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12 },
    title: { fontFamily: 'Jost-Bold', fontSize: 22, color: FOREST },
    close: { fontFamily: 'Jost-Bold', fontSize: 24, color: FOREST },
    body: { paddingHorizontal: 20, paddingBottom: 60 },
    sub: { fontFamily: 'Jost-Regular', fontSize: 15, color: '#4B5A45', marginBottom: 14 },
    meCard: { backgroundColor: FOREST, borderRadius: 16, padding: 16, marginBottom: 14 },
    meLine: { fontFamily: 'Jost-SemiBold', fontSize: 16, color: '#fff' },
    meRank: { fontFamily: 'Jost-SemiBold', fontSize: 14, color: '#F5C98B', marginTop: 4 },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E3DCCB' },
    rowMe: { borderColor: '#4E7A54', borderWidth: 2 },
    rowNo: { width: 34, fontFamily: 'Jost-Bold', fontSize: 18, color: FOREST },
    rowName: { flex: 1, fontFamily: 'Jost-SemiBold', fontSize: 16, color: '#22301C' },
    rowPages: { fontFamily: 'Jost-Regular', fontSize: 14, color: '#4B5A45' },
    empty: { fontFamily: 'Jost-Regular', fontSize: 15, color: '#4B5A45', marginVertical: 12 },
    nameCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#E3DCCB' },
    nameTitle: { fontFamily: 'Jost-Bold', fontSize: 17, color: FOREST },
    nameHint: { fontFamily: 'Jost-Regular', fontSize: 13, color: '#4B5A45', marginTop: 4, marginBottom: 10 },
    input: { borderWidth: 1, borderColor: '#CFC6AF', borderRadius: 10, paddingHorizontal: 12, height: 46, fontFamily: 'Jost-Regular', fontSize: 16, color: '#22301C' },
    err: { fontFamily: 'Jost-Regular', fontSize: 13, color: '#B3202A', marginTop: 6 },
    btn: { marginTop: 12, minHeight: 46, borderRadius: 12, backgroundColor: '#4E7A54', alignItems: 'center', justifyContent: 'center' },
    btnText: { fontFamily: 'Jost-Bold', fontSize: 16, color: '#fff' },
    leave: { marginTop: 10, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
    leaveText: { fontFamily: 'Jost-SemiBold', fontSize: 14, color: '#B3202A' },
    retry: { marginTop: 20, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: FOREST, alignItems: 'center', justifyContent: 'center' },
    retryText: { fontFamily: 'Jost-SemiBold', fontSize: 15, color: FOREST },
});
