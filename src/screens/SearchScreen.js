import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ImageBackground,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { FEATURED_BLOGGERS } from '../constants/featuredBloggers';
import { colors, radius, shadow } from '../constants/tokens';
import { useSync } from '../hooks/useSync';
import RecipeDetailModal from '../components/RecipeDetailModal';
import { pickFirst, getRawRecipeId, normalizeRecipe, normalizeAiRecipe } from '../utils/recipeNormalize';
import { fetchRecipeImage } from '../utils/recipeImage';
import useLanguage from '../hooks/useLanguage';

const AI_SEARCH_URL = 'https://app.clickpickandcook.com/.netlify/functions/ai';

const SEARCH_SYSTEM_PROMPT = 'You are a world-class chef and culinary expert with deep knowledge of celebrity recipes, viral dishes, restaurant classics, and home cooking. The user will give you a search query. IMPORTANT: If the query is not related to food, cooking, ingredients, cuisines, or dishes — respond with exactly: [] (an empty JSON array, nothing else). If it is food-related, respond ONLY with a raw JSON array of 6 recipe objects, no markdown, no backticks, no explanation. SEARCH RULES: (1) If the query mentions a specific person, celebrity, chef, or restaurant — your FIRST result must be that exact named recipe as accurately as possible, followed by 4 closely related variations. (2) If the query is a specific dish — your FIRST result must be the most classic/authentic version, followed by 4 variations. (3) If the query is an ingredient — return 5 distinct dishes featuring it. Each object must have: title, emoji (1 emoji), cuisine, mealType (Breakfast/Lunch/Dinner/Dessert/Snack/Appetizer), time (e.g. "40 min"), difficulty (Easy/Medium/Hard), description (2 sentences), ingredients (string array with QUANTITIES: "2 cups flour", "1 egg", "3 tbsp butter"), instructions (string[]), notes (string or ""), photoSearch (a SPECIFIC plain English phrase of 3-5 words that includes the cuisine/style AND key visual distinguishing detail — e.g. "Korean gochujang glazed chicken" not just "grilled chicken", "tandoori chicken naan basmati" not just "grilled chicken" — must be different enough between similar recipes in this same response that photo searches return visually distinct images), matchType ("exact" if this is the specific named recipe the user searched for, "variation" for related recipes).';

function buildSearchUserMessage(query) {
    return `The user searched for: "${query}". Apply the search rules strictly: if this mentions a specific person or named recipe lead with that exact recipe first then 4 close variations. If it is a dish lead with the most authentic classic version then 4 variations. Make all 5 recipes realistic achievable and distinct. Return ONLY valid JSON array of exactly 6 recipes.`;
}

function parseAiRecipeList(rawText) {
    const cleaned = String(rawText || '')
        .trim()
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/, '')
        .trim();

    try {
        const parsed = JSON.parse(cleaned);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function SearchResultCard({ recipe, isSaved, onPress, t }) {
    return (
        <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.resultCard, shadow.card]}>
            <View style={styles.resultImageWrap}>
                <ImageBackground
                    source={recipe.image ? { uri: recipe.image } : null}
                    style={styles.resultImageBackground}
                >
                    {!recipe.image ? (
                        <Text style={styles.resultEmoji}>{recipe.emoji}</Text>
                    ) : null}
                </ImageBackground>
                {isSaved ? (
                    <View style={styles.savedBadge}>
                        <Text style={styles.savedBadgeText}>{t('results_saved_badge')}</Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.resultBody}>
                <Text style={styles.resultTitle}>{recipe.title}</Text>

                <View style={styles.resultTagsRow}>
                    {recipe.category ? (
                        <View style={styles.resultTag}><Text style={styles.resultTagText}>{recipe.category}</Text></View>
                    ) : null}
                    {recipe.meal ? (
                        <View style={styles.resultTag}><Text style={styles.resultTagText}>{recipe.meal}</Text></View>
                    ) : null}
                    {recipe.time ? (
                        <View style={styles.resultTag}><Text style={styles.resultTagText}>⏱ {recipe.time}</Text></View>
                    ) : null}
                </View>

                {recipe.description ? (
                    <Text style={styles.resultDescription}>{recipe.description}</Text>
                ) : null}

                {isSaved ? (
                    <>
                        <View style={styles.resultDivider} />
                        <Text style={styles.resultSavedNote}>{t('already_saved_indicator')}</Text>
                    </>
                ) : null}
            </View>
        </TouchableOpacity>
    );
}

function ActionButton({ label, icon, dark, onPress, style }) {
    return (
        <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.actionButton, dark ? styles.actionButtonDark : styles.actionButtonLight, style]}>
            <Text
                numberOfLines={1}
                style={[styles.actionButtonText, dark ? styles.actionButtonTextDark : styles.actionButtonTextLight]}
            >
                {icon ? `${icon} ` : ''}{label}
            </Text>
        </TouchableOpacity>
    );
}

function BloggerCard({ item, onPress }) {
    return (
        <TouchableOpacity style={styles.bloggerCardWrap} activeOpacity={0.85} onPress={onPress}>
            <View style={[styles.bloggerCard, { backgroundColor: item.color }]}>
                <Text style={styles.bloggerEmoji}>{item.emoji}</Text>
            </View>
            <Text style={styles.bloggerName}>{item.name}</Text>
        </TouchableOpacity>
    );
}

