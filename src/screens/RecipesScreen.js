import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, shadow } from '../constants/tokens';
import { useSync } from '../hooks/useSync';

function pickFirst(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function getDifficultyLevel(difficulty) {
  const value = String(difficulty || '').trim().toLowerCase();
  if (value.includes('hard')) return 3;
  if (value.includes('medium') || value.includes('med')) return 2;
  return 1;
}

function toList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          return pickFirst(item.name, item.title, item.text, item.ingredient, item.step, item.value, '').trim();
        }
        return '';
      })
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/\n|,|;/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
}

function toSteps(value) {
  if (Array.isArray(value)) return toList(value);
  if (typeof value !== 'string') return [];
  const lines = value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  return value
    .split(/\.(?:\s+|$)/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function firstNonEmptyArray(...arrays) {
  for (const arr of arrays) {
    if (Array.isArray(arr) && arr.length) return arr;
  }
  return [];
}

function normalizeIdArray(value) {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => normalizeIdArray(item))
      .filter(Boolean);
  }

  if (value && typeof value === 'object') {
    return normalizeIdArray(
      pickFirst(
        value.id,
        value.uuid,
        value.recipe_id,
        value.recipeId,
        value._bookId,
      )
    );
  }

  if (value === undefined || value === null || value === '') return [];
  return [String(value)];
}

function normalizeRecipe(item, index) {
  const title = pickFirst(item?.title, item?.name, item?.recipe_name, item?.recipeTitle, 'Untitled recipe');
  const category = pickFirst(item?.cuisine, item?.category, item?.type, item?.mealType, 'Dinner');
  const meal = pickFirst(item?.slot, item?.meal, item?.course, 'Dinner');
  const time = pickFirst(item?.time, item?.minutes ? `${item.minutes} min` : null, item?.duration, '');
  const difficulty = pickFirst(item?.difficulty, item?.skillLevel, item?.level, 'Easy');
  const image = pickFirst(
    Array.isArray(item?._cloudPhotos) ? item._cloudPhotos[0] : null,
    item?._cloudPhotos?.[0],
    item?.image,
    item?.imageUrl,
    item?.photo,
    item?.thumbnail,
    item?.coverImage,
    item?.picture,
  );
  const id = pickFirst(item?.id, item?.uuid, item?.recipe_id, `${index}`);
  const description = pickFirst(item?.description, item?.summary, item?.blurb, item?.about, 'No description yet.');
  const servings = pickFirst(item?.servings, item?.serves, item?.yield, '4');
  const ingredients = firstNonEmptyArray(
    toList(item?.ingredients),
    toList(item?._ingredients),
    toList(item?.ingredientLines),
    toList(item?.shopping),
  );
  const methodSteps = firstNonEmptyArray(
    toSteps(item?.method),
    toSteps(item?.steps),
    toSteps(item?.instructions),
    toSteps(item?.directions),
  );
  const note = pickFirst(item?.note, item?.myNote, item?.notes, '');
  const bookIds = Array.from(new Set([
    ...normalizeIdArray(item?._bookId),
    ...normalizeIdArray(item?._bookIds),
  ]));

  return {
    id,
    title,
    category,
    meal,
    time,
    difficulty,
    image,
    description,
    servings,
    ingredients: ingredients.length ? ingredients : ['No ingredients listed yet'],
    methodSteps: methodSteps.length ? methodSteps : ['No method steps listed yet'],
    note,
    bookIds,
  };
}

function getRawRecipeId(item, index) {
  return String(pickFirst(item?.id, item?.uuid, item?.recipe_id, `${index}`));
}

function normalizeBook(item, index) {
  const title = pickFirst(item?.title, item?.name, item?.book_title, item?.label, `Cookbook ${index + 1}`);
  const subtitle = pickFirst(item?.subtitle, item?.description, item?.author, item?.owner, 'My cookbook');
  const cover = pickFirst(
    Array.isArray(item?._cloudPhotos) ? item._cloudPhotos[0] : null,
    item?._cloudPhotos?.[0],
    item?.image,
    item?.imageUrl,
    item?.cover,
    item?.coverImage,
    item?.thumbnail,
  );
  const recipes = firstNonEmptyArray(
    item?.recipes,
    item?.saved,
    item?.items,
    item?.recipe_ids,
  );
  const recipeCount = typeof item?.recipeCount === 'number'
    ? item.recipeCount
    : recipes.length;
  const recipeIds = Array.from(new Set([
    ...normalizeIdArray(item?.recipe_ids),
    ...normalizeIdArray(item?.recipeIds),
    ...normalizeIdArray(item?.recipeIDs),
    ...normalizeIdArray(item?.recipes),
    ...normalizeIdArray(item?.saved),
    ...normalizeIdArray(item?.items),
  ]));

  return {
    id: String(pickFirst(item?.id, item?.uuid, item?.book_id, `${index}`)),
    title,
    subtitle,
    cover,
    recipeCount,
    recipeIds,
  };
}

