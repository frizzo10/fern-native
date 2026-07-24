import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useLanguage from '../../hooks/useLanguage';

const NUTRITION_GOALS_STORAGE_KEY = 'fern_nutrition_goals';
const NUTRITION_ANALYSIS_STORAGE_KEY = 'fern_nutrition_analysis';
const AI_URL = 'https://app.clickpickandcook.com/.netlify/functions/ai';
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CALORIE_OPTIONS = [
    { value: 'under_1500', labelKey: 'nutrition_calorie_under_1500', englishLabel: 'Under 1,500', targetCalories: 1500 },
    { value: '1500_1800', labelKey: 'nutrition_calorie_1500_1800', englishLabel: '1,500 - 1,800', targetCalories: 1800 },
    { value: '1800_2200', labelKey: 'nutrition_calorie_1800_2200', englishLabel: '1,800 - 2,200', targetCalories: 2200 },
    { value: 'over_2200', labelKey: 'nutrition_calorie_over_2200', englishLabel: 'Over 2,200', targetCalories: 2400 },
];

const PROTEIN_OPTIONS = [
    { value: 'none', labelKey: 'nutrition_protein_none', englishLabel: 'no specific goal' },
    { value: '50g', labelKey: 'nutrition_protein_50', englishLabel: '50g+' },
    { value: '80g', labelKey: 'nutrition_protein_80', englishLabel: '80g+' },
    { value: '100g', labelKey: 'nutrition_protein_100', englishLabel: '100g+' },
];

const CARB_OPTIONS = [
    { value: 'no_limit', labelKey: 'nutrition_carb_no_limit', englishLabel: 'any' },
    { value: 'low', labelKey: 'nutrition_carb_low', englishLabel: 'low carb (under 100g)' },
    { value: 'moderate', labelKey: 'nutrition_carb_moderate', englishLabel: 'moderate (100-150g)' },
    { value: 'low_sugar', labelKey: 'nutrition_carb_low_sugar', englishLabel: 'low sugar focus' },
];

const DIETARY_FOCUS_OPTIONS = [
    { value: 'balanced', labelKey: 'nutrition_focus_balanced', englishLabel: 'Balanced' },
    { value: 'high_protein', labelKey: 'nutrition_focus_high_protein', englishLabel: 'High protein' },
    { value: 'low_carb', labelKey: 'nutrition_focus_low_carb', englishLabel: 'Low carb' },
    { value: 'heart_healthy', labelKey: 'nutrition_focus_heart_healthy', englishLabel: 'Heart healthy' },
    { value: 'mediterranean', labelKey: 'nutrition_focus_mediterranean', englishLabel: 'Mediterranean' },
    { value: 'plant_based', labelKey: 'nutrition_focus_plant_based', englishLabel: 'Plant-based' },
];

const EMPTY_GOALS = {
    calorieTarget: null,
    proteinGoal: null,
    carbLimit: null,
    dietaryFocus: null,
};

function dateKey(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

async function buildWeekMealLines() {
    const mealPlan = JSON.parse((await AsyncStorage.getItem('rv4_meal_plan')) || '{}');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lines = [];

    for (let i = 0; i < 7; i += 1) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dayAbbr = DAY_ABBR[d.getDay()];
        const entries = mealPlan[dateKey(d)];
        if (!Array.isArray(entries)) continue;

        entries.forEach((m) => {
            if (m && m.title) {
                lines.push(`${dayAbbr} : ${m.title}`);
            }
        });
    }

    return lines;
}

function parseResponseTextAsJson(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }
}

function normalizeAnalysisResult(raw, basedOnSuggestion) {
    const days = Array.isArray(raw?.days)
        ? raw.days.map((d) => ({
            day: String(d?.day || ''),
            calories: Number(d?.calories) || 0,
            protein: Number(d?.protein) || 0,
            carbs: Number(d?.carbs) || 0,
            fat: Number(d?.fat) || 0,
            goalMet: Boolean(d?.goal_met),
            highlight: String(d?.highlight || ''),
        }))
        : [];

    return {
        days,
        weeklyAvg: {
            calories: Number(raw?.weekly_avg?.calories) || 0,
            protein: Number(raw?.weekly_avg?.protein) || 0,
            carbs: Number(raw?.weekly_avg?.carbs) || 0,
            fat: Number(raw?.weekly_avg?.fat) || 0,
        },
        tip: String(raw?.tip || ''),
        offGoalDays: Array.isArray(raw?.off_goal_days) ? raw.off_goal_days.map(String) : [],
        goalRecipeSuggestion: String(raw?.goal_recipe_suggestion || ''),
        basedOnSuggestion: Boolean(basedOnSuggestion),
    };
}

