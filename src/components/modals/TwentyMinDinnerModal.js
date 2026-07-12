import React from 'react';
import {
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import useLanguage from '../../hooks/useLanguage';

// `value` is the literal string sent to the whats-for-dinner API's `quickPicks`
// field (backend contract, kept in English) — `labelKey` is the translated
// display text shown on the chip.
const QUICK_PICK_OPTIONS = [
    { value: 'Chicken', labelKey: 'quick_dinner_pick_chicken' },
    { value: 'Ground beef', labelKey: 'quick_dinner_pick_ground_beef' },
    { value: 'Pasta', labelKey: 'quick_dinner_pick_pasta' },
    { value: 'Rice', labelKey: 'quick_dinner_pick_rice' },
    { value: 'Eggs', labelKey: 'quick_dinner_pick_eggs' },
    { value: 'Salmon', labelKey: 'quick_dinner_pick_salmon' },
    { value: 'Shrimp', labelKey: 'quick_dinner_pick_shrimp' },
    { value: 'Tofu', labelKey: 'quick_dinner_pick_tofu' },
    { value: 'Potatoes', labelKey: 'quick_dinner_pick_potatoes' },
    { value: 'Broccoli', labelKey: 'quick_dinner_pick_broccoli' },
    { value: 'Spinach', labelKey: 'quick_dinner_pick_spinach' },
    { value: 'Tomatoes', labelKey: 'quick_dinner_pick_tomatoes' },
    { value: 'Garlic', labelKey: 'quick_dinner_pick_garlic' },
    { value: 'Onion', labelKey: 'quick_dinner_pick_onion' },
    { value: 'Canned beans', labelKey: 'quick_dinner_pick_canned_beans' },
    { value: 'Lentils', labelKey: 'quick_dinner_pick_lentils' },
];

export default function TwentyMinDinnerModal({
    visible,
    onClose,
    onAskFern,
    selectedQuickPicks,
    onToggleQuickPick,
    ingredientsInput,
    setIngredientsInput,
    isSearching,
    hasError,
    onSearch,
    onRetry,
    recipes,
    onChangeSelection,
    onViewRecipe,
    onAddToList,
}) {
    const { t } = useLanguage();
    const hasSelection = selectedQuickPicks.length > 0 || ingredientsInput.trim().length > 0;
    const showResults = recipes.length > 0 && !hasError;

    return (
        <Modal
            transparent
            animationType="slide"
            visible={visible}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.backdrop}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.sheet}>
                    <View style={styles.topBar}>
                        <Text style={styles.title}>{`⚡ ${t('quick_dinner_title')}`}</Text>
                        <TouchableOpacity style={styles.askFernBtn} activeOpacity={0.85} onPress={onAskFern}>
                            <Text style={styles.askFernText}>{t('leftover_ask_fern_btn')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
                            <Text style={styles.closeText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.scrollContent}
                    >
                        {hasError ? (
                            <View style={styles.errorState}>
                                <Text style={styles.errorEmoji}>😕</Text>
                                <Text style={styles.errorText}>{t('quick_dinner_load_failed')}</Text>
                                <TouchableOpacity style={styles.retryBtn} activeOpacity={0.85} onPress={onRetry}>
                                    <Text style={styles.retryBtnText}>{`← ${t('quick_dinner_try_again_btn')}`}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : showResults ? (
                            <View>
                                <View style={styles.resultsHeaderRow}>
                                    <Text style={styles.resultsHeading}>
                                        {t('quick_dinner_results_heading', { count: recipes.length })}
                                    </Text>
                                    <TouchableOpacity activeOpacity={0.7} onPress={onChangeSelection}>
                                        <Text style={styles.changeLink}>{`← ${t('quick_dinner_change_btn')}`}</Text>
                                    </TouchableOpacity>
                                </View>

                                {recipes.map((recipe, index) => (
                                    <View key={recipe.id || `quick-dinner-card-${index}`} style={styles.recipeCard}>
                                        {recipe.image ? (
                                            <Image source={{ uri: recipe.image }} style={styles.recipeImage} />
                                        ) : null}

                                        <View style={styles.recipeCardBody}>
                                            <Text style={styles.recipeTitle}>{recipe.title}</Text>
                                            {recipe.tagline ? (
                                                <Text style={styles.recipeTagline}>{recipe.tagline}</Text>
                                            ) : null}

                                            <View style={styles.pillRow}>
                                                <View style={styles.timePill}>
                                                    <Text style={styles.timePillText}>{`⚡ ${recipe.time}`}</Text>
                                                </View>
                                                {recipe.cuisine ? (
                                                    <View style={styles.cuisinePill}>
                                                        <Text style={styles.cuisinePillText}>{recipe.cuisine}</Text>
                                                    </View>
                                                ) : null}
                                            </View>

                                            <View style={styles.recipeActionsRow}>
                                                <TouchableOpacity
                                                    style={styles.previewBtn}
                                                    activeOpacity={0.85}
                                                    onPress={() => onViewRecipe(recipe)}
                                                >
                                                    <Text style={styles.previewBtnText}>{t('quick_dinner_preview_btn')}</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={styles.listBtn}
                                                    activeOpacity={0.85}
                                                    onPress={() => onAddToList(recipe)}
                                                >
                                                    <Text style={styles.listBtnText}>{t('quick_dinner_list_btn')}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View>
                                <Text style={styles.sectionHeading}>{t('quick_dinner_picks_heading')}</Text>

                                <View style={styles.chipGrid}>
                                    {QUICK_PICK_OPTIONS.map((option) => {
                                        const isSelected = selectedQuickPicks.includes(option.value);
                                        return (
                                            <TouchableOpacity
                                                key={option.value}
                                                style={[styles.chip, isSelected ? styles.chipSelected : null]}
                                                activeOpacity={0.85}
                                                onPress={() => onToggleQuickPick(option.value)}
                                            >
                                                <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}>{t(option.labelKey)}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                <Text style={styles.sectionHeading}>{t('quick_dinner_type_heading')}</Text>
                                <TextInput
                                    value={ingredientsInput}
                                    onChangeText={setIngredientsInput}
                                    placeholder={t('quick_dinner_input_placeholder')}
                                    placeholderTextColor="#9A8D7F"
                                    style={styles.input}
                                />

                                <Text style={styles.hintText}>
                                    {hasSelection
                                        ? t('quick_dinner_selected_prefix', {
                                            items: [
                                                ...selectedQuickPicks.map((value) => {
                                                    const match = QUICK_PICK_OPTIONS.find((option) => option.value === value);
                                                    return match ? t(match.labelKey) : value;
                                                }),
                                                ingredientsInput.trim(),
                                            ].filter(Boolean).join(', '),
                                        })
                                        : t('quick_dinner_nothing_selected')}
                                </Text>

                                <TouchableOpacity
                                    style={[styles.primaryAction, !hasSelection ? styles.primaryActionDisabled : null]}
                                    activeOpacity={0.85}
                                    onPress={onSearch}
                                    disabled={isSearching}
                                >
                                    <Text style={styles.primaryActionText}>
                                        {isSearching ? t('searching_ellipsis') : `⚡ ${t('quick_dinner_find_btn')}`}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
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
    topBar: {
        minHeight: 72,
        paddingHorizontal: 18,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#E0D4C4',
        gap: 10,
    },
    title: {
        flex: 1,
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 18,
    },
    askFernBtn: {
        backgroundColor: '#E96B1E',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    askFernText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#D6C8B4',
        backgroundColor: '#F2ECE3',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeText: {
        color: '#8C6B46',
        fontFamily: 'Jost-Bold',
        fontSize: 24,
        lineHeight: 24,
    },
    scrollContent: {
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 24,
    },
    sectionHeading: {
        marginTop: 14,
        color: '#8C6B46',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 0.6,
    },
    chipGrid: {
        marginTop: 12,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    chip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#D9CDBD',
        backgroundColor: '#F2ECE0',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    chipSelected: {
        backgroundColor: '#173E20',
        borderColor: '#173E20',
    },
    chipText: {
        color: '#2A1A11',
        fontFamily: 'Jost-SemiBold',
        fontSize: 14,
    },
    chipTextSelected: {
        color: '#F1F7F1',
    },
    input: {
        marginTop: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#174025',
        backgroundColor: '#FFFFFF',
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    hintText: {
        marginTop: 14,
        color: '#9B7E5F',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
    },
    primaryAction: {
        marginTop: 22,
        borderRadius: 14,
        backgroundColor: '#173E20',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    primaryActionDisabled: {
        opacity: 0.55,
    },
    primaryActionText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 15,
    },
    errorState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    errorEmoji: {
        fontSize: 40,
    },
    errorText: {
        marginTop: 14,
        color: '#7B5E3E',
        fontFamily: 'Jost-Medium',
        fontSize: 15,
    },
    retryBtn: {
        marginTop: 18,
        borderRadius: 12,
        backgroundColor: '#173E20',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    retryBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    resultsHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    resultsHeading: {
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 15,
    },
    changeLink: {
        color: '#7B5E3E',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
    },
    recipeCard: {
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: '#CFBEA7',
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        marginBottom: 14,
        overflow: 'hidden',
    },
    recipeImage: {
        width: 110,
        height: '100%',
        minHeight: 150,
    },
    recipeCardBody: {
        flex: 1,
        padding: 14,
    },
    recipeTitle: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 17,
        lineHeight: 21,
    },
    recipeTagline: {
        marginTop: 6,
        color: '#7B5E3E',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
        lineHeight: 17,
    },
    pillRow: {
        marginTop: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    timePill: {
        borderRadius: 8,
        backgroundColor: '#FBE7CF',
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    timePillText: {
        color: '#C05B1B',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
    },
    cuisinePill: {
        borderRadius: 8,
        backgroundColor: '#F2ECE0',
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    cuisinePillText: {
        color: '#5A4530',
        fontFamily: 'Jost-Medium',
        fontSize: 11,
    },
    recipeActionsRow: {
        marginTop: 12,
        flexDirection: 'row',
        gap: 8,
    },
    previewBtn: {
        flex: 1,
        borderRadius: 10,
        backgroundColor: '#173E20',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    previewBtnText: {
        color: '#F2F8F2',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    listBtn: {
        flex: 1,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#CFBEA7',
        backgroundColor: '#F8F5EF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    listBtnText: {
        color: '#2B2017',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
});
