import React from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import useLanguage from '../hooks/useLanguage';

const FILTERS = [
    { key: 'all', icon: '' },
    { key: 'new', icon: '🆕' },
    { key: 'saved', icon: '💾' },
    { key: 'dismissed', icon: '🚫' },
];

function timeAgoLabel(t, updatedAt) {
    if (!updatedAt) return '';
    const minutes = Math.floor((Date.now() - updatedAt) / 60000);
    if (minutes < 1) return t('updated_just_now');
    if (minutes < 60) return t('updated_minutes_ago', { count: minutes });
    const hours = Math.floor(minutes / 60);
    return t('updated_hours_ago', { count: hours });
}

export default function SuggestedRecipesScreen({
    groups,
    isLoading,
    updatedAt,
    filter,
    onChangeFilter,
    onRefresh,
    onBack,
    onViewRecipe,
    isRecipeSaved,
    dismissedIds,
    onToggleDismiss,
}) {
    const { t } = useLanguage();

    const totalRecipes = groups.reduce((sum, g) => sum + g.recipes.length, 0);

    const visibleGroups = groups
        .map((group) => ({
            ...group,
            recipes: group.recipes.filter((entry) => {
                const dismissed = dismissedIds.includes(entry.id);
                const saved = isRecipeSaved({ ...entry.recipe, image: entry.image });

                if (filter === 'dismissed') return dismissed;
                if (dismissed) return false;
                if (filter === 'saved') return saved;
                if (filter === 'new') return !saved;
                return true;
            }),
        }))
        .filter((group) => group.recipes.length > 0);

    return (
        <View style={styles.wrap}>
            <TouchableOpacity style={styles.backLink} activeOpacity={0.7} onPress={onBack}>
                <Text style={styles.backLinkText}>{t('back_btn')}</Text>
            </TouchableOpacity>

            <View style={styles.headerRow}>
                <Text style={styles.title}>{`✨ ${t('suggested_recipes_title')}`}</Text>
                <TouchableOpacity style={styles.refreshBtn} activeOpacity={0.85} onPress={onRefresh} disabled={isLoading}>
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#5D4F42" />
                    ) : (
                        <Text style={styles.refreshText}>{`🌿 ${t('refresh_btn')}`}</Text>
                    )}
                </TouchableOpacity>
            </View>

            <Text style={styles.subtitle}>
                {isLoading
                    ? t('generating_suggestions')
                    : `${timeAgoLabel(t, updatedAt)} · ${t('picks_from_fern', { count: totalRecipes })}`}
            </Text>

            <View style={styles.filterRow}>
                {FILTERS.map(({ key, icon }) => (
                    <TouchableOpacity
                        key={key}
                        activeOpacity={0.85}
                        onPress={() => onChangeFilter(key)}
                        style={[styles.filterChip, filter === key ? styles.filterChipActive : null]}
                    >
                        <Text style={[styles.filterChipText, filter === key ? styles.filterChipTextActive : null]}>
                            {icon ? `${icon} ` : ''}{t(`suggested_filter_${key}`)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {!isLoading && !visibleGroups.length ? (
                <Text style={styles.emptyText}>{t('no_suggestions_yet')}</Text>
            ) : null}

            {visibleGroups.map((group) => (
                <View key={group.id} style={styles.groupBlock}>
                    <Text style={styles.groupLabel}>{group.label}</Text>
                    {group.reason ? (
                        <View style={styles.groupReasonBox}>
                            <Text style={styles.groupReasonText}>{`🌿 ${group.reason}`}</Text>
                        </View>
                    ) : null}

                    {group.recipes.map((entry) => {
                        const dismissed = dismissedIds.includes(entry.id);
                        return (
                            <TouchableOpacity
                                key={entry.id}
                                activeOpacity={0.85}
                                style={styles.recipeCard}
                                onPress={() => onViewRecipe(entry)}
                            >
                                <View style={styles.recipeThumb}>
                                    {entry.image ? (
                                        <Image source={{ uri: entry.image }} style={styles.recipeThumbImage} />
                                    ) : (
                                        <Text style={styles.recipeThumbEmoji}>{entry.recipe.emoji}</Text>
                                    )}
                                </View>

                                <View style={styles.recipeInfo}>
                                    <Text style={styles.recipeTitle} numberOfLines={2}>{entry.recipe.title}</Text>
                                    <Text style={styles.recipeMeta} numberOfLines={1}>
                                        {[entry.recipe.cuisine, entry.recipe.mealType, entry.recipe.time ? `⏱ ${entry.recipe.time}` : null]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </Text>
                                    {entry.why ? (
                                        <Text style={styles.recipeWhy} numberOfLines={2}>{entry.why}</Text>
                                    ) : null}
                                </View>

                                <TouchableOpacity
                                    style={styles.dismissBtn}
                                    activeOpacity={0.7}
                                    onPress={(e) => {
                                        e.stopPropagation?.();
                                        onToggleDismiss(entry.id);
                                    }}
                                >
                                    <Text style={styles.dismissBtnText}>{dismissed ? '↺' : '×'}</Text>
                                </TouchableOpacity>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    backLink: {
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
    backLinkText: {
        color: '#7B5E3E',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    title: {
        flex: 1,
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 24,
    },
    refreshBtn: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#D4C9BA',
        backgroundColor: '#EDE7DE',
        paddingHorizontal: 16,
        paddingVertical: 10,
        minWidth: 90,
        alignItems: 'center',
    },
    refreshText: {
        color: '#5D4F42',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    subtitle: {
        marginTop: 6,
        color: '#8C7A5F',
        fontFamily: 'Jost-Italic',
        fontStyle: 'italic',
        fontSize: 13,
    },
    filterRow: {
        marginTop: 16,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    filterChip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#D4C9BA',
        backgroundColor: '#FBF8F2',
        paddingHorizontal: 14,
        paddingVertical: 9,
    },
    filterChipActive: {
        backgroundColor: '#173E20',
        borderColor: '#173E20',
    },
    filterChipText: {
        color: '#5D4F42',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    filterChipTextActive: {
        color: '#F1F7F1',
    },
    emptyText: {
        marginTop: 24,
        textAlign: 'center',
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
    },
    groupBlock: {
        marginTop: 26,
    },
    groupLabel: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 20,
        lineHeight: 26,
    },
    groupReasonBox: {
        marginTop: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#173E20',
        backgroundColor: '#F1EEE7',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    groupReasonText: {
        color: '#4A3D2E',
        fontFamily: 'Jost-Italic',
        fontStyle: 'italic',
        fontSize: 13,
        lineHeight: 18,
    },
    recipeCard: {
        marginTop: 14,
        flexDirection: 'row',
        gap: 12,
        borderWidth: 1,
        borderColor: '#E5DCCB',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        alignItems: 'flex-start',
    },
    recipeThumb: {
        width: 64,
        height: 64,
        borderRadius: 10,
        backgroundColor: '#EFE6D5',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    recipeThumbImage: {
        width: '100%',
        height: '100%',
    },
    recipeThumbEmoji: {
        fontSize: 26,
    },
    recipeInfo: {
        flex: 1,
    },
    recipeTitle: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 16,
        lineHeight: 20,
    },
    recipeMeta: {
        marginTop: 4,
        color: '#8C6B46',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },
    recipeWhy: {
        marginTop: 4,
        color: '#3E6B3E',
        fontFamily: 'Jost-Italic',
        fontStyle: 'italic',
        fontSize: 12,
        lineHeight: 16,
    },
    dismissBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F2ECE3',
    },
    dismissBtnText: {
        color: '#8C6B46',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        lineHeight: 16,
    },
});
