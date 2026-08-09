import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors, shadow } from '../constants/tokens';
import { useSync } from '../hooks/useSync';
import useLanguage from '../hooks/useLanguage';
import { useTour } from '../services/TourContext';
import useEntitlement from '../hooks/useEntitlement';
import { TIERS } from '../constants/tiers';
import UpgradeGateModal from '../components/UpgradeGateModal';
import FamilyVoiceExampleScreen from '../components/FamilyVoiceExampleScreen';
import RecipeDetailModal from '../components/RecipeDetailModal';
import FamilyAddSavedMealModal from '../components/modals/FamilyAddSavedMealModal';
import FamilyAddActivityModal from '../components/modals/FamilyAddActivityModal';
import { useAiRecipeCollection } from '../hooks/useAiRecipeCollection';
import { fetchMealPlanRecipeDetail, fetchDinnerIdeas } from '../services/mealPlanRecipeService';
import { fetchRecipeImage } from '../utils/recipeImage';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DAY_ABBREVIATIONS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDateKey(key) {
    const [y, m, d] = String(key || '').split('-').map(Number);
    return new Date(y || 1970, (m || 1) - 1, d || 1);
}

function dateToKey(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// A rolling 7-day window starting today — not "whatever dates happen to be in
// mealPlanLocal" (that could include stale/past dates or drift past 7 days).
// Recomputed on every render so the window itself rolls forward at midnight
// without any extra state.
function buildRollingWeekDateKeys() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return dateToKey(d);
    });
}

function normalizeSlot(entry) {
    return String(entry?.slot || '').trim().toLowerCase();
}

// "Sun 9" — title-case weekday abbreviation + day number, matching the shape
// activities are stored/displayed with (`rv4_activities`'s `day` field).
function formatDayLabel(dateKey) {
    const date = parseDateKey(dateKey);
    const abbrev = DAY_ABBREVIATIONS[date.getDay()];
    const titleCased = abbrev.charAt(0) + abbrev.slice(1).toLowerCase();
    return `${titleCased} ${date.getDate()}`;
}

