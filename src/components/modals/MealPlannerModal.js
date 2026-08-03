import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { colors } from '../../constants/tokens';
import useLanguage from '../../hooks/useLanguage';
import { useTour } from '../../services/TourContext';
import useEntitlement from '../../hooks/useEntitlement';
import { TIERS } from '../../constants/tiers';
import UpgradeGateModal from '../UpgradeGateModal';
import MealPlannerPreferencesScreen from '../MealPlannerPreferencesScreen';
import MealPlannerRecipeDetailView from '../MealPlannerRecipeDetailView';
import MealPlannerShoppingListView from '../MealPlannerShoppingListView';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SHEET_PADDING = 18;
// The day pager bleeds out to full screen width (see dayPagerBleed's negative
// margin canceling scrollContent's padding), so each page must be exactly
// SCREEN_WIDTH too — a narrower page here was leaving a sliver of the next
// day's card visible after each swipe.
const PAGE_WIDTH = SCREEN_WIDTH;

function MealCard({ meal, onPress }) {
    const { t } = useLanguage();
    return (
        <TouchableOpacity style={styles.mealCard} activeOpacity={0.85} onPress={() => onPress(meal)}>
            <View style={styles.mealCardTopRow}>
                <Text style={styles.mealSlotLabel}>{meal.slot?.toUpperCase()}</Text>
                <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>{`✦ ${t('meal_planner_ai_badge')}`}</Text>
                </View>
            </View>

            <View style={styles.mealTitleRow}>
                <Text style={styles.mealEmoji}>{meal.emoji}</Text>
                <Text style={styles.mealTitle} numberOfLines={2}>{meal.title}</Text>
                <Text style={styles.mealChevron}>{'→'}</Text>
            </View>

            <Text style={styles.mealMeta}>
                {[meal.cuisine, meal.time, meal.difficulty].filter(Boolean).join(' · ')}
            </Text>
        </TouchableOpacity>
    );
}

