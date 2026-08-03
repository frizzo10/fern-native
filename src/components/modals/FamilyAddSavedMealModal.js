import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import useLanguage from '../../hooks/useLanguage';
import { normalizeRecipe } from '../../utils/recipeNormalize';

export default function FamilyAddSavedMealModal({ visible, slotLabel, savedRecipes, onClose, onSelect }) {
    const { t } = useLanguage();
    const [search, setSearch] = useState('');

    const normalized = useMemo(() => (
        (Array.isArray(savedRecipes) ? savedRecipes : []).map((item, index) => normalizeRecipe(item, index))
    ), [savedRecipes]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return normalized;
        return normalized.filter((recipe) => recipe.title.toLowerCase().includes(query));
    }, [normalized, search]);

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
                        <Text style={styles.title}>{t('family_add_saved_meal_title', { slot: slotLabel })}</Text>
                        <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
                            <Text style={styles.closeText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchWrap}>
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder={t('search_recipes_placeholder')}
                            placeholderTextColor="#9A8D7F"
                            style={styles.searchInput}
                        />
                    </View>

                    <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
                        {filtered.length ? (
                            filtered.map((recipe) => (
                                <TouchableOpacity
                                    key={recipe.id}
                                    style={styles.row}
                                    activeOpacity={0.85}
                                    onPress={() => onSelect(recipe)}
                                >
                                    <View style={styles.rowIconWrap}>
                                        <Text style={styles.rowIconEmoji}>{recipe.emoji}</Text>
                                    </View>
                                    <View style={styles.rowInfo}>
                                        <Text style={styles.rowTitle} numberOfLines={1}>{recipe.title}</Text>
                                        <Text style={styles.rowMeta} numberOfLines={1}>
                                            {[recipe.category, recipe.time].filter(Boolean).join(' · ')}
                                        </Text>
                                    </View>
                                    <Text style={styles.rowChevron}>{'→'}</Text>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyTitle}>{t('no_saved_recipes_title')}</Text>
                                <Text style={styles.emptySub}>{t('no_saved_recipes_sub')}</Text>
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
        height: '85%',
        backgroundColor: '#FBF8F2',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        overflow: 'hidden',
    },
    topBar: {
        minHeight: 68,
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
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 18,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#D6C8B4',
        backgroundColor: '#F2ECE3',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeText: {
        color: '#8C6B46',
        fontFamily: 'Jost-Bold',
        fontSize: 22,
        lineHeight: 28,
    },
    searchWrap: {
        paddingHorizontal: 18,
        paddingTop: 14,
    },
    searchInput: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        backgroundColor: '#FFFFFF',
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    listContent: {
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: 30,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: '#E5DCCB',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
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
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 15,
    },
    rowMeta: {
        marginTop: 3,
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },
    rowChevron: {
        color: '#B0A08A',
        fontFamily: 'Jost-Bold',
        fontSize: 16,
    },
    emptyState: {
        marginTop: 40,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    emptyTitle: {
        color: '#2A1A11',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 16,
        textAlign: 'center',
    },
    emptySub: {
        marginTop: 8,
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
        textAlign: 'center',
    },
});