export default function RecipesScreen({ user }) {
  const route = useRoute();
  const { data, pushAllFromStorage } = useSync(user);
  const [tab, setTab] = useState('recipes');
  const [query, setQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [noteByRecipeId, setNoteByRecipeId] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const openRecipeDetail = (recipe) => {
    setSelectedRecipe(recipe);
    setNoteText(noteByRecipeId[recipe.id] ?? recipe.note ?? '');
  };

  const syncRecipeCache = async (nextSaved) => {
    const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
    const nextCache = {
      ...cache,
      recipes: nextSaved,
    };
    await AsyncStorage.setItem('fern_sync_cache', JSON.stringify(nextCache));
  };

  const persistRecipeNote = async () => {
    if (!selectedRecipe) return;

    const trimmed = noteText.trim();
    setIsSaving(true);
    try {
      const storedSaved = JSON.parse(await AsyncStorage.getItem('rv4_saved') || 'null');
      const baseSaved = Array.isArray(storedSaved)
        ? storedSaved
        : (Array.isArray(data.recipes) ? data.recipes : []);

      const selectedId = String(selectedRecipe.id);
      const selectedTitle = String(selectedRecipe.title || '').trim().toLowerCase();

      const updatedSaved = baseSaved.map((item, index) => {
        const itemId = getRawRecipeId(item, index);
        const itemTitle = String(pickFirst(item?.title, item?.name, item?.recipe_name, item?.recipeTitle, '')).trim().toLowerCase();
        const isMatch = itemId === selectedId || (selectedTitle && itemTitle === selectedTitle);
        if (!isMatch) return item;

        // Keep one canonical note field to avoid sending duplicates to backend.
        const { notes, myNote, ...rest } = item;
        return {
          ...rest,
          note: trimmed,
        };
      });

      await AsyncStorage.setItem('rv4_saved', JSON.stringify(updatedSaved));
      await syncRecipeCache(updatedSaved);

      setNoteByRecipeId((prev) => ({
        ...prev,
        [selectedId]: trimmed,
      }));

      await pushAllFromStorage();
      setSelectedRecipe(null);
    } catch (e) {
      console.warn('Save recipe note failed:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!selectedRecipe) return;
    await persistRecipeNote();
  };

  const recipes = useMemo(() => {
    const list = Array.isArray(data.recipes) ? data.recipes : [];
    return list.map(normalizeRecipe);
  }, [data.recipes]);

  const filteredRecipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((recipe) => {
      return [recipe.title, recipe.category, recipe.meal, recipe.difficulty]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [recipes, query]);

  const books = useMemo(() => {
    const list = Array.isArray(data.books) ? data.books : [];
    return list.map(normalizeBook);
  }, [data.books]);

  const booksWithMatchedCounts = useMemo(() => {
    return books.map((book) => ({
      ...book,
      matchedRecipeCount: recipes.filter((recipe) => recipe.bookIds.includes(book.id)).length,
    }));
  }, [books, recipes]);

  const selectedBookRecipes = useMemo(() => {
    if (!selectedBook) return [];

    const q = query.trim().toLowerCase();
    const filtered = recipes.filter((recipe) => {
      const matchesBookId = recipe.bookIds.includes(selectedBook.id);
      const matchesRecipeList = selectedBook.recipeIds.includes(String(recipe.id));
      if (!matchesBookId && !matchesRecipeList) return false;

      if (!q) return true;
      return [recipe.title, recipe.category, recipe.meal, recipe.difficulty]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });

    return filtered;
  }, [selectedBook, recipes, query]);

  React.useEffect(() => {
    const debugBooks = (Array.isArray(data.books) ? data.books : []).map((book) => ({
      id: pickFirst(book?.id, book?.uuid, book?.book_id, null),
      name: pickFirst(book?.name, book?.title, book?.book_title, null),
      recipe_ids: pickFirst(book?.recipe_ids, book?.recipeIds, book?.recipes, book?.saved, null),
      raw: book,
    }));

    const debugRecipes = (Array.isArray(data.recipes) ? data.recipes : []).map((recipe, index) => ({
      id: pickFirst(recipe?.id, recipe?.uuid, recipe?.recipe_id, `${index}`),
      title: pickFirst(recipe?.title, recipe?.name, recipe?.recipe_name, null),
      _bookId: pickFirst(recipe?._bookId, recipe?._bookIds, null),
      raw: recipe,
    }));

    const normalizedMatches = booksWithMatchedCounts.map((book) => ({
      bookId: book.id,
      title: book.title,
      recipeIdsFromBook: book.recipeIds,
      matchedRecipeCount: book.matchedRecipeCount,
      matchedRecipes: recipes
        .filter((recipe) => recipe.bookIds.includes(book.id) || book.recipeIds.includes(String(recipe.id)))
        .map((recipe) => ({ id: recipe.id, title: recipe.title, bookIds: recipe.bookIds })),
    }));

    console.log('[RecipesScreen] latest API books raw:', JSON.stringify(debugBooks, null, 2));
    console.log('[RecipesScreen] latest API saved raw:', JSON.stringify(debugRecipes, null, 2));
    console.log('[RecipesScreen] normalized cookbook matches:', JSON.stringify(normalizedMatches, null, 2));
  }, [data.books, data.recipes, booksWithMatchedCounts, recipes]);

  React.useEffect(() => {
    const requestedTab = route?.params?.openTab;
    if (requestedTab === 'recipes' || requestedTab === 'cookbooks') {
      setTab(requestedTab);
      setSelectedBook(null);
      setQuery('');
    }
  }, [route?.params?.openTab, route?.params?.requestKey]);

  React.useEffect(() => {
    if (tab !== 'cookbooks' && selectedBook) {
      setSelectedBook(null);
    }
  }, [tab, selectedBook]);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={styles.content}
      >
        {!selectedBook ? (
          <View style={styles.tabsRow}>
            <View style={styles.tabsPill}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setTab('recipes')}
                style={[styles.tabButton, tab === 'recipes' ? styles.tabButtonActive : null]}
              >
                <Text style={[styles.tabButtonText, tab === 'recipes' ? styles.tabButtonTextActive : null]}>
                  Recipes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setTab('cookbooks')}
                style={[styles.tabButton, tab === 'cookbooks' ? styles.tabButtonActive : null]}
              >
                <Text style={[styles.tabButtonText, tab === 'cookbooks' ? styles.tabButtonTextActive : null]}>
                  Cookbooks
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <TextInput
                placeholder="Search recipes..."
                placeholderTextColor="#AA9D8C"
                value={query}
                onChangeText={setQuery}
                style={styles.searchInput}
              />
            </View>
          </View>
        ) : null}

        {tab === 'recipes' ? (
          filteredRecipes.length ? (
            <View style={styles.grid}>
              {filteredRecipes.map((recipe) => (
                <TouchableOpacity
                  key={recipe.id}
                  activeOpacity={0.9}
                  onPress={() => {
                    setSelectedRecipe(recipe);
                    setNoteText(noteByRecipeId[recipe.id] ?? recipe.note ?? '');
                  }}
                  style={[styles.recipeCard, shadow.card]}
                >
                  <View style={styles.imageWrap}>
                    <ImageBackground
                      source={recipe.image ? { uri: recipe.image } : require('../../assets/icon.png')}
                      style={styles.recipeImage}
                      imageStyle={styles.recipeImageInner}
                    >
                      <View style={styles.badgePill}>
                        <Text style={styles.badgePillText}>📚 MY RECIPES</Text>
                      </View>
                    </ImageBackground>
                  </View>

                  <View style={styles.cardBody}>
                    <Text numberOfLines={2} style={styles.recipeTitle}>{recipe.title}</Text>
                    <Text numberOfLines={1} style={styles.recipeMeta}>
                      {recipe.category} • {recipe.meal}
                      {recipe.time ? ` • ${recipe.time}` : ''}
                    </Text>

                    {(noteByRecipeId[recipe.id] ?? recipe.note) ? (
                      <Text style={styles.noteHint}>Note saved</Text>
                    ) : null}

                    <View style={styles.difficultyPill}>
                      {Array.from({ length: 3 }, (_, i) => {
                        const dotIdx = i + 1;
                        const isFilled = dotIdx <= getDifficultyLevel(recipe.difficulty);
                        return (
                          <View
                            key={`${recipe.id}-dot-${dotIdx}`}
                            style={[
                              styles.difficultyDot,
                              isFilled ? styles.difficultyDotFilled : styles.difficultyDotEmpty,
                            ]}
                          />
                        );
                      })}
                      <Text style={styles.difficultyText}>{recipe.difficulty}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No saved recipes yet</Text>
              <Text style={styles.emptySub}>Saved recipes from sync will appear here.</Text>
            </View>
          )
        ) : (
          selectedBook ? (
            <View style={styles.bookDetailWrap}>
              <View style={styles.bookDetailActionsTop}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setSelectedBook(null)}
                  style={[styles.bookActionBtn, styles.bookActionBtnMuted]}
                >
                  <Text style={styles.bookActionTextLight}>← Back</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.bookDetailActionsRow}>
                <TouchableOpacity activeOpacity={0.85} style={[styles.bookActionBtn, styles.bookActionBtnMuted, styles.bookActionBtnWide]}>
                  <Text style={styles.bookActionTextLight}>＋ Add Recipes</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.85} style={[styles.bookActionBtn, styles.bookActionBtnGreen]}>
                  <Text style={styles.bookActionTextLight}>✏️ Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.85} style={[styles.bookActionBtn, styles.bookActionBtnShare]}>
                  <Text style={styles.bookActionTextLight}>✦ Share</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.85} style={[styles.bookActionBtn, styles.bookActionBtnDarkGreen]}>
                  <Text style={styles.bookActionTextLight}>🎙 Ask Fern</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity activeOpacity={0.85} style={styles.bookTrashBtn}>
                <Text style={styles.bookTrashText}>🗑</Text>
              </TouchableOpacity>

              <View style={styles.bookDetailCard}>
                <View style={[styles.bookDetailHeader, selectedBook.cover ? styles.bookDetailHeaderWithImage : null]}>
                  {selectedBook.cover ? (
                    <ImageBackground
                      source={{ uri: selectedBook.cover }}
                      style={styles.bookDetailHeaderImage}
                      imageStyle={styles.bookDetailHeaderImageInner}
                    >
                      <View style={styles.bookDetailHeaderOverlay} />
                    </ImageBackground>
                  ) : null}
                  <Text style={styles.bookDetailTitle}>{selectedBook.title}</Text>
                  <Text style={styles.bookDetailCount}>{selectedBookRecipes.length} RECIPE{selectedBookRecipes.length === 1 ? '' : 'S'}</Text>
                  <Text style={styles.bookDetailSparkle}>✦</Text>
                </View>

                <View style={styles.bookDetailPage}>
                  {selectedBookRecipes.length ? (
                    <View style={styles.bookRecipeGrid}>
                      {selectedBookRecipes.map((recipe) => (
                        <TouchableOpacity
                          key={`book-${selectedBook.id}-${recipe.id}`}
                          activeOpacity={0.9}
                          onPress={() => openRecipeDetail(recipe)}
                          style={[styles.bookRecipeCard, shadow.card]}
                        >
                          <ImageBackground
                            source={recipe.image ? { uri: recipe.image } : require('../../assets/icon.png')}
                            style={styles.bookRecipeImage}
                            imageStyle={styles.bookRecipeImageInner}
                          />
                          <View style={styles.bookRecipeBody}>
                            <Text numberOfLines={2} style={styles.bookRecipeTitle}>{recipe.title}</Text>
                            <Text numberOfLines={1} style={styles.bookRecipeMeta}>{recipe.category} · {recipe.meal}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.bookDetailEmpty}>
                      <Text style={styles.bookDetailEmptyTitle}>No recipes in this cookbook yet</Text>
                      <Text style={styles.bookDetailEmptySub}>Saved recipes with a matching book ID will appear here.</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.bookPagerRow}>
                <TouchableOpacity activeOpacity={0.85} style={[styles.bookPagerBtn, styles.bookPagerBtnDisabled]}>
                  <Text style={styles.bookPagerBtnDisabledText}>‹ Prev</Text>
                </TouchableOpacity>
                <Text style={styles.bookPagerText}>Page 1 of 1</Text>
                <TouchableOpacity activeOpacity={0.85} style={[styles.bookPagerBtn, styles.bookPagerBtnNext]}>
                  <Text style={styles.bookPagerBtnText}>Next ›</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : booksWithMatchedCounts.length ? (
            <View style={styles.cookbooksWrap}>
              <View style={[styles.cookbooksHero, shadow.strong]}>
                <Text style={styles.cookbooksHeroTitle}>My cookbooks</Text>
                <Text style={styles.cookbooksHeroSub}>Tap a cookbook to browse its recipes</Text>

                <TouchableOpacity style={styles.newBookBtn} activeOpacity={0.85}>
                  <Text style={styles.newBookBtnText}>+ NEW COOKBOOK</Text>
                </TouchableOpacity>

                <View style={styles.bookshelfDeck}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.bookshelfRow}
                  >
                    {booksWithMatchedCounts.map((book) => (
                      <TouchableOpacity
                        key={book.id}
                        activeOpacity={0.9}
                        onPress={() => {
                          setSelectedBook(book);
                          setQuery('');
                        }}
                        style={styles.bookSpine}
                      >
                        {book.cover ? (
                          <ImageBackground
                            source={{ uri: book.cover }}
                            style={styles.bookSpineCover}
                            imageStyle={styles.bookSpineCoverImage}
                          >
                            <View style={styles.bookOverlay} />
                          </ImageBackground>
                        ) : null}

                        <View style={styles.bookSpineLeftEdge} />
                        <View style={styles.bookSpineRightEdge} />

                        <View style={styles.bookSpineInner}>
                          <View style={styles.bookRuleTop} />

                          <View style={styles.bookLabelWrap}>
                            <Text numberOfLines={1} style={styles.bookSpineTitle}>{book.title}</Text>
                          </View>

                          <View style={styles.bookRuleBottom} />
                          <Text style={styles.bookSpineSparkle}>✦</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No cookbooks yet</Text>
              <Text style={styles.emptySub}>Cookbooks from your API sync will appear here.</Text>
            </View>
          )
        )}
      </ScrollView>

      <Modal
        visible={!!selectedRecipe}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRecipe(null)}
      >
        <View style={styles.overlayBackdrop}>
          <TouchableOpacity
            style={styles.overlayBackdropTap}
            activeOpacity={1}
            onPress={() => setSelectedRecipe(null)}
          />

          {selectedRecipe ? (
            <KeyboardAvoidingView
              style={styles.overlaySheetKeyboardAvoid}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
              <View style={styles.overlaySheet}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                  contentContainerStyle={styles.overlayContent}
                >
                  <View style={styles.overlayImageWrap}>
                    <ImageBackground
                      source={selectedRecipe.image ? { uri: selectedRecipe.image } : require('../../assets/icon.png')}
                      style={styles.overlayImage}
                      imageStyle={styles.overlayImageInner}
                    />

                    <TouchableOpacity
                      style={styles.overlayCloseBtn}
                      onPress={() => setSelectedRecipe(null)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.overlayCloseBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.overlayBody}>
                    <Text style={styles.overlayFoodEmoji}>🥗</Text>
                    <Text style={styles.overlayTitle}>{selectedRecipe.title}</Text>

                    <View style={styles.overlayMetaRow}>
                      <Text style={styles.overlayMetaText}>🌍 {selectedRecipe.category}</Text>
                      <Text style={styles.overlayMetaText}>🍽 {selectedRecipe.meal}</Text>
                      {selectedRecipe.time ? <Text style={styles.overlayMetaText}>⏱ {selectedRecipe.time}</Text> : null}

                      <View style={styles.overlayDifficultyPill}>
                        {Array.from({ length: 3 }, (_, i) => {
                          const dotIdx = i + 1;
                          const isFilled = dotIdx <= getDifficultyLevel(selectedRecipe.difficulty);
                          return (
                            <View
                              key={`detail-dot-${dotIdx}`}
                              style={[
                                styles.difficultyDot,
                                isFilled ? styles.difficultyDotFilled : styles.difficultyDotEmpty,
                              ]}
                            />
                          );
                        })}
                        <Text style={styles.overlayDifficultyText}>{selectedRecipe.difficulty}</Text>
                      </View>
                    </View>

                    <View style={styles.overlayDivider} />

                    <View style={styles.overlayDescriptionCard}>
                      <Text style={styles.overlayDescriptionText}>{selectedRecipe.description}</Text>
                    </View>

                    <View style={styles.overlayThumbsRow}>
                      <ImageBackground
                        source={selectedRecipe.image ? { uri: selectedRecipe.image } : require('../../assets/icon.png')}
                        style={styles.overlayThumbImage}
                        imageStyle={styles.overlayThumbImageInner}
                      />
                      <View style={styles.overlayCameraPlaceholder}>
                        <Text style={styles.overlayCameraIcon}>📷</Text>
                      </View>
                    </View>

                    <Text style={styles.overlaySectionTitle}>INGREDIENTS <Text style={styles.overlayServings}>• {selectedRecipe.servings} servings</Text></Text>

                    <View style={styles.overlayTopActionsRow}>
                      <TouchableOpacity style={styles.overlayActionPill}><Text style={styles.overlayActionText}>↕ Scale</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.overlayActionPill}><Text style={styles.overlayActionText}>🍷 Pair</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.overlayActionPill}><Text style={styles.overlayActionText}>🎨 Plate</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.overlayActionPill, styles.overlayActionPillCook]}><Text style={styles.overlayActionText}>🎙 Cook</Text></TouchableOpacity>
                    </View>

                    <View style={styles.overlayDivider} />

                    <View style={styles.overlayIngredientsList}>
                      {selectedRecipe.ingredients.map((ingredient, idx) => (
                        <View key={`${selectedRecipe.id}-ing-${idx}`} style={styles.overlayIngredientItem}>
                          <Text style={styles.overlayIngredientText}>- {ingredient}</Text>
                        </View>
                      ))}
                    </View>

                    <Text style={styles.overlayTipText}>💡 Tap any ingredient for Pro substitutions</Text>

                    <Text style={styles.overlaySectionTitle}>METHOD</Text>
                    <View style={styles.overlayDivider} />

                    {selectedRecipe.methodSteps.map((step, idx) => (
                      <View key={`${selectedRecipe.id}-step-${idx}`} style={styles.overlayStepRow}>
                        <View style={styles.overlayStepNum}><Text style={styles.overlayStepNumText}>{idx + 1}</Text></View>
                        <Text style={styles.overlayStepText}>{step}</Text>
                      </View>
                    ))}

                    <View style={styles.overlayDivider} />
                    <Text style={styles.overlaySectionTitle}>MY NOTE</Text>
                    <View style={styles.overlayDivider} />

                    <View style={styles.overlayNoteBox}>
                      <TextInput
                        multiline
                        placeholder="Add your own note - tips, substitutions, memories..."
                        placeholderTextColor="#A9A9A9"
                        value={noteText}
                        onChangeText={setNoteText}
                        style={styles.overlayNoteInput}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.overlaySaveNoteBtn, isSaving ? styles.disabledBtn : null]}
                      activeOpacity={0.85}
                      onPress={persistRecipeNote}
                      disabled={isSaving}
                    >
                      <Text style={styles.overlaySaveNoteBtnText}>SAVE NOTE</Text>
                    </TouchableOpacity>

                    <View style={styles.overlayDivider} />

                    <View style={styles.overlayBottomActionsWrap}>
                      <TouchableOpacity
                        style={[styles.overlayBottomBtn, styles.overlayBottomBtnDark, isSaving ? styles.disabledBtn : null]}
                        onPress={handleSaveRecipe}
                        disabled={isSaving}
                      >
                        <Text style={styles.overlayBottomBtnTextLight}>💾 SAVE</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.overlayBottomBtn, styles.overlayBottomBtnGreen]}><Text style={styles.overlayBottomBtnTextLight}>✨ Share</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.overlayBottomBtn, styles.overlayBottomBtnDark]}><Text style={styles.overlayBottomBtnTextLight}>🛒 List</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.overlayBottomBtn, styles.overlayBottomBtnInstacart]}><Text style={styles.overlayBottomBtnTextLight}>🥕 Instacart</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.overlayBottomBtn, styles.overlayBottomBtnEdit]}><Text style={styles.overlayBottomBtnTextLight}>✏️ Edit</Text></TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.overlayBottomBtn, styles.overlayBottomBtnClose]}
                        onPress={() => setSelectedRecipe(null)}
                      >
                        <Text style={styles.overlayBottomBtnTextDark}>Close</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.overlayBottomBtn, styles.overlayBottomBtnDelete]}><Text style={styles.overlayBottomBtnTextDelete}>🗑 Delete</Text></TouchableOpacity>
                    </View>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.parch,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
  },
  tabsPill: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#EFE4D2',
    borderColor: '#D9C9AF',
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.forest,
  },
  tabButtonText: {
    color: '#7B5E38',
    fontSize: 12,
    fontFamily: 'Jost-Bold',
  },
  tabButtonTextActive: {
    color: '#F5EFE6',
  },
  searchBox: {
    width: 160,
    flex: 1,
    borderWidth: 1,
    borderColor: '#D9C9AF',
    backgroundColor: '#FFFDF8',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 35,
    justifyContent: 'center',
  },
  searchInput: {
    color: colors.ink,
    fontSize: 10,
    fontFamily: 'Jost-Medium',
    padding: 0,
  },
  grid: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  recipeCard: {
    width: '48%',
    backgroundColor: '#FFFDF8',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DCCFB8',
  },
  imageWrap: {
    height: 100,
  },
  recipeImage: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  recipeImageInner: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  badgePill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    marginLeft: 8,
    backgroundColor: 'rgba(30, 57, 30, 0.96)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  badgePillText: {
    color: '#F1F1E7',
    fontSize: 8,
    fontFamily: 'Jost-Bold',
    letterSpacing: 0.8,
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    minHeight: 96,
  },
  recipeTitle: {
    color: '#3A2416',
    fontSize: 14,
    lineHeight: 18,
    minHeight: 36,
    fontFamily: 'PlayfairDisplay-Bold',
    textAlignVertical: 'top',
  },
  recipeMeta: {
    marginTop: 6,
    color: '#8E6D49',
    fontSize: 10,
    lineHeight: 14,
    minHeight: 14,
    fontFamily: 'PlayfairDisplay-Medium',
    fontStyle: 'italic',
  },
  noteHint: {
    marginTop: 4,
    color: '#2F6B2F',
    fontSize: 9,
    fontFamily: 'Jost-Bold',
  },
  difficultyPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D7C39A',
    backgroundColor: '#F4ECD8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
  },
  difficultyDotFilled: {
    backgroundColor: '#947117',
  },
  difficultyDotEmpty: {
    borderWidth: 1,
    borderColor: '#B99233',
    backgroundColor: 'transparent',
  },
  difficultyText: {
    marginLeft: 4,
    color: '#A17A12',
    fontSize: 12,
    fontFamily: 'Jost-Bold',
    fontStyle: 'italic',
  },
  emptyState: {
    marginTop: 36,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: '#DCCFB8',
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontFamily: 'Jost-Bold',
  },
  emptySub: {
    marginTop: 6,
    color: colors.brown,
    fontSize: 13,
    fontFamily: 'Jost-Medium',
  },
  cookbooksWrap: {
    marginTop: 22,
  },
  bookDetailWrap: {
    marginTop: 14,
    paddingBottom: 14,
  },
  bookDetailActionsTop: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  bookDetailActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bookActionBtn: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
  },
  bookActionBtnMuted: {
    backgroundColor: '#344337',
    borderColor: '#596B5B',
  },
  bookActionBtnWide: {
    paddingHorizontal: 16,
  },
  bookActionBtnGreen: {
    backgroundColor: '#356B29',
    borderColor: '#4B8A3D',
  },
  bookActionBtnShare: {
    backgroundColor: '#B2511C',
    borderColor: '#CC7032',
  },
  bookActionBtnDarkGreen: {
    backgroundColor: '#1E4B20',
    borderColor: '#2E6930',
  },
  bookActionTextLight: {
    color: '#F1EFE8',
    fontSize: 13,
    fontFamily: 'Jost-Bold',
  },
  bookTrashBtn: {
    marginTop: 12,
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F4F0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookTrashText: {
    fontSize: 22,
  },
  bookDetailCard: {
    marginTop: 18,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#ECE8DF',
    borderWidth: 1,
    borderColor: '#D3CCBE',
  },
  bookDetailHeader: {
    minHeight: 164,
    backgroundColor: '#A7C2E1',
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookDetailHeaderWithImage: {
    position: 'relative',
  },
  bookDetailHeaderImage: {
    ...StyleSheet.absoluteFillObject,
  },
  bookDetailHeaderImageInner: {
    resizeMode: 'cover',
  },
  bookDetailHeaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(130, 170, 215, 0.74)',
  },
  bookDetailTitle: {
    color: '#F7F2E8',
    fontSize: 28,
    lineHeight: 34,
    fontFamily: 'PlayfairDisplay-Bold',
    textAlign: 'center',
    zIndex: 1,
  },
  bookDetailCount: {
    marginTop: 8,
    color: 'rgba(243, 239, 229, 0.88)',
    fontSize: 12,
    letterSpacing: 3,
    fontFamily: 'Jost-SemiBold',
    zIndex: 1,
  },
  bookDetailSparkle: {
    marginTop: 18,
    color: 'rgba(243, 239, 229, 0.72)',
    fontSize: 20,
    zIndex: 1,
  },
  bookDetailPage: {
    minHeight: 360,
    backgroundColor: '#FAF8F4',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#D7D3CC',
  },
  bookRecipeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  bookRecipeCard: {
    width: '48%',
    backgroundColor: '#FFFDFC',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0D5C5',
  },
  bookRecipeImage: {
    height: 164,
    backgroundColor: '#E7E0D6',
  },
  bookRecipeImageInner: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  bookRecipeBody: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  bookRecipeTitle: {
    color: '#3A2416',
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'PlayfairDisplay-Bold',
  },
  bookRecipeMeta: {
    marginTop: 4,
    color: '#8E6D49',
    fontSize: 11,
    fontFamily: 'PlayfairDisplay-Italic',
  },
  bookDetailEmpty: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bookDetailEmptyTitle: {
    color: '#3A2416',
    fontSize: 18,
    fontFamily: 'Jost-Bold',
    textAlign: 'center',
  },
  bookDetailEmptySub: {
    marginTop: 8,
    color: '#80623F',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Jost-Regular',
    textAlign: 'center',
  },
  bookPagerRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bookPagerBtn: {
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  bookPagerBtnDisabled: {
    backgroundColor: '#2B3E36',
    opacity: 0.55,
  },
  bookPagerBtnNext: {
    backgroundColor: '#63402B',
  },
  bookPagerBtnDisabledText: {
    color: '#C4C7C3',
    fontSize: 14,
    fontFamily: 'Jost-Bold',
  },
  bookPagerBtnText: {
    color: '#F4ECDD',
    fontSize: 14,
    fontFamily: 'Jost-Bold',
  },
  bookPagerText: {
    color: '#977A4E',
    fontSize: 16,
    fontFamily: 'PlayfairDisplay-Bold',
  },
  cookbooksHero: {
    borderRadius: 28,
    backgroundColor: '#2B1107',
    paddingHorizontal: 16,
    paddingVertical: 22,
    overflow: 'hidden',
  },
  cookbooksHeroTitle: {
    color: '#E6D9C0',
    fontSize: 26,
    lineHeight: 32,
    fontFamily: 'PlayfairDisplay-Bold',
    opacity: 0.26,
  },
  cookbooksHeroSub: {
    marginTop: 6,
    color: '#8D6542',
    fontSize: 12,
    lineHeight: 20,
    fontFamily: 'Jost-Regular',
  },
  newBookBtn: {
    marginTop: 16,
    alignSelf: 'flex-start',
    borderRadius: 10,
    backgroundColor: colors.forest,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  newBookBtnText: {
    color: '#F3EEE4',
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: 'Jost-Bold',
  },
  bookshelfDeck: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: '#B68757',
    borderWidth: 1,
    borderColor: '#CAA47F',
    paddingVertical: 16,
  },
  bookshelfRow: {
    paddingHorizontal: 12,
    alignItems: 'stretch',
  },
  bookSpine: {
    width: 50,
    minHeight: 250,
    borderRadius: 6,
    backgroundColor: '#A97B4A',
    borderWidth: 1,
    borderColor: '#8E653E',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  bookSpineCover: {
    ...StyleSheet.absoluteFillObject,
  },
  bookSpineCoverImage: {
    borderRadius: 6,
  },
  bookOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(54, 30, 14, 0.55)',
    borderRadius: 6,
  },
  bookSpineLeftEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: 'rgba(229, 206, 165, 0.18)',
  },
  bookSpineRightEdge: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 7,
    backgroundColor: 'rgba(27, 13, 5, 0.65)',
  },
  bookSpineInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  bookLabelWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookSpineTitle: {
    color: '#F5ECE0',
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.2,
    fontFamily: 'PlayfairDisplay-Bold',
    transform: [{ rotate: '-90deg' }],
    width: 178,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bookRuleTop: {
    marginTop: 12,
    width: '74%',
    height: 3,
    borderRadius: 2,
    backgroundColor: '#D3AE52',
    borderWidth: 1,
    borderColor: '#B88E2E',
  },
  bookRuleBottom: {
    width: '74%',
    height: 3,
    borderRadius: 2,
    backgroundColor: '#D3AE52',
    borderWidth: 1,
    borderColor: '#B88E2E',
  },
  bookSpineSparkle: {
    marginTop: 8,
    color: '#E8E3DA',
    fontSize: 12,
    fontFamily: 'Jost-Bold',
  },

  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.34)',
    justifyContent: 'flex-end',
  },
  overlaySheetKeyboardAvoid: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  overlayBackdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  overlaySheet: {
    maxHeight: '92%',
    backgroundColor: '#F3EFE8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#D5C8B5',
    overflow: 'hidden',
  },
  overlayContent: {
    paddingBottom: 30,
  },
  overlayImageWrap: {
    overflow: 'hidden',
    height: 300,
  },
  overlayImage: {
    flex: 1,
  },
  overlayImageInner: {
    borderRadius: 22,
  },
  overlayCloseBtn: {
    position: 'absolute',
    right: 14,
    top: 14,
    width: 34,
    height: 34,
    borderRadius: 99,
    backgroundColor: 'rgba(26,14,5,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCloseBtnText: {
    color: '#fff',
    fontSize: 19,
    lineHeight: 20,
    fontFamily: 'Jost-Regular',
  },
  overlayBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  overlayFoodEmoji: {
    fontSize: 30,
  },
  overlayTitle: {
    marginTop: 8,
    color: '#2D1A0F',
    fontSize: 22,
    lineHeight: 30,
    fontFamily: 'PlayfairDisplay-Bold',
  },
  overlayMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  overlayMetaText: {
    color: '#7F6547',
    fontSize: 12,
    fontFamily: 'Jost-Regular',
  },
  overlayDifficultyPill: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#D3BE96',
    borderRadius: 999,
    backgroundColor: '#F5EEDB',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  overlayDifficultyText: {
    marginLeft: 4,
    color: '#977110',
    fontSize: 10,
    fontFamily: 'Jost-Bold',
  },
  overlayDivider: {
    marginTop: 14,
    marginBottom: 14,
    height: 1,
    backgroundColor: '#D8C8B0',
  },
  overlayDescriptionCard: {
    borderRadius: 8,
    borderLeftWidth: 6,
    borderLeftColor: '#265A34',
    backgroundColor: '#D8E6D7',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  overlayDescriptionText: {
    color: '#80623F',
    fontSize: 10,
    lineHeight: 16,
    fontFamily: 'PlayfairDisplay-Italic',
  },
  overlayThumbsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  overlayThumbImage: {
    width: 100,
    height: 100,
  },
  overlayThumbImageInner: {
    borderRadius: 10,
  },
  overlayCameraPlaceholder: {
    width: 100,
    height: 100,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D3BE96',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCameraIcon: {
    fontSize: 30,
    opacity: 0.65,
  },
  overlaySectionTitle: {
    marginTop: 16,
    color: '#214A2B',
    fontSize: 11,
    letterSpacing: 3,
    fontFamily: 'Jost-Bold',
  },
  overlayServings: {
    color: '#7B5D3C',
    letterSpacing: 0,
    fontFamily: 'Jost-Regular',
  },
  overlayTopActionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  overlayActionPill: {
    backgroundColor: '#1C512A',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  overlayActionPillCook: {
    backgroundColor: '#E96B1E',
  },
  overlayActionText: {
    color: '#F2F0E8',
    fontSize: 10,
    fontFamily: 'Jost-Bold',
  },
  overlayIngredientsList: {
    gap: 8,
  },
  overlayIngredientItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5D8C8',
    paddingBottom: 4,
  },
  overlayIngredientText: {
    color: '#795A39',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Jost-Regular',
  },
  overlayTipText: {
    marginTop: 14,
    color: '#1F140C',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'PlayfairDisplay-BoldItalic',
  },
  overlayStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5D8C8',
  },
  overlayStepNum: {
    width: 28,
    height: 28,
    borderRadius: 99,
    backgroundColor: '#1C512A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  overlayStepNumText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Jost-Bold',
  },
  overlayStepText: {
    flex: 1,
    color: '#7C5E3D',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Jost-Regular',
  },
  overlayNoteBox: {
    borderWidth: 1,
    borderColor: '#CDBA9F',
    borderRadius: 10,
    borderLeftWidth: 6,
    borderLeftColor: '#1C512A',
    backgroundColor: '#F8F5EF',
    minHeight: 100,
    marginLeft: -5,
    padding: 10,
  },
  overlayNoteInput: {
    color: '#1A0E05',
    fontSize: 12,
    lineHeight: 18,
    minHeight: 80,
    textAlignVertical: 'top',
    fontFamily: 'Jost-Regular',
  },
  overlaySaveNoteBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#C0A987',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#F8F5EF',
  },
  overlaySaveNoteBtnText: {
    color: '#7B5D3C',
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: 'Jost-Bold',
  },
  overlayBottomActionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  overlayBottomBtn: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  overlayBottomBtnDark: {
    backgroundColor: '#184626',
  },
  overlayBottomBtnGreen: {
    backgroundColor: '#2F6B2F',
  },
  overlayBottomBtnInstacart: {
    backgroundColor: '#0B9A4B',
  },
  overlayBottomBtnEdit: {
    backgroundColor: '#8A6538',
  },
  overlayBottomBtnClose: {
    backgroundColor: '#E5E4DD',
    borderWidth: 1,
    borderColor: '#D1C4AC',
  },
  overlayBottomBtnDelete: {
    backgroundColor: '#F7E7E9',
    borderWidth: 1,
    borderColor: '#EEB7C0',
  },
  overlayBottomBtnTextLight: {
    color: '#F1F1E8',
    fontSize: 10,
    fontFamily: 'Jost-Bold',
  },
  overlayBottomBtnTextDark: {
    color: '#21150D',
    fontSize: 10,
    fontFamily: 'Jost-Bold',
  },
  overlayBottomBtnTextDelete: {
    color: '#D34157',
    fontSize: 10,
    fontFamily: 'Jost-Bold',
  },
  disabledBtn: {
    opacity: 0.55,
  },
});