export default function MealPlannerModal({
    visible,
    onClose,
    isLoading,
    isGenerating,
    days,
    savedRecipesCount,
    onSelectMeal,
    onGenerate,
    onOpenShoppingList,
    shoppingListGroups,
    isLoadingShoppingList,
    onShopWithFern,
    isSavingShoppingList,
    selectedMeal,
    onCloseMealDetail,
    onSwapMeal,
    isSwapping,
}) {
    const { t } = useLanguage();
    const { maybeAutoStart } = useTour();
    const { hasAccess } = useEntitlement();
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [showPreferences, setShowPreferences] = useState(false);
    const [showShoppingList, setShowShoppingList] = useState(false);
    const dayScrollRef = useRef(null);

    useEffect(() => {
        if (visible) maybeAutoStart('meal_planner');
    }, [visible]);

    useEffect(() => {
        if (visible) setSelectedDayIndex(0);
    }, [visible, days]);

    useEffect(() => {
        if (!visible) {
            setShowPreferences(false);
            setShowShoppingList(false);
        }
    }, [visible]);

    if (visible && !hasAccess(TIERS.PRO)) {
        return <UpgradeGateModal visible={visible} onClose={onClose} tier={TIERS.PRO} />;
    }

    const goToDay = (index) => {
        const clamped = Math.max(0, Math.min(index, days.length - 1));
        setSelectedDayIndex(clamped);
        dayScrollRef.current?.scrollTo({ x: clamped * PAGE_WIDTH, animated: true });
    };

    const handleGeneratePress = async (preferences) => {
        const success = await onGenerate(preferences);
        if (success) setShowPreferences(false);
    };

    return (
        <Modal
            transparent
            animationType="slide"
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.topBar}>
                        <Text style={styles.title}>{`🗓️ ${t('meal_planner_title')}`}</Text>
                        <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
                            <Text style={styles.closeText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    {isLoading ? (
                        <View style={styles.loadingState}>
                            <Text style={styles.loadingEmoji}>🗒️</Text>
                            <Text style={styles.loadingText}>{t('meal_planner_loading')}</Text>
                            <ActivityIndicator color={colors.forest} style={styles.loadingSpinner} />
                        </View>
                    ) : isGenerating ? (
                        <View style={styles.loadingState}>
                            <Text style={styles.loadingEmoji}>✨</Text>
                            <Text style={styles.loadingText}>{t('meal_planner_generating')}</Text>
                            <ActivityIndicator color={colors.forest} style={styles.loadingSpinner} />
                        </View>
                    ) : selectedMeal ? (
                        <MealPlannerRecipeDetailView
                            meal={selectedMeal}
                            onBack={onCloseMealDetail}
                            onSwap={onSwapMeal}
                            isSwapping={isSwapping}
                        />
                    ) : showShoppingList ? (
                        <MealPlannerShoppingListView
                            groups={shoppingListGroups}
                            isLoading={isLoadingShoppingList}
                            onBack={() => setShowShoppingList(false)}
                            onShopWithFern={onShopWithFern}
                            isSaving={isSavingShoppingList}
                        />
                    ) : showPreferences ? (
                        <View style={styles.preferencesWrap}>
                            <MealPlannerPreferencesScreen
                                savedRecipesCount={savedRecipesCount}
                                onBack={() => setShowPreferences(false)}
                                onGenerate={handleGeneratePress}
                            />
                        </View>
                    ) : !days.length ? (
                        <View style={styles.loadingState}>
                            <Text style={styles.loadingEmoji}>🗒️</Text>
                            <Text style={styles.loadingText}>{t('meal_planner_empty')}</Text>
                        </View>
                    ) : (
                        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                            <View style={styles.actionsRow}>
                                <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.85} onPress={() => setShowPreferences(true)}>
                                    <Text style={styles.secondaryBtnText}>{`⚙️ ${t('meal_planner_preferences_btn')}`}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.shoppingBtn}
                                    activeOpacity={0.85}
                                    onPress={() => {
                                        setShowShoppingList(true);
                                        onOpenShoppingList();
                                    }}
                                >
                                    <Text style={styles.shoppingBtnText}>{`🛒 ${t('meal_planner_shopping_list_btn')}`}</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={styles.regenerateBtn} activeOpacity={0.85} onPress={() => handleGeneratePress()}>
                                <Text style={styles.regenerateBtnText}>{`↺ ${t('meal_planner_regenerate_btn')}`}</Text>
                            </TouchableOpacity>

                            <ScrollView
                                ref={dayScrollRef}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                style={styles.dayPagerBleed}
                                onMomentumScrollEnd={(e) => {
                                    const idx = Math.round(e.nativeEvent.contentOffset.x / PAGE_WIDTH);
                                    setSelectedDayIndex(Math.max(0, Math.min(idx, days.length - 1)));
                                }}
                            >
                                {days.map((day, dayIndex) => (
                                    <View key={day.id} style={[styles.dayPage, { width: PAGE_WIDTH }]}>
                                        <Text style={styles.dayLabel}>{day.dayLabel}</Text>
                                        <Text style={styles.dayCounter}>
                                            {t('meal_planner_day_of', { day: dayIndex + 1, total: days.length })}
                                        </Text>

                                        {day.meals.map((meal) => (
                                            <MealCard
                                                key={meal.id}
                                                meal={meal}
                                                onPress={(selectedMeal) => onSelectMeal(selectedMeal, day.dayLabel, dayIndex)}
                                            />
                                        ))}
                                    </View>
                                ))}
                            </ScrollView>

                            <View style={styles.dotsRow}>
                                {days.map((day, idx) => (
                                    <TouchableOpacity key={day.id} onPress={() => goToDay(idx)}>
                                        <View style={[styles.dot, idx === selectedDayIndex ? styles.dotActive : null]} />
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {days.length > 1 ? (
                                <Text style={styles.swipeHint}>{`${t('meal_planner_swipe_hint')} →`}</Text>
                            ) : null}
                        </ScrollView>
                    )}
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
        height: '90%',
        backgroundColor: '#FBF8F2',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        overflow: 'hidden',
    },
    topBar: {
        minHeight: 72,
        paddingHorizontal: SHEET_PADDING,
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
        fontSize: 20,
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
    loadingState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingEmoji: {
        fontSize: 46,
    },
    loadingText: {
        marginTop: 14,
        color: '#7B5E3E',
        fontFamily: 'Jost-Italic',
        fontStyle: 'italic',
        fontSize: 14,
    },
    loadingSpinner: {
        marginTop: 16,
    },
    scrollContent: {
        paddingHorizontal: SHEET_PADDING,
        paddingTop: 18,
        paddingBottom: 30,
    },
    preferencesWrap: {
        flex: 1,
        paddingHorizontal: SHEET_PADDING,
        paddingTop: 18,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    secondaryBtn: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D9CDBD',
        backgroundColor: '#FBF8F2',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    secondaryBtnText: {
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    shoppingBtn: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: 'rgb(216, 109, 51)',
        backgroundColor: '#FBF8F2',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    shoppingBtnText: {
        color: 'rgb(216, 109, 51)',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    regenerateBtn: {
        marginTop: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D9CDBD',
        backgroundColor: '#FBF8F2',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    regenerateBtnText: {
        color: '#5D4F42',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    dayPagerBleed: {
        marginTop: 20,
        marginHorizontal: -SHEET_PADDING,
    },
    dayPage: {
        paddingHorizontal: SHEET_PADDING,
    },
    dayLabel: {
        textAlign: 'center',
        color: '#2A1A11',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 26,
    },
    dayCounter: {
        marginTop: 4,
        textAlign: 'center',
        color: '#8C7A5F',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
        letterSpacing: 0.6,
    },
    mealCard: {
        marginTop: 18,
        borderWidth: 1,
        borderColor: '#E5DCCB',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
    },
    mealCardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    mealSlotLabel: {
        color: '#8C7A5F',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
        letterSpacing: 0.6,
    },
    aiBadge: {
        backgroundColor: '#F2ECE0',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    aiBadgeText: {
        color: 'rgb(216, 109, 51)',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
    },
    mealTitleRow: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    mealEmoji: {
        fontSize: 22,
    },
    mealTitle: {
        flex: 1,
        color: '#2A1A11',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 18,
    },
    mealChevron: {
        color: '#B0A08A',
        fontFamily: 'Jost-Bold',
        fontSize: 16,
    },
    mealMeta: {
        marginTop: 4,
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },
    dotsRow: {
        marginTop: 18,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#D9CDBD',
    },
    dotActive: {
        width: 18,
        backgroundColor: 'rgb(216, 109, 51)',
    },
    swipeHint: {
        marginTop: 8,
        textAlign: 'center',
        color: '#B0A08A',
        fontFamily: 'Jost-Italic',
        fontStyle: 'italic',
        fontSize: 12,
    },
});
