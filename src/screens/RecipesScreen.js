import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  Image,
  ImageBackground,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, shadow } from '../constants/tokens';
import { buildChapters, chapterNameById } from '../utils/cookbookChapters';
import { loadChapterMap, needsOrganizing, organizeBook } from '../services/cookbookOrganizer';
import { useSync, lastPush } from '../hooks/useSync';
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
import { uploadPhoto } from '../services/uploadPhotoService';
import NewCookbookModal from '../components/modals/NewCookbookModal';
import AddRecipesToCookbookModal from '../components/modals/AddRecipesToCookbookModal';
import ShareLinkModal from '../components/modals/ShareLinkModal';
import { translateRecipes, translateStrings } from '../services/translateService';
import AddSharedCookbookModal from '../components/modals/AddSharedCookbookModal';
import { createCookbookShareLink, fetchSharedCookbook, fetchSharedRecipe, parseShareLink } from '../services/shareService';
import useLanguage from '../hooks/useLanguage';
import { useTour } from '../services/TourContext';
import useEntitlement from '../hooks/useEntitlement';
import { TIERS } from '../constants/tiers';
import UpgradeGateModal from '../components/UpgradeGateModal';
import SaveToCookbookModal from '../components/modals/SaveToCookbookModal';
import { cookbookCount, FREE_COOKBOOK_LIMIT, recipeLimitReached } from '../utils/freeLimits';

function resolveCoverUri(cover) {
  if (!cover || typeof cover !== 'string') return null;
  const trimmed = cover.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('data:')) {
    // Strip any embedded whitespace/newlines from the base64 payload —
    // a data URI with stray whitespace fails to decode in RN's Image,
    // often silently, even though the string "looks" well-formed.
    const commaIndex = trimmed.indexOf(',');
    if (commaIndex === -1) return trimmed;
    const header = trimmed.slice(0, commaIndex + 1);
    const payload = trimmed.slice(commaIndex + 1).replace(/\s/g, '');
    return `${header}${payload}`;
  }
  // Some older cb_covers entries were stored as bare base64 with no data: prefix.
  return `data:image/jpeg;base64,${trimmed.replace(/\s/g, '')}`;
}

// Same 12 binding colors (and the same pick rule) as the web app's
// SPINE_COLORS / getSpineColor. On the web a book only gets one of these when
// it has no saved colorId (and no cover photo); books with a colorId fall back
// to the default tan spine, so native does the same.
const SPINE_PALETTE = [
  { bg: '#A63145', dark: '#5C1520', tc: '#A8D5A2' },
  { bg: '#2E6040', dark: '#0F2A14', tc: '#E8C97A' },
  { bg: '#1A3A60', dark: '#050E1C', tc: '#F0D88A' },
  { bg: '#9B6A10', dark: '#3A2400', tc: '#F5E8B8' },
  { bg: '#6A2A7A', dark: '#1F0A28', tc: '#F5D8E8' },
  { bg: '#2A6060', dark: '#0A2020', tc: '#F0E8C0' },
  { bg: '#7A3A10', dark: '#1F0D03', tc: '#A8D5A2' },
  { bg: '#3D5260', dark: '#1A222A', tc: '#E8DCC0' },
  { bg: '#E8D9B8', dark: '#C4B696', tc: '#5C3A1E' },
  { bg: '#1A1A1A', dark: '#000000', tc: '#7DBD6A' },
  { bg: '#9B3A20', dark: '#3A1208', tc: '#F5D8B8' },
  { bg: '#5A5A30', dark: '#2A2A15', tc: '#E8D8A8' },
];

function getSpinePalette(id) {
  const key = String(id || '');
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) & 0xFFFFFF;
  }
  return SPINE_PALETTE[Math.abs(hash) % SPINE_PALETTE.length];
}

