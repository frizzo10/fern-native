import React from 'react';
import { ActivityIndicator, Clipboard, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../constants/tokens';
import useLanguage from '../hooks/useLanguage';

// Rendered inline inside MealPlannerModal's single Modal (same reasoning as
// MealPlannerRecipeDetailView/MealPlannerPreferencesScreen) — not its own
// Modal, since stacking a second one crashes on iOS.
export default function MealPlannerShoppingListView({ groups, isLoading, onBack, onShopWithFern, isSaving }) {
    const { t } = useLanguage();

    const flatText = (groups || [])
        .map((group) => `${group.category.toUpperCase()}\n${group.items.map((item) => `- ${item}`).join('\n')}`)
        .join('\n\n');

    const handleCopyList = () => {
        Clipboard.setString(flatText);
    };

    const handleShare = async () => {
        try {
            await Share.share({ message: flatText || t('meal_planner_shopping_empty') });
        } catch (e) {
            console.log('[meal-planner] share shopping list failed', e?.message || e);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loadingState}>
                <Text style={styles.loadingEmoji}>🛒</Text>
                <Text style={styles.loadingTitle}>{t('meal_planner_shopping_loading_title')}</Text>
                <Text style={styles.loadingDesc}>{t('meal_planner_shopping_loading_desc')}</Text>
                <ActivityIndicator color={colors.forest} style={styles.loadingSpinner} />
            </View>
        );
    }

    return (
        <View style={styles.wrap}>
            <TouchableOpacity style={styles.backLink} activeOpacity={0.7} onPress={onBack}>
                <Text style={styles.backLinkText}>{`← ${t('meal_planner_back_to_week')}`}</Text>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
                <Text style={styles.headerEmoji}>🛒</Text>
                <Text style={styles.headerTitle}>{`🛒 ${t('meal_planner_shopping_title')}`}</Text>
                <Text style={styles.headerSubtitle}>{t('meal_planner_shopping_subtitle')}</Text>
            </View>

            {(groups || []).length ? (
                <View style={styles.listScroll}>
                    {groups.map((group) => (
                        <View key={group.category} style={styles.card}>
                            <Text style={styles.cardHeader}>{group.category.toUpperCase()}</Text>
                            {group.items.map((item, idx) => (
                                <View key={`${group.category}-${idx}`} style={styles.itemRow}>
                                    <Text style={styles.itemText}>{item}</Text>
                                </View>
                            ))}
                        </View>
                    ))}
                </View>
            ) : (
                <Text style={styles.emptyText}>{t('meal_planner_shopping_empty')}</Text>
            )}

            <TouchableOpacity
                style={[styles.shopWithFernBtn, isSaving ? styles.btnDisabled : null]}
                activeOpacity={0.85}
                onPress={onShopWithFern}
                disabled={isSaving}
            >
                {isSaving ? (
                    <ActivityIndicator color="#F1F7F1" />
                ) : (
                    <Text style={styles.shopWithFernBtnText}>{`🛍️ ${t('meal_planner_shop_with_fern_btn')}`}</Text>
                )}
            </TouchableOpacity>

            <View style={styles.bottomRow}>
                <TouchableOpacity style={styles.copyBtn} activeOpacity={0.85} onPress={handleCopyList}>
                    <Text style={styles.copyBtnText}>{`📋 ${t('meal_planner_copy_list_btn')}`}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareBtn} activeOpacity={0.85} onPress={handleShare}>
                    <Text style={styles.shareBtnText}>{`↗ ${t('meal_planner_share_btn')}`}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
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
    headerCenter: {
        alignItems: 'center',
        marginTop: 14,
    },
    headerEmoji: {
        fontSize: 40,
    },
    headerTitle: {
        color: '#2A1A11',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 24,
    },
    headerSubtitle: {
        marginTop: 6,
        color: '#8C7A5F',
        fontFamily: 'Jost-Italic',
        fontStyle: 'italic',
        fontSize: 13,
    },
    listScroll: {
        marginTop: 20,
    },
    card: {
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#E0D4C4',
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    cardHeader: {
        color: 'rgb(216, 109, 51)',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 1,
        marginBottom: 8,
    },
    itemRow: {
        paddingVertical: 9,
        borderBottomWidth: 1,
        borderBottomColor: '#F0E9DD',
        borderStyle: 'dashed',
    },
    itemText: {
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
    },
    emptyText: {
        marginTop: 40,
        textAlign: 'center',
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
    },
    shopWithFernBtn: {
        marginTop: 8,
        borderRadius: 14,
        backgroundColor: colors.forest,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 17,
    },
    shopWithFernBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
        textAlign: 'center',
    },
    btnDisabled: {
        opacity: 0.6,
    },
    bottomRow: {
        marginTop: 12,
        flexDirection: 'row',
        gap: 10,
    },
    copyBtn: {
        flex: 1,
        borderRadius: 14,
        backgroundColor: 'rgb(216, 109, 51)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    copyBtnText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    shareBtn: {
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgb(216, 109, 51)',
        backgroundColor: '#FBF8F2',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    shareBtnText: {
        color: 'rgb(216, 109, 51)',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    loadingState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 30,
    },
    loadingEmoji: {
        fontSize: 46,
    },
    loadingTitle: {
        marginTop: 14,
        textAlign: 'center',
        color: '#2A1A11',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 18,
    },
    loadingDesc: {
        marginTop: 8,
        textAlign: 'center',
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
    },
    loadingSpinner: {
        marginTop: 16,
    },
});
