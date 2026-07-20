import React, { useState } from 'react';
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
import useLanguage from '../../hooks/useLanguage';

const WEEKLY_PRESETS = [50, 75, 100, 150, 200];
const PER_PERSON_PRESETS = [3, 5, 7, 10, 15];

const BUDGET_PLANNER_PEOPLE_OPTIONS = [1, 2, 3, 4, 5, 6, 8];

export const BUDGET_PLANNER_DIETARY_OPTIONS = [
    { value: 'No restrictions', labelKey: 'budget_planner_dietary_no_restrictions' },
    { value: 'Vegetarian', labelKey: 'vegetarian' },
    { value: 'Vegan', labelKey: 'vegan' },
    { value: 'Gluten-Free', labelKey: 'gluten_free' },
    { value: 'Dairy-Free', labelKey: 'dairy_free' },
    { value: 'Low-Carb', labelKey: 'budget_planner_dietary_low_carb' },
    { value: 'Halal', labelKey: 'charcuterie_dietary_halal' },
    { value: 'Kosher', labelKey: 'budget_planner_dietary_kosher' },
];

function DinnerCard({ dinner, t, onSave, onAdd, onView, isSaved, isSaving }) {
    return (
        <TouchableOpacity style={styles.dinnerCard} activeOpacity={0.85} onPress={() => onView(dinner)}>
            {dinner.image ? (
                <Image source={{ uri: dinner.image }} style={styles.dinnerImage} />
            ) : (
                <View style={styles.dinnerImagePlaceholder}>
                    <Text style={styles.dinnerImageEmoji}>{dinner.emoji}</Text>
                </View>
            )}

            <View style={styles.dinnerBody}>
                <View style={styles.dinnerHeaderRow}>
                    <Text style={styles.dinnerDay}>{dinner.day?.toUpperCase()}</Text>
                    <View style={styles.dinnerCostPill}>
                        <Text style={styles.dinnerCostPillText}>{dinner.totalCost}</Text>
                    </View>
                </View>

                <Text style={styles.dinnerTitle} numberOfLines={2}>{`${dinner.emoji} ${dinner.title}`}</Text>

                <Text style={styles.dinnerDescription} numberOfLines={3}>{dinner.description}</Text>

                <View style={styles.dinnerActionsRow}>
                    <TouchableOpacity
                        style={[styles.dinnerSaveBtn, isSaved ? styles.dinnerSaveBtnSaved : null]}
                        activeOpacity={0.85}
                        onPress={() => onSave(dinner)}
                        disabled={isSaving || isSaved}
                    >
                        <Text style={styles.dinnerSaveBtnText}>
                            {isSaving ? t('saving_ellipsis') : isSaved ? t('budget_planner_saved_btn') : t('budget_planner_save_btn')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.dinnerAddBtn}
                        activeOpacity={0.85}
                        onPress={() => onAdd(dinner)}
                    >
                        <Text style={styles.dinnerAddBtnText}>{t('budget_planner_add_btn')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );
}

export default function BudgetPlannerModal({
    visible,
    onClose,
    step,
    onAskFern,
    budgetType,
    onSelectBudgetType,
    budgetInput,
    onChangeBudgetInput,
    onSelectPreset,
    people,
    onSelectPeople,
    dietary,
    onSelectDietary,
    onPlan,
    plan,
    onSaveDinner,
    onAddDinnerToList,
    onViewDinner,
    isDinnerSaved,
    savingDinnerKey,
    shoppingItems,
    onToggleShoppingItem,
    onRemoveShoppingItem,
    isAddingItemRowOpen,
    onToggleAddItemRow,
    newItemText,
    onChangeNewItemText,
    onConfirmAddItem,
    onReviewShoppingList,
    onNewPlan,
    confirmItems,
    onToggleConfirmItem,
    onConfirmAddToShoppingList,
    isAddingToShoppingList,
    onBackToResults,
}) {
    const { t } = useLanguage();
    const [isPeopleMenuOpen, setIsPeopleMenuOpen] = useState(false);
    const [isDietaryMenuOpen, setIsDietaryMenuOpen] = useState(false);

    const dietaryOption = BUDGET_PLANNER_DIETARY_OPTIONS.find((option) => option.value === dietary) || BUDGET_PLANNER_DIETARY_OPTIONS[0];
    const presets = budgetType === 'per_person' ? PER_PERSON_PRESETS : WEEKLY_PRESETS;

    const shoppingByCategory = [];
    const categoryOrder = [];
    (shoppingItems || []).forEach((item) => {
        if (!categoryOrder.includes(item.category)) {
            categoryOrder.push(item.category);
            shoppingByCategory.push({ category: item.category, items: [] });
        }
        shoppingByCategory.find((entry) => entry.category === item.category).items.push(item);
    });

    return (
        <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={styles.backdrop}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.sheet}>
                    <View style={styles.topBar}>
                        <Text style={styles.title} numberOfLines={3} >{`💰 ${t('tool_budget_planner')}`}</Text>
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
                        contentContainerStyle={styles.scrollContent}
                        onScrollBeginDrag={Keyboard.dismiss}
                    >
                        {step === 'loading' ? (
                            <View style={styles.loadingWrap}>
                                <Text style={styles.loadingEmoji}>💰</Text>
                                <Text style={styles.loadingTitle}>{t('budget_planner_loading_title')}</Text>
                                <Text style={styles.loadingSubtitle}>
                                    {t('budget_planner_loading_subtitle', { budget: budgetInput, people })}
                                </Text>
                                <ActivityIndicator style={styles.loadingSpinner} size="large" color="#173E20" />
                            </View>
                        ) : step === 'confirm' && confirmItems ? (
                            <View>
                                <TouchableOpacity activeOpacity={0.7} onPress={onBackToResults}>
                                    <Text style={styles.backLink}>{t('budget_planner_confirm_back')}</Text>
                                </TouchableOpacity>

                                <Text style={styles.confirmTitle}>{t('budget_planner_confirm_title')}</Text>
                                <Text style={styles.confirmSubtitle}>{t('budget_planner_confirm_subtitle')}</Text>

                                <View style={styles.confirmInfoBar}>
                                    <Text style={styles.confirmInfoText}>{t('budget_planner_confirm_info')}</Text>
                                </View>

                                {confirmItems.map((item) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={styles.confirmRow}
                                        activeOpacity={0.7}
                                        onPress={() => onToggleConfirmItem(item.id)}
                                    >
                                        <View style={[styles.confirmCircle, item.selected ? styles.confirmCircleChecked : null]}>
                                            {item.selected ? <Text style={styles.confirmCheckMark}>✓</Text> : null}
                                        </View>
                                        <Text style={[styles.confirmItemText, !item.selected ? styles.confirmItemTextCrossed : null]}>
                                            {item.text}
                                        </Text>
                                    </TouchableOpacity>
                                ))}

                                {confirmItems.length ? (
                                    <TouchableOpacity
                                        style={[styles.confirmAddBtn, isAddingToShoppingList ? styles.disabledBtn : null]}
                                        activeOpacity={0.85}
                                        onPress={onConfirmAddToShoppingList}
                                        disabled={isAddingToShoppingList}
                                    >
                                        <Text style={styles.confirmAddBtnText}>
                                            {isAddingToShoppingList ? t('adding_ellipsis') : t('budget_planner_confirm_add_btn')}
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <Text style={styles.confirmEmptyText}>{t('budget_planner_confirm_empty')}</Text>
                                )}
                            </View>
                        ) : step === 'results' && plan ? (
                            <View>
                                <View style={styles.statsRow}>
                                    <View style={styles.statTile}>
                                        <Text style={styles.statLabel}>{t('budget_planner_stat_budget')}</Text>
                                        <Text style={styles.statValue}>{`$${plan.weeklyBudget}`}</Text>
                                    </View>
                                    <View style={[styles.statTile, styles.statTileAccent]}>
                                        <Text style={[styles.statLabel, styles.statLabelAccent]}>{t('budget_planner_stat_est_cost')}</Text>
                                        <Text style={[styles.statValue, styles.statValueAccent]}>{plan.estimatedActualCost}</Text>
                                    </View>
                                    <View style={styles.statTile}>
                                        <Text style={styles.statLabel}>{t('budget_planner_stat_vs_eating_out')}</Text>
                                        <Text style={styles.statValue} numberOfLines={2}>{plan.savings}</Text>
                                    </View>
                                </View>

                                {plan.moneyTips.length ? (
                                    <View style={styles.tipsCard}>
                                        <Text style={styles.tipsTitle}>{`💡 ${t('budget_planner_money_tips_title')}`}</Text>
                                        {plan.moneyTips.map((tip, index) => (
                                            <Text key={`tip-${index}`} style={styles.tipsItem}>{`•  ${tip}`}</Text>
                                        ))}
                                    </View>
                                ) : null}

                                {plan.dealsUsed.length ? (
                                    <View style={styles.dealsCard}>
                                        <Text style={styles.dealsTitle}>{`🏷️ ${t('budget_planner_deals_used_title')}`}</Text>
                                        {plan.dealsUsed.map((deal, index) => (
                                            <Text key={`deal-${index}`} style={styles.dealsItem}>{`•  ${deal}`}</Text>
                                        ))}
                                    </View>
                                ) : null}

                                {plan.dinners.map((dinner) => (
                                    <DinnerCard
                                        key={dinner.id}
                                        dinner={dinner}
                                        t={t}
                                        onSave={onSaveDinner}
                                        onAdd={onAddDinnerToList}
                                        onView={onViewDinner}
                                        isSaved={isDinnerSaved(dinner)}
                                        isSaving={savingDinnerKey === (dinner.id || dinner.title)}
                                    />
                                ))}

                                <View style={styles.shoppingListCard}>
                                    <View style={styles.shoppingListHeaderRow}>
                                        <Text style={styles.shoppingListTitle}>{`🛒 ${t('budget_planner_shopping_list_title')}`}</Text>
                                        <TouchableOpacity style={styles.addItemBtn} activeOpacity={0.85} onPress={onToggleAddItemRow}>
                                            <Text style={styles.addItemBtnText}>{t('budget_planner_add_item_btn')}</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {isAddingItemRowOpen ? (
                                        <View style={styles.newItemRow}>
                                            <TextInput
                                                value={newItemText}
                                                onChangeText={onChangeNewItemText}
                                                placeholder={t('budget_planner_new_item_placeholder')}
                                                placeholderTextColor="#9A8D7F"
                                                style={styles.newItemInput}
                                                onSubmitEditing={onConfirmAddItem}
                                                returnKeyType="done"
                                            />
                                            <TouchableOpacity style={styles.newItemConfirmBtn} activeOpacity={0.85} onPress={onConfirmAddItem}>
                                                <Text style={styles.newItemConfirmBtnText}>{t('budget_planner_add_item_confirm')}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : null}

                                    {shoppingByCategory.map((section) => (
                                        <View key={section.category} style={styles.shoppingSection}>
                                            <Text style={styles.shoppingCategoryLabel}>{section.category.toUpperCase()}</Text>
                                            {section.items.map((item) => (
                                                <View key={item.id} style={styles.shoppingRow}>
                                                    <TouchableOpacity
                                                        style={styles.shoppingCircleWrap}
                                                        activeOpacity={0.7}
                                                        onPress={() => onToggleShoppingItem(item.id)}
                                                    >
                                                        <View style={[styles.shoppingCircle, item.haveAlready ? styles.shoppingCircleChecked : null]}>
                                                            {item.haveAlready ? <Text style={styles.shoppingCheckMark}>✓</Text> : null}
                                                        </View>
                                                        <Text style={[styles.shoppingItemText, item.haveAlready ? styles.shoppingItemTextChecked : null]}>
                                                            {item.text}
                                                        </Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity activeOpacity={0.7} onPress={() => onRemoveShoppingItem(item.id)}>
                                                        <Text style={styles.shoppingRemoveText}>×</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                        </View>
                                    ))}
                                </View>

                                <TouchableOpacity style={styles.reviewBtn} activeOpacity={0.85} onPress={onReviewShoppingList}>
                                    <Text style={styles.reviewBtnText}>{t('budget_planner_review_shopping_btn')}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.newPlanBtn} activeOpacity={0.85} onPress={onNewPlan}>
                                    <Text style={styles.newPlanBtnText}>{t('budget_planner_new_plan_btn')}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                                <Text style={styles.heroEmoji}>💰</Text>
                                <Text style={styles.heading}>{t('budget_planner_heading')}</Text>
                                <Text style={styles.subheading}>{t('budget_planner_subtitle')}</Text>

                                <View style={styles.formCard}>
                                    <Text style={styles.formLabel}>{t('budget_planner_budget_type_label')}</Text>
                                    <View style={styles.typeToggleRow}>
                                        <TouchableOpacity
                                            style={[styles.typeBtn, budgetType === 'weekly' ? styles.typeBtnActive : null]}
                                            activeOpacity={0.85}
                                            onPress={() => onSelectBudgetType('weekly')}
                                        >
                                            <Text style={[styles.typeBtnText, budgetType === 'weekly' ? styles.typeBtnTextActive : null]}>
                                                {t('budget_planner_type_weekly')}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.typeBtn, budgetType === 'per_person' ? styles.typeBtnActive : null]}
                                            activeOpacity={0.85}
                                            onPress={() => onSelectBudgetType('per_person')}
                                        >
                                            <Text style={[styles.typeBtnText, budgetType === 'per_person' ? styles.typeBtnTextActive : null]}>
                                                {t('budget_planner_type_per_person')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={styles.formLabel}>
                                        {budgetType === 'per_person'
                                            ? t('budget_planner_per_person_budget_label')
                                            : t('budget_planner_weekly_budget_label')}
                                    </Text>
                                    <View style={styles.budgetInputWrap}>
                                        <Text style={styles.budgetInputPrefix}>$</Text>
                                        <TextInput
                                            value={budgetInput}
                                            onChangeText={onChangeBudgetInput}
                                            keyboardType="number-pad"
                                            style={styles.budgetInput}
                                        />
                                    </View>

                                    <View style={styles.presetRow}>
                                        {presets.map((value) => {
                                            const isSelected = String(value) === String(budgetInput).trim();
                                            return (
                                                <TouchableOpacity
                                                    key={value}
                                                    style={[styles.presetChip, isSelected ? styles.presetChipSelected : null]}
                                                    activeOpacity={0.85}
                                                    onPress={() => onSelectPreset(value)}
                                                >
                                                    <Text style={[styles.presetChipText, isSelected ? styles.presetChipTextSelected : null]}>
                                                        {`$${value}`}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                <View style={styles.rowFieldsWrap}>
                                    <View style={styles.rowField}>
                                        <Text style={styles.formLabel}>{t('budget_planner_people_label')}</Text>
                                        <View style={styles.pickerWrapper}>
                                            <TouchableOpacity
                                                style={styles.dropdownButton}
                                                activeOpacity={0.8}
                                                onPress={() => {
                                                    setIsDietaryMenuOpen(false);
                                                    setIsPeopleMenuOpen((v) => !v);
                                                }}
                                            >
                                                <Text style={styles.dropdownText} numberOfLines={1}>
                                                    {people === 1
                                                        ? t('budget_planner_people_value_singular', { count: people })
                                                        : t('budget_planner_people_value', { count: people })}
                                                </Text>
                                                <Text style={styles.dropdownArrow}>⌄</Text>
                                            </TouchableOpacity>

                                            {isPeopleMenuOpen && (
                                                <View style={styles.dropdownMenu}>
                                                    <ScrollView style={styles.dropdownMenuScroll} nestedScrollEnabled>
                                                        {BUDGET_PLANNER_PEOPLE_OPTIONS.map((value) => (
                                                            <TouchableOpacity
                                                                key={value}
                                                                style={styles.dropdownItem}
                                                                activeOpacity={0.8}
                                                                onPress={() => {
                                                                    onSelectPeople(value);
                                                                    setIsPeopleMenuOpen(false);
                                                                }}
                                                            >
                                                                <Text style={styles.dropdownItemText}>
                                                                    {value === 1
                                                                        ? t('budget_planner_people_value_singular', { count: value })
                                                                        : t('budget_planner_people_value', { count: value })}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </ScrollView>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    <View style={styles.rowField}>
                                        <Text style={styles.formLabel}>{t('budget_planner_dietary_label')}</Text>
                                        <View style={styles.pickerWrapper}>
                                            <TouchableOpacity
                                                style={styles.dropdownButton}
                                                activeOpacity={0.8}
                                                onPress={() => {
                                                    setIsPeopleMenuOpen(false);
                                                    setIsDietaryMenuOpen((v) => !v);
                                                }}
                                            >
                                                <Text style={styles.dropdownText} numberOfLines={1}>{t(dietaryOption.labelKey)}</Text>
                                                <Text style={styles.dropdownArrow}>⌄</Text>
                                            </TouchableOpacity>

                                            {isDietaryMenuOpen && (
                                                <View style={styles.dropdownMenu}>
                                                    <ScrollView style={styles.dropdownMenuScroll} nestedScrollEnabled>
                                                        {BUDGET_PLANNER_DIETARY_OPTIONS.map((option) => (
                                                            <TouchableOpacity
                                                                key={option.value}
                                                                style={styles.dropdownItem}
                                                                activeOpacity={0.8}
                                                                onPress={() => {
                                                                    onSelectDietary(option.value);
                                                                    setIsDietaryMenuOpen(false);
                                                                }}
                                                            >
                                                                <Text style={styles.dropdownItemText}>{t(option.labelKey)}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </ScrollView>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </View>

                                <TouchableOpacity style={styles.planBtn} activeOpacity={0.85} onPress={onPlan}>
                                    <Text style={styles.planBtnText}>{t('budget_planner_plan_btn')}</Text>
                                </TouchableOpacity>
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
        height: '92%',
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
        lineHeight: 30,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 28,
    },
    disabledBtn: {
        opacity: 0.6,
    },

    // Form step
    heroEmoji: {
        textAlign: 'center',
        fontSize: 42,
    },
    heading: {
        marginTop: 12,
        textAlign: 'center',
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 20,
        lineHeight: 30,
    },
    subheading: {
        marginTop: 8,
        textAlign: 'center',
        color: '#7B5E3E',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
        lineHeight: 18,
    },
    formCard: {
        marginTop: 22,
        borderRadius: 16,
        backgroundColor: '#F1E9DA',
        padding: 16,
    },
    formLabel: {
        marginTop: 12,
        color: '#a88c6d',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 0.8,
        marginBottom: 8,
    },
    typeToggleRow: {
        flexDirection: 'row',
        gap: 10,
    },
    typeBtn: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#CFBEA7',
        backgroundColor: '#FBF8F2',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    typeBtnActive: {
        backgroundColor: '#173E20',
        borderColor: '#173E20',
    },
    typeBtnText: {
        color: '#2B2017',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    typeBtnTextActive: {
        color: '#F1F7F1',
    },
    budgetInputWrap: {
        marginTop: 4,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#CFBEA7',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
    },
    budgetInputPrefix: {
        color: '#8C7355',
        fontFamily: 'Jost-Bold',
        fontSize: 20,
        marginRight: 6,
    },
    budgetInput: {
        flex: 1,
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 22,
        paddingVertical: 8,
    },
    presetRow: {
        marginTop: 12,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    presetChip: {
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#CFBEA7',
        backgroundColor: '#FBF8F2',
        paddingHorizontal: 14,
        paddingVertical: 4,
    },
    presetChipSelected: {
        backgroundColor: '#173E20',
        borderColor: '#173E20',
    },
    presetChipText: {
        color: '#2B2017',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
    },
    presetChipTextSelected: {
        color: '#F1F7F1',
    },
    rowFieldsWrap: {
        marginTop: 0,
        flexDirection: 'row',
        gap: 14,
    },
    rowField: {
        flex: 1,
    },
    pickerWrapper: {
        position: 'relative',
    },
    dropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#CFBEA7',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    dropdownText: {
        flex: 1,
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
    },
    dropdownArrow: {
        fontSize: 20,
        color: '#8C7355',
        marginTop: -10,
    },
    dropdownMenu: {
        position: 'absolute',
        bottom: 54,
        left: 0,
        right: 0,
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
    dropdownMenuScroll: {
        maxHeight: 220,
    },
    dropdownItem: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F0E9DC',
    },
    dropdownItemText: {
        color: '#2A1A11',
        fontFamily: 'Jost-Medium',
        fontSize: 14,
    },
    planBtn: {
        marginTop: 24,
        borderRadius: 14,
        backgroundColor: '#173E20',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 17,
    },
    planBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 15,
    },

    // Loading step
    loadingWrap: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    loadingEmoji: {
        fontSize: 48,
    },
    loadingTitle: {
        marginTop: 16,
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 20,
    },
    loadingSubtitle: {
        marginTop: 8,
        color: '#8C7355',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
    },
    loadingSpinner: {
        marginTop: 22,
    },

    // Results step — stats
    statsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    statTile: {
        flex: 1,
        borderRadius: 14,
        backgroundColor: '#E9F1E7',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 6,
    },
    statTileAccent: {
        backgroundColor: '#FBEADA',
    },
    statLabel: {
        color: '#3D6B3F',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
        letterSpacing: 0.4,
    },
    statLabelAccent: {
        color: '#B4551E',
    },
    statValue: {
        marginTop: 6,
        textAlign: 'center',
        color: '#173E20',
        fontFamily: 'Playfair-Bold',
        fontSize: 16,
    },
    statValueAccent: {
        color: '#C34B1B',
    },

    // Results step — tips / deals
    tipsCard: {
        marginTop: 18,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E3C94F',
        backgroundColor: '#FDF8E4',
        padding: 16,
    },
    tipsTitle: {
        color: '#8C6B1E',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    tipsItem: {
        marginTop: 6,
        color: '#4A3B1A',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        lineHeight: 19,
    },
    dealsCard: {
        marginTop: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#CFE0CC',
        backgroundColor: '#EEF6EC',
        padding: 16,
    },
    dealsTitle: {
        color: '#2F6B2F',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    dealsItem: {
        marginTop: 6,
        color: '#2A4A2A',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        lineHeight: 19,
    },

    // Dinner cards
    dinnerCard: {
        marginTop: 16,
        flexDirection: 'row',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E3D9C6',
        backgroundColor: '#FBF8F2',
        overflow: 'hidden',
    },
    dinnerImage: {
        width: 100,
        alignSelf: 'stretch',
    },
    dinnerImagePlaceholder: {
        width: 100,
        alignSelf: 'stretch',
        backgroundColor: '#EFE6D5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dinnerImageEmoji: {
        fontSize: 32,
    },
    dinnerBody: {
        flex: 1,
        padding: 12,
    },
    dinnerHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dinnerDay: {
        color: '#8C7355',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
        letterSpacing: 0.6,
    },
    dinnerCostPill: {
        borderRadius: 999,
        backgroundColor: '#EAF2E8',
        paddingHorizontal: 9,
        paddingVertical: 3,
    },
    dinnerCostPillText: {
        color: '#173E20',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
    },
    dinnerTitle: {
        marginTop: 4,
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 15,
        lineHeight: 19,
    },
    dinnerDescription: {
        marginTop: 6,
        color: '#7B5E3E',
        fontFamily: 'Jost-Regular',
        fontSize: 12,
        lineHeight: 17,
    },
    dinnerActionsRow: {
        marginTop: 10,
        flexDirection: 'row',
        gap: 8,
    },
    dinnerSaveBtn: {
        flex: 1,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#CFBEA7',
        backgroundColor: '#F8F5EF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 9,
    },
    dinnerSaveBtnSaved: {
        opacity: 0.7,
    },
    dinnerSaveBtnText: {
        color: '#2B2017',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
    },
    dinnerAddBtn: {
        flex: 1,
        borderRadius: 10,
        backgroundColor: '#173E20',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 9,
    },
    dinnerAddBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
    },

    // Shopping list card
    shoppingListCard: {
        marginTop: 22,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E3D9C6',
        backgroundColor: '#FFFFFF',
        padding: 16,
    },
    shoppingListHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    shoppingListTitle: {
        color: '#173E20',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        letterSpacing: 0.4,
    },
    addItemBtn: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#CFE0CC',
        backgroundColor: '#EAF2E8',
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    addItemBtnText: {
        color: '#173E20',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    newItemRow: {
        marginTop: 12,
        flexDirection: 'row',
        gap: 8,
    },
    newItemInput: {
        flex: 1,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#CFBEA7',
        backgroundColor: '#FBF8F2',
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    newItemConfirmBtn: {
        borderRadius: 10,
        backgroundColor: '#173E20',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    newItemConfirmBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    shoppingSection: {
        marginTop: 16,
    },
    shoppingCategoryLabel: {
        color: '#2F6B2F',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
        letterSpacing: 0.6,
        marginBottom: 8,
    },
    shoppingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F0E9DC',
    },
    shoppingCircleWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    shoppingCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: '#CFBEA7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shoppingCircleChecked: {
        backgroundColor: '#173E20',
        borderColor: '#173E20',
    },
    shoppingCheckMark: {
        color: '#F1F7F1',
        fontSize: 12,
        fontFamily: 'Jost-Bold',
    },
    shoppingItemText: {
        flex: 1,
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
    },
    shoppingItemTextChecked: {
        color: '#A99C88',
        textDecorationLine: 'line-through',
    },
    shoppingRemoveText: {
        color: '#C97B6F',
        fontSize: 16,
        fontFamily: 'Jost-Bold',
        paddingHorizontal: 6,
    },

    reviewBtn: {
        marginTop: 20,
        borderRadius: 14,
        backgroundColor: '#173E20',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    reviewBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    newPlanBtn: {
        marginTop: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#CFBEA7',
        backgroundColor: '#F8F5EF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
    },
    newPlanBtnText: {
        color: '#7B5E3E',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },

    // Confirm step
    backLink: {
        color: '#8C6B46',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    confirmTitle: {
        marginTop: 14,
        color: '#173E20',
        fontFamily: 'Playfair-Bold',
        fontSize: 22,
    },
    confirmSubtitle: {
        marginTop: 2,
        color: '#8C7355',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
    },
    confirmInfoBar: {
        marginTop: 16,
        borderRadius: 10,
        backgroundColor: '#F1E9DA',
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    confirmInfoText: {
        color: '#7B5E3E',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },
    confirmRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0E9DC',
    },
    confirmCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#CFBEA7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmCircleChecked: {
        backgroundColor: '#173E20',
        borderColor: '#173E20',
    },
    confirmCheckMark: {
        color: '#F1F7F1',
        fontSize: 14,
        fontFamily: 'Jost-Bold',
    },
    confirmItemText: {
        flex: 1,
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
    },
    confirmItemTextCrossed: {
        color: '#A99C88',
        textDecorationLine: 'line-through',
    },
    confirmAddBtn: {
        marginTop: 22,
        borderRadius: 14,
        backgroundColor: '#173E20',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 17,
    },
    confirmAddBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    confirmEmptyText: {
        marginTop: 22,
        textAlign: 'center',
        color: '#8C7355',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
    },
});
