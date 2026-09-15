import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import useLanguage from '../../hooks/useLanguage';
import { pickFirst } from '../../utils/recipeNormalize';
import { colors, radius } from '../../constants/tokens';
import { CUISINE_OPTIONS, CUISINE_OTHER_VALUE, MEAL_TYPE_OPTIONS } from '../../constants/recipeOptions';

const MY_RECIPES_ID = '';

function normalizeBookOption(book, index) {
    return {
        value: String(pickFirst(book?.id, book?.uuid, book?.book_id, `book-${index}`)),
        label: String(pickFirst(book?.title, book?.name, book?.book_title, book?.label, `Cookbook ${index + 1}`)).trim(),
    };
}

function PickerField({ label, value, onPress }) {
    return (
        <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
            <TouchableOpacity style={styles.fieldInput} activeOpacity={0.8} onPress={onPress}>
                <Text style={styles.fieldValue} numberOfLines={1}>{value}</Text>
                <Text style={styles.fieldChevron}>⌄</Text>
            </TouchableOpacity>
        </View>
    );
}

function OptionsOverlay({ visible, title, options, selectedValue, onSelect, onClose }) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlayBackdrop} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity activeOpacity={1} style={styles.overlaySheet}>
                    <Text style={styles.overlayTitle}>{title}</Text>
                    <ScrollView style={styles.overlayList} showsVerticalScrollIndicator={false}>
                        {options.map((opt) => (
                            <TouchableOpacity
                                key={opt.value}
                                style={styles.overlayRow}
                                activeOpacity={0.7}
                                onPress={() => onSelect(opt.value)}
                            >
                                <Text style={styles.overlayRowText}>{opt.label}</Text>
                                {opt.value === selectedValue ? <Text style={styles.overlayCheck}>✓</Text> : null}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

export default function SaveToCookbookModal({
    visible,
    books,
    initialBookId = '',
    initialCuisine = '',
    initialMealType = '',
    isSaving = false,
    onCancel,
    onSave,
}) {
    const { t } = useLanguage();
    const [bookId, setBookId] = useState(MY_RECIPES_ID);
    const [cuisine, setCuisine] = useState('');
    const [customCuisine, setCustomCuisine] = useState('');
    const [mealType, setMealType] = useState('');
    const [activeField, setActiveField] = useState(null); // 'book' | 'cuisine' | 'mealType' | null

    useEffect(() => {
        if (!visible) return;
        setBookId(initialBookId || MY_RECIPES_ID);
        const isKnownCuisine = CUISINE_OPTIONS.includes(initialCuisine);
        setCuisine(isKnownCuisine ? initialCuisine : (initialCuisine ? CUISINE_OTHER_VALUE : ''));
        setCustomCuisine(!isKnownCuisine ? (initialCuisine || '') : '');
        setMealType(MEAL_TYPE_OPTIONS.includes(initialMealType) ? initialMealType : '');
        setActiveField(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, initialBookId, initialCuisine, initialMealType]);

    if (!visible) return null;

    const bookOptions = [
        { value: MY_RECIPES_ID, label: t('my_recipes_option') },
        ...(Array.isArray(books) ? books.map(normalizeBookOption) : []),
    ];
    const cuisineOptions = [
        ...CUISINE_OPTIONS.map((c) => ({ value: c, label: c })),
        { value: CUISINE_OTHER_VALUE, label: t('cuisine_other_option') },
    ];
    const mealTypeOptions = MEAL_TYPE_OPTIONS.map((m) => ({ value: m, label: m }));

    const bookLabel = bookOptions.find((o) => o.value === bookId)?.label || t('my_recipes_option');
    const cuisineLabel = cuisine === CUISINE_OTHER_VALUE
        ? (customCuisine || t('cuisine_other_option'))
        : (cuisine || t('select_placeholder'));
    const mealTypeLabel = mealType || t('select_placeholder');

    const handleSave = () => {
        const finalCuisine = cuisine === CUISINE_OTHER_VALUE ? customCuisine.trim() : cuisine;
        onSave({ bookId: bookId || null, cuisine: finalCuisine, mealType });
    };

    return (
        <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{t('move_to_cookbook_title')}</Text>
                        <TouchableOpacity style={styles.closeBtn} activeOpacity={0.7} onPress={onCancel}>
                            <Text style={styles.closeBtnText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    <PickerField label={t('save_to_cookbook_label')} value={bookLabel} onPress={() => setActiveField('book')} />
                    <PickerField label={t('edit_recipe_cuisine_label')} value={cuisineLabel} onPress={() => setActiveField('cuisine')} />
                    {cuisine === CUISINE_OTHER_VALUE ? (
                        <TextInput
                            style={styles.customCuisineInput}
                            value={customCuisine}
                            onChangeText={setCustomCuisine}
                            placeholder={t('edit_recipe_cuisine_label')}
                            placeholderTextColor={colors.brown}
                        />
                    ) : null}
                    <PickerField label={t('edit_recipe_meal_label')} value={mealTypeLabel} onPress={() => setActiveField('mealType')} />

                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={[styles.saveBtn, isSaving ? styles.disabledBtn : null]}
                            activeOpacity={0.85}
                            onPress={handleSave}
                            disabled={isSaving}
                        >
                            <Text style={styles.saveBtnText}>{`${t('move_to_cookbook_save_btn').toUpperCase()} ✦`}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.cancelBtn}
                            activeOpacity={0.85}
                            onPress={onCancel}
                            disabled={isSaving}
                        >
                            <Text style={styles.cancelBtnText}>{t('cancel_btn').toUpperCase()}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <OptionsOverlay
                visible={activeField === 'book'}
                title={t('save_to_cookbook_label')}
                options={bookOptions}
                selectedValue={bookId}
                onSelect={(v) => { setBookId(v); setActiveField(null); }}
                onClose={() => setActiveField(null)}
            />
            <OptionsOverlay
                visible={activeField === 'cuisine'}
                title={t('edit_recipe_cuisine_label')}
                options={cuisineOptions}
                selectedValue={cuisine}
                onSelect={(v) => { setCuisine(v); setActiveField(null); }}
                onClose={() => setActiveField(null)}
            />
            <OptionsOverlay
                visible={activeField === 'mealType'}
                title={t('edit_recipe_meal_label')}
                options={mealTypeOptions}
                selectedValue={mealType}
                onSelect={(v) => { setMealType(v); setActiveField(null); }}
                onClose={() => setActiveField(null)}
            />
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(26,14,5,0.45)',
    },
    card: {
        backgroundColor: colors.parch,
        borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl,
        paddingHorizontal: 20,
        paddingTop: 22,
        paddingBottom: 34,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 16,
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    title: {
        color: colors.ink,
        fontFamily: 'Playfair-Bold',
        fontSize: 20,
    },
    closeBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: colors.paper,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtnText: {
        color: colors.brown,
        fontSize: 16,
        lineHeight: 18,
    },
    fieldGroup: {
        marginBottom: 18,
    },
    fieldLabel: {
        color: colors.brown,
        fontFamily: 'Jost-Bold',
        fontSize: 11,
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    fieldInput: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: '#FFFFFF',
        borderRadius: radius.sm,
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    fieldValue: {
        flex: 1,
        color: colors.ink,
        fontFamily: 'Jost-Medium',
        fontSize: 15,
    },
    fieldChevron: {
        color: colors.brown,
        fontSize: 16,
        marginLeft: 8,
    },
    customCuisineInput: {
        marginTop: -10,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: '#FFFFFF',
        borderRadius: radius.sm,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: colors.ink,
        fontFamily: 'Jost-Medium',
        fontSize: 15,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 6,
    },
    saveBtn: {
        flex: 2,
        backgroundColor: colors.forest,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    saveBtnText: {
        color: colors.onFern,
        fontFamily: 'Jost-Bold',
        fontSize: 13,
        letterSpacing: 0.5,
    },
    cancelBtn: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    cancelBtnText: {
        color: colors.brown,
        fontFamily: 'Jost-Bold',
        fontSize: 13,
        letterSpacing: 0.5,
    },
    disabledBtn: {
        opacity: 0.6,
    },
    overlayBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(26,14,5,0.55)',
        justifyContent: 'center',
        paddingHorizontal: 30,
    },
    overlaySheet: {
        maxHeight: '70%',
        backgroundColor: colors.parch,
        borderRadius: radius.lg,
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 8,
    },
    overlayTitle: {
        color: colors.ink,
        fontFamily: 'Playfair-Bold',
        fontSize: 16,
        marginBottom: 10,
    },
    overlayList: {
        marginBottom: 8,
    },
    overlayRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    overlayRowText: {
        flex: 1,
        color: colors.ink,
        fontFamily: 'Jost-Medium',
        fontSize: 15,
    },
    overlayCheck: {
        color: colors.forest,
        fontFamily: 'Jost-Bold',
        fontSize: 16,
        marginLeft: 10,
    },
});
