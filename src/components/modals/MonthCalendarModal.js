import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import useLanguage from '../../hooks/useLanguage';
import { dateToKey } from '../../utils/familyDates';

export const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DOW_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// A full-month picker. One Modal, opened with nothing else showing.
// `markedKeys` = date keys that already hold a meal or activity (get a dot).
export default function MonthCalendarModal({ visible, selectedKey, markedKeys, onPick, onClose }) {
    const { t, locale } = useLanguage();
    const months = locale === 'es' ? MONTHS_ES : MONTHS_EN;
    const [view, setView] = useState(() => new Date());

    useEffect(() => {
        if (!visible) return;
        const [y, m] = String(selectedKey || '').split('-').map(Number);
        setView(y && m ? new Date(y, m - 1, 1) : new Date());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first.getDay(); i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = dateToKey(today);
    const shift = (n) => setView(new Date(year, month + n, 1));
    const marked = markedKeys || new Set();

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => { }}>
                    <View style={styles.head}>
                        <TouchableOpacity style={styles.arrow} onPress={() => shift(-1)} accessibilityRole="button">
                            <Text style={styles.arrowText}>‹</Text>
                        </TouchableOpacity>
                        <Text style={styles.monthTitle}>{`${months[month]} ${year}`}</Text>
                        <TouchableOpacity style={styles.arrow} onPress={() => shift(1)} accessibilityRole="button">
                            <Text style={styles.arrowText}>›</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.row}>
                        {DOW_EN.map((d, i) => (<Text key={i} style={styles.dow}>{d}</Text>))}
                    </View>
                    {rows.map((r, ri) => (
                        <View key={ri} style={styles.row}>
                            {r.map((d, ci) => {
                                if (!d) return <View key={ci} style={styles.cell} />;
                                const key = dateToKey(new Date(year, month, d));
                                const isPast = key < todayKey;
                                const isSel = key === selectedKey;
                                return (
                                    <TouchableOpacity
                                        key={ci}
                                        style={[styles.cell, isSel ? styles.cellSel : null, key === todayKey && !isSel ? styles.cellToday : null]}
                                        activeOpacity={0.7}
                                        disabled={isPast}
                                        onPress={() => onPick(key)}
                                    >
                                        <Text style={[styles.cellText, isPast ? styles.cellPast : null, isSel ? styles.cellTextSel : null]}>{d}</Text>
                                        {marked.has(key) ? <View style={[styles.dot, isSel ? styles.dotSel : null]} /> : null}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ))}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.todayBtn} onPress={() => onPick(todayKey)}>
                            <Text style={styles.todayText}>{t('family_cal_today')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <Text style={styles.closeText}>{t('cancel_btn')}</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(30,50,36,0.45)', justifyContent: 'center', padding: 20 },
    card: { backgroundColor: '#F7FAF3', borderRadius: 20, padding: 16 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    arrowText: { fontSize: 30, color: '#3F5645' },
    monthTitle: { fontFamily: 'Playfair-Bold', fontSize: 20, color: '#2F4535' },
    row: { flexDirection: 'row' },
    dow: { flex: 1, textAlign: 'center', fontFamily: 'Jost-Bold', fontSize: 12, color: '#5C7262', paddingVertical: 4 },
    cell: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
    cellSel: { backgroundColor: '#4E7A54' },
    cellToday: { borderWidth: 1.5, borderColor: '#4E7A54' },
    cellText: { fontFamily: 'Jost-Bold', fontSize: 16, color: '#2F4535' },
    cellPast: { color: '#B5C2AE' },
    cellTextSel: { color: '#FFFFFF' },
    dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#4E7A54', position: 'absolute', bottom: 5 },
    dotSel: { backgroundColor: '#FFFFFF' },
    footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    todayBtn: { paddingVertical: 12, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
    todayText: { fontFamily: 'Jost-Bold', fontSize: 15, color: '#4E7A54' },
    closeBtn: { paddingVertical: 12, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
    closeText: { fontFamily: 'Jost-Bold', fontSize: 15, color: '#5C7262' },
});
