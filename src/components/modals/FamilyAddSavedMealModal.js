import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import useLanguage from '../../hooks/useLanguage';
import { normalizeRecipe } from '../../utils/recipeNormalize';
import { fetchRecipeImage } from '../../utils/recipeImage';
import { useContinuousMic } from '../../hooks/useContinuousMic';
import { findRecipes } from '../../services/recipeFindService';
import RecipePhoto from '../RecipePhoto';

// Remembered for the session so reopening the picker doesn't re-fetch.
const thumbCache = {};

function RecipeThumb({ recipe, token }) {
    const [url, setUrl] = useState(recipe.image || thumbCache[recipe.title] || null);
    useEffect(() => {
        if (url) return undefined;
        let alive = true;
        fetchRecipeImage(recipe.title, token).then((found) => {
            if (!found) return;
            thumbCache[recipe.title] = found;
            if (alive) setUrl(found);
        });
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recipe.title]);
    return (
        <View style={styles.rowIconWrap}>
            {url
                ? <Image source={{ uri: url }} style={styles.rowImage} resizeMode="cover" />
                : <Text style={styles.rowIconEmoji}>{recipe.emoji}</Text>}
        </View>
    );
}

export default function FamilyAddSavedMealModal({ visible, slotLabel, savedRecipes, token, userId, onClose, onSelect, onAddFound }) {
    const { t, locale } = useLanguage();
    const [search, setSearch] = useState('');
    const [heard, setHeard] = useState('');
    const [finding, setFinding] = useState(false);
    const [found, setFound] = useState(null); // null = nothing searched yet, [] = nothing found
    const [addingTitle, setAddingTitle] = useState('');

    const runFind = async (query) => {
        const q = String(query || '').trim();
        if (!q) return;
        setHeard(q);
        setFinding(true);
        setFound(null);
        try {
            setFound(await findRecipes({ query: q, locale, token, userId }));
        } catch (e) {
            setFound([]);
        } finally {
            setFinding(false);
        }
    };

    const mic = useContinuousMic({
        onTranscript: (text) => runFind(text),
        autoSpeakReply: false,
        locale,
        token,
    });

    const handleClose = () => {
        if (mic.isListening) mic.stop();
        setFound(null);
        setHeard('');
        setSearch('');
        onClose();
    };

    const addFound = async (recipe) => {
        if (addingTitle) return;
        setAddingTitle(recipe.title);
        try {
            await onAddFound?.(recipe);
            setFound(null);
            setHeard('');
            setSearch('');
        } finally {
            setAddingTitle('');
        }
    };

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
            onRequestClose={handleClose}
        >
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.topBar}>
                        <Text style={styles.title}>{t('family_add_saved_meal_title', { slot: slotLabel })}</Text>
                        <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={handleClose}>
                            <Text style={styles.closeText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    {onAddFound ? (
                        <View style={styles.findWrap}>
                            <TouchableOpacity
                                style={[styles.micBtn, mic.isListening ? styles.micBtnOn : null]}
                                activeOpacity={0.88}
                                disabled={finding || mic.isProcessing}
                                onPress={() => (mic.isListening ? mic.stop() : mic.start())}
                            >
                                <Text style={styles.micBtnText}>
                                    {mic.isListening ? t('find_recipe_listening') : (mic.isProcessing || finding) ? t('find_recipe_working') : `🎤 ${t('find_recipe_btn')}`}
                                </Text>
                            </TouchableOpacity>
                            {heard ? <Text style={styles.heard}>{`“${heard}”`}</Text> : null}
                            {finding ? <ActivityIndicator color="#E8742A" style={{ marginTop: 10 }} /> : null}
                            {found && !found.length ? <Text style={styles.heard}>{t('find_recipe_none')}</Text> : null}
                            {(found || []).map((r) => (
                                <View key={r.id} style={styles.row}>
                                    <View style={styles.rowIconWrap}>
                                        <RecipePhoto title={r.title} image={r.image} style={styles.rowImage} fallback={<Text style={styles.rowIconEmoji}>{r.emoji}</Text>} />
                                    </View>
                                    <View style={styles.rowInfo}>
                                        <Text style={styles.rowTitle} numberOfLines={2}>{r.title}</Text>
                                        <Text style={styles.rowMeta} numberOfLines={2}>{[r.time, r.description].filter(Boolean).join(' · ')}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.addBtn} activeOpacity={0.85} disabled={Boolean(addingTitle)} onPress={() => addFound(r)}>
                                        <Text style={styles.addBtnText}>{addingTitle === r.title ? '…' : t('find_recipe_add')}</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    ) : null}

                    <View style={styles.searchWrap}>
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            returnKeyType={onAddFound ? 'search' : 'done'}
                            onSubmitEditing={() => { if (onAddFound && search.trim()) runFind(search); }}
                            placeholder={t('search_recipes_placeholder')}
                            placeholderTextColor="#9A8D7F"
                            style={styles.searchInput}
                        />
                    </View>

                    <FlatList
                        data={filtered}
                        keyExtractor={(recipe) => String(recipe.id)}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        initialNumToRender={10}
                        windowSize={5}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item: recipe }) => (
                            <TouchableOpacity
                                style={styles.row}
                                activeOpacity={0.85}
                                onPress={() => onSelect(recipe)}
                            >
                                <RecipeThumb recipe={recipe} token={token} />
                                <View style={styles.rowInfo}>
                                    <Text style={styles.rowTitle} numberOfLines={1}>{recipe.title}</Text>
                                    <Text style={styles.rowMeta} numberOfLines={1}>
                                        {[recipe.category, recipe.time].filter(Boolean).join(' · ')}
                                    </Text>
                                </View>
                                <Text style={styles.rowChevron}>{'→'}</Text>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={(
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyTitle}>{t('no_saved_recipes_title')}</Text>
                                <Text style={styles.emptySub}>{t('no_saved_recipes_sub')}</Text>
                            </View>
                        )}
                    />
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
    findWrap: { paddingHorizontal: 18, paddingTop: 14 },
    micBtn: { backgroundColor: '#E8742A', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
    micBtnOn: { backgroundColor: '#B8481A' },
    micBtnText: { color: '#fff', fontFamily: 'Jost-Bold', fontSize: 16 },
    heard: { color: '#8C7A5F', fontFamily: 'Jost-Medium', fontSize: 13, marginTop: 8, textAlign: 'center' },
    addBtn: { backgroundColor: '#E8742A', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
    addBtnText: { color: '#fff', fontFamily: 'Jost-Bold', fontSize: 13 },
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
        overflow: 'hidden',
    },
    rowImage: {
        width: '100%',
        height: '100%',
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
