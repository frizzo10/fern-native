import React from 'react';
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
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { colors } from '../../constants/tokens';
import useLanguage from '../../hooks/useLanguage';

// `value` is the literal string sent to the charcuterie-board API's
// `occasion`/`dietary` fields (backend contract, kept in English) —
// `labelKey` is the translated display text shown on the chip/option.
const CHARCUTERIE_OCCASIONS = [
    { value: 'Date Night', labelKey: 'charcuterie_occasion_date_night' },
    { value: 'House Party', labelKey: 'charcuterie_occasion_house_party' },
    { value: 'Wine Tasting', labelKey: 'charcuterie_occasion_wine_tasting' },
    { value: 'Game Night', labelKey: 'charcuterie_occasion_game_night' },
    { value: 'Holiday Gathering', labelKey: 'charcuterie_occasion_holiday_gathering' },
    { value: 'Baby Shower', labelKey: 'charcuterie_occasion_baby_shower' },
    { value: 'Birthday Party', labelKey: 'charcuterie_occasion_birthday_party' },
    { value: 'Corporate Event', labelKey: 'charcuterie_occasion_corporate_event' },
    { value: 'Casual Hangout', labelKey: 'charcuterie_occasion_casual_hangout' },
    { value: 'Movie Night', labelKey: 'charcuterie_occasion_movie_night' },
];

const CHARCUTERIE_BOARD_STYLES = [
    { id: 'classic', emoji: '🧀', titleKey: 'charcuterie_style_classic_title', subtitleKey: 'charcuterie_style_classic_subtitle' },
    { id: 'italian', emoji: '🇮🇹', titleKey: 'charcuterie_style_italian_title', subtitleKey: 'charcuterie_style_italian_subtitle' },
    { id: 'french', emoji: '🇫🇷', titleKey: 'charcuterie_style_french_title', subtitleKey: 'charcuterie_style_french_subtitle' },
    { id: 'vegan', emoji: '🌱', titleKey: 'charcuterie_style_vegan_title', subtitleKey: 'charcuterie_style_vegan_subtitle' },
    { id: 'mediterranean', emoji: '🫒', titleKey: 'charcuterie_style_mediterranean_title', subtitleKey: 'charcuterie_style_mediterranean_subtitle' },
    { id: 'dessert', emoji: '🍫', titleKey: 'charcuterie_style_dessert_title', subtitleKey: 'charcuterie_style_dessert_subtitle' },
];

const CHARCUTERIE_DIETARY_OPTIONS = [
    { value: 'None', labelKey: 'charcuterie_dietary_none' },
    { value: 'Vegetarian', labelKey: 'charcuterie_dietary_vegetarian' },
    { value: 'Vegan', labelKey: 'charcuterie_dietary_vegan' },
    { value: 'GF', labelKey: 'charcuterie_dietary_gf' },
    { value: 'Halal', labelKey: 'charcuterie_dietary_halal' },
];