export default function SearchScreen({ user }) {
    const navigation = useNavigation();
    const route = useRoute();
    const { t } = useLanguage();
    const { data, pull, pushAllFromStorage, pushChangedFromStorage } = useSync(user);
    const [searchText, setSearchText] = useState('');
    const [cravingText, setCravingText] = useState('');
    const [isBloggersModalOpen, setIsBloggersModalOpen] = useState(false);
    const [bloggerQuery, setBloggerQuery] = useState('');
    const [followingBloggersLocal, setFollowingBloggersLocal] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [activeQuery, setActiveQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showOnlyMyRecipes, setShowOnlyMyRecipes] = useState(false);
    const [selectedRecipe, setSelectedRecipe] = useState(null);
    const [noteText, setNoteText] = useState('');
    const [isSavingRecipe, setIsSavingRecipe] = useState(false);
    const syncTimerRef = useRef(null);
    const isSyncingRef = useRef(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (route?.params?.openBloggers) {
            setIsBloggersModalOpen(true);
            navigation.setParams({ openBloggers: false });
        }
    }, [route?.params?.openBloggers, navigation]);

    useEffect(() => {
        if (isBloggersModalOpen) {
            pull();
        }
    }, [isBloggersModalOpen, pull]);

    useFocusEffect(
        useMemo(() => () => {
            pull();
        }, [pull])
    );

    useEffect(() => {
        return () => {
            if (syncTimerRef.current) {
                clearTimeout(syncTimerRef.current);
            }
        };
    }, []);

    const normalizeBlogger = (item) => {
        const featured = FEATURED_BLOGGERS.find((b) => b.id === item?.id || b.name === item?.name);
        return {
            id: item?.id || featured?.id,
            url: item?.url || featured?.url || '',
            name: item?.name || featured?.name || 'Unknown blogger',
            color: item?.color || featured?.color || '#4A7C2F',
            emoji: item?.emoji || featured?.emoji || '🍽',
            specialty: item?.specialty || featured?.specialty || 'Food recipes',
        };
    };

    useEffect(() => {
        const source = Array.isArray(data.followers) ? data.followers : [];
        const hasPendingSync = Boolean(syncTimerRef.current);
        if (hasPendingSync || isSyncingRef.current) {
            console.log('[bloggers-sync] ignoring remote update while local sync is pending', {
                remoteCount: source.length,
                pending: hasPendingSync,
                syncing: isSyncingRef.current,
            });
            return;
        }

        console.log('[bloggers-sync] applying remote followers', {
            count: source.length,
            ids: source.map((b) => b?.id).filter(Boolean),
        });
        setFollowingBloggersLocal(source.map(normalizeBlogger));
    }, [data.followers]);

    const persistFollowedBloggersLocal = async (nextFollowed) => {
        setFollowingBloggersLocal(nextFollowed);

        await AsyncStorage.setItem('cpc_followed_bloggers', JSON.stringify(nextFollowed));
        const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
        await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({
            ...cache,
            followers: nextFollowed,
        }));
    };

    const scheduleBloggersSync = (nextFollowed, reason) => {
        if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
        }

        console.log('[bloggers-sync] queued sync in 2000ms', {
            reason,
            count: nextFollowed.length,
            ids: nextFollowed.map((b) => b.id),
        });

        syncTimerRef.current = setTimeout(async () => {
            syncTimerRef.current = null;
            isSyncingRef.current = true;

            try {
                console.log('[bloggers-sync] uploading followed_bloggers', {
                    count: nextFollowed.length,
                    ids: nextFollowed.map((b) => b.id),
                });
                await pushAllFromStorage();

                console.log('[bloggers-sync] upload complete, pulling latest from backend');
                await pull();
                console.log('[bloggers-sync] pull complete after upload');
            } catch (e) {
                console.log('[bloggers-sync] upload/pull failed', e?.message || e);
                Alert.alert(t('sync_error'), t('sync_bloggers_error_desc'));
            } finally {
                isSyncingRef.current = false;
            }
        }, 2000);
    };

    const followingBloggers = followingBloggersLocal;
    const followingIds = useMemo(
        () => new Set(followingBloggers.map((b) => b.id)),
        [followingBloggers]
    );

    const visibleBloggers = FEATURED_BLOGGERS.filter((blogger) => {
        const q = bloggerQuery.trim().toLowerCase();
        if (!q) return true;
        return blogger.name.toLowerCase().includes(q) || blogger.specialty.toLowerCase().includes(q);
    });

    const savedRecipes = useMemo(
        () => (Array.isArray(data.recipes) ? data.recipes : []).map(normalizeRecipe),
        [data.recipes]
    );

    const findSavedRecipeByTitle = (title) => {
        const target = String(title || '').trim().toLowerCase();
        if (!target) return null;
        return savedRecipes.find((recipe) => recipe.title.trim().toLowerCase() === target) || null;
    };

    const isResultSaved = (title) => Boolean(findSavedRecipeByTitle(title));

    const visibleResults = useMemo(() => {
        let results = showOnlyMyRecipes
            ? searchResults.filter((recipe) => isResultSaved(recipe.title))
            : searchResults;

        // Deduplicate by ID — backend may send same recipe multiple times
        const seen = new Set();
        return results.filter((recipe) => {
            if (seen.has(recipe.id)) return false;
            seen.add(recipe.id);
            return true;
        });
    }, [searchResults, showOnlyMyRecipes, savedRecipes]);

    const savedCountInResults = useMemo(
        () => searchResults.filter((recipe) => isResultSaved(recipe.title)).length,
        [searchResults, savedRecipes]
    );

    const selectedIsSaved = useMemo(
        () => Boolean(selectedRecipe && findSavedRecipeByTitle(selectedRecipe.title)),
        [selectedRecipe, savedRecipes]
    );

    const performSearch = async (query) => {
        setActiveQuery(query);
        setHasSearched(true);
        setShowOnlyMyRecipes(false);
        setSearchResults([]);
        setIsSearching(true);
        scrollRef.current?.scrollTo({ y: 0, animated: false });

        try {
            const res = await fetch(AI_SEARCH_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'FernApp/1.0 (myaifern.com)',
                },
                body: JSON.stringify({
                    system: SEARCH_SYSTEM_PROMPT,
                    messages: [{ role: 'user', content: buildSearchUserMessage(query) }],
                    feature: 'recipe_search',
                    userId: user?.id || '',
                    locale: 'en',
                }),
            });

            const json = await res.json();
            const rawText = json?.content?.[0]?.text ?? '[]';
            const recipes = parseAiRecipeList(rawText).map(normalizeAiRecipe);
            setSearchResults(recipes);

            // Emoji is just a placeholder until each recipe's real photo loads in.
            recipes.forEach((recipe) => {
                fetchRecipeImage(recipe.photoSearch || recipe.title).then((url) => {
                    if (!url) return;
                    setSearchResults((prev) => prev.map((item) => (
                        item.id === recipe.id ? { ...item, image: url, _cloudPhotos: [url] } : item
                    )));
                    setSelectedRecipe((prev) => (
                        prev && prev.id === recipe.id ? { ...prev, image: url, _cloudPhotos: [url] } : prev
                    ));
                });
            });
        } catch (e) {
            console.warn('[ai-search] request failed', e);
            Alert.alert(t('search_failed'), t('ai_search_failed_desc'));
        } finally {
            setIsSearching(false);
        }
    };

    const runSearch = async () => {
        const query = searchText.trim();
        if (!query) {
            Alert.alert(t('search_alert_title'), t('search_alert_desc'));
            return;
        }

        await performSearch(query);
    };

    const runSuggestSomething = async () => {
        await performSearch('dinner idea');
    };

    const resetSearch = () => {
        setHasSearched(false);
        setSearchResults([]);
        setActiveQuery('');
        setShowOnlyMyRecipes(false);
        scrollRef.current?.scrollTo({ y: 0, animated: false });
    };

    const openSearchResultDetail = (recipe) => {
        const matched = findSavedRecipeByTitle(recipe.title);
        setSelectedRecipe(matched || recipe);
        setNoteText(matched?.note ?? '');
    };

    const syncRecipeCache = async (nextSaved) => {
        const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
        await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({ ...cache, recipes: nextSaved }));
    };

    const persistSelectedRecipeNote = async () => {
        if (!selectedRecipe) return;

        const trimmed = noteText.trim();
        setIsSavingRecipe(true);
        try {
            const storedSaved = JSON.parse(await AsyncStorage.getItem('rv4_saved') || 'null');
            const baseSaved = Array.isArray(storedSaved)
                ? storedSaved
                : (Array.isArray(data.recipes) ? data.recipes : []);

            const selectedTitle = String(selectedRecipe.title || '').trim().toLowerCase();
            const existingIndex = baseSaved.findIndex((item) => {
                const itemTitle = String(pickFirst(item?.title, item?.name, item?.recipe_name, item?.recipeTitle, '')).trim().toLowerCase();
                return itemTitle && itemTitle === selectedTitle;
            });

            let updatedSaved;
            if (existingIndex >= 0) {
                updatedSaved = baseSaved.map((item, idx) => {
                    if (idx !== existingIndex) return item;
                    const { notes, myNote, ...rest } = item;
                    return { ...rest, note: trimmed };
                });
            } else {
                updatedSaved = [
                    ...baseSaved,
                    {
                        id: `search-${Date.now()}`,
                        title: selectedRecipe.title,
                        emoji: selectedRecipe.emoji,
                        cuisine: selectedRecipe.category,
                        mealType: selectedRecipe.meal,
                        time: selectedRecipe.time,
                        difficulty: selectedRecipe.difficulty,
                        description: selectedRecipe.description,
                        ingredients: selectedRecipe.ingredients,
                        instructions: selectedRecipe.methodSteps,
                        note: trimmed,
                        photoSearch: selectedRecipe.photoSearch || '',
                        _cloudPhotos: selectedRecipe.image ? [selectedRecipe.image] : [],
                    },
                ];
            }

            await AsyncStorage.setItem('rv4_saved', JSON.stringify(updatedSaved));
            await syncRecipeCache(updatedSaved);

            await pushAllFromStorage();
            setSelectedRecipe(null);
            await pull();
        } catch (e) {
            console.warn('[ai-search] save recipe failed', e);
            Alert.alert(t('save_failed'), t('save_recipe_failed_desc'));
        } finally {
            setIsSavingRecipe(false);
        }
    };

    const handleDeleteSelectedRecipe = async () => {
        if (!selectedRecipe) return;

        Alert.alert(
            t('delete_recipe_title'),
            t('delete_recipe_desc', { title: selectedRecipe.title }),
            [
                { text: t('cancel_btn'), style: 'cancel' },
                {
                    text: t('delete_recipe_confirm'),
                    style: 'destructive',
                    onPress: async () => {
                        setIsSavingRecipe(true);
                        try {
                            const storedSaved = JSON.parse(await AsyncStorage.getItem('rv4_saved') || 'null');
                            const baseSaved = Array.isArray(storedSaved)
                                ? storedSaved
                                : (Array.isArray(data.recipes) ? data.recipes : []);

                            const selectedId = String(selectedRecipe.id || '').trim();
                            const selectedTitle = String(selectedRecipe.title || '').trim().toLowerCase();

                            const nextSaved = baseSaved.filter((recipe, index) => {
                                const rawId = getRawRecipeId(recipe, index).trim();
                                const rawTitle = String(pickFirst(recipe?.title, recipe?.name, recipe?.recipe_name, recipe?.recipeTitle, '')).trim().toLowerCase();
                                const idMatches = selectedId && rawId === selectedId;
                                const titleMatches = selectedTitle && rawTitle === selectedTitle;
                                return !(idMatches || titleMatches);
                            });

                            await AsyncStorage.setItem('rv4_saved', JSON.stringify(nextSaved));
                            await syncRecipeCache(nextSaved);

                            await pushChangedFromStorage({ saved: nextSaved });
                            setSelectedRecipe(null);
                            await pull();
                        } catch (e) {
                            console.warn('[ai-search] delete recipe failed', e);
                            Alert.alert(t('delete_recipe_failed_title'), t('delete_recipe_failed_desc'));
                        } finally {
                            setIsSavingRecipe(false);
                        }
                    },
                },
            ]
        );
    };

    const runCraving = () => {
        const query = cravingText.trim();
        Alert.alert(
            t('ask_fern_craving_title'),
            query ? t('ask_fern_craving_thinking', { query }) : t('ask_fern_craving_empty')
        );
    };

    const toggleFollow = async (blogger) => {
        const bloggerId = blogger.id;
        const removing = followingIds.has(bloggerId);
        const next = removing
            ? followingBloggers.filter((item) => item.id !== bloggerId)
            : [...followingBloggers, blogger];

        try {
            console.log('[bloggers-sync] local change', {
                action: removing ? 'delete' : 'add',
                bloggerId,
                bloggerName: blogger.name,
                nextCount: next.length,
            });
            await persistFollowedBloggersLocal(next);
            scheduleBloggersSync(next, removing ? 'delete' : 'add');
        } catch {
            Alert.alert(t('sync_error'), t('sync_bloggers_error_desc'));
        }
    };

    const openBloggerRecipes = async (blogger) => {
        try {
            await Linking.openURL(blogger.url);
        } catch {
            Alert.alert(t('recipes_tab'), t('open_recipes_failed_desc', { url: blogger.url }));
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
            <LinearGradient colors={['#FBF7EF', '#F7F1E6', '#FBF8F1']} style={styles.background}>
                <View style={styles.glowOne} />
                <View style={styles.glowTwo} />

                <ScrollView
                    ref={scrollRef}
                    contentContainerStyle={[styles.content, hasSearched ? styles.contentSearched : null]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentInsetAdjustmentBehavior="never"
                    automaticallyAdjustContentInsets={false}
                >

                    {!hasSearched ? (
                        <>
                            <View style={styles.hero}>
                                <View style={styles.wordmarkRow}>
                                    <Image source={require('../../assets/icon.png')} style={styles.heroIcon} resizeMode="contain" />
                                    <Text style={styles.wordmark}>fern</Text>
                                </View>
                                <Text style={styles.tagline}>{t('tagline')}</Text>
                            </View>

                            <Text style={styles.title}>
                                <Text style={styles.titleMain}>{t('cooking_tonight_line1')}</Text>
                                <Text style={styles.titleAccent}>{t('cooking_tonight_accent1')}</Text>
                                <Text style={styles.titleMain}>{'\n'}</Text>
                                <Text style={styles.sdad}>{t('cooking_tonight_accent2')}</Text>
                            </Text>

                            <Text style={styles.subtitle}>
                                {t('search_subtitle')}
                            </Text>

                            <View style={styles.searchCard}>
                                <TextInput
                                    value={searchText}
                                    onChangeText={setSearchText}
                                    placeholder={t('search_input_placeholder')}
                                    placeholderTextColor="#C7B59E"
                                    style={styles.searchInput}
                                    returnKeyType="search"
                                    onSubmitEditing={runSearch}
                                />
                                <TouchableOpacity activeOpacity={0.9} onPress={runSearch} style={styles.searchButton}>
                                    <Text style={styles.searchButtonText}>{t('search_btn')}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.quickActionsRow}>
                                <ActionButton
                                    label={t('circular_scanner')}
                                    icon="📸"
                                    onPress={() => Alert.alert(t('circular_scanner'), t('circular_scanner_stub_desc'))}
                                    style={styles.quickActionLeft}
                                />
                                <ActionButton
                                    label={t('suggest_something')}
                                    icon="🤔"
                                    dark
                                    onPress={runSuggestSomething}
                                    style={styles.quickActionRight}
                                />
                            </View>

                            <View style={styles.cravingCard}>
                                <Text style={styles.cravingLabel}>{t('i_am_craving')}</Text>
                                <TextInput
                                    value={cravingText}
                                    onChangeText={setCravingText}
                                    placeholder={t('craving_placeholder')}
                                    placeholderTextColor="#9F9E99"
                                    style={styles.cravingInput}
                                    returnKeyType="done"
                                    onSubmitEditing={runCraving}
                                    onFocus={() => {
                                        scrollRef.current?.scrollTo({
                                            y: 120,
                                            animated: true,
                                        });
                                    }}
                                />
                                <TouchableOpacity activeOpacity={0.9} onPress={runCraving} style={styles.cravingButton}>
                                    <Text style={styles.cravingButtonText}>{t('craving_btn')}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>{t('food_bloggers_title')}</Text>
                                <View style={styles.sectionHeaderActions}>
                                    <ActionButton
                                        label={t('ask_fern_btn')}
                                        icon="🌿"
                                        dark={false}
                                        onPress={() => Alert.alert(t('ask_fern_btn'), t('ask_fern_stub_desc'))}
                                        style={styles.askFernButton}
                                    />
                                    <TouchableOpacity activeOpacity={0.85} onPress={() => setIsBloggersModalOpen(true)}>
                                        <Text style={styles.manageLink}>{t('manage_link')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.bloggersRow}>
                                {followingBloggers.map((item) => (
                                    <BloggerCard key={item.id} item={item} onPress={() => setIsBloggersModalOpen(true)} />
                                ))}

                                <TouchableOpacity style={styles.bloggerCardWrap} activeOpacity={0.85} onPress={() => setIsBloggersModalOpen(true)}>
                                    <View style={[styles.bloggerCard, styles.followCard]}>
                                        <Text style={styles.followPlus}>+</Text>
                                    </View>
                                    <Text style={styles.bloggerName}>{t('follow_btn')}</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <View style={styles.resultsWrap}>
                            <View style={styles.resultsHeaderRow}>
                                <View style={styles.resultsHeaderTextWrap}>
                                    <Text style={styles.resultsHeaderTitle}>
                                        {t('results_title', {
                                            query: activeQuery.toUpperCase(),
                                            savedCount: savedCountInResults,
                                            aiCount: searchResults.length,
                                        })}
                                    </Text>
                                </View>
                                <TouchableOpacity activeOpacity={0.85} onPress={resetSearch} style={styles.newSearchBtn}>
                                    <Text style={styles.newSearchBtnText}>{t('new_search_btn')}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.filterPillRow}>
                                <View style={styles.filterPillLine} />
                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={() => setShowOnlyMyRecipes((v) => !v)}
                                    style={[styles.filterPill, showOnlyMyRecipes ? styles.filterPillActive : null]}
                                >
                                    <Text style={styles.filterPillText}>{t('from_my_recipes_filter')}</Text>
                                </TouchableOpacity>
                                <View style={styles.filterPillLine} />
                            </View>

                            {isSearching ? (
                                <View style={styles.loadingWrap}>
                                    <ActivityIndicator color={colors.forest} />
                                    <Text style={styles.loadingText}>{t('searching_results', { query: activeQuery })}</Text>
                                </View>
                            ) : visibleResults.length ? (
                                <View style={styles.resultsList}>
                                    {visibleResults.map((recipe) => (
                                        <SearchResultCard
                                            key={recipe.id}
                                            recipe={recipe}
                                            isSaved={isResultSaved(recipe.title)}
                                            onPress={() => openSearchResultDetail(recipe)}
                                            t={t}
                                        />
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.emptyResultsWrap}>
                                    <Text style={styles.emptyResultsTitle}>
                                        {showOnlyMyRecipes ? t('no_saved_recipes') : t('no_recipes_found')}
                                    </Text>
                                    <Text style={styles.emptyResultsSub}>
                                        {showOnlyMyRecipes
                                            ? t('turn_off_filter')
                                            : t('try_different_search')}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>

                <Modal
                    animationType="fade"
                    transparent
                    visible={isBloggersModalOpen}
                    onRequestClose={() => setIsBloggersModalOpen(false)}
                >
                    <View style={styles.modalBackdrop}>
                        <SafeAreaView style={styles.modalSafeArea}>
                            <View style={styles.modalCard}>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>{t('bloggers_title')}</Text>
                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        onPress={() => setIsBloggersModalOpen(false)}
                                        style={styles.modalCloseBtn}
                                    >
                                        <Text style={styles.modalCloseText}>×</Text>
                                    </TouchableOpacity>
                                </View>

                                <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                                    <Text style={styles.followingTitle}>{t('following_label', { count: followingBloggers.length })}</Text>

                                    {followingBloggers.map((blogger) => (
                                        <View key={`following-${blogger.id}`} style={styles.manageRowCard}>
                                            <View style={[styles.manageAvatar, { backgroundColor: blogger.color }]}>
                                                <Text style={styles.manageAvatarEmoji}>{blogger.emoji}</Text>
                                            </View>

                                            <View style={styles.manageMeta}>
                                                <Text style={styles.manageName}>{blogger.name}</Text>
                                                <Text style={styles.manageSpecialty}>{blogger.specialty}</Text>
                                            </View>

                                            <View style={styles.followingActions}>
                                                <TouchableOpacity activeOpacity={0.85} style={styles.followingActionBtn}>
                                                    <Text style={styles.followingActionText}>{t('blogger_new')}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity activeOpacity={0.85} style={styles.followingActionBtn} onPress={() => openBloggerRecipes(blogger)}>
                                                    <Text style={styles.followingRecipesText}>{t('blogger_recipes')}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity activeOpacity={0.85} style={styles.followingRemoveBtn} onPress={() => toggleFollow(blogger)}>
                                                    <Text style={styles.followingRemoveText}>×</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}

                                    <View style={styles.modalSearchWrap}>
                                        <TextInput
                                            value={bloggerQuery}
                                            onChangeText={setBloggerQuery}
                                            placeholder={t('blogger_search_placeholder')}
                                            placeholderTextColor="#AAA39A"
                                            style={styles.modalSearchInput}
                                        />
                                    </View>

                                    {visibleBloggers.map((blogger) => {
                                        const isFollowing = followingIds.has(blogger.id);

                                        return (
                                            <View key={`discover-${blogger.id}`} style={styles.manageRowCard}>
                                                <View style={[styles.manageAvatar, { backgroundColor: blogger.color }]}>
                                                    <Text style={styles.manageAvatarEmoji}>{blogger.emoji}</Text>
                                                </View>

                                                <View style={styles.manageMeta}>
                                                    <Text style={styles.manageName}>{blogger.name}</Text>
                                                    <Text style={styles.manageSpecialty}>{blogger.specialty}</Text>
                                                </View>

                                                <TouchableOpacity
                                                    activeOpacity={0.85}
                                                    onPress={() => toggleFollow(blogger)}
                                                    style={isFollowing ? styles.followingPill : styles.followPill}
                                                >
                                                    <Text style={isFollowing ? styles.followingPillText : styles.followPillText}>
                                                        {isFollowing ? t('blogger_following_pill') : t('blogger_follow_pill')}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        </SafeAreaView>
                    </View>
                </Modal>

                <RecipeDetailModal
                    recipe={selectedRecipe}
                    onClose={() => setSelectedRecipe(null)}
                    noteText={noteText}
                    onChangeNoteText={setNoteText}
                    isSaving={isSavingRecipe}
                    onSaveNote={persistSelectedRecipeNote}
                    isAlreadySaved={selectedIsSaved}
                    showSavedIndicator
                    onDeleteRecipe={selectedIsSaved ? handleDeleteSelectedRecipe : undefined}
                />
            </LinearGradient>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.parch,
    },
    background: {
        flex: 1,
        position: 'relative',
    },
    glowOne: {
        position: 'absolute',
        top: 70,
        left: -50,
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: 'rgba(28,58,26,0.06)',
    },
    glowTwo: {
        position: 'absolute',
        top: 140,
        right: -30,
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(232,101,26,0.05)',
    },
    content: {
        paddingHorizontal: 22,
        paddingTop: 0,
        paddingBottom: 20,
    },
    contentSearched: {
        paddingTop: 0,
        paddingBottom: 10,
    },
    hero: {
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 10,
    },
    wordmarkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    heroIcon: {
        width: 0,
        height: 0,
        tintColor: '#4D823D',
    },
    wordmark: {
        fontFamily: 'PlayfairDisplay-Regular',
        fontSize: 52,
        lineHeight: 72,
        color: '#204421',
    },
    tagline: {
        marginTop: 6,
        fontFamily: 'Jost-SemiBold',
        fontSize: 10,
        letterSpacing: 1.6,
        color: '#5B8F3D',
        textAlign: 'center',
    },
    title: {
        textAlign: 'center',
        marginTop: 6,
        marginBottom: 10,
    },
    titleMain: {
        fontFamily: 'Playfair-Regular',
        fontSize: 28,
        color: '#4B2412',
    },
    titleAccent: {
        fontFamily: 'Playfair-Italic',
        fontSize: 28,
        color: '#3F7A34'
    },
    subtitle: {
        textAlign: 'center',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
        marginTop: -5,
        color: '#8B6840',
        marginBottom: 22,
    },
    searchCard: {
        backgroundColor: '#FFFDF8',
        borderColor: '#E2CFB0',
        borderWidth: 2,
        borderRadius: 18,
        padding: 14,
        ...shadow.card,
        marginBottom: 22,
    },
    searchInput: {
        borderRadius: 14,
        backgroundColor: '#FFFDF8',
        color: '#7B5D3B',
        fontFamily: 'PlayfairDisplay-Italic',
        fontSize: 14,
        paddingHorizontal: 10,
        paddingVertical: 10,
        marginBottom: 12,
    },
    searchButton: {
        backgroundColor: colors.forest,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    searchButtonText: {
        color: '#FFF8EE',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 2.2,
    },
    quickActionsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 15,
    },
    actionButton: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadow.card,
    },
    actionButtonDark: {
        backgroundColor: '#3C2414',
    },
    actionButtonLight: {
        backgroundColor: colors.forest,
    },
    actionButtonText: {
        fontSize: 13,
    },
    actionButtonTextDark: {
        color: '#F3E5D5',
        fontFamily: 'Jost-SemiBold',
    },
    actionButtonTextLight: {
        color: '#F5F0E3',
        fontFamily: 'Jost-SemiBold',
    },
    quickActionLeft: {
        flex: 1,
    },
    quickActionRight: {
        flex: 1,
    },
    cravingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#9F804E',
        borderRadius: 12,
        padding: 5,
        marginBottom: 20,
    },
    cravingLabel: {
        color: '#F4E7CC',
        fontFamily: 'PlayfairDisplay-MediumItalic',
        fontSize: 12,
        flexShrink: 0,
        marginHorizontal: 12,
    },
    cravingInput: {
        flex: 1,
        minWidth: 0,
        backgroundColor: '#E6DBCA',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontFamily: 'Jost-SemiBold',
        fontSize: 10,
        color: '#86725B',
    },
    cravingButton: {
        width: 60,
        backgroundColor: '#3F2412',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginLeft: 10,
    },
    cravingButtonText: {
        color: '#F8ECDB',
        fontFamily: 'Jost-SemiBold',
        fontSize: 10,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    sectionTitle: {
        fontFamily: 'Jost-Bold',
        color: '#7A5A36',
        fontSize: 12,
        letterSpacing: 1.2,
        flexShrink: 1,
    },
    sectionHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginLeft: 8,
    },
    askFernButton: {
        flex: 0,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#F17821',
    },
    manageLink: {
        fontFamily: 'Jost-SemiBold',
        color: '#D43C6E',
        fontSize: 10,
    },
    bloggersRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 20,
        alignItems: 'flex-start',
    },
    bloggerCardWrap: {
        alignItems: 'center',
        width: 70,
    },
    bloggerCard: {
        width: 52,
        height: 52,
        borderRadius: 46,
        borderWidth: 1,
        borderColor: '#F8F4EC',
        alignItems: 'center',
        justifyContent: 'center',
        ...shadow.card,
    },
    bloggerEmoji: {
        fontSize: 34,
    },
    bloggerName: {
        marginTop: 10,
        fontFamily: 'Jost-SemiBold',
        color: '#7E5C31',
        fontSize: 12,
        textAlign: 'center',
    },
    followCard: {
        borderStyle: 'dashed',
        borderColor: '#DAC7AA',
        backgroundColor: '#F6EFE4',
    },
    followPlus: {
        fontSize: 22,
        color: '#2E1C10',
        marginTop: -2,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(16, 12, 8, 0.45)',
        paddingHorizontal: 12,
        paddingVertical: 18,
    },
    modalSafeArea: {
        flex: 1,
        justifyContent: 'center',
    },
    modalCard: {
        backgroundColor: '#F7F4EE',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#DDD0BB',
        maxHeight: '90%',
        overflow: 'hidden',
    },
    modalHeader: {
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#DDD0BB',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    modalTitle: {
        fontFamily: 'Playfair-Bold',
        color: '#2F1C10',
        fontSize: 18,
        lineHeight: 24,
    },
    modalCloseBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#CEBFA8',
        backgroundColor: '#EFE8DB',
    },
    modalCloseText: {
        fontSize: 28,
        color: '#8A6B47',
        marginTop: -2,
    },
    modalContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    followingTitle: {
        marginTop: 14,
        marginBottom: 12,
        fontFamily: 'Jost-Bold',
        fontSize: 16,
        letterSpacing: 1.8,
        color: '#7E5D3A',
    },
    manageRowCard: {
        backgroundColor: '#F9F7F3',
        borderWidth: 1,
        borderColor: '#D3C3AB',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 14,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
    },
    manageAvatar: {
        width: 34,
        height: 34,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },
    manageAvatarEmoji: {
        fontSize: 20,
    },
    manageMeta: {
        flex: 1,
        marginLeft: 8,
    },
    manageName: {
        fontFamily: 'Jost-Bold',
        fontSize: 18,
        lineHeight: 22,
        color: '#2E1A0F',
    },
    manageSpecialty: {
        marginTop: 2,
        fontFamily: 'Jost-Regular',
        fontSize: 10,
        lineHeight: 12,
        color: '#7D6040',
    },
    followingActions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
        gap: 8,
    },
    followingActionBtn: {
        borderWidth: 1,
        borderColor: '#D1C0A6',
        backgroundColor: '#F4EEE4',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    followingActionText: {
        color: '#8A6C4B',
        fontFamily: 'Jost-SemiBold',
        fontSize: 8,
    },
    followingRecipesText: {
        color: '#2E92F4',
        fontFamily: 'Jost-SemiBold',
        fontSize: 8,
    },
    followingRemoveBtn: {
        backgroundColor: '#F5DDE1',
        borderRadius: 6,
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    followingRemoveText: {
        fontSize: 12,
        color: '#D5464E',
        lineHeight: 14,
        marginTop: -1,
    },
    modalSearchWrap: {
        marginTop: 6,
        marginBottom: 10,
    },
    modalSearchInput: {
        borderWidth: 1,
        borderColor: '#D6C7B2',
        borderRadius: 14,
        backgroundColor: '#FCF9F4',
        paddingHorizontal: 16,
        paddingVertical: 13,
        fontFamily: 'Jost-Regular',
        color: '#624A31',
        fontSize: 12,
    },
    followPill: {
        backgroundColor: '#CB1B6D',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 9,
    },
    followPillText: {
        color: '#FFF5FB',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
    },
    followingPill: {
        borderWidth: 2,
        borderColor: '#A4D6B0',
        backgroundColor: '#E7F5E9',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 10,
    },
    followingPillText: {
        color: '#2F8550',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
    },
    resultsWrap: {
        marginTop: 0,
    },
    resultsHeaderRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 18,
    },
    resultsHeaderTextWrap: {
        flex: 1,
    },
    resultsHeaderTitle: {
        fontFamily: 'Jost-Bold',
        color: '#7A5A36',
        fontSize: 13,
        lineHeight: 19,
        letterSpacing: 0.6,
    },
    newSearchBtn: {
        borderWidth: 1,
        borderColor: '#DAC7AA',
        backgroundColor: '#FFFDF8',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        ...shadow.card,
    },
    newSearchBtnText: {
        fontFamily: 'Jost-SemiBold',
        color: colors.forest,
        fontSize: 11,
        textAlign: 'center',
    },
    filterPillRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 18,
    },
    filterPillLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#DDCBAE',
    },
    filterPill: {
        flexShrink: 0,
        borderWidth: 1,
        borderColor: '#A4D6B0',
        backgroundColor: '#E7F5E9',
        borderRadius: 999,
        paddingHorizontal: 16,
        paddingVertical: 9,
    },
    filterPillActive: {
        backgroundColor: colors.forest,
        borderColor: colors.forest,
    },
    filterPillText: {
        fontFamily: 'Jost-Bold',
        color: '#2F8550',
        fontSize: 11,
    },
    loadingWrap: {
        alignItems: 'center',
        paddingVertical: 50,
        gap: 12,
    },
    loadingText: {
        fontFamily: 'Jost-Regular',
        color: '#8B6840',
        fontSize: 12,
    },
    resultsList: {
        gap: 18,
    },
    resultCard: {
        backgroundColor: '#FFFDF8',
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#DCCFB8',
    },
    resultImageWrap: {
        height: 160,
        backgroundColor: '#E9E2D2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    resultImageBackground: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    savedBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: 'rgba(30,57,30,0.92)',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 12,
    },
    savedBadgeText: {
        color: '#F1F1E7',
        fontSize: 8,
        fontFamily: 'Jost-Bold',
        letterSpacing: 0.8,
    },
    resultEmoji: {
        fontSize: 48,
    },
    resultBody: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 16,
    },
    resultTitle: {
        color: '#3A2416',
        fontSize: 19,
        lineHeight: 24,
        fontFamily: 'PlayfairDisplay-Bold',
    },
    resultTagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
    },
    resultTag: {
        borderWidth: 1,
        borderColor: '#D7C39A',
        backgroundColor: '#F4ECD8',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    resultTagText: {
        color: '#8E6D49',
        fontSize: 11,
        fontFamily: 'Jost-SemiBold',
    },
    resultDescription: {
        marginTop: 12,
        color: '#7B5D3C',
        fontSize: 13,
        lineHeight: 19,
        fontFamily: 'PlayfairDisplay-Italic',
    },
    resultDivider: {
        marginTop: 14,
        marginBottom: 10,
        height: 1,
        backgroundColor: '#E5D8C8',
    },
    resultSavedNote: {
        color: '#2F6B2F',
        fontSize: 12,
        fontFamily: 'Jost-Bold',
    },
    emptyResultsWrap: {
        marginTop: 20,
        padding: 18,
        borderRadius: 20,
        backgroundColor: '#FFFDF8',
        borderWidth: 1,
        borderColor: '#DCCFB8',
        alignItems: 'center',
    },
    emptyResultsTitle: {
        color: colors.ink,
        fontSize: 16,
        fontFamily: 'Jost-Bold',
        textAlign: 'center',
    },
    emptyResultsSub: {
        marginTop: 6,
        color: colors.brown,
        fontSize: 12,
        fontFamily: 'Jost-Medium',
        textAlign: 'center',
    },
});