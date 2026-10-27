import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

export default function FamilyAddSavedMealModal({ visible, slotLabel, dayActivities, dayLabel, savedRecipes, token, userId, onClose, onSelect, onAddFound }) {
    const { t, locale } = useLanguage();
    const [search, setSearch] = useState('');
    const [heard, setHeard] = useState('');
    const [finding, setFinding] = useState(false);
    const [found, setFound] = useState(null); // null = nothing searched yet, [] = nothing found
    const [addingTitle, setAddingTitle] = useState('');
    const [preview, setPreview] = useState(null); // { recipe, found } | null: look at a recipe before adding it

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
        setPreview(null);
        onClose();
    };

    const addFound = async (recipe) => {
        if (addingTitle) return;
        setAddingTitle(recipe.title);
        try {
            await onAddFound?.(recipe);
            setPreview(null);
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

                    {Array.isArray(dayActivities) && dayActivities.length ? (
                        <View style={styles.dayStrip}>
                            <Text style={styles.dayStripTitle}>{t('meal_day_activities', { day: dayLabel || '' })}</Text>
                            {dayActivities.map((a, i) => (
                                <Text key={`${a.label}-${i}`} style={styles.dayStripLine} numberOfLines={1}>
                                    {`${a.emoji || '•'} ${a.label}${a.time ? ` · ${a.time}` : ''}`}
                                </Text>
                            ))}
                        </View>
                    ) : null}

                    {preview ? (
                        <View style={{ flex: 1 }}>
                            <ScrollView contentContainerStyle={styles.previewContent} showsVerticalScrollIndicator={false}>
                                <TouchableOpacity onPress={() => setPreview(null)} accessibilityRole="button">
                                    <Text style={styles.previewBack}>{t('meal_preview_back')}</Text>
                                </TouchableOpacity>
                                <Text style={styles.previewTitle}>{`${preview.recipe.emoji || '🍽️'} ${preview.recipe.title}`}</Text>
                                <Text style={styles.rowMeta}>{[preview.recipe.category, preview.recipe.time].filter(Boolean).join(' · ')}</Text>
                                <Text style={styles.previewHead}>{t('meal_preview_ingredients')}</Text>
                                {(preview.recipe.ingredients || []).map((ing, i) => (
                                    <Text key={`i${i}`} style={styles.previewLine}>{`• ${typeof ing === 'string' ? ing : (ing?.text || ing?.item || '')}`}</Text>
                                ))}
                                <Text style={styles.previewHead}>{t('meal_preview_steps')}</Text>
                                {(preview.recipe.methodSteps || []).map((step, i) => (
                                    <Text key={`s${i}`} style={styles.previewLine}>{`${i + 1}. ${typeof step === 'string' ? step : (step?.text || '')}`}</Text>
                                ))}
                            </ScrollView>
                            <View style={styles.previewFooter}>
                                <TouchableOpacity
                                    style={styles.previewAddBtn}
                                    activeOpacity={0.88}
                                    disabled={Boolean(addingTitle)}
                                    onPress={() => (preview.found ? addFound(preview.recipe) : (setPreview(null), onSelect(preview.recipe)))}
                                >
                                    <Text style={styles.previewAddText}>{addingTitle ? '…' : t('meal_preview_add', { slot: slotLabel || '' })}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                    <>
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
                            {finding ? <ActivityIndicator color="#4E7A54" style={{ marginTop: 10 }} /> : null}
                            {found && !found.length ? <Text style={styles.heard}>{t('find_recipe_none')}</Text> : null}
                            {(found || []).map((r) => (
                                <View key={r.id} style={styles.row}>
                                    <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }} activeOpacity={0.85} onPress={() => setPreview({ recipe: r, found: true })}>
                                    <View style={styles.rowIconWrap}>
                                        <RecipePhoto title={r.title} image={r.image} style={styles.rowImage} fallback={<Text style={styles.rowIconEmoji}>{r.emoji}</Text>} />
                                    </View>
                                    <View style={styles.rowInfo}>
                                        <Text style={styles.rowTitle} numberOfLines={2}>{r.title}</Text>
                                        <Text style={styles.rowMeta} numberOfLines={2}>{[r.time, r.description].filter(Boolean).join(' · ')}</Text>
                                    </View>
                                    </TouchableOpacity>
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
                                onPress={() => setPreview({ recipe, found: false })}
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
                    </>
                    )}
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
        backgroundColor: '#ECF2E6',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: '#C8D6BE',
        overflow: 'hidden',
    },
    topBar: {
        minHeight: 68,
        paddingHorizontal: 18,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#C8D6BE',
        gap: 10,
    },
    title: {
        flex: 1,
        color: '#2F4535',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 18,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#C8D6BE',
        backgroundColor: '#ECF2E6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeText: {
        color: '#5C7262',
        fontFamily: 'Jost-Bold',
        fontSize: 22,
        lineHeight: 28,
    },
    findWrap: { paddingHorizontal: 18, paddingTop: 14 },
    micBtn: { backgroundColor: '#4E7A54', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
    micBtnOn: { backgroundColor: '#3F6845' },
    micBtnText: { color: '#fff', fontFamily: 'Jost-Bold', fontSize: 16 },
    heard: { color: '#6B7F66', fontFamily: 'Jost-Medium', fontSize: 13, marginTop: 8, textAlign: 'center' },
    addBtn: { backgroundColor: '#4E7A54', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
    addBtnText: { color: '#fff', fontFamily: 'Jost-Bold', fontSize: 13 },
    searchWrap: {
        paddingHorizontal: 18,
        paddingTop: 14,
    },
    searchInput: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#C8D6BE',
        backgroundColor: '#FFFFFF',
        color: '#2F4535',
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
        borderColor: '#C8D6BE',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
    },
    rowIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: '#ECF2E6',
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
        color: '#2F4535',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 15,
    },
    rowMeta: {
        marginTop: 3,
        color: '#6B7F66',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },
    rowChevron: {
        color: '#66795F',
        fontFamily: 'Jost-Bold',
        fontSize: 16,
    },
    dayStrip: { backgroundColor: '#DDE7D5', borderBottomWidth: 1, borderBottomColor: '#C8D6BE', paddingHorizontal: 18, paddingVertical: 10 },
    dayStripTitle: { color: '#3F5645', fontFamily: 'Jost-Bold', fontSize: 13, marginBottom: 2 },
    dayStripLine: { color: '#3F5645', fontFamily: 'Jost-Medium', fontSize: 13, marginTop: 1 },
    previewContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 20 },
    previewBack: { color: '#4E7A54', fontFamily: 'Jost-Bold', fontSize: 15, marginBottom: 10 },
    previewTitle: { color: '#2F4535', fontFamily: 'PlayfairDisplay-Bold', fontSize: 20, marginBottom: 4 },
    previewHead: { color: '#2F4535', fontFamily: 'Jost-Bold', fontSize: 14, marginTop: 16, marginBottom: 6, textTransform: 'uppercase' },
    previewLine: { color: '#2F4535', fontFamily: 'Jost-Regular', fontSize: 15, lineHeight: 22, marginBottom: 4 },
    previewFooter: { padding: 14, borderTopWidth: 1, borderTopColor: '#C8D6BE', backgroundColor: '#ECF2E6' },
    previewAddBtn: { backgroundColor: '#4E7A54', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
    previewAddText: { color: '#fff', fontFamily: 'Jost-Bold', fontSize: 16 },
    emptyState: {
        marginTop: 40,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    emptyTitle: {
        color: '#2F4535',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 16,
        textAlign: 'center',
    },
    emptySub: {
        marginTop: 8,
        color: '#6B7F66',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
        textAlign: 'center',
    },
});