export default function FamilyScreen({ user }) {
    const { t, locale } = useLanguage();
    const { data, pull, pushAllFromStorage, pushChangedFromStorage } = useSync(user);
    const { maybeAutoStart, tourKey: activeTourKey, stepIndex: activeTourStepIndex } = useTour();
    const { hasAccess } = useEntitlement();
    const mealPlanRecipes = useAiRecipeCollection({ source: 'family_meal_plan', data, pushAllFromStorage, pull, t, token: user?.token });

    const [mealPlanLocal, setMealPlanLocal] = useState({});
    const [activitiesLocal, setActivitiesLocal] = useState([]);
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [showExampleView, setShowExampleView] = useState(false);
    const [isLoadingMealRecipe, setIsLoadingMealRecipe] = useState(false);
    const [isFillingWeek, setIsFillingWeek] = useState(false);
    const [addMealModal, setAddMealModal] = useState(null); // { dateKey, slot, slotLabel } | null
    const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
    const dayScrollRef = useRef(null);
    const imageFetchInFlight = useRef(new Set());
    const pageScrollRef = useRef(null);
    const sectionY = useRef({});

    // "family_hub" tour step -> scroll target. Steps 1 and 6 talk about the
    // week/mic generally (top); step 2 is about tapping an empty meal slot
    // (mealCards); steps 3-4 are about the AI Fill Week / shopping-list
    // actions (actionsRow); step 5 is the Add Activity button.
    const FAMILY_HUB_TOUR_STEP_TARGETS = ['top', 'mealCards', 'actionsRow', 'actionsRow', 'addActivity', 'top'];

    // Always today → today+6, regardless of what's actually populated in
    // mealPlanLocal — this is what makes "yesterday" naturally fall off the
    // strip (and out of the dinners/unplanned stats) once the date rolls over.
    // Recomputed every render (cheap) rather than memoized, so it stays
    // correct even in a session left open across midnight.
    const dateKeys = buildRollingWeekDateKeys();

    useEffect(() => {
        setMealPlanLocal(data.mealPlan || {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.mealPlan]);

    useEffect(() => {
        setActivitiesLocal(Array.isArray(data.activities) ? data.activities : []);
    }, [data.activities]);

    useEffect(() => {
        setSelectedDayIndex((current) => Math.min(current, Math.max(0, dateKeys.length - 1)));
    }, [dateKeys.length]);

    useFocusEffect(
        useMemo(() => () => {
            pull();
        }, [pull])
    );

    useEffect(() => {
        maybeAutoStart('family_hub');
    }, []);

    useEffect(() => {
        if (activeTourKey !== 'family_hub') return;
        const target = FAMILY_HUB_TOUR_STEP_TARGETS[activeTourStepIndex] || 'top';
        const y = target === 'top' ? 0 : (sectionY.current[target] ?? 0);
        pageScrollRef.current?.scrollTo({ y, animated: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTourKey, activeTourStepIndex]);

    const navigation = useNavigation();

    const goToDay = (index) => {
        const clamped = Math.max(0, Math.min(index, dateKeys.length - 1));
        setSelectedDayIndex(clamped);
        dayScrollRef.current?.scrollTo({ x: clamped * SCREEN_WIDTH, animated: true });
    };

    const dinnersPlannedCount = dateKeys.filter((key) => (
        (mealPlanLocal[key] || []).some((entry) => normalizeSlot(entry) === 'dinner')
    )).length;
    const unplannedDinners = dateKeys.length - dinnersPlannedCount;
    const shoppingCount = (data.shopping || []).length;
    const isFullWeekPlanned = dateKeys.length > 0 && dinnersPlannedCount === dateKeys.length;

    const selectedDateKey = dateKeys[selectedDayIndex];
    const selectedDayMeals = mealPlanLocal[selectedDateKey] || [];
    const breakfastEntries = selectedDayMeals.filter((entry) => normalizeSlot(entry) === 'breakfast');
    const lunchEntries = selectedDayMeals.filter((entry) => normalizeSlot(entry) === 'lunch');
    const dinnerEntries = selectedDayMeals.filter((entry) => normalizeSlot(entry) === 'dinner');
    const missingMealsCount = (breakfastEntries.length ? 0 : 1) + (lunchEntries.length ? 0 : 1) + (dinnerEntries.length ? 0 : 1);

    const dayOptions = dateKeys.map((dateKey) => ({ dateKey, label: formatDayLabel(dateKey) }));
    const activitiesThisWeek = activitiesLocal.filter((activity) => dateKeys.includes(activity?.dateKey));
    const selectedDayActivities = activitiesThisWeek.filter((activity) => activity.dateKey === selectedDateKey);

    // Real photos for the selected day's meals: render emoji first (above),
    // then fetch a photo in the background per entry and swap it in once it
    // resolves. Cached on the entry itself (`entry.image`) and pushed through
    // the normal sync path so it persists — never refetched once set.
    useEffect(() => {
        const entriesToFetch = [...breakfastEntries, ...lunchEntries, ...dinnerEntries]
            .filter((entry) => entry?.title && !entry.image);

        entriesToFetch.forEach((entry) => {
            const key = `${selectedDateKey}|${entry.slot}|${entry.title}`;
            if (imageFetchInFlight.current.has(key)) return;
            imageFetchInFlight.current.add(key);

            fetchRecipeImage(entry.title, user?.token).then((url) => {
                imageFetchInFlight.current.delete(key);
                if (!url) return;

                setMealPlanLocal((current) => {
                    const dayMeals = current[selectedDateKey] || [];
                    if (!dayMeals.includes(entry)) return current;
                    const nextDayMeals = dayMeals.map((m) => (m === entry ? { ...m, image: url } : m));
                    const next = { ...current, [selectedDateKey]: nextDayMeals };
                    AsyncStorage.setItem('rv4_meal_plan', JSON.stringify(next))
                        .then(() => pushChangedFromStorage({ meal_plan: next }))
                        .catch((e) => console.log('[family-hub] failed to persist meal image', e?.message || e));
                    return next;
                });
            });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDateKey, breakfastEntries, lunchEntries, dinnerEntries, user?.token]);

    const persistMealPlan = (nextMealPlan) => {
        setMealPlanLocal(nextMealPlan);
        AsyncStorage.setItem('rv4_meal_plan', JSON.stringify(nextMealPlan))
            .then(() => pushChangedFromStorage({ meal_plan: nextMealPlan }))
            .catch((e) => console.log('[family-hub] failed to sync meal plan', e?.message || e));
    };

    const persistActivities = (nextActivities) => {
        setActivitiesLocal(nextActivities);
        AsyncStorage.setItem('rv4_activities', JSON.stringify(nextActivities))
            .then(() => pushChangedFromStorage({ activities: nextActivities }))
            .catch((e) => console.log('[family-hub] failed to sync activities', e?.message || e));
    };

    const handleAddActivity = (activity) => {
        persistActivities([...activitiesLocal, activity]);
        setIsAddActivityOpen(false);
    };

    const handleRemoveActivity = (activity) => {
        persistActivities(activitiesLocal.filter((item) => item !== activity));
    };

    const handleRemoveMeal = (dateKey, entry) => {
        const dayMeals = mealPlanLocal[dateKey] || [];
        const nextDayMeals = dayMeals.filter((item) => item !== entry);
        persistMealPlan({ ...mealPlanLocal, [dateKey]: nextDayMeals });
    };

    const showComingSoon = (titleKey) => {
        Alert.alert(t(titleKey), t('coming_soon'));
    };

    const openAddMealModal = (dateKey, slot, slotLabel) => {
        setAddMealModal({ dateKey, slot, slotLabel });
    };

    const handleSelectSavedMealForAdd = (recipe) => {
        if (!addMealModal) return;
        const { dateKey, slot } = addMealModal;
        const dayMeals = mealPlanLocal[dateKey] || [];
        const newEntry = { slot, title: recipe.title, emoji: recipe.emoji || '🍽️', image: recipe.image || null };
        persistMealPlan({ ...mealPlanLocal, [dateKey]: [...dayMeals, newEntry] });
        setAddMealModal(null);
    };

    const handleAiFillWeek = async () => {
        const emptyDinnerDays = dateKeys.filter((key) => (
            !(mealPlanLocal[key] || []).some((entry) => normalizeSlot(entry) === 'dinner')
        ));

        if (!emptyDinnerDays.length) {
            Alert.alert(t('family_hub_ai_fill_none_title'), t('family_hub_ai_fill_none_desc'));
            return;
        }

        Alert.alert(
            t('family_hub_ai_fill_confirm_title'),
            t('family_hub_ai_fill_confirm_desc', { count: emptyDinnerDays.length }),
            [
                { text: t('cancel_btn'), style: 'cancel' },
                {
                    text: t('family_hub_ai_fill_confirm_btn'),
                    onPress: async () => {
                        setIsFillingWeek(true);
                        try {
                            const ideas = await fetchDinnerIdeas({ count: emptyDinnerDays.length, locale, token: user?.token });
                            let nextMealPlan = mealPlanLocal;
                            emptyDinnerDays.forEach((dateKey, idx) => {
                                const idea = ideas[idx];
                                if (!idea) return;
                                const dayMeals = nextMealPlan[dateKey] || [];
                                nextMealPlan = {
                                    ...nextMealPlan,
                                    [dateKey]: [...dayMeals, { slot: 'Dinner', title: idea.title, emoji: idea.emoji }],
                                };
                            });
                            persistMealPlan(nextMealPlan);
                        } catch (e) {
                            console.log('[family-hub] AI fill week failed', e?.message || e);
                            Alert.alert(t('save_failed'), t('save_error_desc'));
                        } finally {
                            setIsFillingWeek(false);
                        }
                    },
                },
            ],
        );
    };

    const handleViewMealRecipe = async (entry) => {
        if (!entry?.title || isLoadingMealRecipe) return;

        setIsLoadingMealRecipe(true);
        try {
            const recipeDetail = await fetchMealPlanRecipeDetail({ title: entry.title, locale, token: user?.token });

            await mealPlanRecipes.viewRecipe({
                id: `meal-plan-${entry.title}`,
                title: recipeDetail.title || entry.title,
                cuisine: '',
                mealType: entry.slot || 'Dinner',
                time: recipeDetail.time,
                difficulty: 'Medium',
                emoji: entry.emoji,
                description: '',
                servings: recipeDetail.servings,
                ingredients: recipeDetail.ingredients,
                instructions: recipeDetail.directions,
                image: null,
            });
        } catch (e) {
            console.log('[family-hub] failed to fetch meal recipe', e?.message || e);
            Alert.alert(t('save_failed'), t('save_error_desc'));
        } finally {
            setIsLoadingMealRecipe(false);
        }
    };

    const handlePressList = () => {
        navigation.navigate('Shopping');
    };

    if (!hasAccess(TIERS.PRO)) {
        return <UpgradeGateModal visible tier={TIERS.PRO} onClose={() => { }} />;
    }

    if (showExampleView) {
        return <FamilyVoiceExampleScreen user={user} onClose={() => setShowExampleView(false)} />;
    }

    const isSelectedMealRecipeSaved = mealPlanRecipes.selectedRecipe
        ? mealPlanRecipes.isRecipeSaved(mealPlanRecipes.selectedRecipe)
        : false;

    return (
        <>
            <ScrollView ref={pageScrollRef} style={styles.screen} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                    style={styles.hiddenToggle}
                    activeOpacity={0.6}
                    onPress={() => setShowExampleView(true)}
                >
                    <Text style={styles.hiddenToggleText}>🧪</Text>
                </TouchableOpacity>

                <Text style={styles.title}>{`🗓️ ${t('family_hub_title')}`}</Text>
                <Text style={styles.statusLine}>
                    {isFullWeekPlanned ? t('family_hub_full_week_planned') : t('family_hub_dinners_left', { count: Math.max(0, dateKeys.length - dinnersPlannedCount) })}
                </Text>

                {isLoadingMealRecipe ? (
                    <View style={styles.recipeLoadingRow}>
                        <ActivityIndicator color={colors.forest} size="small" />
                        <Text style={styles.recipeLoadingText}>{t('family_hub_loading_recipe')}</Text>
                    </View>
                ) : null}

                {isFillingWeek ? (
                    <View style={styles.recipeLoadingRow}>
                        <ActivityIndicator color={colors.forest} size="small" />
                        <Text style={styles.recipeLoadingText}>{t('family_hub_ai_filling')}</Text>
                    </View>
                ) : null}

                <View
                    style={styles.actionsRow}
                    onLayout={(e) => { sectionY.current.actionsRow = e.nativeEvent.layout.y; }}
                >
                    <TouchableOpacity
                        style={[styles.fillWeekBtn, isFillingWeek ? styles.fillWeekBtnDisabled : null]}
                        activeOpacity={0.85}
                        onPress={handleAiFillWeek}
                        disabled={isFillingWeek}
                    >
                        <Text style={styles.fillWeekBtnText}>{t('family_hub_ai_fill_week_btn')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.planFernBtn, shadow.card]} activeOpacity={0.85} onPress={() => showComingSoon('family_hub_plan_with_fern_btn')}>
                        <Text style={styles.planFernBtnText}>{t('family_hub_plan_with_fern_btn')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.listBtn} activeOpacity={0.85} onPress={handlePressList}>
                        <Text style={styles.listBtnText}>{t('family_hub_list_btn')}</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.shareBtn} activeOpacity={0.85} onPress={() => showComingSoon('family_hub_share_btn')}>
                    <Text style={styles.shareBtnText}>{t('family_hub_share_btn')}</Text>
                </TouchableOpacity>

                <View style={styles.statsRow}>
                    <View style={[styles.statCard, shadow.card]}>
                        <Text style={styles.statLabel}>{t('family_hub_stat_dinners')}</Text>
                        <Text style={styles.statValue}>{`${dinnersPlannedCount}/${dateKeys.length}`}</Text>
                    </View>
                    <View style={[styles.statCard, shadow.card]}>
                        <Text style={styles.statLabel}>{t('family_hub_stat_activities')}</Text>
                        <Text style={styles.statValue}>{activitiesThisWeek.length}</Text>
                    </View>
                    <View style={[styles.statCard, shadow.card]}>
                        <Text style={styles.statLabel}>{t('family_hub_stat_shopping')}</Text>
                        <Text style={styles.statValue}>{t('family_hub_stat_shopping_items', { count: shoppingCount })}</Text>
                    </View>
                    <View style={[styles.statCard, shadow.card]}>
                        <Text style={styles.statLabel}>{t('family_hub_stat_unplanned')}</Text>
                        <Text style={styles.statValue}>{t('family_hub_stat_unplanned_dinners', { count: unplannedDinners })}</Text>
                    </View>
                </View>

                {dateKeys.length === 0 ? (
                    <Text style={styles.emptyText}>{t('family_hub_empty_no_days')}</Text>
                ) : (
                    <>
                        <View style={styles.dayStripOuter}>
                            <ScrollView
                                ref={dayScrollRef}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                onMomentumScrollEnd={(e) => {
                                    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                                    setSelectedDayIndex(Math.max(0, Math.min(idx, dateKeys.length - 1)));
                                }}
                            >
                                {dateKeys.map((dateKey, idx) => {
                                    const date = parseDateKey(dateKey);
                                    return (
                                        <View key={dateKey} style={[styles.dayPage, { width: SCREEN_WIDTH }]}>
                                            <TouchableOpacity
                                                style={styles.dayArrowBtn}
                                                activeOpacity={0.7}
                                                disabled={idx === 0}
                                                onPress={() => goToDay(idx - 1)}
                                            >
                                                {idx > 0 ? <Text style={styles.dayArrowText}>‹</Text> : null}
                                            </TouchableOpacity>

                                            <View style={styles.dayCenter}>
                                                <Text style={styles.dayAbbrev}>{DAY_ABBREVIATIONS[date.getDay()]}</Text>
                                                <View style={styles.dayDateRow}>
                                                    <Text style={styles.dayDateNum}>{date.getDate()}</Text>
                                                    <Text style={styles.dayMonth}>{MONTH_ABBREVIATIONS[date.getMonth()]}</Text>
                                                </View>
                                            </View>

                                            <TouchableOpacity
                                                style={styles.dayArrowBtn}
                                                activeOpacity={0.7}
                                                disabled={idx === dateKeys.length - 1}
                                                onPress={() => goToDay(idx + 1)}
                                            >
                                                {idx < dateKeys.length - 1 ? <Text style={styles.dayArrowText}>›</Text> : null}
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </ScrollView>

                            <View style={styles.dotsRow}>
                                {dateKeys.map((dateKey, idx) => (
                                    <View key={dateKey} style={[styles.dot, idx === selectedDayIndex ? styles.dotActive : null]} />
                                ))}
                            </View>
                        </View>

                        <View
                            style={[styles.mealCard, !breakfastEntries.length ? styles.mealCardEmpty : null]}
                            onLayout={(e) => { sectionY.current.mealCards = e.nativeEvent.layout.y; }}
                        >
                            <View style={styles.mealIconWrap}>
                                {breakfastEntries[0]?.image ? (
                                    <Image source={{ uri: breakfastEntries[0].image }} style={styles.mealIconImage} />
                                ) : (
                                    <Text style={styles.mealIconEmoji}>{breakfastEntries[0]?.emoji || '🌅'}</Text>
                                )}
                            </View>
                            <TouchableOpacity
                                style={styles.mealInfo}
                                activeOpacity={0.7}
                                onPress={() => (breakfastEntries.length
                                    ? handleViewMealRecipe(breakfastEntries[0])
                                    : openAddMealModal(selectedDateKey, 'Breakfast', t('meal_planner_slot_breakfast')))}
                            >
                                <Text style={styles.mealSlotLabel}>{t('family_hub_breakfast_label')}</Text>
                                {breakfastEntries.length ? (
                                    <Text style={styles.mealTitle}>{breakfastEntries[0].title}</Text>
                                ) : (
                                    <Text style={styles.mealAddText}>{t('family_hub_add_breakfast')}</Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.mealActionBtn}
                                activeOpacity={0.7}
                                onPress={() => (breakfastEntries.length
                                    ? handleRemoveMeal(selectedDateKey, breakfastEntries[0])
                                    : openAddMealModal(selectedDateKey, 'Breakfast', t('meal_planner_slot_breakfast')))}
                            >
                                <Text style={styles.mealActionText}>{breakfastEntries.length ? '×' : '+'}</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.mealCard, !lunchEntries.length ? styles.mealCardEmpty : null]}>
                            <View style={styles.mealIconWrap}>
                                {lunchEntries[0]?.image ? (
                                    <Image source={{ uri: lunchEntries[0].image }} style={styles.mealIconImage} />
                                ) : (
                                    <Text style={styles.mealIconEmoji}>{lunchEntries[0]?.emoji || '☀️'}</Text>
                                )}
                            </View>
                            <TouchableOpacity
                                style={styles.mealInfo}
                                activeOpacity={0.7}
                                onPress={() => (lunchEntries.length
                                    ? handleViewMealRecipe(lunchEntries[0])
                                    : openAddMealModal(selectedDateKey, 'Lunch', t('meal_planner_slot_lunch')))}
                            >
                                <Text style={styles.mealSlotLabel}>{t('family_hub_lunch_label')}</Text>
                                {lunchEntries.length ? (
                                    <Text style={styles.mealTitle}>{lunchEntries[0].title}</Text>
                                ) : (
                                    <Text style={styles.mealAddText}>{t('family_hub_add_lunch')}</Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.mealActionBtn}
                                activeOpacity={0.7}
                                onPress={() => (lunchEntries.length
                                    ? handleRemoveMeal(selectedDateKey, lunchEntries[0])
                                    : openAddMealModal(selectedDateKey, 'Lunch', t('meal_planner_slot_lunch')))}
                            >
                                <Text style={styles.mealActionText}>{lunchEntries.length ? '×' : '+'}</Text>
                            </TouchableOpacity>
                        </View>

                        {dinnerEntries.length ? (
                            dinnerEntries.map((entry, idx) => (
                                <View key={`${selectedDateKey}-dinner-${idx}`} style={styles.mealCard}>
                                    <View style={styles.mealIconWrap}>
                                        {entry.image ? (
                                            <Image source={{ uri: entry.image }} style={styles.mealIconImage} />
                                        ) : (
                                            <Text style={styles.mealIconEmoji}>{entry.emoji || '🌙'}</Text>
                                        )}
                                    </View>
                                    <TouchableOpacity
                                        style={styles.mealInfo}
                                        activeOpacity={0.7}
                                        onPress={() => handleViewMealRecipe(entry)}
                                    >
                                        <Text style={styles.mealSlotLabel}>{t('family_hub_dinner_label')}</Text>
                                        <Text style={styles.mealTitle}>{entry.title}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.mealActionBtn}
                                        activeOpacity={0.7}
                                        onPress={() => handleRemoveMeal(selectedDateKey, entry)}
                                    >
                                        <Text style={styles.mealActionText}>×</Text>
                                    </TouchableOpacity>
                                </View>
                            ))
                        ) : (
                            <View style={[styles.mealCard, styles.mealCardEmpty]}>
                                <View style={styles.mealIconWrap}>
                                    <Text style={styles.mealIconEmoji}>🌙</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.mealInfo}
                                    activeOpacity={0.7}
                                    onPress={() => openAddMealModal(selectedDateKey, 'Dinner', t('meal_planner_slot_dinner'))}
                                >
                                    <Text style={styles.mealSlotLabel}>{t('family_hub_dinner_label')}</Text>
                                    <Text style={styles.mealAddText}>{t('family_hub_add_dinner')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.mealActionBtn}
                                    activeOpacity={0.7}
                                    onPress={() => openAddMealModal(selectedDateKey, 'Dinner', t('meal_planner_slot_dinner'))}
                                >
                                    <Text style={styles.mealActionText}>+</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {selectedDayActivities.length ? (
                            <View style={styles.activitiesSection}>
                                <Text style={styles.activitiesLabel}>{t('family_hub_activities_label')}</Text>
                                {selectedDayActivities.map((activity, idx) => (
                                    <View key={`${selectedDateKey}-activity-${idx}`} style={styles.mealCard}>
                                        <View style={styles.mealIconWrap}>
                                            <Text style={styles.mealIconEmoji}>{activity.emoji || '🗓️'}</Text>
                                        </View>
                                        <View style={styles.mealInfo}>
                                            <Text style={styles.mealTitle}>{activity.label}</Text>
                                            {activity.time ? (
                                                <Text style={styles.mealAddText}>{activity.time}</Text>
                                            ) : null}
                                        </View>
                                        <TouchableOpacity
                                            style={styles.mealActionBtn}
                                            activeOpacity={0.7}
                                            onPress={() => handleRemoveActivity(activity)}
                                        >
                                            <Text style={styles.mealActionText}>×</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        ) : null}

                        <TouchableOpacity
                            style={styles.addActivityBtn}
                            activeOpacity={0.85}
                            onPress={() => setIsAddActivityOpen(true)}
                            onLayout={(e) => { sectionY.current.addActivity = e.nativeEvent.layout.y; }}
                        >
                            <Text style={styles.addActivityText}>{t('family_hub_add_activity')}</Text>
                        </TouchableOpacity>

                        {missingMealsCount > 0 ? (
                            <View style={styles.fernBanner}>
                                <Text style={styles.fernBannerEmoji}>🌿</Text>
                                <View style={styles.fernBannerTextWrap}>
                                    <Text style={styles.fernBannerLabel}>{t('family_hub_fern_says_label')}</Text>
                                    <Text style={styles.fernBannerText}>{t('family_hub_fern_says_meals', { count: missingMealsCount })}</Text>
                                </View>
                            </View>
                        ) : null}
                    </>
                )}
            </ScrollView>

            <RecipeDetailModal
                recipe={mealPlanRecipes.selectedRecipe}
                onClose={() => mealPlanRecipes.setSelectedRecipe(null)}
                noteText={mealPlanRecipes.noteText}
                onChangeNoteText={mealPlanRecipes.setNoteText}
                isSaving={mealPlanRecipes.isSaving}
                onSaveNote={() => mealPlanRecipes.persistSelectedNote(() => { })}
                isAlreadySaved={isSelectedMealRecipeSaved}
                showSavedIndicator
                onDeleteRecipe={isSelectedMealRecipeSaved ? () => mealPlanRecipes.handleDeleteSelected(() => mealPlanRecipes.setSelectedRecipe(null)) : undefined}
                onAddToList={mealPlanRecipes.handleAddToShoppingList}
            />

            <FamilyAddSavedMealModal
                visible={Boolean(addMealModal)}
                slotLabel={addMealModal?.slotLabel}
                savedRecipes={data.recipes}
                onClose={() => setAddMealModal(null)}
                onSelect={handleSelectSavedMealForAdd}
            />

            <FamilyAddActivityModal
                visible={isAddActivityOpen}
                dayOptions={dayOptions}
                initialDateKey={selectedDateKey}
                onClose={() => setIsAddActivityOpen(false)}
                onAdd={handleAddActivity}
            />
        </>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.parch,
    },
    screenContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
    },
    hiddenToggle: {
        position: 'absolute',
        top: 8,
        right: 12,
        width: 26,
        height: 26,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.35,
    },
    hiddenToggleText: {
        fontSize: 14,
    },
    title: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 24,
    },
    statusLine: {
        marginTop: 6,
        color: colors.forest,
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    recipeLoadingRow: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    recipeLoadingText: {
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },
    actionsRow: {
        marginTop: 16,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    fillWeekBtn: {
        backgroundColor: colors.forest,
        borderRadius: 999,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    fillWeekBtnDisabled: {
        opacity: 0.6,
    },
    fillWeekBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    planFernBtn: {
        backgroundColor: 'rgb(216, 109, 51)',
        borderRadius: 999,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    planFernBtnText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    listBtn: {
        backgroundColor: '#EDE7DE',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#D4C9BA',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    listBtnText: {
        color: '#5D4F42',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    shareBtn: {
        marginTop: 10,
        alignSelf: 'flex-start',
        backgroundColor: '#FBF8F2',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#D4C9BA',
        paddingHorizontal: 16,
        paddingVertical: 11,
    },
    shareBtnText: {
        color: '#5D4F42',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    statsRow: {
        marginTop: 18,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    statCard: {
        flexBasis: '47%',
        flexGrow: 1,
        borderRadius: 14,
        backgroundColor: '#F1EEE7',
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    statLabel: {
        color: '#8C7A5F',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
        letterSpacing: 0.6,
    },
    statValue: {
        marginTop: 6,
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 20,
    },
    dayStripOuter: {
        marginTop: 24,
        marginHorizontal: -20,
    },
    dayPage: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 30,
    },
    dayArrowBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#D9CDBD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayArrowText: {
        color: '#5D4F42',
        fontFamily: 'Jost-Bold',
        fontSize: 18,
    },
    dayCenter: {
        alignItems: 'center',
    },
    dayAbbrev: {
        color: '#8C7A5F',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 1,
    },
    dayDateRow: {
        marginTop: 4,
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    dayDateNum: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 40,
    },
    dayMonth: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 18,
    },
    dotsRow: {
        marginTop: 10,
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
        backgroundColor: colors.forest,
    },
    mealCard: {
        marginTop: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: '#E5DCCB',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
    },
    mealCardEmpty: {
        borderStyle: 'dashed',
        backgroundColor: '#F1EEE7',
    },
    mealIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: '#F1EEE7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mealIconEmoji: {
        fontSize: 20,
    },
    mealIconImage: {
        width: 44,
        height: 44,
        borderRadius: 10,
    },
    mealInfo: {
        flex: 1,
    },
    mealSlotLabel: {
        color: '#8C7A5F',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
        letterSpacing: 0.6,
    },
    mealTitle: {
        marginTop: 3,
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 16,
    },
    mealAddText: {
        marginTop: 3,
        color: '#B0A08A',
        fontFamily: 'Jost-Medium',
        fontSize: 14,
    },
    mealActionBtn: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mealActionText: {
        color: '#8C7A5F',
        fontFamily: 'Jost-Bold',
        fontSize: 18,
    },
    activitiesSection: {
        marginTop: 20,
    },
    activitiesLabel: {
        color: '#8C7A5F',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
        letterSpacing: 0.6,
    },
    addActivityBtn: {
        marginTop: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#D9CDBD',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    addActivityText: {
        color: '#5D4F42',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    fernBanner: {
        marginTop: 20,
        flexDirection: 'row',
        gap: 12,
        backgroundColor: colors.forest,
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
    },
    fernBannerEmoji: {
        fontSize: 20,
    },
    fernBannerTextWrap: {
        flex: 1,
    },
    fernBannerLabel: {
        color: '#B9D6B4',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
    },
    fernBannerText: {
        marginTop: 4,
        color: '#F1F7F1',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
        lineHeight: 19,
    },
    emptyText: {
        marginTop: 40,
        textAlign: 'center',
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
    },
});
