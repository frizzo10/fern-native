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
const MINUTE_OPTIONS = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
const AMPM_OPTIONS = ['AM', 'PM'];

function cycleValue(options, current, dir) {
    const idx = options.indexOf(current);
    const next = (idx + dir + options.length) % options.length;
    return options[next];
}

function StepperField({ value, placeholder, onUp, onDown }) {
    return (
        <View style={styles.stepperBox}>
            <Text style={[styles.stepperValue, !value ? styles.stepperPlaceholder : null]} numberOfLines={1}>
                {value || placeholder}
            </Text>
            <View style={styles.stepperArrows}>
                <TouchableOpacity activeOpacity={0.6} onPress={onUp} hitSlop={{ top: 4, bottom: 1, left: 6, right: 6 }}>
                    <Text style={styles.stepperArrow}>▲</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.6} onPress={onDown} hitSlop={{ top: 1, bottom: 4, left: 6, right: 6 }}>
                    <Text style={styles.stepperArrow}>▼</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function FamilyAddActivityModal({ visible, dayOptions, initialDateKey, onClose, onAdd }) {
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
        setEmoji('');
        setName('');
        setStartHour('');
        setStartMinute('');
        setStartAmPm('PM');
        setEndHour('');
        setEndMinute('');
        setEndAmPm('PM');
        const initialIndex = (dayOptions || []).findIndex((d) => d.dateKey === initialDateKey);
        setDayIndex(initialIndex >= 0 ? initialIndex : 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, initialDateKey]);

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

        onAdd({
            day: selectedDay.label,
            time,
            emoji: emoji || '🗓️',
            label: trimmedName,
            dateKey: selectedDay.dateKey,
            endTime,
            startTime,
            _origLabel: trimmedName,
        });
    };

    const selectedDayLabel = (dayOptions || [])[dayIndex]?.label || '';

    return (
        <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.grabber} />

                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <Text style={styles.title}>{t('family_add_activity_title')}</Text>

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
                            placeholderTextColor="#B0A08A"
                            style={styles.emojiInput}
                            maxLength={4}
                        />
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder={t('family_activity_name_placeholder')}
                            placeholderTextColor="#B0A08A"
                            style={styles.nameInput}
                        />

                        <View style={styles.fieldsRow}>
                            <View style={styles.dayFieldWrap}>
                                <Text style={styles.fieldLabel}>{t('family_activity_day_label')}</Text>
                                <StepperField
                                    value={selectedDayLabel}
                                    placeholder="—"
                                    onUp={() => setDayIndex((i) => (i + 1) % Math.max(1, (dayOptions || []).length))}
                                    onDown={() => setDayIndex((i) => (i - 1 + (dayOptions || []).length) % Math.max(1, (dayOptions || []).length))}
                                />
                            </View>

                            <View style={styles.timeFieldWrap}>
                                <Text style={styles.fieldLabel}>{t('family_activity_start_label')}</Text>
                                <View style={styles.timeRow}>
                                    <StepperField
                                        value={startHour}
                                        placeholder="H"
                                        onUp={() => setStartHour((v) => cycleValue(HOUR_OPTIONS, v, 1))}
                                        onDown={() => setStartHour((v) => cycleValue(HOUR_OPTIONS, v, -1))}
                                    />
                                    <StepperField
                                        value={startMinute}
                                        placeholder="MM"
                                        onUp={() => setStartMinute((v) => cycleValue(MINUTE_OPTIONS, v, 1))}
                                        onDown={() => setStartMinute((v) => cycleValue(MINUTE_OPTIONS, v, -1))}
                                    />
                                </View>
                                <StepperField
                                    value={startAmPm}
                                    placeholder="PM"
                                    onUp={() => setStartAmPm((v) => cycleValue(AMPM_OPTIONS, v, 1))}
                                    onDown={() => setStartAmPm((v) => cycleValue(AMPM_OPTIONS, v, -1))}
                                />
                            </View>

                            <View style={styles.timeFieldWrap}>
                                <Text style={styles.fieldLabel}>{t('family_activity_end_label')}</Text>
                                <View style={styles.timeRow}>
                                    <StepperField
                                        value={endHour}
                                        placeholder="H"
                                        onUp={() => setEndHour((v) => cycleValue(HOUR_OPTIONS, v, 1))}
                                        onDown={() => setEndHour((v) => cycleValue(HOUR_OPTIONS, v, -1))}
                                    />
                                    <StepperField
                                        value={endMinute}
                                        placeholder="MM"
                                        onUp={() => setEndMinute((v) => cycleValue(MINUTE_OPTIONS, v, 1))}
                                        onDown={() => setEndMinute((v) => cycleValue(MINUTE_OPTIONS, v, -1))}
                                    />
                                </View>
                                <StepperField
                                    value={endAmPm}
                                    placeholder="PM"
                                    onUp={() => setEndAmPm((v) => cycleValue(AMPM_OPTIONS, v, 1))}
                                    onDown={() => setEndAmPm((v) => cycleValue(AMPM_OPTIONS, v, -1))}
                                />
                            </View>
                        </View>

                        <View style={styles.actionsRow}>
                            <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.85} onPress={onClose}>
                                <Text style={styles.cancelBtnText}>{t('cancel_btn')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.addBtn} activeOpacity={0.85} onPress={handleAdd}>
                                <Text style={styles.addBtnText}>{t('family_activity_add_btn')}</Text>
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
        borderColor: '#D9CFBF',
        overflow: 'hidden',
    },
    grabber: {
        alignSelf: 'center',
        marginTop: 10,
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#D9CDBD',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 30,
    },
    title: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 24,
    },
    sectionLabel: {
        marginTop: 20,
        color: '#8C7A5F',
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
        borderColor: '#D9CFBF',
        backgroundColor: '#F1EEE7',
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    quickChipActive: {
        borderColor: colors.forest,
        backgroundColor: '#E4EFE0',
    },
    quickChipText: {
        color: '#5D4F42',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
    },
    emojiInput: {
        marginTop: 10,
        width: 90,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        backgroundColor: '#FFFFFF',
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 16,
        textAlign: 'center',
        paddingVertical: 12,
    },
    nameInput: {
        marginTop: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        backgroundColor: '#FFFFFF',
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    fieldsRow: {
        marginTop: 18,
        flexDirection: 'row',
        gap: 10,
    },
    dayFieldWrap: {
        flex: 1,
    },
    timeFieldWrap: {
        flex: 1,
        gap: 6,
    },
    timeRow: {
        flexDirection: 'row',
        gap: 6,
    },
    fieldLabel: {
        marginBottom: 6,
        color: '#8C7A5F',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
        letterSpacing: 0.6,
    },
    stepperBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 10,
        paddingVertical: 10,
    },
    stepperValue: {
        color: '#2A1A11',
        fontFamily: 'Jost-Medium',
        fontSize: 14,
    },
    stepperPlaceholder: {
        color: '#B0A08A',
    },
    stepperArrows: {
        marginLeft: 6,
    },
    stepperArrow: {
        color: '#8C7A5F',
        fontSize: 9,
        lineHeight: 11,
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
        borderColor: '#D4C9BA',
        backgroundColor: '#F1EEE7',
        alignItems: 'center',
        paddingVertical: 15,
    },
    cancelBtnText: {
        color: '#5D4F42',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    addBtn: {
        flex: 2,
        borderRadius: 999,
        backgroundColor: colors.forest,
        alignItems: 'center',
        paddingVertical: 15,
    },
    addBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
});
