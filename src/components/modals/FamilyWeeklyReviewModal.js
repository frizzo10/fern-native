import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadow } from '../../constants/tokens';
import useLanguage from '../../hooks/useLanguage';

// A once-a-week prompt (see FamilyScreen's fern_weekly_review_last_shown
// gate) that surfaces two things Family Hub otherwise never resurfaces on
// its own: saved recipes worth cooking again, and activities that keep
// recurring on the same weekday. Both lists are computed once by the
// caller (FamilyScreen) when the modal opens, not recomputed here on every
// render, so tapping "+ Add" on one suggestion doesn't reshuffle the rest.
export default function FamilyWeeklyReviewModal({
    visible,
    dayLabel,
    suggestedMeals,
    recurringActivities,
    addedMealIds,
    addedActivityKeys,
    onAddMeal,
    onAddActivity,
    onPlanWithFern,
    onDone,
    onSkip,
}) {
    const { t } = useLanguage();

    return (
        <Modal transparent animationType="slide" visible={visible} onRequestClose={onSkip}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.grabber} />

                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <Text style={styles.title}>{t('family_weekly_review_title', { day: dayLabel })}</Text>
                        <Text style={styles.subtitle}>{t('family_weekly_review_subtitle')}</Text>

                        <TouchableOpacity style={[styles.planFernBtn, shadow.card]} activeOpacity={0.88} onPress={onPlanWithFern}>
                            <Text style={styles.planFernBtnText}>{t('family_hub_plan_with_fern_btn')}</Text>
                        </TouchableOpacity>

                        <Text style={styles.sectionLabel}>{t('family_weekly_review_suggested_meals_label')}</Text>
                        {suggestedMeals.length ? (
                            suggestedMeals.map((meal) => {
                                const added = addedMealIds.has(meal.id);
                                return (
                                    <View key={meal.id} style={styles.row}>
                                        <View style={styles.rowIconWrap}>
                                            <Text style={styles.rowIconEmoji}>{meal.emoji}</Text>
                                        </View>
                                        <View style={styles.rowInfo}>
                                            <Text style={styles.rowTitle} numberOfLines={1}>{meal.title}</Text>
                                            <Text style={styles.rowMeta} numberOfLines={1}>
                                                {t('family_weekly_review_cooked_count', {
                                                    count: meal.cookedCount,
                                                    cuisine: meal.cuisine ? ` · ${meal.cuisine}` : '',
                                                })}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            style={[styles.addBtn, added ? styles.addBtnDone : null]}
                                            activeOpacity={0.85}
                                            disabled={added}
                                            onPress={() => onAddMeal(meal)}
                                        >
                                            <Text style={styles.addBtnText}>
                                                {added ? t('family_weekly_review_added_btn') : t('family_weekly_review_add_btn')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })
                        ) : (
                            <Text style={styles.emptyText}>{t('family_weekly_review_empty_meals')}</Text>
                        )}

                        <Text style={styles.sectionLabel}>{t('family_weekly_review_recurring_activities_label')}</Text>
                        {recurringActivities.length ? (
                            recurringActivities.map((activity) => {
                                const added = addedActivityKeys.has(activity.key);
                                return (
                                    <View key={activity.key} style={styles.row}>
                                        <View style={styles.rowIconWrap}>
                                            <Text style={styles.rowIconEmoji}>{activity.emoji}</Text>
                                        </View>
                                        <View style={styles.rowInfo}>
                                            <Text style={styles.rowTitle} numberOfLines={1}>{activity.label}</Text>
                                            <Text style={styles.rowMeta} numberOfLines={1}>
                                                {t('family_weekly_review_recurring_meta', { day: activity.dayLabel, count: activity.count })}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            style={[styles.addBtn, added ? styles.addBtnDone : null]}
                                            activeOpacity={0.85}
                                            disabled={added}
                                            onPress={() => onAddActivity(activity)}
                                        >
                                            <Text style={styles.addBtnText}>
                                                {added ? t('family_weekly_review_added_btn') : t('family_weekly_review_add_btn')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })
                        ) : (
                            <Text style={styles.emptyText}>{t('family_weekly_review_empty_activities')}</Text>
                        )}

                        <TouchableOpacity style={styles.doneBtn} activeOpacity={0.88} onPress={onDone}>
                            <Text style={styles.doneBtnText}>{t('family_weekly_review_done_btn')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.skipBtn} activeOpacity={0.85} onPress={onSkip}>
                            <Text style={styles.skipBtnText}>{t('family_weekly_review_skip_btn')}</Text>
                        </TouchableOpacity>
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
        maxHeight: '90%',
        backgroundColor: '#FBF8F2',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        overflow: 'hidden',
    },
    grabber: {
        alignSelf: 'center',
        marginTop: 10,
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#D9CDBD',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 30,
    },
    title: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 24,
        textAlign: 'center',
    },
    subtitle: {
        marginTop: 8,
        color: colors.forest,
        fontFamily: 'Jost-Medium',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 19,
    },
    planFernBtn: {
        marginTop: 20,
        backgroundColor: colors.orange,
        borderRadius: radius.full,
        alignItems: 'center',
        paddingVertical: 16,
    },
    planFernBtnText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 15,
    },
    sectionLabel: {
        marginTop: 24,
        color: '#8C7A5F',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
        letterSpacing: 0.6,
    },
    row: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: '#E5DCCB',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
    },
    rowIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: '#F1EEE7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowIconEmoji: {
        fontSize: 20,
    },
    rowInfo: {
        flex: 1,
    },
    rowTitle: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 15,
    },
    rowMeta: {
        marginTop: 3,
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },
    addBtn: {
        backgroundColor: colors.forest,
        borderRadius: radius.full,
        paddingHorizontal: 14,
        paddingVertical: 9,
    },
    addBtnDone: {
        backgroundColor: '#D8E4D6',
    },
    addBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    emptyText: {
        marginTop: 12,
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
        lineHeight: 19,
    },
    doneBtn: {
        marginTop: 28,
        backgroundColor: colors.forest,
        borderRadius: radius.full,
        alignItems: 'center',
        paddingVertical: 17,
    },
    doneBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 15,
    },
    skipBtn: {
        marginTop: 10,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: '#D4C9BA',
        alignItems: 'center',
        paddingVertical: 15,
    },
    skipBtnText: {
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
    },
});
