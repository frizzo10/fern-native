import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../constants/tokens';
import useLanguage from '../hooks/useLanguage';

// Rendered inline inside MealPlannerModal's single Modal (as another "view
// state" alongside the day pager/Preferences), not its own Modal — presenting
// a second RN Modal on top of one that's already up crashes on iOS
// ("already presenting <RCTFabricModalHostViewController>").
export default function MealPlannerRecipeDetailView({ meal, onBack, onSwap, isSwapping }) {
    const { t } = useLanguage();

    if (!meal) return null;

    const metaLine = [meal.dayLabel, meal.slot, meal.time, meal.difficulty].filter(Boolean).join(' · ');

    return (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={styles.backLink} activeOpacity={0.7} onPress={onBack}>
                <Text style={styles.backLinkText}>{`← ${t('meal_planner_back_to_week')}`}</Text>
            </TouchableOpacity>

            <Text style={styles.mealEmoji}>{meal.emoji}</Text>
            <Text style={styles.mealTitle}>{meal.title}</Text>
            {metaLine ? <Text style={styles.mealMeta}>{metaLine}</Text> : null}

            {meal.ingredients?.length ? (
                <View style={styles.card}>
                    <Text style={styles.cardHeader}>{t('ingredients_title')}</Text>
                    {meal.ingredients.map((ingredient, idx) => (
                        <View key={`ingredient-${idx}`} style={styles.bulletRow}>
                            <Text style={styles.bulletDot}>{'•'}</Text>
                            <Text style={styles.bulletText}>{ingredient}</Text>
                        </View>
                    ))}
                </View>
            ) : null}

            {meal.instructions?.length ? (
                <View style={styles.card}>
                    <Text style={styles.cardHeader}>{t('method_title')}</Text>
                    {meal.instructions.map((step, idx) => (
                        <View key={`step-${idx}`} style={styles.stepRow}>
                            <View style={styles.stepBadge}>
                                <Text style={styles.stepBadgeText}>{idx + 1}</Text>
                            </View>
                            <Text style={styles.stepText}>{step}</Text>
                        </View>
                    ))}
                </View>
            ) : null}

            {meal.notes ? (
                <View style={styles.tipCard}>
                    <Text style={styles.tipText}>{`💡 ${meal.notes}`}</Text>
                </View>
            ) : null}

            <TouchableOpacity
                style={[styles.swapBtn, isSwapping ? styles.swapBtnDisabled : null]}
                activeOpacity={0.85}
                onPress={onSwap}
                disabled={isSwapping}
            >
                {isSwapping ? (
                    <ActivityIndicator color="#FFF5EC" />
                ) : (
                    <Text style={styles.swapBtnText}>{`↺ ${t('meal_planner_swap_meal_btn')}`}</Text>
                )}
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        paddingHorizontal: 18,
        paddingTop: 16,
        paddingBottom: 30,
    },
    backLink: {
        alignSelf: 'flex-start',
    },
    backLinkText: {
        color: '#8C6B46',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    mealEmoji: {
        marginTop: 22,
        textAlign: 'center',
        fontSize: 46,
    },
    mealTitle: {
        marginTop: 10,
        textAlign: 'center',
        color: '#2A1A11',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 24,
    },
    mealMeta: {
        marginTop: 6,
        textAlign: 'center',
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
    },
    card: {
        marginTop: 22,
        borderWidth: 1,
        borderColor: '#E0D4C4',
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    cardHeader: {
        color: '#8C6B46',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 1,
        marginBottom: 10,
    },
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        paddingVertical: 4,
    },
    bulletDot: {
        color: '#2A1A11',
        fontSize: 14,
        lineHeight: 20,
    },
    bulletText: {
        flex: 1,
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
        lineHeight: 20,
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
        fontSize: 14,
        lineHeight: 21,
    },
    tipCard: {
        marginTop: 16,
        borderLeftWidth: 3,
        borderLeftColor: colors.forest,
        backgroundColor: '#F1EEE7',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    tipText: {
        color: '#4A3D2E',
        fontFamily: 'Jost-Italic',
        fontStyle: 'italic',
        fontSize: 13,
        lineHeight: 19,
    },
    swapBtn: {
        marginTop: 24,
        borderRadius: 14,
        backgroundColor: 'rgb(216, 109, 51)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 17,
    },
    swapBtnDisabled: {
        opacity: 0.6,
    },
    swapBtnText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
        letterSpacing: 0.6,
    },
});