export default function CharcuterieModal({
    visible,
    onClose,
    charcuterieOccasion,
    setCharcuterieOccasion,
    charcuterieBoardStyle,
    setCharcuterieBoardStyle,
    charcuteriePeople,
    setCharcuteriePeople,
    charcuterieBudget,
    setCharcuterieBudget,
    charcuterieDietary,
    setCharcuterieDietary,
    isDietaryMenuOpen,
    setIsDietaryMenuOpen,
    isCharcuterieBuilding,
    charcuterieResult,
    isAddingCharcuterieToList,
    isSavingCharcuterieBoard,
    onBuild,
    onBuildAnother,
    onAddSingleShoppingItem,
    onAddAllShoppingItems,
    onSaveBoard,
    onAskFern,
}) {
    const { t } = useLanguage();
    const hasBoard = Boolean(charcuterieResult);
    const selectedDietaryOption = CHARCUTERIE_DIETARY_OPTIONS.find((option) => option.value === charcuterieDietary);
    const garnishChips = [
        ...(Array.isArray(charcuterieResult?.garnishes) ? charcuterieResult.garnishes : []),
        ...(Array.isArray(charcuterieResult?.drizzles) ? charcuterieResult.drizzles : []),
    ];

    const renderIngredientSection = (title, emoji, items) => {
        if (!Array.isArray(items) || !items.length) return null;

        return (
            <View>
                <Text style={styles.charcuterieSectionHeader}>{`${emoji} ${title}`}</Text>
                {items.map((item, index) => (
                    <View key={`${title}-${index}-${item.name}`} style={styles.charcuterieResultItemCard}>
                        <Text style={styles.charcuterieResultItemTitle}>{`${item.emoji || emoji} ${item.name}`}</Text>
                        {item.quantity ? <Text style={styles.charcuterieResultItemQty}>{item.quantity}</Text> : null}
                        {item.description ? <Text style={styles.charcuterieResultItemDesc}>{item.description}</Text> : null}
                    </View>
                ))}
            </View>
        );
    };

    return (
        <Modal
            transparent
            animationType="slide"
            visible={visible}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.charcuterieBackdrop}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.charcuterieSheet}>
                    <TouchableOpacity style={styles.charcuterieCloseBtn} activeOpacity={0.85} onPress={onClose}>
                        <Text style={styles.charcuterieCloseText}>×</Text>
                    </TouchableOpacity>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.charcuterieContentScroll}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.charcuterieTopRow}>
                            <Text style={styles.charcuterieTopTitle}>{`🧀 ${t('charcuterie_title')}`}</Text>
                        </View>

                        {hasBoard ? (
                            <View>
                                <View style={styles.charcuterieResultHeroCard}>
                                    <Text style={styles.charcuterieResultHeroKicker}>{t('charcuterie_board_kicker')}</Text>
                                    <Text style={styles.charcuterieResultHeroTitle}>{charcuterieResult.title}</Text>
                                    {charcuterieResult.tagline ? <Text style={styles.charcuterieResultHeroTagline}>{charcuterieResult.tagline}</Text> : null}
                                    <View style={styles.charcuterieResultHeroMetaRow}>
                                        <Text style={styles.charcuterieResultHeroMetaText}>{t('charcuterie_serves_label', { count: charcuterieResult.serves || charcuteriePeople })}</Text>
                                        {charcuterieResult.estimatedCost ? <Text style={styles.charcuterieResultHeroMetaText}>{`💰 ${charcuterieResult.estimatedCost}`}</Text> : null}
                                    </View>
                                </View>

                                {renderIngredientSection(t('section_meats'), '🥩', charcuterieResult.meats)}
                                {renderIngredientSection(t('section_cheeses'), '🧀', charcuterieResult.cheeses)}
                                {renderIngredientSection(t('section_accompaniments'), '🍇', charcuterieResult.accompaniments)}
                                {renderIngredientSection(t('section_crackers'), '🍞', charcuterieResult.crackers)}

                                {Array.isArray(charcuterieResult.drinks) && charcuterieResult.drinks.length ? (
                                    <View>
                                        <Text style={styles.charcuterieSectionHeader}>{t('section_drinks')}</Text>
                                        {charcuterieResult.drinks.map((drink, index) => (
                                            <View key={`drink-${index}-${drink.name}`} style={styles.charcuterieResultItemCard}>
                                                <Text style={styles.charcuterieResultItemTitle}>{`${drink.emoji || '🥤'} ${drink.name}`}</Text>
                                                {drink.why ? <Text style={styles.charcuterieResultItemDesc}>{drink.why}</Text> : null}
                                            </View>
                                        ))}
                                    </View>
                                ) : null}

                                {garnishChips.length ? (
                                    <View>
                                        <Text style={styles.charcuterieSectionHeader}>{t('section_garnishes')}</Text>
                                        <View style={styles.charcuterieGarnishWrap}>
                                            {garnishChips.map((chip, index) => (
                                                <View key={`${chip}-${index}`} style={styles.charcuterieGarnishChip}>
                                                    <Text style={styles.charcuterieGarnishChipText}>{chip}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                ) : null}

                                <View style={styles.charcuterieBoardDiagramCard}>
                                    <Text style={styles.charcuterieBoardDiagramTitle}>{t('board_diagram_title')}</Text>
                                    <Image
                                        source={require('../../../assets/boardDiagram.png')}
                                        style={styles.charcuterieBoardDiagramImage}
                                        resizeMode="contain"
                                    />
                                    {charcuterieResult.boardLayout ? <Text style={styles.charcuterieBoardDiagramText}>{charcuterieResult.boardLayout}</Text> : null}
                                </View>

                                {Array.isArray(charcuterieResult.hostTips) && charcuterieResult.hostTips.length ? (
                                    <View style={styles.charcuterieTipsCard}>
                                        <Text style={styles.charcuterieTimelineLabel}>{t('host_tips_label')}</Text>
                                        {charcuterieResult.hostTips.map((tip, index) => (
                                            <Text key={`tip-${index}`} style={styles.charcuterieTipText}>{`• ${tip}`}</Text>
                                        ))}
                                    </View>
                                ) : null}

                                {charcuterieResult.prepTimeline ? (
                                    <View style={styles.charcuterieTimelineCard}>
                                        <Text style={styles.charcuterieTimelineLabel}>{t('prep_timeline_label')}</Text>
                                        <Text style={styles.charcuterieTimelineText}>{charcuterieResult.prepTimeline}</Text>
                                    </View>
                                ) : null}

                                {Array.isArray(charcuterieResult.shoppingList) && charcuterieResult.shoppingList.length ? (
                                    <View style={styles.charcuterieShoppingCard}>
                                        <View style={styles.charcuterieShoppingHeaderRow}>
                                            <Text style={styles.charcuterieShoppingTitle}>{t('shopping_list_title')}</Text>
                                            <TouchableOpacity
                                                style={[styles.charcuterieShoppingAddAllBtn, isAddingCharcuterieToList ? styles.charcuterieActionBtnDisabled : null]}
                                                activeOpacity={0.85}
                                                onPress={onAddAllShoppingItems}
                                                disabled={isAddingCharcuterieToList}
                                            >
                                                <Text style={styles.charcuterieShoppingAddAllText}>{isAddingCharcuterieToList ? t('adding_ellipsis') : t('add_items_btn')}</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {charcuterieResult.shoppingList.map((group, groupIndex) => (
                                            <View key={`${group.category}-${groupIndex}`} style={styles.charcuterieShoppingGroup}>
                                                <Text style={styles.charcuterieShoppingGroupTitle}>{group.category}</Text>
                                                {group.items.map((item, itemIndex) => (
                                                    <View key={`${item}-${itemIndex}`} style={styles.charcuterieShoppingItemRow}>
                                                        <Text style={styles.charcuterieShoppingItemText}>{item}</Text>
                                                        {/* <TouchableOpacity
                                                            style={[styles.charcuterieShoppingAddBtn, isAddingCharcuterieToList ? styles.charcuterieActionBtnDisabled : null]}
                                                            activeOpacity={0.85}
                                                            onPress={() => onAddSingleShoppingItem(item, group.category)}
                                                            disabled={isAddingCharcuterieToList}
                                                        >
                                                            <Text style={styles.charcuterieShoppingAddBtnText}>+</Text>
                                                        </TouchableOpacity> */}
                                                    </View>
                                                ))}
                                            </View>
                                        ))}
                                    </View>
                                ) : null}

                                <View style={styles.charcuterieResultActionsRow}>
                                    <TouchableOpacity
                                        style={[styles.charcuterieSecondaryActionBtn, isSavingCharcuterieBoard ? styles.charcuterieActionBtnDisabled : null]}
                                        activeOpacity={0.85}
                                        onPress={onSaveBoard}
                                        disabled={isSavingCharcuterieBoard}
                                    >
                                        <Text style={styles.charcuterieSecondaryActionText}>{isSavingCharcuterieBoard ? t('saving_ellipsis') : t('save_btn')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.charcuteriePrimaryActionBtn, isAddingCharcuterieToList ? styles.charcuterieActionBtnDisabled : null]}
                                        activeOpacity={0.85}
                                        onPress={onAddAllShoppingItems}
                                        disabled={isAddingCharcuterieToList}
                                    >
                                        <Text style={styles.charcuteriePrimaryActionText}>{isAddingCharcuterieToList ? t('adding_ellipsis') : t('add_to_shopping_list_btn')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.charcuterieSecondaryActionBtn}
                                        activeOpacity={0.85}
                                        onPress={onBuildAnother}
                                    >
                                        <Text style={styles.charcuterieSecondaryActionText}>{t('build_another_board_btn')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View>
                                <Text style={styles.charcuterieHero}>🧀</Text>
                                <Text style={styles.charcuterieTitle}>{t('charcuterie_title')}</Text>
                                <Text style={styles.charcuterieSubtitle}>{t('charcuterie_form_subtitle')}</Text>

                                <Text style={styles.charcuterieSectionLabel}>{t('occasion_label')}</Text>
                                <View style={styles.charcuterieOccasionWrap}>
                                    {CHARCUTERIE_OCCASIONS.map((occasion) => {
                                        const selected = charcuterieOccasion === occasion.value;
                                        return (
                                            <TouchableOpacity
                                                key={occasion.value}
                                                activeOpacity={0.85}
                                                style={[styles.charcuterieChip, selected ? styles.charcuterieChipActive : null]}
                                                onPress={() => setCharcuterieOccasion(occasion.value)}
                                            >
                                                <Text style={[styles.charcuterieChipText, selected ? styles.charcuterieChipTextActive : null]}>{t(occasion.labelKey)}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                <Text style={styles.charcuterieSectionLabel}>{t('board_style_label')}</Text>
                                <View style={styles.charcuterieBoardGrid}>
                                    {CHARCUTERIE_BOARD_STYLES.map((styleItem) => {
                                        const selected = charcuterieBoardStyle === styleItem.id;
                                        return (
                                            <TouchableOpacity
                                                key={styleItem.id}
                                                activeOpacity={0.86}
                                                style={[styles.charcuterieBoardCard, selected ? styles.charcuterieBoardCardActive : null]}
                                                onPress={() => setCharcuterieBoardStyle(styleItem.id)}
                                            >
                                                <Text style={[styles.charcuterieBoardTitle, selected ? styles.charcuterieBoardTitleActive : null]}>
                                                    {`${styleItem.emoji} ${t(styleItem.titleKey)}`}
                                                </Text>
                                                <Text style={[styles.charcuterieBoardSub, selected ? styles.charcuterieBoardSubActive : null]}>
                                                    {t(styleItem.subtitleKey)}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                <View style={styles.charcuterieInputRow}>
                                    <View style={styles.charcuterieInputCol}>
                                        <Text style={styles.charcuterieSectionLabel}>{t('people_label')}</Text>
                                        <TextInput
                                            value={charcuteriePeople}
                                            onChangeText={setCharcuteriePeople}
                                            keyboardType="number-pad"
                                            placeholder={t('charcuterie_people_placeholder')}
                                            placeholderTextColor="#B5AA9B"
                                            style={styles.charcuterieInput}
                                        />
                                    </View>

                                    <View style={styles.charcuterieInputCol}>
                                        <Text style={styles.charcuterieSectionLabel}>{t('charcuterie_budget_label')}</Text>
                                        <TextInput
                                            value={`${charcuterieBudget}`}
                                            onChangeText={setCharcuterieBudget}
                                            keyboardType="number-pad"
                                            placeholder={t('charcuterie_budget_placeholder')}
                                            placeholderTextColor="#B5AA9B"
                                            style={styles.charcuterieInput}
                                        />
                                    </View>

                                    <View style={styles.charcuterieInputCol}>
                                        <Text style={styles.charcuterieSectionLabel}>{t('charcuterie_dietary_label')}</Text>
                                        <View style={styles.charcuteriePickerWrapper}>
                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                style={styles.charcuterieDropdownButton}
                                                onPress={() => setIsDietaryMenuOpen((v) => !v)}
                                            >
                                                <Text style={styles.charcuterieDropdownText}>{selectedDietaryOption ? t(selectedDietaryOption.labelKey) : charcuterieDietary}</Text>
                                                <Text style={styles.charcuterieDropdownArrow}>⌄</Text>
                                            </TouchableOpacity>

                                            {isDietaryMenuOpen && (
                                                <View style={styles.charcuterieDropdownMenu}>
                                                    {CHARCUTERIE_DIETARY_OPTIONS.map((option) => (
                                                        <TouchableOpacity
                                                            key={option.value}
                                                            style={styles.charcuterieDropdownItem}
                                                            activeOpacity={0.8}
                                                            onPress={() => {
                                                                setCharcuterieDietary(option.value);
                                                                setIsDietaryMenuOpen(false);
                                                            }}
                                                        >
                                                            <Text style={styles.charcuterieDropdownItemText}>{t(option.labelKey)}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={[styles.charcuterieBuildBtn, isCharcuterieBuilding ? styles.charcuterieActionBtnDisabled : null]}
                                    activeOpacity={0.85}
                                    onPress={onBuild}
                                    disabled={isCharcuterieBuilding}
                                >
                                    {isCharcuterieBuilding ? <ActivityIndicator color="#FFF5EB" /> : <Text style={styles.charcuterieBuildBtnText}>{t('build_my_board_btn')}</Text>}
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.charcuterieAskFernBtn} activeOpacity={0.85} onPress={onAskFern}>
                                    <Text style={styles.charcuterieAskFernText}>{t('ask_fern_walkthrough_btn')}</Text>
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
    charcuterieBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.28)',
        justifyContent: 'flex-end',
    },
    charcuterieSheet: {
        backgroundColor: '#F5F2ED',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 16,
        height: '86%',
    },
    charcuterieCloseBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 1,
        borderColor: '#C9BAA4',
        backgroundColor: '#EFE9DF',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    charcuterieCloseText: {
        color: '#8C6B46',
        fontFamily: 'Jost-Bold',
        fontSize: 26,
        lineHeight: 32,
    },
    charcuterieContentScroll: {
        paddingTop: 8,
        paddingBottom: 28,
    },
    charcuterieTopRow: {
        borderBottomWidth: 1,
        borderBottomColor: '#D6C8B4',
        marginHorizontal: -16,
        paddingHorizontal: 16,
        paddingBottom: 12,
        marginBottom: 12,
    },
    charcuterieTopTitle: {
        color: '#2A1A11',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 16,
        lineHeight: 24,
        paddingRight: 58,
    },
    charcuterieHero: {
        marginTop: 2,
        textAlign: 'center',
        fontSize: 50,
        lineHeight: 62,
    },
    charcuterieTitle: {
        marginTop: 2,
        textAlign: 'center',
        color: '#2A1A11',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 20,
        lineHeight: 40,
    },
    charcuterieSubtitle: {
        marginTop: 8,
        textAlign: 'center',
        color: '#7B5E3E',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
        lineHeight: 22,
        paddingHorizontal: 4,
    },
    charcuterieSectionLabel: {
        marginTop: 18,
        marginBottom: 8,
        color: '#7B5C3A',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 1,
    },
    charcuterieOccasionWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    charcuterieChip: {
        borderWidth: 1,
        borderColor: '#CFBFA7',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#F5F2ED',
    },
    charcuterieChipActive: {
        backgroundColor: '#1D512A',
        borderColor: '#1D512A',
    },
    charcuterieChipText: {
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
    },
    charcuterieChipTextActive: {
        color: '#F9F3E8',
    },
    charcuterieBoardGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    charcuterieBoardCard: {
        width: '48.5%',
        borderWidth: 2,
        borderColor: '#CEBFA6',
        borderRadius: 16,
        backgroundColor: '#F6F3ED',
        paddingHorizontal: 12,
        paddingVertical: 12,
        minHeight: 92,
    },
    charcuterieBoardCardActive: {
        borderColor: colors.forest,
        backgroundColor: '#EAF2E8',
    },
    charcuterieBoardTitle: {
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        lineHeight: 20,
    },
    charcuterieBoardTitleActive: {
        color: '#1D4A27',
    },
    charcuterieBoardSub: {
        marginTop: 4,
        color: '#665446',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
        lineHeight: 18,
    },
    charcuterieBoardSubActive: {
        color: '#2A5B34',
    },
    charcuterieInputRow: {
        marginTop: 4,
        flexDirection: 'row',
        gap: 10,
    },
    charcuterieInputCol: {
        flex: 1,
    },
    charcuterieInput: {
        borderWidth: 2,
        borderColor: '#CEBFA6',
        borderRadius: 14,
        backgroundColor: '#F6F3ED',
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        lineHeight: 20,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    charcuteriePickerWrapper: {
        position: 'relative',
    },
    charcuterieDropdownButton: {
        borderWidth: 2,
        borderColor: '#CEBFA6',
        borderRadius: 14,
        backgroundColor: '#F6F3ED',
        minHeight: 35,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    charcuterieDropdownText: {
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    charcuterieDropdownArrow: {
        fontSize: 20,
        color: '#6D563F',
        marginTop: -10,
    },
    charcuterieDropdownMenu: {
        position: 'absolute',
        bottom: 58,
        backgroundColor: '#FFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        overflow: 'hidden',
        zIndex: 9999,
        elevation: 10,
        shadowColor: '#181717',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: {
            width: 0,
            height: 2,
        },
    },
    charcuterieDropdownItem: {
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    charcuterieDropdownItemText: {
        color: '#2A1A11',
        fontFamily: 'Jost-Medium',
        fontSize: 15,
    },
    charcuterieBuildBtn: {
        marginTop: 18,
        backgroundColor: '#5A2F16',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    charcuterieBuildBtnText: {
        color: '#FFF5EB',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    charcuterieAskFernBtn: {
        marginTop: 10,
        backgroundColor: '#EC6518',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    charcuterieAskFernText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    charcuterieActionBtnDisabled: {
        opacity: 0.6,
    },
    charcuterieResultHeroCard: {
        marginTop: 8,
        borderRadius: 18,
        backgroundColor: '#7A4E2C',
        paddingHorizontal: 16,
        paddingVertical: 16,
        marginBottom: 14,
    },
    charcuterieResultHeroKicker: {
        color: '#E7D2BE',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
        letterSpacing: 2,
    },
    charcuterieResultHeroTitle: {
        marginTop: 4,
        color: '#F8ECDD',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 22,
        lineHeight: 38,
    },
    charcuterieResultHeroTagline: {
        marginTop: 4,
        color: '#F2E3CF',
        fontFamily: 'Jost-Medium',
        fontSize: 14,
        lineHeight: 24,
    },
    charcuterieResultHeroMetaRow: {
        marginTop: 10,
        flexDirection: 'row',
        gap: 14,
    },
    charcuterieResultHeroMetaText: {
        color: '#F8ECDD',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        lineHeight: 18,
        paddingBottom: 12,
    },
    charcuterieSectionHeader: {
        marginTop: 16,
        marginBottom: 10,
        color: '#5E3C22',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        lineHeight: 26,
    },
    charcuterieResultItemCard: {
        borderRadius: 14,
        backgroundColor: '#ECE7DE',
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 8,
    },
    charcuterieResultItemTitle: {
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        lineHeight: 22,
    },
    charcuterieResultItemQty: {
        marginTop: 2,
        color: '#715943',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
        lineHeight: 19,
    },
    charcuterieResultItemDesc: {
        marginTop: 1,
        color: '#7A5F41',
        fontFamily: 'Jost-Italic',
        fontStyle: 'italic',
        fontSize: 12,
        lineHeight: 19,
    },
    charcuterieGarnishWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    charcuterieGarnishChip: {
        backgroundColor: '#F1E9DD',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    charcuterieGarnishChipText: {
        color: '#694A2E',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        lineHeight: 18,
    },
    charcuterieBoardDiagramCard: {
        marginTop: 14,
        borderWidth: 1,
        borderColor: '#E3CDAE',
        borderRadius: 16,
        paddingHorizontal: 10,
        paddingVertical: 10,
        backgroundColor: '#FDF9F2',
    },
    charcuterieBoardDiagramTitle: {
        color: '#5E3C22',
        fontFamily: 'Jost-Bold',
        fontSize: 17,
        lineHeight: 24,
        letterSpacing: 1,
    },
    charcuterieBoardDiagramImage: {
        width: '100%',
        height: 200,
    },
    charcuterieBoardDiagramText: {
        marginTop: 8,
        color: '#7A5F41',
        fontFamily: 'Jost-Italic',
        fontStyle: 'italic',
        fontSize: 12,
        lineHeight: 18,
    },
    charcuterieTimelineCard: {
        marginTop: 14,
        borderRadius: 14,
        backgroundColor: '#ECE7DE',
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    charcuterieTimelineLabel: {
        color: '#5E3C22',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        lineHeight: 22,
        letterSpacing: 1,
    },
    charcuterieTimelineText: {
        marginTop: 6,
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 12,
        lineHeight: 22,
    },
    charcuterieShoppingCard: {
        marginTop: 14,
        borderWidth: 1,
        borderColor: '#D2B99A',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: '#F7F5F1',
    },
    charcuterieShoppingHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    charcuterieShoppingTitle: {
        color: colors.forest,
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        lineHeight: 24,
        letterSpacing: 1,
    },
    charcuterieShoppingAddAllBtn: {
        backgroundColor: '#DDECDC',
        borderWidth: 1,
        borderColor: '#A8CCAA',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 3,
    },
    charcuterieShoppingAddAllText: {
        color: colors.bright,
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        lineHeight: 20,
    },
    charcuterieShoppingGroup: {
        marginTop: 10,
    },
    charcuterieShoppingGroupTitle: {
        color: colors.bright,
        fontFamily: 'Jost-Bold',
        fontSize: 10,
        lineHeight: 19,
        letterSpacing: 1,
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    charcuterieShoppingItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 2,
        borderBottomWidth: 1,
        borderBottomColor: '#E2D4C1',
    },
    charcuterieShoppingItemText: {
        flex: 1,
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 12,
        lineHeight: 20,
        paddingRight: 10,
    },
    charcuterieShoppingAddBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#CDBCA4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    charcuterieShoppingAddBtnText: {
        color: '#7C6245',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        lineHeight: 15,
    },
    charcuterieTipsCard: {
        marginTop: 14,
        borderWidth: 1,
        borderColor: '#E2C659',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: '#F8F6EF',
    },
    charcuterieTipText: {
        marginTop: 4,
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 12,
        lineHeight: 20,
    },
    charcuterieResultActionsRow: {
        marginTop: 16,
        gap: 10,
    },
    charcuterieSecondaryActionBtn: {
        borderWidth: 1,
        borderColor: '#CEBFA6',
        borderRadius: 14,
        backgroundColor: '#F1ECE4',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    charcuterieSecondaryActionText: {
        color: '#7D5B38',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },
    charcuteriePrimaryActionBtn: {
        backgroundColor: '#1D512A',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    charcuteriePrimaryActionText: {
        color: '#F3F9ED',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        paddingHorizontal: 8,
    },
});
