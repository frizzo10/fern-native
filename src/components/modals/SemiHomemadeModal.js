import React, { useEffect } from 'react';
import {
    ActivityIndicator,
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
    View,
} from 'react-native';
import { colors } from '../../constants/tokens';
import useLanguage from '../../hooks/useLanguage';
import { useTour } from '../../services/TourContext';
import useEntitlement from '../../hooks/useEntitlement';
import { TIERS } from '../../constants/tiers';
import UpgradeGateModal from '../UpgradeGateModal';

// `value` is the literal string sent to the semi-homemade API's `items`
// field (backend contract, kept in English, emoji included) — `labelKey` is
// the translated display text shown on the chip.
const SEMI_HOMEMADE_SHORTCUTS = [
    { value: '🍗 Rotisserie chicken', labelKey: 'semi_homemade_shortcut_rotisserie_chicken' },
    { value: '🥫 Jarred marinara sauce', labelKey: 'semi_homemade_shortcut_jarred_marinara' },
    { value: '🍝 Dried pasta', labelKey: 'semi_homemade_shortcut_dried_pasta' },
    { value: '🧊 Frozen gnocchi', labelKey: 'semi_homemade_shortcut_frozen_gnocchi' },
    { value: '🥟 Frozen dumplings', labelKey: 'semi_homemade_shortcut_frozen_dumplings' },
    { value: '🫓 Naan or flatbread', labelKey: 'semi_homemade_shortcut_naan_flatbread' },
    { value: '🥗 Bagged salad greens', labelKey: 'semi_homemade_shortcut_bagged_salad' },
    { value: '🌯 Flour tortillas', labelKey: 'semi_homemade_shortcut_flour_tortillas' },
    { value: '🫘 Canned black beans', labelKey: 'semi_homemade_shortcut_canned_black_beans' },
    { value: '🥥 Canned coconut milk', labelKey: 'semi_homemade_shortcut_canned_coconut_milk' },
    { value: '🍚 Pre-cooked rice', labelKey: 'semi_homemade_shortcut_precooked_rice' },
    { value: '🧀 Shredded cheese', labelKey: 'semi_homemade_shortcut_shredded_cheese' },
    { value: '🍟 Frozen fries', labelKey: 'semi_homemade_shortcut_frozen_fries' },
    { value: '🥫 Refried beans', labelKey: 'semi_homemade_shortcut_refried_beans' },
    { value: '🍜 Instant ramen', labelKey: 'semi_homemade_shortcut_instant_ramen' },
    { value: '🌿 Pesto', labelKey: 'semi_homemade_shortcut_pesto' },
    { value: '🍅 Salsa', labelKey: 'semi_homemade_shortcut_salsa' },
    { value: '🍕 Pre-made pizza crust', labelKey: 'semi_homemade_shortcut_pizza_crust' },
];

const SEMI_HOMEMADE_SERVINGS_OPTIONS = [2, 4, 6, 8];