// Deterministic per-book pseudo-random size so the shelf reads as a real
// mixed bookshelf (varied widths/heights) instead of uniform tiles, while
// staying stable across re-renders — re-rolling on every render would make
// spines visibly resize any time unrelated screen state changes.
function hashSeed(value) {
  const str = String(value || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const BOOK_SPINE_WIDTH_RANGE = [30, 46];
const BOOK_SPINE_HEIGHT_RANGE = [150, 190];

function getBookSpineSize(id) {
  const seed = hashSeed(id);
  const widthSpan = BOOK_SPINE_WIDTH_RANGE[1] - BOOK_SPINE_WIDTH_RANGE[0];
  const heightSpan = BOOK_SPINE_HEIGHT_RANGE[1] - BOOK_SPINE_HEIGHT_RANGE[0];
  const width = BOOK_SPINE_WIDTH_RANGE[0] + (seed % (widthSpan + 1));
  const height = BOOK_SPINE_HEIGHT_RANGE[0] + (Math.floor(seed / 7) % (heightSpan + 1));
  // Rotated title text runs the length of the spine — same ~46px margin
  // (padding + rules + sparkle) the spine's own paddingVertical/rule/sparkle sizes use.
  return { width, height, titleWidth: Math.max(90, height - 46) };
}

// Each editable recipe field may live under one of several legacy alias keys
// (see recipeNormalize.js's pickFirst chains). Editing should overwrite
// whichever alias key is already driving the displayed value rather than
// always writing the canonical key — otherwise a stale alias could keep
// winning pickFirst and the edit would silently not show up.
const RECIPE_FIELD_ALIASES = {
  title: { aliases: ['title', 'name', 'recipe_name', 'recipeTitle'], canonical: 'title' },
  category: { aliases: ['cuisine', 'category', 'type', 'mealType'], canonical: 'cuisine' },
  meal: { aliases: ['slot', 'meal', 'course'], canonical: 'meal' },
  time: { aliases: ['time'], canonical: 'time' },
  difficulty: { aliases: ['difficulty', 'skillLevel', 'level'], canonical: 'difficulty' },
  description: { aliases: ['description', 'summary', 'blurb', 'about'], canonical: 'description' },
  servings: { aliases: ['servings', 'serves', 'yield'], canonical: 'servings' },
  methodSteps: { aliases: ['method', 'steps', 'instructions', 'directions'], canonical: 'instructions' },
};

function applyRecipeFieldEdit(item, fieldKey, value) {
  const config = RECIPE_FIELD_ALIASES[fieldKey];
  if (!config) return { ...item, [fieldKey]: value };
  const existingKey = config.aliases.find((key) => item?.[key] !== undefined && item?.[key] !== null && item?.[key] !== '');
  const targetKey = existingKey || config.canonical;
  return { ...item, [targetKey]: value };
}

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
  const color = pickFirst(item?.color, null);

  return {
    id: String(pickFirst(item?.id, item?.uuid, item?.book_id, `${index}`)),
    title,
    subtitle,
    cover,
    color,
    colorId: pickFirst(item?.colorId, null),
    recipeCount,
    recipeIds,
  };
}

export default function RecipesScreen({ user }) {
  const { t, locale } = useLanguage();
  const route = useRoute();
  const { maybeAutoStart } = useTour();
  const { data, pull, pushAllFromStorage, pushChangedFromStorage } = useSync(user);

  useEffect(() => {
    maybeAutoStart('recipes');
  }, []);
  const [tab, setTab] = useState('recipes');
  const [query, setQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [noteByRecipeId, setNoteByRecipeId] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [recipesLocal, setRecipesLocal] = useState([]);
  const [booksLocal, setBooksLocal] = useState([]);
  const [isNewCookbookVisible, setIsNewCookbookVisible] = useState(false);
  const { hasAccess } = useEntitlement();
  const [cookbookGate, setCookbookGate] = useState(false);
  const openNewCookbook = async () => {
    if (!hasAccess(TIERS.PRO) && (await cookbookCount()) >= FREE_COOKBOOK_LIMIT) { setCookbookGate(true); return; }
    setIsNewCookbookVisible(true);
  };
  const [isSharedCbVisible, setIsSharedCbVisible] = useState(false);
  const openSharedCookbook = async () => {
    if (!hasAccess(TIERS.PRO) && (await cookbookCount()) >= FREE_COOKBOOK_LIMIT) { setCookbookGate(true); return; }
    setIsSharedCbVisible(true);
  };
  // Pasted share link -> new cookbook + all its recipes, saved and synced like any other.
  const handleAddSharedCookbook = async (linkText) => {
    try {
      const { kind, id } = parseShareLink(linkText);
      if (!kind) return { ok: false, error: 'shared_cb_err_link' };
      if (kind === 'recipe' || kind === 'unknown') {
        // A shared recipe link (or a bare id that is not a cookbook): save it to My Recipes.
        let recipe = null;
        try {
          recipe = await fetchSharedRecipe(id);
        } catch (e) {
          if (kind === 'recipe' || String(e?.message) !== 'not_found') throw e;
        }
        if (recipe) {
          const storedSaved = JSON.parse(await AsyncStorage.getItem('rv4_saved') || 'null');
          const baseSaved = Array.isArray(storedSaved) ? storedSaved : [];
          const key = recipe.title.trim().toLowerCase();
          if (baseSaved.some((r) => String(r?.title || '').trim().toLowerCase() === key)) return { ok: false, error: 'shared_rc_err_already' };
          if (!hasAccess(TIERS.PRO) && (await recipeLimitReached())) return { ok: false, error: 'shared_rc_err_limit' };
          const nextSaved = [...baseSaved, { ...recipe, id: `shared-${Date.now()}`, _bookIds: [] }];
          await AsyncStorage.setItem('rv4_saved', JSON.stringify(nextSaved));
          const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
          await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({ ...cache, recipes: nextSaved }));
          await pushChangedFromStorage({ saved: nextSaved });
          await pull();
          return { ok: true, recipe: true, name: recipe.title };
        }
      }
      const shared = await fetchSharedCookbook(linkText);
      const storedBooks = JSON.parse(await AsyncStorage.getItem('rv4_books') || 'null');
      const baseBooks = Array.isArray(storedBooks) ? storedBooks : (Array.isArray(booksLocal) ? booksLocal : []);
      if (baseBooks.some((b) => b?.sharedFrom === shared.id)) return { ok: false, error: 'shared_cb_err_already' };

      const stamp = Date.now();
      const bookId = `cb_${stamp}`;
      const newBook = {
        id: bookId, title: shared.name, name: shared.name, subtitle: 'Shared cookbook',
        color: '#1F5C3A', cover: shared.cover || '', recipeIds: [], sharedFrom: shared.id,
      };
      const storedSaved = JSON.parse(await AsyncStorage.getItem('rv4_saved') || 'null');
      const baseSaved = Array.isArray(storedSaved) ? storedSaved : [];
      const nextSaved = [
        ...baseSaved,
        ...shared.recipes.map((r, i) => ({ ...r, id: `shared-${stamp}-${i}`, _bookIds: [bookId] })),
      ];
      const nextBooks = [...baseBooks, newBook];

      await AsyncStorage.setItem('rv4_saved', JSON.stringify(nextSaved));
      await AsyncStorage.setItem('rv4_books', JSON.stringify(nextBooks));
      setBooksLocal(nextBooks);
      const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
      await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({ ...cache, recipes: nextSaved, books: nextBooks }));
      await pushChangedFromStorage({ saved: nextSaved, books: nextBooks });
      await pull();
      return { ok: true, name: shared.name, count: shared.recipes.length };
    } catch (e) {
      const m = String(e?.message || '');
      if (m === 'not_a_link') return { ok: false, error: 'shared_cb_err_link' };
      if (m === 'not_found') return { ok: false, error: 'shared_cb_err_notfound' };
      return { ok: false, error: 'shared_cb_err_generic' };
    }
  };
  // Opened from a fern:// share link (App.js -> linkBus): import it straight away, no pasting.
  const handledImportRef = useRef('');
  useEffect(() => {
    const link = route?.params?.importLink;
    const nonce = String(route?.params?.importNonce || '');
    if (!link || !nonce || handledImportRef.current === nonce) return;
    handledImportRef.current = nonce;
    (async () => {
      setTab('cookbooks');
      setSelectedBook(null);
      if (/cookbook-share/i.test(link) && !hasAccess(TIERS.PRO) && (await cookbookCount()) >= FREE_COOKBOOK_LIMIT) { setCookbookGate(true); return; }
      // A shared RECIPE: ask where to keep it (My Recipes or a cookbook), then open it.
      try {
        const parsed = parseShareLink(link);
        if (parsed.kind === 'recipe' || parsed.kind === 'unknown') {
          let shared = null;
          try { shared = await fetchSharedRecipe(parsed.id); } catch (e) {
            if (parsed.kind === 'recipe' || String(e?.message) !== 'not_found') throw e;
          }
          if (shared) {
            const stored = JSON.parse(await AsyncStorage.getItem('rv4_saved') || 'null');
            const list = Array.isArray(stored) ? stored : [];
            const key = shared.title.trim().toLowerCase();
            const dup = list.find((r) => String(r?.title || r?.name || '').trim().toLowerCase() === key);
            if (dup) {
              // Already own it: keep the copy, but bring over any photos it doesn't have yet.
              let opened = dup;
              try {
                const isWeb = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);
                const have = (Array.isArray(dup._cloudPhotos) ? dup._cloudPhotos : []).filter(isWeb);
                if (!have.length && isWeb(dup._photoUrl)) have.push(dup._photoUrl);
                const merged = [...have];
                (shared._cloudPhotos || []).forEach((u) => { if (isWeb(u) && !merged.includes(u)) merged.push(u); });
                if (merged.length > have.length) {
                  opened = { ...dup, _cloudPhotos: merged };
                  const next = list.map((r) => (r === dup ? opened : r));
                  await AsyncStorage.setItem('rv4_saved', JSON.stringify(next));
                  const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
                  await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({ ...cache, recipes: next }));
                  pushChangedFromStorage({ saved: next }).then(() => pull()).catch(() => {});
                }
              } catch (e) {}
              setTab('recipes'); setTimeout(() => setSelectedRecipe(normalizeRecipe(opened)), 400); return;
            }
            if (!hasAccess(TIERS.PRO) && (await recipeLimitReached())) { Alert.alert(t('shared_cb_title'), t('shared_rc_err_limit')); return; }
            setPendingShared(shared);
            return;
          }
        }
      } catch (e) {
        Alert.alert(t('shared_cb_title'), t('shared_cb_err_generic'));
        return;
      }
      const r = await handleAddSharedCookbook(link);
      Alert.alert(
        t('shared_cb_title'),
        r.ok ? (r.recipe ? t('shared_rc_added', { name: r.name }) : t('shared_cb_added', { name: r.name, count: r.count })) : t(r.error),
      );
    })();
  }, [route?.params?.importLink, route?.params?.importNonce]);
  // Recipe that arrived from a share link, waiting for the person to pick where to save it.
  const [pendingShared, setPendingShared] = useState(null);
  const confirmPendingShared = async ({ bookId, cuisine, mealType }) => {
    const shared = pendingShared;
    if (!shared) return;
    try {
      const stored = JSON.parse(await AsyncStorage.getItem('rv4_saved') || 'null');
      const base = Array.isArray(stored) ? stored : [];
      const entry = {
        ...shared, id: `shared-${Date.now()}`, _bookIds: bookId ? [bookId] : [],
        cuisine: cuisine || shared.cuisine, mealType: mealType || shared.mealType,
      };
      const next = [...base, entry];
      await AsyncStorage.setItem('rv4_saved', JSON.stringify(next));
      const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
      await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({ ...cache, recipes: next }));
      setPendingShared(null);
      setTab('recipes');
      // iOS drops a Modal opened while another is still closing.
      setTimeout(() => setSelectedRecipe(normalizeRecipe(entry)), 500);
      await pushChangedFromStorage({ saved: next });
      await pull();
    } catch (e) {
      setPendingShared(null);
      Alert.alert(t('shared_cb_title'), t('shared_cb_err_generic'));
    }
  };
  const [isCreatingCookbook, setIsCreatingCookbook] = useState(false);
  const [isEditCookbookVisible, setIsEditCookbookVisible] = useState(false);
  const [isSavingCookbookEdit, setIsSavingCookbookEdit] = useState(false);
  const [isAddRecipesVisible, setIsAddRecipesVisible] = useState(false);
  const [isShareCookbookVisible, setIsShareCookbookVisible] = useState(false);
  const [isSavingAddRecipes, setIsSavingAddRecipes] = useState(false);
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

      // A recipe opened here that is not in the library yet (e.g. from a share link): Save adds it.
      const wasFound = baseSaved.some((item, index) => {
        const itemId = getRawRecipeId(item, index);
        const itemTitle = String(pickFirst(item?.title, item?.name, item?.recipe_name, item?.recipeTitle, '')).trim().toLowerCase();
        return itemId === selectedId || (selectedTitle && itemTitle === selectedTitle);
      });
      if (!wasFound) {
        if (!hasAccess(TIERS.PRO) && (await recipeLimitReached())) { setCookbookGate(false); Alert.alert(t('shared_cb_title'), t('shared_rc_err_limit')); setIsSaving(false); return; }
        updatedSaved.push({
          title: selectedRecipe.title,
          emoji: selectedRecipe.emoji,
          cuisine: selectedRecipe.category || selectedRecipe.cuisine || '',
          mealType: selectedRecipe.meal || selectedRecipe.mealType || '',
          time: selectedRecipe.time || '',
          difficulty: selectedRecipe.difficulty || '',
          description: selectedRecipe.description || '',
          ingredients: selectedRecipe.ingredients || [],
          instructions: selectedRecipe.methodSteps || selectedRecipe.instructions || [],
          _cloudPhotos: selectedRecipe._cloudPhotos || [],
          id: `shared-${Date.now()}`,
          note: trimmed,
          _bookIds: [],
        });
      }

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

  // Deliberately does NOT close selectedRecipe on success (unlike
  // persistRecipeNote above) — this runs from inside SaveToCookbookModal, a
  // second Modal nested within RecipeDetailModal's own Modal. Closing the
  // outer detail view while that inner modal is still tearing down leaves
  // RN's native modal stack broken/unresponsive on iOS, so it patches
  // selectedRecipe in place instead.
  const persistSelectedRecipeToCookbook = async ({ bookId, cuisine, mealType }) => {
    if (!selectedRecipe) return;

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

        return {
          ...item,
          cuisine: cuisine || item.cuisine,
          mealType: mealType || item.mealType,
          _bookIds: bookId ? [bookId] : [],
        };
      });

      await AsyncStorage.setItem('rv4_saved', JSON.stringify(updatedSaved));
      await syncRecipeCache(updatedSaved);

      await pushAllFromStorage();
      await pull();

      setSelectedRecipe((current) => (
        current && String(current.id) === selectedId
          ? { ...current, category: cuisine || current.category, meal: mealType || current.meal }
          : current
      ));
    } catch (e) {
      console.warn('Save recipe to cookbook failed:', e);
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

  const handleCreateCookbook = async ({ name, photo, color }) => {
    setIsCreatingCookbook(true);
    try {
      let coverUrl = null;
      const bookId = `cb_${Date.now()}`;

      if (photo?.base64) {
        const dataUri = `data:${photo.mimeType || 'image/jpeg'};base64,${photo.base64}`;
        try { coverUrl = await uploadPhoto(dataUri, `cover_${bookId}_${Date.now()}.jpg`); } catch (e) { console.warn('Cover upload failed:', e); }
      }

      const storedBooks = JSON.parse(await AsyncStorage.getItem('rv4_books') || 'null');
      const baseBooks = Array.isArray(storedBooks)
        ? storedBooks
        : (Array.isArray(booksLocal) ? booksLocal : []);

      const newBook = {
        id: bookId,
        title: name,
        name,
        subtitle: 'My cookbook',
        color,
        cover: coverUrl,
        recipeIds: [],
      };
      const nextBooks = [...baseBooks, newBook];

      await AsyncStorage.setItem('rv4_books', JSON.stringify(nextBooks));
      setBooksLocal(nextBooks);

      const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
      await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({ ...cache, books: nextBooks }));

      await pushChangedFromStorage({ books: nextBooks });

      setIsNewCookbookVisible(false);
      await pull();
    } catch (e) {
      console.warn('Create cookbook failed:', e);
      Alert.alert(t('cookbook_create_failed_title'), t('cookbook_create_failed_desc'));
    } finally {
      setIsCreatingCookbook(false);
    }
  };

  const handleEditCookbook = async ({ name, photo, color }) => {
    if (!selectedBook) return;
    setIsSavingCookbookEdit(true);
    try {
      let coverUrl = selectedBook.cover || null;
      if (photo?.base64) {
        const dataUri = `data:${photo.mimeType || 'image/jpeg'};base64,${photo.base64}`;
        try { coverUrl = await uploadPhoto(dataUri, `cover_${selectedBook.id}_${Date.now()}.jpg`); } catch (e) { console.warn('Cover upload failed:', e); }
      }

      const storedBooks = JSON.parse(await AsyncStorage.getItem('rv4_books') || 'null');
      const baseBooks = Array.isArray(storedBooks)
        ? storedBooks
        : (Array.isArray(booksLocal) ? booksLocal : []);

      const selectedId = String(selectedBook.id || '').trim();
      const selectedTitle = String(selectedBook.title || '').trim().toLowerCase();

      const nextBooks = baseBooks.map((book, index) => {
        const rawId = String(pickFirst(book?.id, book?.uuid, book?.book_id, `${index}`)).trim();
        const rawTitle = String(pickFirst(book?.title, book?.name, book?.book_title, '')).trim().toLowerCase();
        const isMatch = (selectedId && rawId === selectedId) || (selectedTitle && rawTitle === selectedTitle);
        if (!isMatch) return book;
        return {
          ...book,
          title: name,
          name,
          color,
          cover: coverUrl,
        };
      });

      await AsyncStorage.setItem('rv4_books', JSON.stringify(nextBooks));
      setBooksLocal(nextBooks);

      const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
      await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({ ...cache, books: nextBooks }));

      await pushChangedFromStorage({ books: nextBooks });

      setSelectedBook((prev) => (prev ? { ...prev, title: name, color, cover: coverUrl } : prev));
      setIsEditCookbookVisible(false);
      await pull();
    } catch (e) {
      console.warn('Edit cookbook failed:', e);
      Alert.alert(t('cookbook_edit_failed_title'), t('cookbook_edit_failed_desc'));
    } finally {
      setIsSavingCookbookEdit(false);
    }
  };

  const handleSaveRecipeEdits = async (patch) => {
    if (!selectedRecipe) return;
    setIsSaving(true);
    try {
      const storedSaved = JSON.parse(await AsyncStorage.getItem('rv4_saved') || 'null');
      const baseSaved = Array.isArray(storedSaved)
        ? storedSaved
        : (Array.isArray(recipesLocal) ? recipesLocal : []);

      const selectedId = String(selectedRecipe.id);
      const selectedTitle = String(selectedRecipe.title || '').trim().toLowerCase();

      const nextSaved = baseSaved.map((item, index) => {
        const itemId = getRawRecipeId(item, index);
        const itemTitle = String(pickFirst(item?.title, item?.name, item?.recipe_name, item?.recipeTitle, '')).trim().toLowerCase();
        const isMatch = itemId === selectedId || (selectedTitle && itemTitle === selectedTitle);
        if (!isMatch) return item;

        let next = item;
        if (patch.title !== undefined) next = applyRecipeFieldEdit(next, 'title', patch.title);
        if (patch.category !== undefined) next = applyRecipeFieldEdit(next, 'category', patch.category);
        if (patch.meal !== undefined) next = applyRecipeFieldEdit(next, 'meal', patch.meal);
        if (patch.time !== undefined) next = applyRecipeFieldEdit(next, 'time', patch.time);
        if (patch.difficulty !== undefined) next = applyRecipeFieldEdit(next, 'difficulty', patch.difficulty);
        if (patch.description !== undefined) next = applyRecipeFieldEdit(next, 'description', patch.description);
        if (patch.servings !== undefined) next = applyRecipeFieldEdit(next, 'servings', patch.servings);
        if (patch.methodSteps !== undefined) next = applyRecipeFieldEdit(next, 'methodSteps', patch.methodSteps);
        if (patch.ingredients !== undefined) next = { ...next, ingredients: patch.ingredients };
        return next;
      });

      await AsyncStorage.setItem('rv4_saved', JSON.stringify(nextSaved));
      await syncRecipeCache(nextSaved);
      setRecipesLocal(nextSaved);
      setSelectedRecipe((prev) => (prev ? { ...prev, ...patch } : prev));

      await pushChangedFromStorage({ saved: nextSaved });
      await pull();
    } catch (e) {
      console.warn('Save recipe edits failed:', e);
      Alert.alert(t('recipe_edit_save_failed_title'), t('recipe_edit_save_failed_desc'));
      throw e;
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateRecipeImage = async (url) => {
    if (!selectedRecipe || !url) return;
    try {
      const storedSaved = JSON.parse(await AsyncStorage.getItem('rv4_saved') || 'null');
      const baseSaved = Array.isArray(storedSaved)
        ? storedSaved
        : (Array.isArray(recipesLocal) ? recipesLocal : []);

      const selectedId = String(selectedRecipe.id);
      const selectedTitle = String(selectedRecipe.title || '').trim().toLowerCase();

      const nextSaved = baseSaved.map((item, index) => {
        const itemId = getRawRecipeId(item, index);
        const itemTitle = String(pickFirst(item?.title, item?.name, item?.recipe_name, item?.recipeTitle, '')).trim().toLowerCase();
        const isMatch = itemId === selectedId || (selectedTitle && itemTitle === selectedTitle);
        if (!isMatch) return item;
        // Add to the recipe's photos instead of replacing them (the web app keeps several here).
        let existing = Array.isArray(item?._cloudPhotos)
          ? item._cloudPhotos.filter((u) => typeof u === 'string' && u)
          : [];
        // Keep the recipe's current picture (e.g. a looked-up photo) as the first one.
        if (!existing.length && typeof item?._photoUrl === 'string' && /^https?:\/\//i.test(item._photoUrl)) existing = [item._photoUrl];
        return { ...item, _cloudPhotos: [...existing, url] };
      });

      await AsyncStorage.setItem('rv4_saved', JSON.stringify(nextSaved));
      await syncRecipeCache(nextSaved);
      setRecipesLocal(nextSaved);
      setSelectedRecipe((prev) => {
        if (!prev) return prev;
        const photos = [...(Array.isArray(prev.photos) ? prev.photos : []), url];
        return { ...prev, image: prev.image || url, photos };
      });

      const pushResult = await pushChangedFromStorage({ saved: nextSaved });
      // Diagnostic: a save that never reached the server is otherwise invisible (the next refresh
      // brings the old recipe back). Show the real status so the cause can be read off the phone.
      const pushOk = pushResult && lastPush.status >= 200 && lastPush.status < 300
        && pushResult.success !== false && !pushResult.error;
      if (!pushOk) {
        Alert.alert(
          t('recipe_image_update_failed_title'),
          `${t('recipe_image_update_failed_desc')}\n\nStatus: ${lastPush.status ?? 'none'}\nSize: ${Math.round((lastPush.bytes || 0) / 1024)} KB\n${lastPush.error || (pushResult && (pushResult.error || pushResult.message)) || ''}`
        );
      }
    } catch (e) {
      console.warn('Update recipe image failed:', e);
      Alert.alert(t('recipe_image_update_failed_title'), t('recipe_image_update_failed_desc'));
      throw e;
    }
  };

  // Make a photo the main one (move it first) or remove it: `photos` is the recipe's new full list.
  const handleSetRecipePhotos = async (photos) => {
    if (!selectedRecipe || !Array.isArray(photos)) return;
    try {
      const storedSaved = JSON.parse(await AsyncStorage.getItem('rv4_saved') || 'null');
      const baseSaved = Array.isArray(storedSaved)
        ? storedSaved
        : (Array.isArray(recipesLocal) ? recipesLocal : []);
      const selectedId = String(selectedRecipe.id);
      const selectedTitle = String(selectedRecipe.title || '').trim().toLowerCase();
      const nextSaved = baseSaved.map((item, index) => {
        const itemId = getRawRecipeId(item, index);
        const itemTitle = String(pickFirst(item?.title, item?.name, item?.recipe_name, item?.recipeTitle, '')).trim().toLowerCase();
        const isMatch = itemId === selectedId || (selectedTitle && itemTitle === selectedTitle);
        return isMatch ? { ...item, _cloudPhotos: photos } : item;
      });
      await AsyncStorage.setItem('rv4_saved', JSON.stringify(nextSaved));
      await syncRecipeCache(nextSaved);
      setRecipesLocal(nextSaved);
      setSelectedRecipe((prev) => (prev ? { ...prev, image: photos[0] || null, photos } : prev));
      const pushResult = await pushChangedFromStorage({ saved: nextSaved });
      const pushOk = pushResult && lastPush.status >= 200 && lastPush.status < 300
        && pushResult.success !== false && !pushResult.error;
      if (!pushOk) {
        Alert.alert(
          t('recipe_image_update_failed_title'),
          `${t('recipe_image_update_failed_desc')}\n\nStatus: ${lastPush.status ?? 'none'}\n${lastPush.error || ''}`
        );
      }
    } catch (e) {
      console.warn('Set recipe photos failed:', e);
      Alert.alert(t('recipe_image_update_failed_title'), t('recipe_image_update_failed_desc'));
    }
  };

  const handleSaveRecipesToBook = async (selectedIds) => {
    if (!selectedBook) return;
    setIsSavingAddRecipes(true);
    try {
      const storedSaved = JSON.parse(await AsyncStorage.getItem('rv4_saved') || 'null');
      const baseSaved = Array.isArray(storedSaved)
        ? storedSaved
        : (Array.isArray(recipesLocal) ? recipesLocal : []);

      const selectedSet = new Set(selectedIds.map(String));
      const bookId = selectedBook.id;

      const nextSaved = baseSaved.map((item, index) => {
        const itemId = getRawRecipeId(item, index);
        const existingBookIds = Array.from(new Set([
          ...normalizeIdArray(item?._bookId),
          ...normalizeIdArray(item?._bookIds),
        ]));
        const shouldHave = selectedSet.has(itemId);
        const alreadyHas = existingBookIds.includes(bookId);
        if (shouldHave === alreadyHas) return item;

        const nextBookIds = shouldHave
          ? Array.from(new Set([...existingBookIds, bookId]))
          : existingBookIds.filter((id) => id !== bookId);

        const { _bookId, ...rest } = item;
        return { ...rest, _bookIds: nextBookIds };
      });

      await AsyncStorage.setItem('rv4_saved', JSON.stringify(nextSaved));
      await syncRecipeCache(nextSaved);
      setRecipesLocal(nextSaved);

      await pushChangedFromStorage({ saved: nextSaved });

      setIsAddRecipesVisible(false);
      await pull();
    } catch (e) {
      console.warn('Add recipes to cookbook failed:', e);
      Alert.alert(t('add_recipes_failed_title'), t('add_recipes_failed_desc'));
    } finally {
      setIsSavingAddRecipes(false);
    }
  };

  // Every recipe in the open cookbook — unlike `selectedBookRecipes`, this
  // ignores the on-screen search filter, since a share should include them all.
  const getAllSelectedBookRecipes = () => {
    if (!selectedBook) return [];
    return recipes.filter((recipe) => (
      recipe.bookIds.includes(selectedBook.id) || selectedBook.recipeIds.includes(String(recipe.id))
    ));
  };

  const handlePressShareCookbook = () => {
    if (!selectedBook) return;
    if (!getAllSelectedBookRecipes().length) {
      Alert.alert(t('share_cookbook_empty_title'), t('share_cookbook_empty_desc'));
      return;
    }
    setIsShareCookbookVisible(true);
  };

  const handleCreateCookbookShareLink = async ({ senderName, message, translateTo }) => {
    const rawBook = (Array.isArray(booksLocal) ? booksLocal : []).find(
      (book) => String(book?.id ?? book?.uuid ?? book?.book_id ?? '') === String(selectedBook.id),
    );
    // Same chapters as the library view; recipes go out in chapter order so the page can rebuild them.
    const all = getAllSelectedBookRecipes();
    const chapters = buildChapters(all, chapterMap[selectedBook.id]);
    const ordered = chapters ? chapters.flatMap((c) => c.items) : all;
    let outTitle = selectedBook.title;
    let outRecipes = ordered;
    let outChapterById = chapters ? chapterNameById(chapters, t) : null;
    if (translateTo === 'es') {
      // Only the shared copy is translated; the library is untouched. Any failure throws, so nothing half-translated is sent.
      outRecipes = await translateRecipes(ordered, 'es', user?.token);
      const names = outChapterById ? Array.from(new Set(Object.values(outChapterById))) : [];
      const tr = await translateStrings([selectedBook.title, ...names], 'es', user?.token);
      outTitle = tr[0];
      if (outChapterById) {
        const map = {};
        names.forEach((n, i) => { map[n] = tr[i + 1]; });
        outChapterById = Object.fromEntries(Object.entries(outChapterById).map(([id, n]) => [id, map[n] || n]));
      }
    }
    return createCookbookShareLink({
      title: outTitle,
      colorId: rawBook?.colorId,
      recipes: outRecipes,
      chapterById: outChapterById,
      coverUrl: selectedBook.cover,
      senderName,
      message,
      token: user?.token,
    });
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

      fetchRecipeImage(recipe.title, user?.token).then((url) => {
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

  // Total + per-meal-type counts for the summary line above the grid (all saved recipes).
  const mealTypeCounts = useMemo(() => {
    const counts = {};
    recipes.forEach((recipe) => {
      const key = String(recipe.meal || '').trim() || 'Dinner';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [recipes]);

  const books = useMemo(() => {
    const list = Array.isArray(booksLocal) ? booksLocal : [];
    // Cookbook cover photos are synced separately from the books themselves
    // (cb_covers, keyed by book id) — that's where the web app keeps them, so
    // a cover set there is only found here. A cover on the book itself (set or
    // edited on native) wins, since native doesn't write cb_covers.
    const syncedCovers = data?.cbCovers && typeof data.cbCovers === 'object' ? data.cbCovers : {};
    const normalized = list.map((item, index) => {
      const book = normalizeBook(item, index);
      return { ...book, cover: pickFirst(book.cover, syncedCovers[book.id]) };
    });

    // Deduplicate by ID — backend may send the same book multiple times.
    // Merge duplicates instead of just keeping the first: an older
    // duplicate entry with no cover must not shadow a later one that has it.
    const byId = new Map();
    normalized.forEach((book) => {
      const existing = byId.get(book.id);
      if (!existing) {
        byId.set(book.id, book);
        return;
      }
      byId.set(book.id, {
        ...existing,
        ...book,
        cover: pickFirst(existing.cover, book.cover),
      });
    });
    return Array.from(byId.values());
  }, [booksLocal, data?.cbCovers]);

  const booksWithMatchedCounts = useMemo(() => {
    return books.map((book) => ({
      ...book,
      matchedRecipeCount: recipes.filter((recipe) => recipe.bookIds.includes(book.id)).length,
    }));
  }, [books, recipes]);

  // Chapters made by Fern in the background (device-only layout, see cookbookOrganizer).
  const [chapterMap, setChapterMap] = useState({});
  const organizingRef = useRef(false);
  const organizeTriedRef = useRef({});
  useEffect(() => { loadChapterMap().then(setChapterMap); }, []);
  useEffect(() => {
    if (organizingRef.current || !user?.token || !recipes.length) return;
    const due = booksWithMatchedCounts
      .map((book) => ({
        book,
        members: recipes.filter((r) => r.bookIds.includes(book.id) || (book.recipeIds || []).includes(String(r.id))),
      }))
      .find(({ book, members }) => (
        needsOrganizing(chapterMap[book.id], members.length)
        && organizeTriedRef.current[book.id] !== members.length
      ));
    if (!due) return;
    organizingRef.current = true;
    organizeTriedRef.current[due.book.id] = due.members.length; // one try per size; a failure is not retried in a loop
    organizeBook({
      bookId: due.book.id,
      recipes: due.members.map((r) => ({ id: r.id, title: r.title })),
      locale,
      token: user.token,
    })
      .then(() => loadChapterMap().then(setChapterMap))
      .catch(() => {})
      .finally(() => { organizingRef.current = false; });
  }, [booksWithMatchedCounts, recipes, chapterMap, user?.token, locale]);

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

  // Cookie-style cookbooks are laid out in chapters by cookie type (same grouping as the shared page); null = plain grid.
  const bookChapters = useMemo(
    () => buildChapters(selectedBookRecipes, selectedBook ? chapterMap[selectedBook.id] : null),
    [selectedBookRecipes, selectedBook, chapterMap],
  );

  React.useEffect(() => {
    const debugBooks = (Array.isArray(data.books) ? data.books : []).map((book) => ({
      id: pickFirst(book?.id, book?.uuid, book?.book_id, null),
      name: pickFirst(book?.name, book?.title, book?.book_title, null),
      recipe_ids: pickFirst(book?.recipe_ids, book?.recipeIds, book?.recipes, book?.saved, null),
      raw: book,
    }));

    // Count raw occurrences per book id — if a cover exists in the data but
    // isn't showing, this reveals whether it's because the backend sent the
    // same book id more than once (dedup shadowing an older/coverless copy).
    const bookIdCounts = {};
    (Array.isArray(data.books) ? data.books : []).forEach((book) => {
      const id = String(pickFirst(book?.id, book?.uuid, book?.book_id, 'unknown'));
      bookIdCounts[id] = (bookIdCounts[id] || 0) + 1;
    });
    console.log('[RecipesScreen] book id occurrence counts:', JSON.stringify(bookIdCounts, null, 2));

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
    console.log('[RecipesScreen] resolved book covers:', JSON.stringify(
      booksWithMatchedCounts.map((book) => ({ id: book.id, title: book.title, cover: book.cover })),
      null, 2
    ));
    console.log('[RecipesScreen] normalized cookbook matches:', JSON.stringify(normalizedMatches, null, 2));
  }, [data.books, data.recipes, booksWithMatchedCounts, recipes]);

  // Opened with a recipe to show (e.g. right after an import): open its card once it is in the list.
  const openedRecipeKeyRef = useRef('');
  React.useEffect(() => {
    const wantId = route?.params?.openRecipeId;
    if (wantId == null) return;
    const key = `${wantId}:${route?.params?.requestKey || ''}`;
    if (openedRecipeKeyRef.current === key) return;
    const found = recipes.find((r) => String(r.id) === String(wantId))
      || recipes.find((r) => route?.params?.openRecipeTitle && r.title === route.params.openRecipeTitle);
    if (found) {
      openedRecipeKeyRef.current = key;
      openRecipeDetail(found);
      return;
    }
    // The list on screen can lag the phone's storage (the background sync has not come back yet),
    // so read the saved recipe straight from storage.
    openedRecipeKeyRef.current = key;
    AsyncStorage.getItem('rv4_saved').then((raw) => {
      const list = JSON.parse(raw || '[]');
      const row = (Array.isArray(list) ? list : []).find((r) => r && String(r.id) === String(wantId));
      if (row) openRecipeDetail(normalizeRecipe(row));
    }).catch(() => {});
  }, [route?.params?.openRecipeId, route?.params?.requestKey, recipes]);

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
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tabButtonText, tab === 'recipes' ? styles.tabButtonTextActive : null]}>
                  {t('recipes_tab')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setTab('cookbooks')}
                style={[styles.tabButton, tab === 'cookbooks' ? styles.tabButtonActive : null]}
              >
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tabButtonText, tab === 'cookbooks' ? styles.tabButtonTextActive : null]}>
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
                  returnKeyType="search"
                  blurOnSubmit
                  style={[styles.searchInput, { flex: 1 }]}
                />
                {query.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setQuery('')}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel={t('search_clear_a11y')}
                    style={styles.searchClearBtn}
                  >
                    <Text style={styles.searchClearText}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {tab === 'recipes' && !selectedBook && recipes.length ? (
          <View style={styles.countWrap}>
            <Text style={styles.countTotal}>
              {query.trim()
                ? t('recipes_count_filtered', { shown: filteredRecipes.length, total: recipes.length })
                : t(recipes.length === 1 ? 'recipes_count_one' : 'recipes_count_many', { count: recipes.length })}
            </Text>
            <View style={styles.countChips}>
              {mealTypeCounts.map(([type, n]) => (
                <View key={type} style={styles.countChip}>
                  <Text style={styles.countChipText}>{type} {n}</Text>
                </View>
              ))}
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
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setIsAddRecipesVisible(true)}
                  style={[styles.bookActionBtn, styles.bookActionBtnMuted, styles.bookActionBtnWide]}
                >
                  <Text style={styles.bookActionTextLight}>{t('add_recipes_btn')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setIsEditCookbookVisible(true)}
                  style={[styles.bookActionBtn, styles.bookActionBtnGreen]}
                >
                  <Text style={styles.bookActionTextLight}>{t('edit_btn_recipes')}</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.85} style={[styles.bookActionBtn, styles.bookActionBtnShare]} onPress={handlePressShareCookbook}>
                  <Text style={styles.bookActionTextLight}>{t('share_btn')}</Text>
                </TouchableOpacity>
                {/* <TouchableOpacity activeOpacity={0.85} style={[styles.bookActionBtn, styles.bookActionBtnDarkGreen]}>
                  <Text style={styles.bookActionTextLight}>{t('ask_fern_recipes')}</Text>
                </TouchableOpacity> */}
              </View>

              <TouchableOpacity activeOpacity={0.85} style={styles.bookTrashBtn} onPress={handleDeleteBook}>
                <Text style={styles.bookTrashText}>🗑</Text>
              </TouchableOpacity>

              <View style={styles.bookDetailCard}>
                <View style={[styles.bookDetailHeader, selectedBook.cover ? styles.bookDetailHeaderWithImage : null]}>
                  {selectedBook.cover ? (
                    <>
                      <Image
                        source={{ uri: resolveCoverUri(selectedBook.cover) }}
                        style={styles.bookDetailHeaderImage}
                        resizeMode="cover"
                      />
                      <View style={styles.bookDetailHeaderOverlay} />
                    </>
                  ) : null}
                  <View style={styles.bookDetailHeaderContent}>
                    <Text style={styles.bookDetailTitle}>{selectedBook.title}</Text>
                    <Text style={styles.bookDetailCount}>
                      {t(selectedBookRecipes.length === 1 ? 'recipe_count_singular' : 'recipe_count_plural', { count: selectedBookRecipes.length })}
                    </Text>
                    <Text style={styles.bookDetailSparkle}>✦</Text>
                  </View>
                </View>

                <View style={styles.bookDetailPage}>
                  {selectedBookRecipes.length ? (
                    bookChapters ? (
                      <View>
                        {bookChapters.map((chapter, ci) => (
                          <View key={`chapter-${chapter.key}`} style={ci > 0 ? styles.bookChapter : null}>
                            <Text style={styles.bookChapterLabel}>{t('ch_label', { n: ci + 1 }).toUpperCase()}</Text>
                            <Text style={styles.bookChapterTitle}>{chapter.name || t(chapter.key)}</Text>
                            <Text style={styles.bookChapterCount}>
                              {t(chapter.items.length === 1 ? 'recipe_count_singular' : 'recipe_count_plural', { count: chapter.items.length })}
                            </Text>
                            <View style={styles.bookRecipeGrid}>
                              {chapter.items.map((recipe, idx) => (
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
                          </View>
                        ))}
                      </View>
                    ) : (
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
                    )
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

                <TouchableOpacity
                  style={styles.newBookBtn}
                  activeOpacity={0.85}
                  onPress={openNewCookbook}
                >
                  <Text style={styles.newBookBtnText}>{t('new_cookbook_btn')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.newBookBtn, { marginTop: 8 }]}
                  activeOpacity={0.85}
                  onPress={openSharedCookbook}
                >
                  <Text style={styles.newBookBtnText}>{t('shared_cb_btn')}</Text>
                </TouchableOpacity>

                <View style={styles.bookshelfDeck}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.bookshelfRow}
                  >
                    {booksWithMatchedCounts.map((book) => {
                      const { width: spineWidth, height: spineHeight, titleWidth } = getBookSpineSize(book.id);
                      const spinePalette = !book.cover && !book.colorId ? getSpinePalette(book.id) : null;
                      return (
                        <TouchableOpacity
                          key={book.id}
                          activeOpacity={0.9}
                          onPress={() => {
                            setSelectedBook(book);
                            setQuery('');
                          }}
                          style={[
                            styles.bookSpine,
                            { width: spineWidth, height: spineHeight },
                            spinePalette ? { backgroundColor: spinePalette.bg, borderColor: spinePalette.dark } : null,
                          ]}
                        >
                          {book.cover ? (
                            <View style={[styles.bookSpineCover, { width: spineWidth, height: spineHeight }]}>
                              <Image
                                source={{ uri: resolveCoverUri(book.cover) }}
                                style={styles.bookSpineCoverImage}
                                resizeMode="cover"
                                onError={(e) => console.log('[RecipesScreen] SPINE2 cover image failed', book.id, e.nativeEvent)}
                                onLoad={(e) => console.log('[RecipesScreen] SPINE2 cover image loaded OK', book.id, e.nativeEvent?.source)}
                              />
                              <View style={styles.bookOverlay} />
                            </View>
                          ) : null}

                          <View style={styles.bookSpineLeftEdge} />
                          <View style={styles.bookSpineRightEdge} />

                          <View style={styles.bookSpineInner}>
                            <View style={styles.bookRuleTop} />

                            <View style={styles.bookLabelWrap}>
                              <Text numberOfLines={1} style={[styles.bookSpineTitle, { width: titleWidth }, spinePalette ? { color: spinePalette.tc } : null]}>{book.title}</Text>
                            </View>

                            <View style={styles.bookRuleBottom} />
                            <Text style={styles.bookSpineSparkle}>✦</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t('no_cookbooks_title')}</Text>
              <Text style={styles.emptySub}>{t('no_cookbooks_sub')}</Text>
              <TouchableOpacity style={styles.newBookBtn} activeOpacity={0.85} onPress={openNewCookbook}>
                <Text style={styles.newBookBtnText}>{t('new_cookbook_btn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.newBookBtn, { marginTop: 8 }]} activeOpacity={0.85} onPress={openSharedCookbook}>
                <Text style={styles.newBookBtnText}>{t('shared_cb_btn')}</Text>
              </TouchableOpacity>
            </View>
          )
        )}
      </ScrollView>

      <SaveToCookbookModal
        visible={!!pendingShared}
        books={data.books}
        initialBookId=""
        initialCuisine={pendingShared?.cuisine || ''}
        initialMealType={pendingShared?.mealType || ''}
        isSaving={false}
        onCancel={() => setPendingShared(null)}
        onSave={confirmPendingShared}
      />
      <RecipeDetailModal
        recipe={selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
        noteText={noteText}
        onChangeNoteText={setNoteText}
        isSaving={isSaving}
        onSaveNote={persistRecipeNote}
        onDeleteRecipe={handleDeleteRecipe}
        onAddToList={handleAddSelectedRecipeToShoppingList}
        onSaveEdits={handleSaveRecipeEdits}
        onUpdateImage={handleUpdateRecipeImage}
        onSetPhotos={handleSetRecipePhotos}
        books={data.books}
        onSaveToCookbook={persistSelectedRecipeToCookbook}
        user={user}
      />

      <NewCookbookModal
        visible={isNewCookbookVisible}
        onClose={() => setIsNewCookbookVisible(false)}
        onCreate={handleCreateCookbook}
        isCreating={isCreatingCookbook}
      />

      <AddSharedCookbookModal
        visible={isSharedCbVisible}
        onClose={() => setIsSharedCbVisible(false)}
        onAdd={handleAddSharedCookbook}
      />

      <UpgradeGateModal
        visible={cookbookGate}
        onClose={() => setCookbookGate(false)}
        tier={TIERS.PRO}
        title={t('cookbook_limit_title')}
        desc={t('cookbook_limit_desc')}
      />

      <NewCookbookModal
        visible={isEditCookbookVisible}
        book={selectedBook}
        onClose={() => setIsEditCookbookVisible(false)}
        onSave={handleEditCookbook}
        isSaving={isSavingCookbookEdit}
      />

      <AddRecipesToCookbookModal
        visible={isAddRecipesVisible}
        book={selectedBook}
        recipes={recipes}
        onClose={() => setIsAddRecipesVisible(false)}
        onSave={handleSaveRecipesToBook}
        isSaving={isSavingAddRecipes}
      />

      <ShareLinkModal
        visible={isShareCookbookVisible}
        onClose={() => setIsShareCookbookVisible(false)}
        title={selectedBook ? t('share_cookbook_title', { title: selectedBook.title }) : ''}
        defaultSenderName={user?.name || ''}
        onCreateLink={handleCreateCookbookShareLink}
        allowTranslate
        buildShareText={(url) => t('share_cookbook_message', {
          title: selectedBook?.title || '',
          count: getAllSelectedBookRecipes().length,
          url,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFAF6',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  tabsPill: {
    flex: 1.5,
    flexDirection: 'row',
    backgroundColor: '#FDE8E0',
    borderColor: '#F3C9BD',
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#8A4A4E',
  },
  tabButtonText: {
    color: '#8A5A5C',
    fontSize: 12,
    fontFamily: 'Jost-Bold',
  },
  tabButtonTextActive: {
    color: '#F5EFE6',
  },
  searchBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#F3C9BD',
    backgroundColor: '#FDE8E0',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 35,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchClearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F3C9BD',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  searchClearText: {
    color: '#5A3236',
    fontSize: 11,
    fontWeight: '800',
  },
  searchInput: {
    color: '#5A3236',
    fontSize: 12,
    fontFamily: 'Jost-Medium',
    padding: 2,
  },
  countWrap: {
    marginTop: 14,
  },
  countTotal: {
    color: '#5A3236',
    fontSize: 14,
    fontFamily: 'Jost-SemiBold',
  },
  countChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  countChip: {
    borderWidth: 1,
    borderColor: '#F3C9BD',
    backgroundColor: '#FDE8E0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 6,
  },
  countChipText: {
    color: '#8A5A5C',
    fontSize: 12,
    fontFamily: 'Jost-Medium',
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
    backgroundColor: '#FDE8E0',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3C9BD',
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
    color: '#5A3236',
    fontSize: 14,
    lineHeight: 18,
    minHeight: 36,
    fontFamily: 'PlayfairDisplay-Bold',
    textAlignVertical: 'top',
  },
  recipeMeta: {
    marginTop: 6,
    color: '#9A7872',
    fontSize: 10,
    lineHeight: 14,
    minHeight: 14,
    fontFamily: 'PlayfairDisplay-Medium',
    fontStyle: 'italic',
  },
  noteHint: {
    marginTop: 4,
    color: '#C0475F',
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
    borderColor: '#F3C9BD',
    backgroundColor: '#FDE8E0',
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
    backgroundColor: '#C0475F',
  },
  difficultyDotEmpty: {
    borderWidth: 1,
    borderColor: '#C0475F',
    backgroundColor: 'transparent',
  },
  difficultyText: {
    marginLeft: 4,
    color: '#C0475F',
    fontSize: 12,
    fontFamily: 'Jost-Bold',
    fontStyle: 'italic',
  },
  emptyState: {
    marginTop: 36,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FDE8E0',
    borderWidth: 1,
    borderColor: '#F3C9BD',
  },
  emptyTitle: {
    color: '#5A3236',
    fontSize: 18,
    fontFamily: 'Jost-Bold',
  },
  emptySub: {
    marginTop: 6,
    color: '#8A5A5C',
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
    backgroundColor: '#FDE8E0',
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
    backgroundColor: '#FDE8E0',
    borderWidth: 1,
    borderColor: '#F3C9BD',
  },
  bookDetailHeader: {
    height: 164,
    overflow: 'hidden',
    backgroundColor: '#A7C2E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookDetailHeaderWithImage: {
    position: 'relative',
    overflow: 'hidden',
  },
  bookDetailHeaderContent: {
    width: '100%',
    height: '100%',
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookDetailHeaderImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  bookDetailHeaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.60)',
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
    backgroundColor: '#FFFAF6',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3C9BD',
  },
  bookChapter: {
    marginTop: 26,
  },
  bookChapterLabel: {
    color: '#9A7872',
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 2,
  },
  bookChapterTitle: {
    color: '#9A3A1E',
    fontSize: 22,
    lineHeight: 28,
    fontFamily: 'PlayfairDisplay-Bold',
  },
  bookChapterCount: {
    color: '#9A7872',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 2,
    marginBottom: 12,
  },
  bookRecipeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 14,
  },
  bookRecipeCard: {
    width: '48%',
    backgroundColor: '#FFFAF6',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3C9BD',
  },
  bookRecipeImage: {
    height: 164,
    backgroundColor: '#F3C9BD',
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
    color: '#5A3236',
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'PlayfairDisplay-Bold',
  },
  bookRecipeMeta: {
    marginTop: 4,
    color: '#9A7872',
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
    color: '#5A3236',
    fontSize: 18,
    fontFamily: 'Jost-Bold',
    textAlign: 'center',
  },
  bookDetailEmptySub: {
    marginTop: 8,
    color: '#8A5A5C',
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
    backgroundColor: '#8A4A4E',
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
    borderRadius: 16,
    backgroundColor: '#B68757',
    borderWidth: 1,
    borderColor: '#CAA47F',
    paddingVertical: 10,
  },
  bookshelfRow: {
    paddingHorizontal: 10,
    alignItems: 'flex-end',
  },
  bookSpine: {
    width: 36,
    height: 170,
    borderRadius: 5,
    backgroundColor: '#A97B4A',
    borderWidth: 1,
    borderColor: '#8E653E',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  bookSpineCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 36,
    height: 170,
  },
  bookSpineCoverImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: 5,
  },
  bookOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(54, 30, 14, 0.55)',
    borderRadius: 5,
  },
  bookSpineLeftEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: 'rgba(229, 206, 165, 0.18)',
  },
  bookSpineRightEdge: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: 'rgba(27, 13, 5, 0.65)',
  },
  bookSpineInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  bookLabelWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookSpineTitle: {
    color: '#F5ECE0',
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.1,
    fontFamily: 'PlayfairDisplay-Bold',
    transform: [{ rotate: '-90deg' }],
    width: 120,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bookRuleTop: {
    marginTop: 6,
    width: '74%',
    height: 2,
    borderRadius: 2,
    backgroundColor: '#D3AE52',
    borderWidth: 1,
    borderColor: '#B88E2E',
  },
  bookRuleBottom: {
    width: '74%',
    height: 2,
    borderRadius: 2,
    backgroundColor: '#D3AE52',
    borderWidth: 1,
    borderColor: '#B88E2E',
  },
  bookSpineSparkle: {
    marginTop: 5,
    color: '#E8E3DA',
    fontSize: 9,
    fontFamily: 'Jost-Bold',
  },

});
