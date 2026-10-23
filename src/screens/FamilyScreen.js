import React, { useEffect, useMemo, useRef, useState } from 'react';
import { subscribeAgentChange } from '../services/fernAgent';
import { ActivityIndicator, Alert, Animated, Dimensions, Image, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { colors, shadow } from '../constants/tokens';
import { useSync } from '../hooks/useSync';
import useLanguage from '../hooks/useLanguage';
import { useTour } from '../services/TourContext';
import useEntitlement from '../hooks/useEntitlement';
import { FEATURE_TIERS } from '../constants/featureAccess';
import UpgradeGateModal from '../components/UpgradeGateModal';
import FamilyVoiceExampleScreen from '../components/FamilyVoiceExampleScreen';
import RecipeDetailModal from '../components/RecipeDetailModal';
import FamilyAddSavedMealModal from '../components/modals/FamilyAddSavedMealModal';
import FamilyAddActivityModal from '../components/modals/FamilyAddActivityModal';
import ChatSheetModal from '../components/modals/ChatSheetModal';
import { useAiRecipeCollection } from '../hooks/useAiRecipeCollection';
import { fetchMealPlanRecipeDetail, fetchDinnerIdeas } from '../services/mealPlanRecipeService';
import { fetchRecipeImage } from '../utils/recipeImage';
import { DAY_ABBREVIATIONS, parseDateKey, buildRollingWeekDateKeys, normalizeSlot, formatDayLabel } from '../utils/familyDates';
import { FAMILY_PLAN_SYSTEM_PROMPT, FAMILY_PLAN_AUTO_OPENER } from '../constants/familyPlanPrompts';
import { onePerSlot } from '../utils/onePerSlot';
import { createPlanShareLink } from '../services/shareService';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function FamilyScreen({ user }) {
    const { t, locale } = useLanguage();
    const { data, pull, pushAllFromStorage, pushChangedFromStorage } = useSync(user);
  const agentPullRef = React.useRef(pull);
  agentPullRef.current = pull;
  React.useEffect(() => subscribeAgentChange(async () => {
    // Show what Fern just changed straight away from the phone's own copy (she saves it there first), then sync.
    try {
      const mp = JSON.parse((await AsyncStorage.getItem('rv4_meal_plan')) || '{}');
      const ac = JSON.parse((await AsyncStorage.getItem('rv4_activities')) || '[]');
      setMealPlanLocal(mp && typeof mp === 'object' ? mp : {});
      setActivitiesLocal(Array.isArray(ac) ? ac : []);
    } catch (e) { /* the pull below still runs */ }
    agentPullRef.current?.();
  }), []);
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
    const [editingActivity, setEditingActivity] = useState(null); // an existing activity being changed
    const [isPlanWithFernOpen, setIsPlanWithFernOpen] = useState(false);
    const dayScrollRef = useRef(null);
    const imageFetchInFlight = useRef(new Set());
    const pageScrollRef = useRef(null);
    const sectionY = useRef({});
    // Fern just added something: scroll it near the top and outline + pulse it for a few seconds so it is obvious.
    const [flash, setFlash] = useState(null); // { kind: 'activity'|'meal', label, slot } | null
    const pulse = useRef(new Animated.Value(0)).current;
    const flashTimer = useRef(null);

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
    const route = useRoute();

    const goToDay = (index) => {
        const clamped = Math.max(0, Math.min(index, dateKeys.length - 1));
        setSelectedDayIndex(clamped);
        dayScrollRef.current?.scrollTo({ x: clamped * SCREEN_WIDTH, animated: true });
    };

    // Deep link from Home ("Add a meal" / "Add an activity" / a tapped day): jump to
    // that day, then open the same add flow the Family Hub buttons use.
    useEffect(() => {
        const params = route?.params;
        if (!params?.addAction) return;
        const idx = Math.max(0, dateKeys.indexOf(params.addDateKey));
        goToDay(idx);
        // On a cold open the day pager may not be mounted yet; re-sync its position once it is.
        setTimeout(() => dayScrollRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: false }), 350);
        const dateKey = dateKeys[idx];
        if (params.addAction === 'activity') {
            setIsAddActivityOpen(true);
        } else if (params.addAction === 'meal') {
            Alert.alert(t('home_add_meal'), undefined, [
                { text: t('meal_planner_slot_breakfast'), onPress: () => openAddMealModal(dateKey, 'Breakfast', t('meal_planner_slot_breakfast')) },
                { text: t('meal_planner_slot_lunch'), onPress: () => openAddMealModal(dateKey, 'Lunch', t('meal_planner_slot_lunch')) },
                { text: t('meal_planner_slot_dinner'), onPress: () => openAddMealModal(dateKey, 'Dinner', t('meal_planner_slot_dinner')) },
                { text: t('cancel_btn'), style: 'cancel' },
            ]);
        }
        navigation.setParams({ addAction: undefined, addDateKey: undefined });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [route?.params?.requestKey]);

    // Fern (the leaf voice) just planned something: show that day, so the person sees it land.
    useEffect(() => {
        const off = route?.params?.showDayOffset;
        if (off == null) return;
        const idx = Math.max(0, Math.min(Number(off) || 0, dateKeys.length - 1));
        goToDay(idx);
        setTimeout(() => dayScrollRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: false }), 350);
        const kind = route?.params?.showKind;
        if (kind) {
            setFlash({ kind, label: String(route?.params?.showLabel || ''), slot: String(route?.params?.showSlot || '').toLowerCase() });
            pulse.setValue(0);
            Animated.loop(Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 450, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0.25, duration: 450, useNativeDriver: true }),
            ])).start();
            if (flashTimer.current) clearTimeout(flashTimer.current);
            flashTimer.current = setTimeout(() => { pulse.stopAnimation(); setFlash(null); }, 6000);
            // after the day has rendered, bring the new entry up near the top of the screen
            setTimeout(() => {
                const y = kind === 'activity' ? sectionY.current.activities : sectionY.current.mealCards;
                if (y != null) pageScrollRef.current?.scrollTo({ y: Math.max(0, y - 90), animated: true });
            }, 700);
        }
        navigation.setParams({ showDayOffset: undefined, showKind: undefined, showLabel: undefined, showSlot: undefined });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [route?.params?.showNonce]);
    useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);
    const ring = (on) => (on ? <Animated.View pointerEvents="none" style={[styles.flashRing, { opacity: pulse }]} /> : null);
    const flashMeal = (slot) => Boolean(flash && flash.kind === 'meal' && (!flash.slot || flash.slot === slot));

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

    const handleSaveActivity = (updated) => {
        const original = editingActivity;
        persistActivities(activitiesLocal.map((item) => (item === original ? updated : item)));
        setEditingActivity(null);
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

    // Tapping the "..." on a planned meal: change it to another saved recipe, remove it (asks first by design:
    // this menu IS the confirmation), or cancel. The picker opens ~400 ms after the Alert closes because iOS
    // drops a Modal presented while an Alert is still dismissing.
    const openMealMenu = (dateKey, entry, slot, slotLabel) => {
        Alert.alert(entry?.title || slotLabel, undefined, [
            {
                text: t('family_meal_change_btn'),
                onPress: () => setTimeout(() => setAddMealModal({ dateKey, slot, slotLabel, replace: entry }), 400),
            },
            { text: t('family_meal_remove_btn'), style: 'destructive', onPress: () => handleRemoveMeal(dateKey, entry) },
            { text: t('cancel_btn'), style: 'cancel' },
        ]);
    };

    // Applies whatever Plan-with-Fern's conversation decided to add. Mirrors
    // the day_offset (0-6) the AI was asked to use back onto dateKeys, since
    // asking a model to compute real calendar dates is asking for mistakes.
    const handlePlanWithFernAction = (parsed) => {
        const mealsToAdd = Array.isArray(parsed?.add_meals) ? parsed.add_meals : [];
        const activitiesToAdd = Array.isArray(parsed?.add_activities) ? parsed.add_activities : [];
        if (!mealsToAdd.length && !activitiesToAdd.length) return undefined;

        const dayOffsetToDateKey = (offset) => dateKeys[Math.max(0, Math.min(dateKeys.length - 1, Number(offset) || 0))];

        if (mealsToAdd.length) {
            let nextMealPlan = mealPlanLocal;
            mealsToAdd.forEach((m) => {
                const dateKey = dayOffsetToDateKey(m?.day_offset);
                const title = String(m?.title || '').trim();
                if (!dateKey || !title) return;
                const dayMeals = nextMealPlan[dateKey] || [];
                nextMealPlan = { ...nextMealPlan, [dateKey]: onePerSlot([...dayMeals, { slot: m?.slot || 'Dinner', title, emoji: m?.emoji || '🍽️' }]) };
            });
            persistMealPlan(nextMealPlan);
        }

        if (activitiesToAdd.length) {
            const newActivities = activitiesToAdd
                .map((a) => {
                    const dateKey = dayOffsetToDateKey(a?.day_offset);
                    const label = String(a?.label || '').trim();
                    if (!dateKey || !label) return null;
                    return {
                        day: formatDayLabel(dateKey),
                        time: a?.time || '',
                        emoji: a?.emoji || '🗓️',
                        label,
                        dateKey,
                        endTime: '',
                        startTime: '',
                        _origLabel: label,
                    };
                })
                .filter(Boolean);
            if (newActivities.length) persistActivities([...activitiesLocal, ...newActivities]);
        }

        const parts = [];
        if (mealsToAdd.length) parts.push(t('family_plan_fern_added_meals', { count: mealsToAdd.length }));
        if (activitiesToAdd.length) parts.push(t('family_plan_fern_added_activities', { count: activitiesToAdd.length }));
        return parts.join(' ');
    };

    const showComingSoon = (titleKey) => {
        Alert.alert(t(titleKey), t('coming_soon'));
    };

    const openAddMealModal = (dateKey, slot, slotLabel) => {
        setAddMealModal({ dateKey, slot, slotLabel });
    };

    const handleSelectSavedMealForAdd = (recipe) => {
        if (!addMealModal) return;
        const { dateKey, slot, replace } = addMealModal;
        const dayMeals = mealPlanLocal[dateKey] || [];
        const newEntry = { slot, title: recipe.title, emoji: recipe.emoji || '🍽️', image: recipe.image || null };
        // Changing a planned meal swaps it in the same spot; adding appends.
        const idx = replace ? dayMeals.indexOf(replace) : -1;
        const nextDayMeals = idx >= 0
            ? dayMeals.map((item, i) => (i === idx ? newEntry : item))
            : onePerSlot([...dayMeals, newEntry]);
        persistMealPlan({ ...mealPlanLocal, [dateKey]: nextDayMeals });
        setAddMealModal(null);
    };

    const [isSharingWeek, setIsSharingWeek] = useState(false);
    const handleShareWeek = async () => {
        if (isSharingWeek) return;
        const days = dateKeys.map((key) => {
            const d = parseDateKey(key);
            const meals = (mealPlanLocal[key] || [])
                .filter((m) => m && m.title)
                .map((m) => ({ slot: m.slot || 'Dinner', title: m.title, emoji: m.emoji || '' }));
            return { label: `${DAY_ABBREVIATIONS[d.getDay()]} ${d.getDate()}`, meals };
        }).filter((d) => d.meals.length);
        if (!days.length) {
            Alert.alert(t('share_week_empty'));
            return;
        }
        setIsSharingWeek(true);
        try {
            const store = String(data?.userStores?.[0]?.name || '').split(/ - |#/)[0].trim();
            const url = await createPlanShareLink({ days, senderName: String(data?.userProfile?.userName || user?.name || '').trim(), store });
            if (!url) throw new Error('no link');
            await Share.share(Platform.OS === 'ios' ? { url } : { message: url });
        } catch (e) {
            Alert.alert(t('share_week_failed'));
        } finally {
            setIsSharingWeek(false);
        }
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
                                    [dateKey]: onePerSlot([...dayMeals, { slot: 'Dinner', title: idea.title, emoji: idea.emoji }]),
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

    if (!hasAccess(FEATURE_TIERS.family_hub)) {
        return <UpgradeGateModal visible tier={FEATURE_TIERS.family_hub} onClose={() => { }} />;
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
                {/* <TouchableOpacity
                    style={styles.hiddenToggle}
                    activeOpacity={0.6}
                    onPress={() => setShowExampleView(true)}
                >
                    <Text style={styles.hiddenToggleText}>🧪</Text>
                </TouchableOpacity> */}

                <Text style={styles.title}>{`🗓️ ${t('family_hub_title')}`}</Text>
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

                    <TouchableOpacity style={[styles.planFernBtn, shadow.card]} activeOpacity={0.85} onPress={() => setIsPlanWithFernOpen(true)}>
                        <Text style={styles.planFernBtnText}>{t('family_hub_plan_with_fern_btn')}</Text>
                    </TouchableOpacity>

                    {/* <TouchableOpacity style={styles.listBtn} activeOpacity={0.85} onPress={handlePressList}>
                        <Text style={styles.listBtnText}>{t('family_hub_list_btn')}</Text>
                    </TouchableOpacity> */}
                </View>

                <TouchableOpacity style={styles.shareBtn} activeOpacity={0.85} onPress={handleShareWeek} disabled={isSharingWeek}>
                    <Text style={styles.shareBtnText}>{isSharingWeek ? t('share_week_creating') : `📤 ${t('family_hub_share_week_btn')}`}</Text>
                </TouchableOpacity>

                <View style={styles.statsRow}>
                    <View style={[styles.statCard, shadow.card]}>
                        <Text style={styles.statLabel}>{t('family_hub_stat_activities')}</Text>
                        <Text style={styles.statValue}>{activitiesThisWeek.length}</Text>
                    </View>
                    <View style={[styles.statCard, shadow.card]}>
                        <Text style={styles.statLabel}>{t('family_hub_stat_shopping')}</Text>
                        <Text style={styles.statValue}>{t('family_hub_stat_shopping_items', { count: shoppingCount })}</Text>
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
                            {ring(flashMeal('breakfast'))}
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
                                    ? openMealMenu(selectedDateKey, breakfastEntries[0], 'Breakfast', t('meal_planner_slot_breakfast'))
                                    : openAddMealModal(selectedDateKey, 'Breakfast', t('meal_planner_slot_breakfast')))}
                            >
                                <Text style={styles.mealActionText}>{breakfastEntries.length ? '⋯' : '+'}</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.mealCard, !lunchEntries.length ? styles.mealCardEmpty : null]}>
                            {ring(flashMeal('lunch'))}
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
                                    ? openMealMenu(selectedDateKey, lunchEntries[0], 'Lunch', t('meal_planner_slot_lunch'))
                                    : openAddMealModal(selectedDateKey, 'Lunch', t('meal_planner_slot_lunch')))}
                            >
                                <Text style={styles.mealActionText}>{lunchEntries.length ? '⋯' : '+'}</Text>
                            </TouchableOpacity>
                        </View>

                        {dinnerEntries.length ? (
                            dinnerEntries.map((entry, idx) => (
                                <View key={`${selectedDateKey}-dinner-${idx}`} style={styles.mealCard}>
                                    {ring(flashMeal('dinner') && (!flash.label || String(entry.title || '').toLowerCase() === flash.label.toLowerCase() || idx === dinnerEntries.length - 1))}
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
                                        onPress={() => openMealMenu(selectedDateKey, entry, 'Dinner', t('meal_planner_slot_dinner'))}
                                    >
                                        <Text style={styles.mealActionText}>⋯</Text>
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
                            <View style={styles.activitiesSection} onLayout={(e) => { sectionY.current.activities = e.nativeEvent.layout.y; }}>
                                <Text style={styles.activitiesLabel}>{t('family_hub_activities_label')}</Text>
                                {selectedDayActivities.map((activity, idx) => (
                                    <View key={`${selectedDateKey}-activity-${idx}`} style={styles.mealCard}>
                                        {ring(Boolean(flash && flash.kind === 'activity' && String(activity.label || '').toLowerCase() === flash.label.toLowerCase()))}
                                        <TouchableOpacity
                                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                                            activeOpacity={0.7}
                                            onPress={() => { setEditingActivity(activity); setIsAddActivityOpen(true); }}
                                            accessibilityRole="button"
                                            accessibilityLabel={t('activity_edit_a11y')}
                                        >
                                            <View style={styles.mealIconWrap}>
                                                <Text style={styles.mealIconEmoji}>{activity.emoji || '🗓️'}</Text>
                                            </View>
                                            <View style={styles.mealInfo}>
                                                <Text style={styles.mealTitle}>{activity.label}</Text>
                                                <Text style={styles.mealAddText}>{activity.time ? `${activity.time}  ✎` : `${t('activity_add_time')}  ✎`}</Text>
                                            </View>
                                        </TouchableOpacity>
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
                onSaveCopy={() => mealPlanRecipes.saveSelectedCopy()}
                isAlreadySaved={isSelectedMealRecipeSaved}
                showSavedIndicator
                onDeleteRecipe={isSelectedMealRecipeSaved ? () => mealPlanRecipes.handleDeleteSelected(() => mealPlanRecipes.setSelectedRecipe(null)) : undefined}
                onAddToList={mealPlanRecipes.handleAddToShoppingList}
                books={data.books}
                onSaveToCookbook={(selection) => mealPlanRecipes.saveSelectedToCookbook(selection)}
                user={user}
            />

            <FamilyAddSavedMealModal
                visible={Boolean(addMealModal)}
                slotLabel={addMealModal?.slotLabel}
                dayActivities={addMealModal ? (activitiesLocal || []).filter((a) => a.dateKey === addMealModal.dateKey) : []}
                dayLabel={addMealModal ? formatDayLabel(addMealModal.dateKey) : ''}
                savedRecipes={data.recipes}
                token={user?.token}
                onClose={() => setAddMealModal(null)}
                onSelect={handleSelectSavedMealForAdd}
            />

            <FamilyAddActivityModal
                visible={isAddActivityOpen}
                dayOptions={dayOptions}
                initialDateKey={selectedDateKey}
                onClose={() => { setIsAddActivityOpen(false); setEditingActivity(null); }}
                onAdd={handleAddActivity}
                editing={editingActivity}
                onSave={handleSaveActivity}
            />

            <ChatSheetModal
                visible={isPlanWithFernOpen}
                onClose={() => setIsPlanWithFernOpen(false)}
                user={user}
                systemPrompt={FAMILY_PLAN_SYSTEM_PROMPT}
                autoOpenerPrompt={FAMILY_PLAN_AUTO_OPENER}
                title={t('family_plan_fern_title')}
                emptyHintKey="family_plan_fern_empty_hint"
                onAction={handlePlanWithFernAction}
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
    flashRing: { position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderWidth: 3, borderColor: '#D86D33', borderRadius: 19 },
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