export default function SemiHomemadeModal({
    visible,
    onClose,
    onAskFern,
    selectedShortcuts,
    onToggleShortcut,
    customItems,
    customItemInput,
    setCustomItemInput,
    onAddCustomItem,
    onRemoveCustomItem,
    vibeInput,
    setVibeInput,
    servings,
    setServings,
    isDesigning,
    result,
    onDesign,
    onTryAgain,
    isSaving,
    isSaved,
    onSaveRecipe,
    isAddingToList,
    onAddToList,
}) {
    const { t } = useLanguage();
    const { maybeAutoStart } = useTour();
    const { hasAccess } = useEntitlement();

    useEffect(() => {
        if (visible) maybeAutoStart('semi_homemade');
    }, [visible]);

    if (visible && !hasAccess(TIERS.PRO)) {
        return <UpgradeGateModal visible={visible} onClose={onClose} tier={TIERS.PRO} />;
    }

    const hasSelection = selectedShortcuts.length > 0 || customItems.length > 0;

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
                <View style={styles.sheet}>
                    <View style={styles.topBar}>
                        <Text style={styles.title}>{`🛒 ${t('semi_homemade_title')}`}</Text>
                        <TouchableOpacity style={styles.askFernBtn} activeOpacity={0.85} onPress={onAskFern}>
                            <Text style={styles.askFernText}>{t('leftover_ask_fern_btn')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
                            <Text style={styles.closeText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.scrollView}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        onScrollBeginDrag={Keyboard.dismiss}
                        contentContainerStyle={styles.scrollContent}
                    >
                            {isDesigning ? (
                                <View style={styles.loadingState}>
                                    <Text style={styles.loadingEmoji}>🥫</Text>
                                    <Text style={styles.loadingTitle}>{t('semi_homemade_designing_title')}</Text>
                                    <Text style={styles.loadingSubtitle}>{t('semi_homemade_designing_subtitle')}</Text>
                                    <ActivityIndicator color={colors.forest} style={styles.loadingSpinner} />
                                </View>
                            ) : result ? (
                                <View>
                                    <View style={styles.resultHeroCard}>
                                        <Text style={styles.resultKicker}>{t('semi_homemade_kicker')}</Text>
                                        <Text style={styles.resultTitle}>{`${result.emoji} ${result.title}`}</Text>
                                        {result.tagline ? <Text style={styles.resultTagline}>{result.tagline}</Text> : null}
                                        <View style={styles.resultMetaRow}>
                                            {result.time ? <Text style={styles.resultMetaText}>{`⏱ ${result.time}`}</Text> : null}
                                            {result.difficulty ? <Text style={styles.resultMetaText}>{`🎯 ${result.difficulty}`}</Text> : null}
                                            <Text style={styles.resultMetaText}>{`🍽 ${t('semi_homemade_serves_label', { count: result.servings })}`}</Text>
                                        </View>
                                    </View>

                                    {result.image ? (
                                        <Image source={{ uri: result.image }} style={styles.resultImage} />
                                    ) : null}

                                    {result.ingredients.length ? (
                                        <View style={styles.card}>
                                            <Text style={styles.cardHeader}>{`🛒 ${t('ingredients_title')}`}</Text>
                                            {result.ingredients.map((ingredient, index) => (
                                                <View key={`ingredient-${index}`} style={styles.listRow}>
                                                    <Text style={styles.listRowText}>{`• ${ingredient}`}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : null}

                                    {result.storeBought.length ? (
                                        <View style={styles.calloutCardShortcut}>
                                            <Text style={styles.calloutHeaderShortcut}>{`🥫 ${t('semi_homemade_store_bought_title')}`}</Text>
                                            {result.storeBought.map((item, index) => (
                                                <View key={`store-bought-${index}`} style={styles.listRow}>
                                                    <Text style={styles.calloutText}>{item}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : null}

                                    {result.homemade.length ? (
                                        <View style={styles.calloutCardFresh}>
                                            <Text style={styles.calloutHeaderFresh}>{`🌿 ${t('semi_homemade_fresh_additions_title')}`}</Text>
                                            {result.homemade.map((item, index) => (
                                                <View key={`homemade-${index}`} style={styles.listRow}>
                                                    <Text style={styles.calloutText}>{item}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : null}

                                    {result.instructions.length ? (
                                        <View style={styles.card}>
                                            <Text style={styles.cardHeader}>{`📖 ${t('method_title')}`}</Text>
                                            {result.instructions.map((step, index) => (
                                                <View key={`step-${index}`} style={styles.stepRow}>
                                                    <View style={styles.stepBadge}>
                                                        <Text style={styles.stepBadgeText}>{index + 1}</Text>
                                                    </View>
                                                    <Text style={styles.stepText}>{step}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : null}

                                    {result.chefTip ? (
                                        <View style={styles.tipCard}>
                                            <Text style={styles.tipLabel}>{t('semi_homemade_chef_tip_label')}</Text>
                                            <Text style={styles.tipText}>{result.chefTip}</Text>
                                        </View>
                                    ) : null}

                                    <View style={styles.resultActionsRow}>
                                        <TouchableOpacity
                                            style={[styles.saveBtn, (isSaving || isSaved) ? styles.actionBtnDisabled : null]}
                                            activeOpacity={0.85}
                                            onPress={onSaveRecipe}
                                            disabled={isSaving || isSaved}
                                        >
                                            <Text style={styles.saveBtnText}>
                                                {isSaving ? t('saving_ellipsis') : isSaved ? t('results_saved_badge') : `💾 ${t('semi_homemade_save_recipe_btn')}`}
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.addListBtn, isAddingToList ? styles.actionBtnDisabled : null]}
                                            activeOpacity={0.85}
                                            onPress={onAddToList}
                                            disabled={isAddingToList}
                                        >
                                            <Text style={styles.addListBtnText}>
                                                {isAddingToList ? t('adding_ellipsis') : `🛒 ${t('semi_homemade_add_to_list_btn')}`}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity style={styles.tryAgainBtn} activeOpacity={0.85} onPress={onTryAgain}>
                                        <Text style={styles.tryAgainText}>{`← ${t('quick_dinner_try_again_btn')}`}</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View>
                                    <View style={styles.introCard}>
                                        <Text style={styles.introEmoji}>🥫</Text>
                                        <Text style={styles.introTitle}>{t('semi_homemade_intro_title')}</Text>
                                        <Text style={styles.introSubtitle}>{t('semi_homemade_intro_subtitle')}</Text>
                                    </View>

                                    <Text style={styles.sectionHeading}>{t('semi_homemade_have_heading')}</Text>
                                    <View style={styles.chipGrid}>
                                        {SEMI_HOMEMADE_SHORTCUTS.map((option) => {
                                            const isSelected = selectedShortcuts.includes(option.value);
                                            return (
                                                <TouchableOpacity
                                                    key={option.value}
                                                    style={[styles.chip, isSelected ? styles.chipSelected : null]}
                                                    activeOpacity={0.85}
                                                    onPress={() => onToggleShortcut(option.value)}
                                                >
                                                    <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}>{t(option.labelKey)}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                        {customItems.map((item) => (
                                            <TouchableOpacity
                                                key={item}
                                                style={[styles.chip, styles.chipSelected]}
                                                activeOpacity={0.85}
                                                onPress={() => onRemoveCustomItem(item)}
                                            >
                                                <Text style={[styles.chipText, styles.chipTextSelected]}>{`${item}  ×`}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <View style={styles.inputRow}>
                                        <TextInput
                                            value={customItemInput}
                                            onChangeText={setCustomItemInput}
                                            placeholder={t('semi_homemade_add_anything_placeholder')}
                                            placeholderTextColor="#9A8D7F"
                                            style={styles.input}
                                            onSubmitEditing={onAddCustomItem}
                                        />
                                        <TouchableOpacity style={styles.addBtn} activeOpacity={0.85} onPress={onAddCustomItem}>
                                            <Text style={styles.addBtnText}>{t('semi_homemade_add_btn')}</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={styles.sectionHeading}>{t('semi_homemade_mood_heading')}</Text>
                                    <TextInput
                                        value={vibeInput}
                                        onChangeText={setVibeInput}
                                        placeholder={t('semi_homemade_mood_placeholder')}
                                        placeholderTextColor="#9A8D7F"
                                        style={styles.input}
                                    />

                                    <Text style={styles.sectionHeading}>{t('semi_homemade_servings_heading')}</Text>
                                    <View style={styles.servingsRow}>
                                        {SEMI_HOMEMADE_SERVINGS_OPTIONS.map((option) => {
                                            const isSelected = servings === option;
                                            return (
                                                <TouchableOpacity
                                                    key={option}
                                                    style={[styles.servingsOption, isSelected ? styles.servingsOptionSelected : null]}
                                                    activeOpacity={0.85}
                                                    onPress={() => setServings(option)}
                                                >
                                                    <Text style={[styles.servingsOptionText, isSelected ? styles.servingsOptionTextSelected : null]}>{option}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.primaryAction, !hasSelection ? styles.primaryActionDisabled : null]}
                                        activeOpacity={0.85}
                                        onPress={onDesign}
                                        disabled={!hasSelection}
                                    >
                                        <Text style={styles.primaryActionText}>{`✨ ${t('semi_homemade_design_btn')}`}</Text>
                                    </TouchableOpacity>

                                    {!hasSelection ? (
                                        <Text style={styles.hintText}>{t('semi_homemade_pick_one_hint')}</Text>
                                    ) : null}
                                </View>
                            )}
                    </ScrollView>
                </View>
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
        height: '90%',
        backgroundColor: '#FBF8F2',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        overflow: 'hidden',
    },
    scrollView: {
        flex: 1,
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
        fontFamily: 'PlayfairDisplay-Bold',
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
        lineHeight: 30,
    },
    scrollContent: {
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 24,
    },
    introCard: {
        borderRadius: 18,
        backgroundColor: colors.forest,
        paddingHorizontal: 18,
        paddingVertical: 22,
        alignItems: 'center',
    },
    introEmoji: {
        fontSize: 32,
    },
    introTitle: {
        marginTop: 8,
        textAlign: 'center',
        color: '#F1F7F1',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 17,
        lineHeight: 22,
    },
    introSubtitle: {
        marginTop: 6,
        textAlign: 'center',
        color: '#E4EFE2',
        fontFamily: 'Jost-Medium',
        fontSize: 11,
        lineHeight: 16,
    },
    sectionHeading: {
        marginTop: 16,
        marginBottom: 8,
        color: '#8C6B46',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
        letterSpacing: 0.6,
    },
    chipGrid: {
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
        fontSize: 12,
    },
    chipTextSelected: {
        color: '#F1F7F1',
    },
    inputRow: {
        marginTop: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    input: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#174025',
        backgroundColor: '#FFFFFF',
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    addBtn: {
        backgroundColor: '#174025',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    addBtnText: {
        color: '#EDF6EA',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    servingsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    servingsOption: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D9CDBD',
        backgroundColor: '#F2ECE0',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    servingsOptionSelected: {
        backgroundColor: '#173E20',
        borderColor: '#173E20',
    },
    servingsOptionText: {
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    servingsOptionTextSelected: {
        color: '#F1F7F1',
    },
    primaryAction: {
        marginTop: 22,
        borderRadius: 14,
        backgroundColor: colors.forest,
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
        fontSize: 13,
        letterSpacing: 0.4,
    },
    hintText: {
        marginTop: 12,
        textAlign: 'center',
        color: '#9B7E5F',
        fontFamily: 'Jost-Italic',
        fontStyle: 'italic',
        fontSize: 11,
    },
    loadingState: {
        alignItems: 'center',
        paddingVertical: 70,
    },
    loadingEmoji: {
        fontSize: 46,
    },
    loadingTitle: {
        marginTop: 14,
        textAlign: 'center',
        color: '#2A1A11',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 20,
    },
    loadingSubtitle: {
        marginTop: 8,
        textAlign: 'center',
        color: '#7B5E3E',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
    },
    loadingSpinner: {
        marginTop: 18,
    },
    resultHeroCard: {
        borderRadius: 18,
        backgroundColor: colors.forest,
        paddingHorizontal: 18,
        paddingVertical: 18,
        marginBottom: 14,
    },
    resultKicker: {
        color: '#CFE4CB',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
        letterSpacing: 2,
    },
    resultTitle: {
        marginTop: 6,
        color: '#F1F7F1',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 22,
        lineHeight: 28,
    },
    resultTagline: {
        marginTop: 6,
        color: '#E4EFE2',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
        lineHeight: 19,
    },
    resultMetaRow: {
        marginTop: 12,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    resultMetaText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    resultImage: {
        width: '100%',
        height: 200,
        borderRadius: 16,
        marginBottom: 14,
    },
    card: {
        borderWidth: 1,
        borderColor: '#E0D4C4',
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 14,
        marginBottom: 14,
    },
    cardHeader: {
        color: '#8C6B46',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 1,
        marginBottom: 8,
    },
    listRow: {
        paddingVertical: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#F0E9DD',
    },
    listRowText: {
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        lineHeight: 19,
    },
    calloutCardShortcut: {
        borderLeftWidth: 3,
        borderLeftColor: '#C05B1B',
        backgroundColor: '#FBF1E6',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 14,
    },
    calloutHeaderShortcut: {
        color: '#C05B1B',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 0.6,
        marginBottom: 6,
    },
    calloutCardFresh: {
        borderLeftWidth: 3,
        borderLeftColor: colors.forest,
        backgroundColor: '#F1F7EE',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 14,
    },
    calloutHeaderFresh: {
        color: colors.forest,
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 0.6,
        marginBottom: 6,
    },
    calloutText: {
        color: '#2A1A11',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
        lineHeight: 19,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F0E9DD',
    },
    stepBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.forest,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepBadgeText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    stepText: {
        flex: 1,
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        lineHeight: 20,
    },
    tipCard: {
        borderWidth: 1,
        borderColor: '#E2C659',
        borderRadius: 14,
        backgroundColor: '#F8F6EF',
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 16,
    },
    tipLabel: {
        color: '#8C6B46',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 0.6,
        marginBottom: 4,
    },
    tipText: {
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        lineHeight: 19,
    },
    resultActionsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    saveBtn: {
        flex: 1,
        borderRadius: 14,
        backgroundColor: colors.forest,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
    },
    saveBtnText: {
        color: '#F2F8F2',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
        textAlign: 'center',
    },
    addListBtn: {
        flex: 1,
        borderRadius: 14,
        backgroundColor: colors.forest,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
    },
    addListBtnText: {
        color: '#F2F8F2',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
        textAlign: 'center',
    },
    actionBtnDisabled: {
        opacity: 0.6,
    },
    tryAgainBtn: {
        marginTop: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#CFBEA7',
        backgroundColor: '#F8F5EF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    tryAgainText: {
        color: '#2B2017',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
});
