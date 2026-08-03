import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import useLanguage from '../hooks/useLanguage';

const MEALS_PER_DAY_OPTIONS = [1, 2, 3];
const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner'];
const COOK_TIME_OPTIONS = [20, 30, 45, 60, 90];
const SERVINGS_OPTIONS = [1, 2, 4, 6, 8];
const DIETARY_OPTIONS = [
    { value: 'Vegetarian', labelKey: 'meal_planner_dietary_vegetarian' },
    { value: 'Vegan', labelKey: 'meal_planner_dietary_vegan' },
    { value: 'Gluten-free', labelKey: 'meal_planner_dietary_gluten_free' },
    { value: 'Dairy-free', labelKey: 'meal_planner_dietary_dairy_free' },
    { value: 'Pescatarian', labelKey: 'meal_planner_dietary_pescatarian' },
    { value: 'Keto', labelKey: 'meal_planner_dietary_keto' },
];

// These selections aren't sent to the `generate` call — the captured request
// only carries `savedRecipes` + the current `plan`, no preference fields —
// but they ARE sent to `save_plan` right after a successful generate, so
// onGenerate is called with the collected preferences object.
export default function MealPlannerPreferencesScreen({ savedRecipesCount, onBack, onGenerate }) {
    const { t } = useLanguage();
    const [mealsPerDay, setMealsPerDay] = useState(1);
    const [selectedSlots, setSelectedSlots] = useState(['Dinner']);
    const [maxCookTime, setMaxCookTime] = useState(45);
    const [servingsPerMeal, setServingsPerMeal] = useState(4);
    const [selectedDietary, setSelectedDietary] = useState([]);
    const [avoidIngredients, setAvoidIngredients] = useState('');

    const handleChangeMealsPerDay = (count) => {
        setMealsPerDay(count);
        setSelectedSlots((current) => (
            current.length ? current.slice(0, count) : MEAL_SLOTS.slice(0, count)
        ));
    };

    const toggleMealSlot = (slot) => {
        setSelectedSlots((current) => {
            if (current.includes(slot)) {
                return current.filter((s) => s !== slot);
            }
            if (mealsPerDay === 1) {
                return [slot];
            }
            if (current.length >= mealsPerDay) {
                return current;
            }
            return [...current, slot];
        });
    };

    const toggleDietary = (value) => {
        setSelectedDietary((current) => (
            current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
        ));
    };

    const handleGeneratePress = () => {
        onGenerate({
            mealsPerDay,
            whichMeals: selectedSlots.map((slot) => slot.toLowerCase()),
            cookTimeMax: maxCookTime,
            servings: servingsPerMeal,
            dietary: selectedDietary.map((value) => value.toLowerCase()),
            disliked: avoidIngredients.split(',').map((item) => item.trim()).filter(Boolean),
        });
    };

    return (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{t('meal_planner_prefs_title')}</Text>
            <Text style={styles.subtitle}>{t('meal_planner_prefs_subtitle', { count: savedRecipesCount })}</Text>

            <Text style={styles.sectionHeading}>{t('meal_planner_prefs_meals_per_day')}</Text>
            <View style={styles.chipRow}>
                {MEALS_PER_DAY_OPTIONS.map((count) => {
                    const isSelected = mealsPerDay === count;
                    return (
                        <TouchableOpacity
                            key={count}
                            style={[styles.optionPill, isSelected ? styles.optionPillActive : null]}
                            activeOpacity={0.85}
                            onPress={() => handleChangeMealsPerDay(count)}
                        >
                            <Text style={[styles.optionPillText, isSelected ? styles.optionPillTextActive : null]}>
                                {t(count === 1 ? 'meal_planner_prefs_meal_count_singular' : 'meal_planner_prefs_meal_count_plural', { count })}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Text style={styles.sectionHeading}>{t('meal_planner_prefs_which_meals')}</Text>
            <View style={styles.chipRow}>
                {MEAL_SLOTS.map((slot) => {
                    const isSelected = selectedSlots.includes(slot);
                    return (
                        <TouchableOpacity
                            key={slot}
                            style={[styles.optionPill, isSelected ? styles.optionPillActive : null]}
                            activeOpacity={0.85}
                            onPress={() => toggleMealSlot(slot)}
                        >
                            <Text style={[styles.optionPillText, isSelected ? styles.optionPillTextActive : null]}>
                                {t(`meal_planner_slot_${slot.toLowerCase()}`)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Text style={styles.sectionHeading}>{t('meal_planner_prefs_max_cook_time')}</Text>
            <View style={styles.chipRowWrap}>
                {COOK_TIME_OPTIONS.map((minutes) => {
                    const isSelected = maxCookTime === minutes;
                    return (
                        <TouchableOpacity
                            key={minutes}
                            style={[styles.smallPill, isSelected ? styles.smallPillActive : null]}
                            activeOpacity={0.85}
                            onPress={() => setMaxCookTime(minutes)}
                        >
                            <Text style={[styles.smallPillText, isSelected ? styles.smallPillTextActive : null]}>
                                {t('meal_planner_prefs_minutes', { count: minutes })}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Text style={styles.sectionHeading}>{t('meal_planner_prefs_servings')}</Text>
            <View style={styles.chipRowWrap}>
                {SERVINGS_OPTIONS.map((count) => {
                    const isSelected = servingsPerMeal === count;
                    return (
                        <TouchableOpacity
                            key={count}
                            style={[styles.smallPill, isSelected ? styles.smallPillActive : null]}
                            activeOpacity={0.85}
                            onPress={() => setServingsPerMeal(count)}
                        >
                            <Text style={[styles.smallPillText, isSelected ? styles.smallPillTextActive : null]}>{count}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Text style={styles.sectionHeading}>{t('meal_planner_prefs_dietary')}</Text>
            <View style={styles.chipRowWrap}>
                {DIETARY_OPTIONS.map((option) => {
                    const isSelected = selectedDietary.includes(option.value);
                    return (
                        <TouchableOpacity
                            key={option.value}
                            style={[styles.outlinePill, isSelected ? styles.outlinePillActive : null]}
                            activeOpacity={0.85}
                            onPress={() => toggleDietary(option.value)}
                        >
                            <Text style={[styles.outlinePillText, isSelected ? styles.outlinePillTextActive : null]}>
                                {t(option.labelKey)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Text style={styles.sectionHeading}>{t('meal_planner_prefs_avoid')}</Text>
            <TextInput
                value={avoidIngredients}
                onChangeText={setAvoidIngredients}
                placeholder={t('meal_planner_prefs_avoid_placeholder')}
                placeholderTextColor="#9A8D7F"
                style={styles.input}
            />

            <TouchableOpacity style={styles.generateBtn} activeOpacity={0.85} onPress={handleGeneratePress}>
                <Text style={styles.generateBtnText}>{`✨ ${t('meal_planner_prefs_generate_btn')}`}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backLink} activeOpacity={0.7} onPress={onBack}>
                <Text style={styles.backLinkText}>{`← ${t('meal_planner_prefs_back_btn')}`}</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingBottom: 30,
    },
    title: {
        textAlign: 'center',
        color: '#2A1A11',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 24,
    },
    subtitle: {
        marginTop: 10,
        textAlign: 'center',
        color: '#6B5A47',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        lineHeight: 19,
    },
    sectionHeading: {
        marginTop: 22,
        marginBottom: 10,
        color: '#8C6B46',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
        letterSpacing: 0.6,
    },
    chipRow: {
        flexDirection: 'row',
        gap: 10,
    },
    chipRowWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    optionPill: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D9CDBD',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    optionPillActive: {
        backgroundColor: 'rgb(216, 109, 51)',
        borderColor: 'rgb(216, 109, 51)',
    },
    optionPillText: {
        color: '#B0A08A',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    optionPillTextActive: {
        color: '#FFFFFF',
    },
    smallPill: {
        minWidth: 64,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#D9CDBD',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    smallPillActive: {
        backgroundColor: 'rgb(216, 109, 51)',
        borderColor: 'rgb(216, 109, 51)',
    },
    smallPillText: {
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    smallPillTextActive: {
        color: '#FFFFFF',
    },
    outlinePill: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#D9CDBD',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    outlinePillActive: {
        backgroundColor: '#2A1A11',
        borderColor: '#2A1A11',
    },
    outlinePillText: {
        color: '#2A1A11',
        fontFamily: 'Jost-SemiBold',
        fontSize: 13,
    },
    outlinePillTextActive: {
        color: '#FFFFFF',
    },
    input: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D9CDBD',
        backgroundColor: '#FFFFFF',
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        paddingHorizontal: 14,
        paddingVertical: 13,
    },
    generateBtn: {
        marginTop: 26,
        borderRadius: 14,
        backgroundColor: 'rgb(216, 109, 51)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
    },
    generateBtnText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        letterSpacing: 0.6,
    },
    backLink: {
        marginTop: 16,
        alignSelf: 'center',
    },
    backLinkText: {
        color: 'rgb(216, 109, 51)',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
});
