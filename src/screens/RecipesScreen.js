import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ImageBackground,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, shadow } from '../constants/tokens';
import { useSync } from '../hooks/useSync';
import RecipeDetailModal from '../components/RecipeDetailModal';
import {
  pickFirst,
  getDifficultyLevel,
  firstNonEmptyArray,
  normalizeIdArray,
  normalizeRecipe,
  getRawRecipeId,
} from '../utils/recipeNormalize';
import { fetchRecipeImage } from '../utils/recipeImage';
import { addRecipeIngredientsToShoppingList } from '../utils/shoppingListSync';
import useLanguage from '../hooks/useLanguage';

function normalizeBook(item, index) {
  const title = pickFirst(item?.title, item?.name, item?.book_title, item?.label, `Cookbook ${index + 1}`);
  const subtitle = pickFirst(item?.subtitle, item?.description, item?.author, item?.owner, 'My cookbook');
  const cover = pickFirst(
    Array.isArray(item?._cloudPhotos) ? item._cloudPhotos[0] : null,
    item?._cloudPhotos?.[0],
    item?._photoUrl,
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
  const { t } = useLanguage();
  const route = useRoute();
  const { data, pull, pushAllFromStorage, pushChangedFromStorage } = useSync(user);
  const [tab, setTab] = useState('recipes');
  const [query, setQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [noteByRecipeId, setNoteByRecipeId] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [recipesLocal, setRecipesLocal] = useState([]);
  const [booksLocal, setBooksLocal] = useState([]);
  const attemptedImageFetchIds = useRef(new Set());

  useFocusEffect(
    useMemo(() => () => {
      pull();
    }, [pull])
  );

  React.useEffect(() => {
    setRecipesLocal(Array.isArray(data.recipes) ? data.recipes : []);
    setBooksLocal(Array.isArray(data.books) ? data.books : []);
  }, [data.books, data.recipes]);

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

  const handleAddSelectedRecipeToShoppingList = async () => {
    if (!selectedRecipe) return;

    const ingredients = Array.isArray(selectedRecipe.ingredients) ? selectedRecipe.ingredients : [];
    if (!ingredients.length) {
      Alert.alert(t('no_items'), t('no_items_desc'));
      return;
    }

    setIsSaving(true);
    try {
      const existingItems = Array.isArray(data.shopping) ? data.shopping : [];
      const { addedCount, checkedCount } = await addRecipeIngredientsToShoppingList(selectedRecipe, existingItems);

      await pushAllFromStorage();
      await pull();

      Alert.alert(t('added_title'), t('shopping_list_updated_desc', { added: addedCount, checked: checkedCount }));
    } catch (e) {
      console.warn('Add to shopping list failed:', e);
      Alert.alert(t('could_not_add_items_title'), t('save_error_desc'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecipe = async () => {
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
            setIsSaving(true);
            try {
              const storedSaved = JSON.parse(await AsyncStorage.getItem('rv4_saved') || 'null');
              const baseSaved = Array.isArray(storedSaved)
                ? storedSaved
                : (Array.isArray(recipesLocal) ? recipesLocal : []);

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
              setRecipesLocal(nextSaved);
              setNoteByRecipeId((prev) => {
                const nextNotes = { ...prev };
                delete nextNotes[selectedId];
                return nextNotes;
              });

              const response = await pushChangedFromStorage({ saved: nextSaved });
              console.log('[recipes-sync] deleted saved recipe', {
                selectedRecipeId: selectedId,
                selectedRecipeTitle: selectedRecipe.title,
                remainingCount: nextSaved.length,
              });
              console.log('[recipes-sync] backend response after delete', response);

              setSelectedRecipe(null);
              await pull();
            } catch (e) {
              console.warn('Delete recipe failed:', e);
              Alert.alert(t('delete_recipe_failed_title'), t('delete_recipe_failed_desc'));
            } finally {
              setIsSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteBook = async () => {
    if (!selectedBook) return;

    Alert.alert(
      t('delete_cookbook_title'),
      t('delete_cookbook_desc', { title: selectedBook.title }),
      [
        { text: t('cancel_btn'), style: 'cancel' },
        {
          text: t('delete_recipe_confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              const storedBooks = JSON.parse(await AsyncStorage.getItem('rv4_books') || 'null');
              const baseBooks = Array.isArray(storedBooks)
                ? storedBooks
                : (Array.isArray(booksLocal) ? booksLocal : []);

              const selectedId = String(selectedBook.id || '').trim();
              const selectedTitle = String(selectedBook.title || '').trim().toLowerCase();

              const nextBooks = baseBooks.filter((book, index) => {
                const rawId = String(pickFirst(book?.id, book?.uuid, book?.book_id, `${index}`)).trim();
                const rawTitle = String(pickFirst(book?.title, book?.name, book?.book_title, '')).trim().toLowerCase();
                const idMatches = selectedId && rawId === selectedId;
                const titleMatches = selectedTitle && rawTitle === selectedTitle;
                return !(idMatches || titleMatches);
              });

              await AsyncStorage.setItem('rv4_books', JSON.stringify(nextBooks));
              setBooksLocal(nextBooks);

              const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
              await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({
                ...cache,
                books: nextBooks,
              }));

              const response = await pushChangedFromStorage({ books: nextBooks });
              console.log('[books-sync] deleted cookbook', {
                selectedBookId: selectedId,
                selectedBookTitle: selectedBook.title,
                remainingCount: nextBooks.length,
              });
              console.log('[books-sync] backend response after delete', response);

              setSelectedBook(null);
              await pull();
            } catch (e) {
              console.warn('Delete cookbook failed:', e);
              Alert.alert(t('delete_recipe_failed_title'), t('delete_cookbook_failed_desc'));
            }
          },
        },
      ]
    );
  };

  const recipes = useMemo(() => {
    const list = Array.isArray(recipesLocal) ? recipesLocal : [];
    const normalized = list.map(normalizeRecipe);

    // Deduplicate by ID — backend may send same recipe multiple times
    const seen = new Set();
    return normalized.filter((recipe) => {
      if (seen.has(recipe.id)) return false;
      seen.add(recipe.id);
      return true;
    });
  }, [recipesLocal]);

  React.useEffect(() => {
    recipes.forEach((recipe) => {
      if (recipe.image || attemptedImageFetchIds.current.has(recipe.id)) return;
      attemptedImageFetchIds.current.add(recipe.id);

      fetchRecipeImage(recipe.title).then((url) => {
        if (!url) return;
        setRecipesLocal((prev) => prev.map((item, index) => (
          getRawRecipeId(item, index) === String(recipe.id) ? { ...item, _cloudPhotos: [url] } : item
        )));
        setSelectedRecipe((prev) => (
          prev && prev.id === recipe.id ? { ...prev, image: url, _cloudPhotos: [url] } : prev
        ));
      });
    });
  }, [recipes]);

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
    const list = Array.isArray(booksLocal) ? booksLocal : [];
    const normalized = list.map(normalizeBook);

    // Deduplicate by ID — backend may send same book multiple times
    const seen = new Set();
    return normalized.filter((book) => {
      if (seen.has(book.id)) return false;
      seen.add(book.id);
      return true;
    });
  }, [booksLocal]);

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
                  {t('recipes_tab')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setTab('cookbooks')}
                style={[styles.tabButton, tab === 'cookbooks' ? styles.tabButtonActive : null]}
              >
                <Text style={[styles.tabButtonText, tab === 'cookbooks' ? styles.tabButtonTextActive : null]}>
                  {t('cookbooks_tab')}
                </Text>
              </TouchableOpacity>
            </View>

            {tab === 'recipes' ? (
              <View style={styles.searchBox}>
                <TextInput
                  placeholder={t('search_recipes_placeholder')}
                  placeholderTextColor="#AA9D8C"
                  value={query}
                  onChangeText={setQuery}
                  style={styles.searchInput}
                />
              </View>
            ) : null}
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
                        <Text style={styles.badgePillText}>{t('my_recipes_badge')}</Text>
                      </View>
                    </ImageBackground>
                  </View>

                  <View style={styles.cardBody}>
                    <Text numberOfLines={2} style={styles.recipeTitle}>{recipe.title}</Text>
                    <Text numberOfLines={2} style={styles.recipeMeta}>
                      {recipe.category} • {recipe.meal}
                      {recipe.time ? ` • ${recipe.time}` : ''}
                    </Text>

                    <Text style={styles.noteHint}>
                      {(noteByRecipeId[recipe.id] ?? recipe.note)
                        ? t('note_saved_badge')
                        : ' '}
                    </Text>

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
              <Text style={styles.emptyTitle}>{t('no_saved_recipes_title')}</Text>
              <Text style={styles.emptySub}>{t('no_saved_recipes_sub')}</Text>
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
                  <Text style={styles.bookActionTextLight}>{t('back_btn')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.bookDetailActionsRow}>
                <TouchableOpacity activeOpacity={0.85} style={[styles.bookActionBtn, styles.bookActionBtnMuted, styles.bookActionBtnWide]}>
                  <Text style={styles.bookActionTextLight}>{t('add_recipes_btn')}</Text>
                </TouchableOpacity>
                {/* <TouchableOpacity activeOpacity={0.85} style={[styles.bookActionBtn, styles.bookActionBtnGreen]}>
                  <Text style={styles.bookActionTextLight}>{t('edit_btn_recipes')}</Text>
                </TouchableOpacity> */}
                <TouchableOpacity activeOpacity={0.85} style={[styles.bookActionBtn, styles.bookActionBtnShare]}>
                  <Text style={styles.bookActionTextLight}>{t('share_btn')}</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.85} style={[styles.bookActionBtn, styles.bookActionBtnDarkGreen]}>
                  <Text style={styles.bookActionTextLight}>{t('ask_fern_recipes')}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity activeOpacity={0.85} style={styles.bookTrashBtn} onPress={handleDeleteBook}>
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
                  <Text style={styles.bookDetailCount}>
                    {t(selectedBookRecipes.length === 1 ? 'recipe_count_singular' : 'recipe_count_plural', { count: selectedBookRecipes.length })}
                  </Text>
                  <Text style={styles.bookDetailSparkle}>✦</Text>
                </View>

                <View style={styles.bookDetailPage}>
                  {selectedBookRecipes.length ? (
                    <View style={styles.bookRecipeGrid}>
                      {selectedBookRecipes.map((recipe, idx) => (
                        <TouchableOpacity
                          key={`book-${selectedBook.id}-${recipe.id}`}
                          activeOpacity={0.9}
                          onPress={() => openRecipeDetail(recipe)}
                          style={[styles.bookRecipeCard, shadow.card, idx % 2 === 0 ? { marginRight: '4%' } : null]}
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
                      <Text style={styles.bookDetailEmptyTitle}>{t('no_recipes_cookbook')}</Text>
                      <Text style={styles.bookDetailEmptySub}>{t('no_recipes_cookbook_sub')}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* <View style={styles.bookPagerRow}>
                <TouchableOpacity activeOpacity={0.85} style={[styles.bookPagerBtn, styles.bookPagerBtnDisabled]}>
                  <Text style={styles.bookPagerBtnDisabledText}>‹ Prev</Text>
                </TouchableOpacity>
                <Text style={styles.bookPagerText}>Page 1 of 1</Text>
                <TouchableOpacity activeOpacity={0.85} style={[styles.bookPagerBtn, styles.bookPagerBtnNext]}>
                  <Text style={styles.bookPagerBtnText}>Next ›</Text>
                </TouchableOpacity>
              </View> */}
            </View>
          ) : booksWithMatchedCounts.length ? (
            <View style={styles.cookbooksWrap}>
              <View style={[styles.cookbooksHero, shadow.strong]}>
                <Text style={styles.cookbooksHeroTitle}>{t('my_cookbooks_title')}</Text>
                <Text style={styles.cookbooksHeroSub}>{t('tap_cookbook_browse')}</Text>

                <TouchableOpacity style={styles.newBookBtn} activeOpacity={0.85}>
                  <Text style={styles.newBookBtnText}>{t('new_cookbook_btn')}</Text>
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
              <Text style={styles.emptyTitle}>{t('no_cookbooks_title')}</Text>
              <Text style={styles.emptySub}>{t('no_cookbooks_sub')}</Text>
            </View>
          )
        )}
      </ScrollView>

      <RecipeDetailModal
        recipe={selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
        noteText={noteText}
        onChangeNoteText={setNoteText}
        isSaving={isSaving}
        onSaveNote={persistRecipeNote}
        onDeleteRecipe={handleDeleteRecipe}
        onAddToList={handleAddSelectedRecipeToShoppingList}
      />
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
    fontSize: 12,
    fontFamily: 'Jost-Medium',
    padding: 2,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  bookActionBtnMuted: {
    backgroundColor: '#344337',
    borderColor: '#596B5B',
  },
  bookActionBtnWide: {
    paddingHorizontal: 12,
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
    fontSize: 10,
    fontFamily: 'Jost-Bold',
  },
  bookTrashBtn: {
    marginTop: 10,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F4F0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookTrashText: {
    fontSize: 14,
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
    rowGap: 14,
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
    fontSize: 8,
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

});
