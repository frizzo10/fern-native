import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import useLanguage from '../../hooks/useLanguage';
import { colors } from '../../constants/tokens';

const QUICK_PICK_ACTIVITIES = [
    { emoji: '⚽', key: 'family_activity_soccer' },
    { emoji: '🏀', key: 'family_activity_basketball' },
    { emoji: '🏊', key: 'family_activity_swimming' },
    { emoji: '🎾', key: 'family_activity_tennis' },
    { emoji: '🏋️', key: 'family_activity_gym' },
    { emoji: '🧘', key: 'family_activity_yoga' },
    { emoji: '🚴', key: 'family_activity_cycling' },
    { emoji: '🏃', key: 'family_activity_running' },
    { emoji: '🎨', key: 'family_activity_art' },
    { emoji: '🎵', key: 'family_activity_music' },
    { emoji: '📚', key: 'family_activity_tutoring' },
    { emoji: '🏥', key: 'family_activity_doctor' },
    { emoji: '✂️', key: 'family_activity_haircut' },
    { emoji: '🛒', key: 'family_activity_grocery' },
    { emoji: '🎂', key: 'family_activity_birthday' },
    { emoji: '🍽️', key: 'family_activity_dinner_out' },
    { emoji: '🎬', key: 'family_activity_movie' },
    { emoji: '⛺', key: 'family_activity_camping' },
    { emoji: '✈️', key: 'family_activity_travel' },
    { emoji: '🧹', key: 'family_activity_cleaning' },
];

const HOUR_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const MINUTE_OPTIONS = ['00', '15', '30', '45'];
const AMPM_OPTIONS = ['AM', 'PM'];

// Big tap-target chip. Tapping the selected one again clears it (when onClear is given).
function Chip({ label, selected, onPress, wide }) {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={[styles.pickChip, wide ? styles.pickChipWide : null, selected ? styles.pickChipActive : null]}
        >
            <Text style={[styles.pickChipText, selected ? styles.pickChipTextActive : null]}>{label}</Text>
        </TouchableOpacity>
    );
}

function TimePicker({ hour, minute, ampm, onHour, onMinute, onAmPm }) {
    return (
        <View style={styles.timeBlock}>
            <View style={styles.chipGrid}>
                {HOUR_OPTIONS.map((h) => (
                    <Chip key={h} label={h} selected={hour === h} onPress={() => onHour(hour === h ? '' : h)} />
                ))}
            </View>
            <View style={styles.chipGrid}>
                {MINUTE_OPTIONS.map((m) => (
                    <Chip key={m} label={`:${m}`} selected={minute === m} onPress={() => onMinute(m)} />
                ))}
                {AMPM_OPTIONS.map((a) => (
                    <Chip key={a} label={a} wide selected={ampm === a} onPress={() => onAmPm(a)} />
                ))}
            </View>
        </View>
    );
}