function OptionGrid({ options, selectedValue, onSelect, t }) {
    return (
        <View style={styles.optionGrid}>
            {options.map((option) => {
                const selected = selectedValue === option.value;
                return (
                    <TouchableOpacity
                        key={option.value}
                        activeOpacity={0.85}
                        style={[styles.optionBtn, selected ? styles.optionBtnSelected : null]}
                        onPress={() => onSelect(option.value)}
                    >
                        <Text style={[styles.optionBtnText, selected ? styles.optionBtnTextSelected : null]} numberOfLines={2}>
                            {t(option.labelKey)}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

export default function NutritionTrackerModal({ visible, onClose, navigation, user }) {
    const { t, locale } = useLanguage();
    const [step, setStep] = useState('form');
    const [goals, setGoals] = useState(EMPTY_GOALS);
    const [result, setResult] = useState(null);

    useEffect(() => {
        if (!visible) return;

        (async () => {
            const [rawGoals, rawAnalysis] = await Promise.all([
                AsyncStorage.getItem(NUTRITION_GOALS_STORAGE_KEY),
                AsyncStorage.getItem(NUTRITION_ANALYSIS_STORAGE_KEY),
            ]);

            const parsedGoals = rawGoals ? JSON.parse(rawGoals) : EMPTY_GOALS;
            const parsedAnalysis = rawAnalysis ? JSON.parse(rawAnalysis) : null;

            setGoals(parsedGoals);

            if (parsedAnalysis?.result) {
                setResult(parsedAnalysis.result);
                setStep('results');
            } else {
                setResult(null);
                setStep('form');
            }
        })();
    }, [visible]);

    const handleSelect = (field, value) => {
        setGoals((current) => ({ ...current, [field]: value }));
    };

    const buildGoalsBarText = (values) => {
        const calorieOption = CALORIE_OPTIONS.find((option) => option.value === values.calorieTarget);
        const proteinOption = PROTEIN_OPTIONS.find((option) => option.value === values.proteinGoal);
        const carbOption = CARB_OPTIONS.find((option) => option.value === values.carbLimit);
        const dietaryOption = DIETARY_FOCUS_OPTIONS.find((option) => option.value === values.dietaryFocus);

        const parts = [];

        if (calorieOption) {
            parts.push(`🔥 ${t('nutrition_summary_calorie_value', { value: t(calorieOption.labelKey) })}`);
        }

        if (proteinOption) {
            parts.push(
                proteinOption.value === 'none'
                    ? `💪 ${t('nutrition_summary_protein_none_value')}`
                    : `💪 ${t('nutrition_summary_protein_value', { value: t(proteinOption.labelKey) })}`
            );
        }

        if (carbOption && carbOption.value !== 'no_limit') {
            parts.push(`🌾 ${t(carbOption.labelKey)}`);
        }

        if (dietaryOption) {
            parts.push(`🥗 ${t(dietaryOption.labelKey)}`);
        }

        return parts.join('  ·  ');
    };

    const handleAnalyze = async () => {
        await AsyncStorage.setItem(NUTRITION_GOALS_STORAGE_KEY, JSON.stringify(goals));

        const mealLines = await buildWeekMealLines();
        const hasMealPlan = mealLines.length > 0;

        setStep('analyzing');

        try {
            const calorieOption = CALORIE_OPTIONS.find((option) => option.value === goals.calorieTarget);
            const proteinOption = PROTEIN_OPTIONS.find((option) => option.value === goals.proteinGoal);
            const carbOption = CARB_OPTIONS.find((option) => option.value === goals.carbLimit);
            const dietaryOption = DIETARY_FOCUS_OPTIONS.find((option) => option.value === goals.dietaryFocus);

            const calorieLabel = calorieOption?.englishLabel || 'no specific limit';
            const proteinLabel = proteinOption?.englishLabel || 'no specific goal';
            const carbLabel = carbOption?.englishLabel || 'any';
            const focusLabel = dietaryOption?.englishLabel || 'Balanced';

            const promptContent = hasMealPlan
                ? `User goals: calories=${calorieLabel}, protein=${proteinLabel}, carbs=${carbLabel}, focus=${focusLabel}. Analyze these meals. For each day estimate calories and macros. Also set goal_met:true/false based on whether the day matches the user goals above. Meals: ${mealLines.join(', ')}. Respond ONLY with valid JSON no markdown: {"days":[{"day":"Mon","calories":1800,"protein":80,"carbs":200,"fat":60,"goal_met":true,"highlight":""}],"weekly_avg":{"calories":0,"protein":0,"carbs":0,"fat":0},"tip":"","off_goal_days":["Tue","Thu"],"goal_recipe_suggestion":""}`
                : `User goals: calories=${calorieLabel}, protein=${proteinLabel}, carbs=${carbLabel}, focus=${focusLabel}. This user hasn't planned any meals this week — a meal plan is optional, so instead suggest a realistic sample 7-day dinner for each day that fits these goals, and estimate its nutrition. Put the suggested dish name in "highlight" for each day. Set goal_met:true/false based on whether the suggested dish matches the goals above. Respond ONLY with valid JSON no markdown: {"days":[{"day":"Mon","calories":1800,"protein":80,"carbs":200,"fat":60,"goal_met":true,"highlight":"Grilled salmon with quinoa and greens"}],"weekly_avg":{"calories":0,"protein":0,"carbs":0,"fat":0},"tip":"","off_goal_days":[],"goal_recipe_suggestion":""}`;

            const res = await fetch(AI_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'FernApp/1.0 (myaifern.com)',
                },
                body: JSON.stringify({
                    system: 'You are a nutrition analyst. Always respond with valid JSON only, no markdown.',
                    messages: [{ role: 'user', content: promptContent }],
                    feature: 'nutrition',
                    locale: locale || 'en',
                    token: user?.token,
                }),
            });

            if (!res.ok) {
                throw new Error(`Nutrition analysis failed (${res.status})`);
            }

            const json = await res.json();
            const text = json?.content?.find((part) => part?.type === 'text')?.text || '';
            const parsed = parseResponseTextAsJson(text);

            if (!parsed) {
                throw new Error('Nutrition analysis returned invalid JSON');
            }

            const normalized = normalizeAnalysisResult(parsed, !hasMealPlan);

            await AsyncStorage.setItem(
                NUTRITION_ANALYSIS_STORAGE_KEY,
                JSON.stringify({ goals, result: normalized, analyzedAt: Date.now() })
            );

            setResult(normalized);
            setStep('results');
        } catch (e) {
            console.log('[nutrition-tracker] analyze failed', e?.message || e);
            Alert.alert(t('nutrition_tracker_analyze_failed_title'), t('nutrition_tracker_analyze_failed_desc'));
            setStep('form');
        }
    };

    const handleEditGoals = () => {
        setStep('form');
    };

    const handleShare = async () => {
        if (!result) return;

        const message = [
            t('nutrition_tracker_share_message_title'),
            '',
            `${result.weeklyAvg.calories} cal · ${result.weeklyAvg.protein}g protein · ${result.weeklyAvg.carbs}g carbs · ${result.weeklyAvg.fat}g fat`,
            result.tip,
        ].filter(Boolean).join('\n');

        try {
            await Share.share({ message });
        } catch (e) {
            console.log('[nutrition-tracker] share failed', e?.message || e);
        }
    };

    const handleFindRecipes = () => {
        const query = result?.goalRecipeSuggestion || '';
        onClose();
        navigation?.navigate('Find', { prefillQuery: query, requestKey: Date.now() });
    };

    const targetCalories = CALORIE_OPTIONS.find((option) => option.value === goals.calorieTarget)?.targetCalories || 2000;

    return (
        <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.topBar}>
                        <Text style={styles.title} numberOfLines={2}>{`🥗 ${t('nutrition_tracker_title')}`}</Text>
                        {step === 'results' ? (
                            <TouchableOpacity style={styles.shareBtn} activeOpacity={0.85} onPress={handleShare}>
                                <Text style={styles.shareBtnText}>{t('nutrition_tracker_share_btn')}</Text>
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
                            <Text style={styles.closeText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        <View style={styles.aiEstimationBanner}>
                            <Text style={styles.aiEstimationText}>
                                {'⚠️ '}
                                <Text style={styles.aiEstimationLabel}>{t('nutrition_tracker_ai_estimation_label')}</Text>
                                {` ${t('nutrition_tracker_ai_estimation_desc')}`}
                            </Text>
                        </View>

                        {step === 'analyzing' ? (
                            <View style={styles.loadingWrap}>
                                <ActivityIndicator size="large" color="#173E20" />
                                <Text style={styles.loadingTitle}>{t('nutrition_tracker_analyzing_title')}</Text>
                            </View>
                        ) : step === 'results' && result ? (
                            <View>
                                {result.basedOnSuggestion ? (
                                    <View style={styles.suggestedPlanBanner}>
                                        <Text style={styles.suggestedPlanText}>
                                            {`📋 ${t('nutrition_tracker_suggested_plan_banner')}`}
                                        </Text>
                                    </View>
                                ) : null}

                                <View style={styles.goalsBar}>
                                    <Text style={styles.goalsBarText}>{buildGoalsBarText(goals)}</Text>
                                    <TouchableOpacity activeOpacity={0.7} onPress={handleEditGoals}>
                                        <Text style={styles.editGoalsLink}>{t('nutrition_tracker_edit_goals_link')}</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.legendRow}>
                                    <View style={styles.legendItem}>
                                        <Text style={styles.legendOnTrackText}>{`✅ ${t('nutrition_tracker_legend_on_track')}`}</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <Text style={styles.legendOffGoalText}>{`➤ ${t('nutrition_tracker_legend_off_goal')}`}</Text>
                                    </View>
                                </View>

                                <View style={styles.statsRow}>
                                    <View style={styles.statTile}>
                                        <Text style={styles.statValue}>{result.weeklyAvg.calories}</Text>
                                        <Text style={styles.statLabel}>{t('nutrition_tracker_stat_avg_cal')}</Text>
                                    </View>
                                    <View style={styles.statTile}>
                                        <Text style={styles.statValue}>{`${result.weeklyAvg.protein}g`}</Text>
                                        <Text style={styles.statLabel}>{t('nutrition_tracker_stat_protein')}</Text>
                                    </View>
                                    <View style={styles.statTile}>
                                        <Text style={styles.statValue}>{`${result.weeklyAvg.carbs}g`}</Text>
                                        <Text style={styles.statLabel}>{t('nutrition_tracker_stat_carbs')}</Text>
                                    </View>
                                    <View style={styles.statTile}>
                                        <Text style={styles.statValue}>{`${result.weeklyAvg.fat}g`}</Text>
                                        <Text style={styles.statLabel}>{t('nutrition_tracker_stat_fat')}</Text>
                                    </View>
                                </View>

                                {result.days.map((day, index) => {
                                    const percent = Math.max(4, Math.min(100, Math.round((day.calories / targetCalories) * 100)));
                                    return (
                                        <View key={`${day.day}-${index}`} style={styles.dayCard}>
                                            <View style={styles.dayHeaderRow}>
                                                <Text style={styles.dayName}>{day.day}</Text>
                                                <Text style={styles.dayMeta}>
                                                    {t('nutrition_tracker_day_meta', { cal: day.calories, protein: day.protein, carbs: day.carbs, fat: day.fat })}
                                                </Text>
                                            </View>

                                            <View style={styles.progressTrack}>
                                                <View
                                                    style={[
                                                        styles.progressFill,
                                                        { width: `${percent}%` },
                                                        day.goalMet ? styles.progressFillOnTrack : styles.progressFillOffGoal,
                                                    ]}
                                                />
                                            </View>

                                            <View style={[styles.dayPill, day.goalMet ? styles.dayPillOnTrack : styles.dayPillOffGoal]}>
                                                <Text style={day.goalMet ? styles.dayPillOnTrackText : styles.dayPillOffGoalText}>
                                                    {day.goalMet ? `✅ ${t('nutrition_tracker_legend_on_track')}` : `➤ ${t('nutrition_tracker_legend_off_goal')}`}
                                                </Text>
                                            </View>

                                            {day.highlight ? <Text style={styles.dayHighlight}>{day.highlight}</Text> : null}
                                        </View>
                                    );
                                })}

                                {result.tip ? (
                                    <View style={styles.tipCard}>
                                        <Text style={styles.tipText}>{`💡 ${result.tip}`}</Text>
                                    </View>
                                ) : null}

                                {result.offGoalDays.length ? (
                                    <View style={styles.offGoalCard}>
                                        <Text style={styles.offGoalTitle}>
                                            {`📋 ${t(
                                                result.offGoalDays.length === 1
                                                    ? 'nutrition_tracker_off_goal_days_title_singular'
                                                    : 'nutrition_tracker_off_goal_days_title_plural',
                                                { count: result.offGoalDays.length, days: result.offGoalDays.join(', ') }
                                            )}`}
                                        </Text>

                                        {result.goalRecipeSuggestion ? (
                                            <Text style={styles.offGoalDesc}>{result.goalRecipeSuggestion}</Text>
                                        ) : null}

                                        <TouchableOpacity style={styles.findRecipesBtn} activeOpacity={0.85} onPress={handleFindRecipes}>
                                            <Text style={styles.findRecipesBtnText}>{t('nutrition_tracker_find_recipes_btn')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : null}
                            </View>
                        ) : (
                            <View>
                                <Text style={styles.goalsHeading}>{t('nutrition_tracker_goals_heading')}</Text>
                                <Text style={styles.goalsSubtitle}>{t('nutrition_tracker_goals_subtitle')}</Text>

                                <Text style={styles.sectionLabel}>{`🔥 ${t('nutrition_tracker_calorie_section')}`}</Text>
                                <OptionGrid
                                    options={CALORIE_OPTIONS}
                                    selectedValue={goals.calorieTarget}
                                    onSelect={(value) => handleSelect('calorieTarget', value)}
                                    t={t}
                                />

                                <Text style={styles.sectionLabel}>{`💪 ${t('nutrition_tracker_protein_section')}`}</Text>
                                <OptionGrid
                                    options={PROTEIN_OPTIONS}
                                    selectedValue={goals.proteinGoal}
                                    onSelect={(value) => handleSelect('proteinGoal', value)}
                                    t={t}
                                />

                                <Text style={styles.sectionLabel}>{`🌾 ${t('nutrition_tracker_carb_section')}`}</Text>
                                <OptionGrid
                                    options={CARB_OPTIONS}
                                    selectedValue={goals.carbLimit}
                                    onSelect={(value) => handleSelect('carbLimit', value)}
                                    t={t}
                                />

                                <Text style={styles.sectionLabel}>{`🥗 ${t('nutrition_tracker_dietary_section')}`}</Text>
                                <OptionGrid
                                    options={DIETARY_FOCUS_OPTIONS}
                                    selectedValue={goals.dietaryFocus}
                                    onSelect={(value) => handleSelect('dietaryFocus', value)}
                                    t={t}
                                />

                                <TouchableOpacity
                                    style={styles.analyzeBtn}
                                    activeOpacity={0.85}
                                    onPress={handleAnalyze}
                                >
                                    <Text style={styles.analyzeBtnText}>{t('nutrition_tracker_analyze_btn')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
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
        maxHeight: '92%',
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
        paddingVertical: 12,
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
        lineHeight: 24,
    },
    shareBtn: {
        borderRadius: 999,
        backgroundColor: '#173E20',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    shareBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
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
        paddingBottom: 28,
    },
    aiEstimationBanner: {
        borderRadius: 14,
        backgroundColor: '#E9F1E7',
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    aiEstimationText: {
        color: '#2A4A2A',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        lineHeight: 20,
    },
    aiEstimationLabel: {
        color: '#2F6B2F',
        fontFamily: 'Jost-Bold',
    },
    suggestedPlanBanner: {
        borderRadius: 14,
        backgroundColor: '#FBEEE0',
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginTop: 12,
    },
    suggestedPlanText: {
        color: '#8C5A1E',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        lineHeight: 20,
    },

    // Loading step
    loadingWrap: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    loadingTitle: {
        marginTop: 18,
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 18,
    },

    // Form step
    goalsHeading: {
        marginTop: 20,
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 20,
        lineHeight: 26,
    },
    goalsSubtitle: {
        marginTop: 6,
        color: '#7B5E3E',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
        lineHeight: 19,
    },
    sectionLabel: {
        marginTop: 20,
        marginBottom: 10,
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 15,
    },
    optionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    optionBtn: {
        width: '47.5%',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#CFBEA7',
        backgroundColor: '#F1E9DA',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 8,
    },
    optionBtnSelected: {
        backgroundColor: '#173E20',
        borderColor: '#173E20',
    },
    optionBtnText: {
        textAlign: 'center',
        color: '#2B2017',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
        lineHeight: 18,
    },
    optionBtnTextSelected: {
        color: '#F1F7F1',
    },
    analyzeBtn: {
        marginTop: 24,
        borderRadius: 14,
        backgroundColor: '#E96B1E',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 17,
    },
    analyzeBtnText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 15,
    },

    // Results step
    goalsBar: {
        marginTop: 16,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        borderRadius: 12,
        backgroundColor: '#E9F1E7',
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    goalsBarText: {
        flex: 1,
        color: '#2A4A2A',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        lineHeight: 18,
    },
    editGoalsLink: {
        color: '#173E20',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        textDecorationLine: 'underline',
    },
    legendRow: {
        marginTop: 14,
        flexDirection: 'row',
        gap: 18,
    },
    legendItem: {},
    legendOnTrackText: {
        color: '#2F6B2F',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    legendOffGoalText: {
        color: '#C0392B',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    statsRow: {
        marginTop: 14,
        flexDirection: 'row',
        gap: 8,
    },
    statTile: {
        flex: 1,
        borderRadius: 14,
        backgroundColor: '#F1E9DA',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 4,
    },
    statValue: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 18,
    },
    statLabel: {
        marginTop: 4,
        color: '#8C7355',
        fontFamily: 'Jost-Bold',
        fontSize: 9,
        letterSpacing: 0.5,
    },
    dayCard: {
        marginTop: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#F0D6D2',
        backgroundColor: '#FBEDEA',
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    dayHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dayName: {
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 15,
    },
    dayMeta: {
        color: '#6B4A3A',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },
    progressTrack: {
        marginTop: 10,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#E9DAD5',
        overflow: 'hidden',
    },
    progressFill: {
        height: 8,
        borderRadius: 4,
    },
    progressFillOnTrack: {
        backgroundColor: '#2F8F4E',
    },
    progressFillOffGoal: {
        backgroundColor: '#C0392B',
    },
    dayPill: {
        marginTop: 10,
        alignSelf: 'flex-start',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    dayPillOnTrack: {
        backgroundColor: '#DCEFDA',
    },
    dayPillOffGoal: {
        backgroundColor: '#FBDAD3',
    },
    dayPillOnTrackText: {
        color: '#2F6B2F',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
    },
    dayPillOffGoalText: {
        color: '#C0392B',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
    },
    dayHighlight: {
        marginTop: 8,
        color: '#6B4A3A',
        fontFamily: 'Jost-Regular',
        fontSize: 12,
        lineHeight: 18,
    },
    tipCard: {
        marginTop: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E9D9A8',
        backgroundColor: '#FDF3DC',
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    tipText: {
        color: '#6B5A2E',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        lineHeight: 19,
    },
    offGoalCard: {
        marginTop: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F0C2BA',
        backgroundColor: '#FBEAE7',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    offGoalTitle: {
        color: '#B5382A',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        lineHeight: 20,
    },
    offGoalDesc: {
        marginTop: 8,
        color: '#5B4238',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        lineHeight: 19,
    },
    findRecipesBtn: {
        marginTop: 14,
        borderRadius: 14,
        backgroundColor: '#E96B1E',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    findRecipesBtnText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
});