// "5:30 PM" -> { hour: '5', minute: '30', ampm: 'PM' } (blank parts when it can't be read)
function parseClock(str) {
    const m = String(str || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    return m ? { hour: String(Number(m[1])), minute: m[2], ampm: m[3].toUpperCase() } : { hour: '', minute: '', ampm: 'PM' };
}

// `editing` = an existing activity to change; then the sheet opens filled in and Save calls onSave(updated).
export default function FamilyAddActivityModal({ visible, dayOptions, initialDateKey, onClose, onAdd, editing = null, onSave }) {
    const { t } = useLanguage();
    const [emoji, setEmoji] = useState('');
    const [name, setName] = useState('');
    const [dayIndex, setDayIndex] = useState(0);
    const [startHour, setStartHour] = useState('');
    const [startMinute, setStartMinute] = useState('');
    const [startAmPm, setStartAmPm] = useState('PM');
    const [endHour, setEndHour] = useState('');
    const [endMinute, setEndMinute] = useState('');
    const [endAmPm, setEndAmPm] = useState('PM');

    useEffect(() => {
        if (!visible) return;
        const from = editing || {};
        const parts = String(from.time || '').split(' - ');
        const st = parseClock(from.startTime || parts[0]);
        const en = parseClock(from.endTime || parts[1]);
        setEmoji(from.emoji && from.emoji !== '🗓️' ? from.emoji : (from.emoji || ''));
        setName(from.label || '');
        setStartHour(st.hour);
        setStartMinute(st.minute);
        setStartAmPm(st.ampm);
        setEndHour(en.hour);
        setEndMinute(en.minute);
        setEndAmPm(en.ampm);
        const wantedKey = from.dateKey || initialDateKey;
        const initialIndex = (dayOptions || []).findIndex((d) => d.dateKey === wantedKey);
        setDayIndex(initialIndex >= 0 ? initialIndex : 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, initialDateKey, editing]);

    const handleQuickPick = (item) => {
        setEmoji(item.emoji);
        setName(t(item.key));
    };

    const handleAdd = () => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            Alert.alert(t('family_activity_name_required_title'), t('family_activity_name_required_desc'));
            return;
        }

        const selectedDay = (dayOptions || [])[dayIndex] || dayOptions?.[0];
        if (!selectedDay) return;

        const startTime = (startHour && startMinute) ? `${startHour}:${startMinute} ${startAmPm}` : '';
        const endTime = (endHour && endMinute) ? `${endHour}:${endMinute} ${endAmPm}` : '';
        const time = startTime && endTime ? `${startTime} - ${endTime}` : (startTime || '');

        const built = {
            ...(editing || {}),
            day: selectedDay.label,
            time,
            emoji: emoji || '🗓️',
            label: trimmedName,
            dateKey: selectedDay.dateKey,
            endTime,
            startTime,
            _origLabel: editing?._origLabel || trimmedName,
        };
        if (editing && onSave) onSave(built); else onAdd(built);
    };

    return (
        <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.grabber} />

                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <Text style={styles.title}>{editing ? t('family_edit_activity_title') : t('family_add_activity_title')}</Text>

                        <Text style={styles.sectionLabel}>{t('family_activity_quick_pick_label')}</Text>
                        <View style={styles.quickRow}>
                            {QUICK_PICK_ACTIVITIES.map((item) => (
                                <TouchableOpacity
                                    key={item.key}
                                    style={[styles.quickChip, name === t(item.key) ? styles.quickChipActive : null]}
                                    activeOpacity={0.85}
                                    onPress={() => handleQuickPick(item)}
                                >
                                    <Text style={styles.quickChipText}>{`${item.emoji} ${t(item.key)}`}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.sectionLabel}>{t('family_activity_custom_label')}</Text>
                        <TextInput
                            value={emoji}
                            onChangeText={setEmoji}
                            placeholder={t('family_activity_emoji_placeholder')}
                            placeholderTextColor="#C3A29B"
                            style={styles.emojiInput}
                            maxLength={4}
                        />
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder={t('family_activity_name_placeholder')}
                            placeholderTextColor="#C3A29B"
                            style={styles.nameInput}
                        />

                        <Text style={styles.sectionLabel}>{t('family_activity_day_label')}</Text>
                        <View style={styles.chipGrid}>
                            {(dayOptions || []).map((d, i) => (
                                <Chip key={d.dateKey} label={d.label} wide selected={dayIndex === i} onPress={() => setDayIndex(i)} />
                            ))}
                        </View>

                        <Text style={styles.sectionLabel}>{t('family_activity_start_label')}</Text>
                        <TimePicker
                            hour={startHour}
                            minute={startMinute}
                            ampm={startAmPm}
                            onHour={(h) => { setStartHour(h); if (h && !startMinute) setStartMinute('00'); }}
                            onMinute={(m) => { setStartMinute(m); if (!startHour) setStartHour('12'); }}
                            onAmPm={setStartAmPm}
                        />

                        <Text style={styles.sectionLabel}>{t('family_activity_end_label')}</Text>
                        <TimePicker
                            hour={endHour}
                            minute={endMinute}
                            ampm={endAmPm}
                            onHour={(h) => { setEndHour(h); if (h && !endMinute) setEndMinute('00'); }}
                            onMinute={(m) => { setEndMinute(m); if (!endHour) setEndHour('12'); }}
                            onAmPm={setEndAmPm}
                        />

                        <View style={styles.actionsRow}>
                            <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.85} onPress={onClose}>
                                <Text style={styles.cancelBtnText}>{t('cancel_btn')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.addBtn} activeOpacity={0.85} onPress={handleAdd}>
                                <Text style={styles.addBtnText}>{editing ? t('family_activity_save_btn') : t('family_activity_add_btn')}</Text>
                            </TouchableOpacity>
                        </View>
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
        maxHeight: '90%',
        backgroundColor: '#FBF8F2',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: '#F3C9BD',
        overflow: 'hidden',
    },
    grabber: {
        alignSelf: 'center',
        marginTop: 10,
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#F3C9BD',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 30,
    },
    title: {
        color: '#5A3236',
        fontFamily: 'Playfair-Bold',
        fontSize: 24,
    },
    sectionLabel: {
        marginTop: 20,
        color: '#9A7872',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
        letterSpacing: 0.6,
    },
    quickRow: {
        marginTop: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    quickChip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#F3C9BD',
        backgroundColor: '#FDE8E0',
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    quickChipActive: {
        borderColor: '#8A4A4E',
        backgroundColor: '#FBD9CE',
    },
    quickChipText: {
        color: '#8A5A5C',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
    },
    emojiInput: {
        marginTop: 10,
        width: 90,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F3C9BD',
        backgroundColor: '#FFFFFF',
        color: '#5A3236',
        fontFamily: 'Jost-Regular',
        fontSize: 16,
        textAlign: 'center',
        paddingVertical: 12,
    },
    nameInput: {
        marginTop: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F3C9BD',
        backgroundColor: '#FFFFFF',
        color: '#5A3236',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    chipGrid: {
        marginTop: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    timeBlock: {
        marginTop: 2,
    },
    pickChip: {
        minWidth: 52,
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#F3C9BD',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
    },
    pickChipWide: {
        minWidth: 64,
        paddingHorizontal: 14,
    },
    pickChipActive: {
        borderColor: '#8A4A4E',
        backgroundColor: '#8A4A4E',
    },
    pickChipText: {
        color: '#5A3236',
        fontFamily: 'Jost-Medium',
        fontSize: 16,
    },
    pickChipTextActive: {
        color: '#FDE8E0',
    },
    actionsRow: {
        marginTop: 26,
        flexDirection: 'row',
        gap: 10,
    },
    cancelBtn: {
        flex: 1,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#F3C9BD',
        backgroundColor: '#FDE8E0',
        alignItems: 'center',
        paddingVertical: 15,
    },
    cancelBtnText: {
        color: '#8A5A5C',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    addBtn: {
        flex: 2,
        borderRadius: 999,
        backgroundColor: '#8A4A4E',
        alignItems: 'center',
        paddingVertical: 15,
    },
    addBtnText: {
        color: '#FDE8E0',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
});
