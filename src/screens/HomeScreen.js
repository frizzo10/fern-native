import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  TextInput,
  TouchableWithoutFeedback,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors, radius, shadow } from '../constants/tokens';
import { STORE_PRESETS } from '../constants/storePresets';
import { useContinuousMic } from '../hooks/useContinuousMic';
import { useSync } from '../hooks/useSync';
import { findStoreLocationByZip } from '../services/storeLookupService';
import { fetchWinePairings } from '../services/winePairingService';
import { fetchCharcuterieBoard } from '../services/charcuterieService';
import { fetchLeftoverRecipes } from '../services/leftoverMagicService';
import { fetchFridgeChallengeRecipes } from '../services/fridgeChallengeService';
import { fetchQuickDinnerRecipes } from '../services/whatsForDinnerService';
import { pickPhotoFromCamera, pickPhotoFromLibrary } from '../services/photoPickerService';
import { fetchRecipeImage } from '../utils/recipeImage';
import { useAiRecipeCollection } from '../hooks/useAiRecipeCollection';
import AlexaSkillModal from '../components/modals/AlexaSkillModal';
import CharcuterieModal from '../components/modals/CharcuterieModal';
import WinePairingModal from '../components/modals/WinePairingModal';
import EventPlannerIntakeModal from '../components/modals/EventPlannerIntakeModal';
import LeftoverMagicModal from '../components/modals/LeftoverMagicModal';
import FridgeChallengeModal from '../components/modals/FridgeChallengeModal';
import TwentyMinDinnerModal from '../components/modals/TwentyMinDinnerModal';
import RecipeDetailModal from '../components/RecipeDetailModal';
import useLanguage from '../hooks/useLanguage';
import LanguageModal from '../components/modals/LanguageModal';

const FRIDGE_CHALLENGE_LAST_PLAYED_KEY = 'fern_fridge_challenge_last_played';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function getGreeting(t) {
  const h = new Date().getHours();
  return h < 12 ? t('good_morning') : h < 17 ? t('good_afternoon') : t('good_evening');
}

function dateKey(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function sanitizeEmoji(emoji) {
  const defaultEmoji = '🍽️';
  if (!emoji || typeof emoji !== 'string') return defaultEmoji;
  if (emoji.includes('')) return defaultEmoji;
  return emoji;
}

function toPlainStoreName(label) {
  return String(label || '')
    .replace(/^\s*[^\w]+\s*/u, '')
    .trim();
}

export default function HomeScreen({ user }) {
  const { t, locale, changeLanguage } = useLanguage();
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const navigation = useNavigation();

  const toolKeysMap = {
    'Alexa Skill': 'tool_alexa',
    'Charcuterie': 'tool_charcuterie',
    'Dinner Party': 'tool_dinner_party',
    'Wine Pairing': 'tool_wine_pairing',
    'Personal Shopper': 'tool_personal_shopper',
    'Weekly Nutrition': 'tool_weekly_nutrition',
    'Fridge Challenge': 'tool_fridge_challenge',
    'Leftover Magic': 'tool_leftover_magic',
    '20-Min Dinner': 'tool_20min_dinner',
    'Budget Planner': 'tool_budget_planner',
    'AI Meal Planner': 'tool_ai_meal_planner',
    'Semi-Homemade': 'tool_semi_homemade',
    'Family Vault': 'tool_family_vault'
  };

  const [fernReply, setFernReply] = useState('');
  const [lastTranscript, setLastTranscript] = useState('');
  const [userStoresLocal, setUserStoresLocal] = useState([]);
  const [isAddStoreModalOpen, setIsAddStoreModalOpen] = useState(false);
  const [storeNameInput, setStoreNameInput] = useState('');
  const [zipCodeInput, setZipCodeInput] = useState('');
  const [isFindingStore, setIsFindingStore] = useState(false);
  const [isSavingStore, setIsSavingStore] = useState(false);
  const [foundStoreCandidate, setFoundStoreCandidate] = useState(null);
  const [isAlexaModalOpen, setIsAlexaModalOpen] = useState(false);
  const [isWineModalOpen, setIsWineModalOpen] = useState(false);
  const [isCharcuterieModalOpen, setIsCharcuterieModalOpen] = useState(false);
  const [isEventPlannerOpen, setIsEventPlannerOpen] = useState(false);
  const [isLeftoverMagicOpen, setIsLeftoverMagicOpen] = useState(false);
  const [leftoverIngredientsInput, setLeftoverIngredientsInput] = useState('');
  const [isLeftoverSearching, setIsLeftoverSearching] = useState(false);
  const [leftoverPhoto, setLeftoverPhoto] = useState(null);
  const [isFridgeChallengeOpen, setIsFridgeChallengeOpen] = useState(false);
  const [fridgeChallengeStep, setFridgeChallengeStep] = useState('intro');
  const [fridgeChallengeIngredientsInput, setFridgeChallengeIngredientsInput] = useState('');
  const [fridgeChallengePhotos, setFridgeChallengePhotos] = useState([null, null, null]);
  const [isFridgeChallengeSearching, setIsFridgeChallengeSearching] = useState(false);
  const [hasPlayedFridgeChallengeToday, setHasPlayedFridgeChallengeToday] = useState(false);
  const [isQuickDinnerOpen, setIsQuickDinnerOpen] = useState(false);
  const [quickDinnerSelectedPicks, setQuickDinnerSelectedPicks] = useState([]);
  const [quickDinnerIngredientsInput, setQuickDinnerIngredientsInput] = useState('');
  const [isQuickDinnerSearching, setIsQuickDinnerSearching] = useState(false);
  const [quickDinnerHasError, setQuickDinnerHasError] = useState(false);
  const [wineDishInput, setWineDishInput] = useState('');
  const [isWineSearching, setIsWineSearching] = useState(false);
  const [wineSummary, setWineSummary] = useState('');
  const [winePairings, setWinePairings] = useState([]);
  const [selectedWinePairing, setSelectedWinePairing] = useState(null);
  const [isAddingWineToList, setIsAddingWineToList] = useState(false);
  const [charcuterieOccasion, setCharcuterieOccasion] = useState('Date Night');
  const [charcuterieBoardStyle, setCharcuterieBoardStyle] = useState('classic');
  const [charcuteriePeople, setCharcuteriePeople] = useState('6');
  const [charcuterieBudget, setCharcuterieBudget] = useState('60');
  const [charcuterieDietary, setCharcuterieDietary] = useState('None');
  const [isDietaryMenuOpen, setIsDietaryMenuOpen] = useState(false);
  const [isCharcuterieBuilding, setIsCharcuterieBuilding] = useState(false);
  const [charcuterieResult, setCharcuterieResult] = useState(null);
  const [isAddingCharcuterieToList, setIsAddingCharcuterieToList] = useState(false);
  const [isSavingCharcuterieBoard, setIsSavingCharcuterieBoard] = useState(false);
  const { data, loading, pull, pushAllFromStorage } = useSync(user);

  const leftover = useAiRecipeCollection({ source: 'leftover', data, pushAllFromStorage, pull, t });
  const fridgeChallenge = useAiRecipeCollection({ source: 'fridge', data, pushAllFromStorage, pull, t });
  const quickDinner = useAiRecipeCollection({ source: 'quick-dinner', data, pushAllFromStorage, pull, t });

  useFocusEffect(
    useMemo(() => () => {
      pull();
    }, [pull])
  );

  useEffect(() => {
    AsyncStorage.getItem(FRIDGE_CHALLENGE_LAST_PLAYED_KEY).then((lastPlayed) => {
      setHasPlayedFridgeChallengeToday(lastPlayed === todayKey());
    });
  }, []);

  const { isListening, isProcessing, start, stop } = useContinuousMic({
    locale: locale,
    onTranscript: async (text) => {
      setLastTranscript(text);
      try {
        const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/ai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FernApp/1.0 (myaifern.com)',
          },
          body: JSON.stringify({ message: text, context: 'family_hub', userId: user?.id, locale }),
        });
        const d = await res.json();
        setFernReply(d.reply || '');
      } catch { }
    },
    onError: (e) => console.warn('Mic error:', e),
  });

  // Build a rolling 7-day window starting from today.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const key = dateKey(d);
    const dayMeals = {};
    const dayMealEmojis = {};

    // Extract meals from mealPlan
    const planDay = data.mealPlan?.[key] || [];
    planDay.forEach(m => {
      if (m.slot) {
        const slotKey = m.slot.toLowerCase();
        dayMeals[slotKey] = m.title;
        dayMealEmojis[slotKey] = sanitizeEmoji(m.emoji);
      }
    });

    // Activities for this day
    const dayActivities = (data.activities || []).filter(a => a.dateKey === key);

    return {
      key,
      day: t('day_' + d.getDay()),
      date: d.getDate(),
      isToday: key === dateKey(today),
      meals: dayMeals,
      mealEmojis: dayMealEmojis,
      activities: dayActivities,
    };
  });

  const totalDinners = weekDays.filter(d => d.meals.dinner).length;
  const shoppingCount = (data.shopping || []).length;
  const recipesCount = (data.recipes || []).length;
  const booksCount = (data.books || []).length;
  const mealsPlannedCount = Object.entries(data.mealPlan || {}).filter(([key, value]) => {
    if (key.startsWith('_')) return false;
    if (!Array.isArray(value)) return false;
    return value.length > 0;
  }).length;
  const followersCount = (data.followers || []).length;
  const rawStores =
    data.userStores ||
    data.user_stores ||
    data.stores ||
    data.userProfile?.user_stores ||
    [];
  const userStores = Array.isArray(rawStores)
    ? rawStores
    : Array.isArray(Object.values(rawStores))
      ? Object.values(rawStores)
      : [];

  useEffect(() => {
    setUserStoresLocal(userStores);
  }, [userStores]);

  const handleDeleteStore = async (indexToDelete) => {
    const nextStores = userStoresLocal.filter((_, index) => index !== indexToDelete);
    setUserStoresLocal(nextStores);

    try {
      await AsyncStorage.setItem('cpc_user_stores', JSON.stringify(nextStores));

      const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
      await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({
        ...cache,
        userStores: nextStores,
      }));

      console.log('[stores-sync] deleted store', {
        index: indexToDelete,
        remainingCount: nextStores.length,
      });

      await pushAllFromStorage();
      await pull();
      console.log('[stores-sync] backend sync complete after delete');
    } catch (e) {
      console.log('[stores-sync] failed to delete/sync store', e?.message || e);
    }
  };

  const resetAddStoreForm = () => {
    setStoreNameInput('');
    setZipCodeInput('');
    setFoundStoreCandidate(null);
    setIsFindingStore(false);
    setIsSavingStore(false);
  };

  const openAddStoreModal = () => {
    resetAddStoreForm();
    setIsAddStoreModalOpen(true);
  };

  const closeAddStoreModal = () => {
    setIsAddStoreModalOpen(false);
    resetAddStoreForm();
  };

  const handleFindStore = async () => {
    const trimmedName = storeNameInput.trim();
    const trimmedZip = zipCodeInput.trim();

    if (!trimmedName) {
      Alert.alert(t('dish_required'), t('store_name_req'));
      return;
    }
    if (!trimmedZip) {
      Alert.alert(t('dish_required'), t('zip_code_req'));
      return;
    }

    setIsFindingStore(true);
    setFoundStoreCandidate(null);

    try {
      const location = await findStoreLocationByZip(trimmedName, trimmedZip);
      console.log('[stores-sync] finding store', { storeName: trimmedName, zipCode: trimmedZip, found: Boolean(location) });

      if (!location) {
        Alert.alert(t('not_found'), t('no_loc_found'));
        return;
      }

      const candidate = {
        name: trimmedName,
        address: location.address,
        lat: location.lat,
        lng: location.lng,
        source: location.source,
      };

      console.log('[stores-sync] find store result', candidate);
      setFoundStoreCandidate(candidate);
    } catch (e) {
      console.log('[stores-sync] failed to find store', e?.message || e);
      Alert.alert(t('lookup_failed'), t('lookup_failed_desc'));
    } finally {
      setIsFindingStore(false);
    }
  };

  const handleAddStore = async () => {
    const trimmedName = storeNameInput.trim();
    const trimmedZip = zipCodeInput.trim();

    if (!trimmedName) {
      Alert.alert(t('dish_required'), t('store_name_req'));
      return;
    }
    if (!trimmedZip) {
      Alert.alert(t('dish_required'), t('zip_code_req'));
      return;
    }
    if (!foundStoreCandidate) {
      Alert.alert(t('find_req'), t('find_req_desc'));
      return;
    }

    const exists = userStoresLocal.some((s) => {
      const sameName = String(s?.name || '').trim().toLowerCase() === trimmedName.toLowerCase();
      const sameAddress = String(s?.address || '').trim().toLowerCase() === String(foundStoreCandidate.address || '').trim().toLowerCase();
      return sameName && sameAddress;
    });
    if (exists) {
      Alert.alert(t('already_added'), t('already_added_desc'));
      return;
    }

    const nextStores = [
      ...userStoresLocal,
      {
        lat: foundStoreCandidate.lat,
        lng: foundStoreCandidate.lng,
        name: trimmedName,
        address: foundStoreCandidate.address,
      },
    ];

    setIsSavingStore(true);
    setUserStoresLocal(nextStores);

    try {
      await AsyncStorage.setItem('cpc_user_stores', JSON.stringify(nextStores));

      const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
      await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({
        ...cache,
        userStores: nextStores,
      }));

      console.log('[stores-sync] adding store', {
        name: trimmedName,
        zipCode: trimmedZip,
        address: foundStoreCandidate.address,
        lat: foundStoreCandidate.lat,
        lng: foundStoreCandidate.lng,
        total: nextStores.length,
      });

      await pushAllFromStorage();
      await pull();
      console.log('[stores-sync] backend sync complete after add');

      closeAddStoreModal();
    } catch (e) {
      console.log('[stores-sync] failed to add/sync store', e?.message || e);
      Alert.alert(t('sync_error'), t('sync_error_desc'));
    } finally {
      setIsSavingStore(false);
    }
  };

  const resetWineModal = () => {
    setWineDishInput('');
    setWineSummary('');
    setWinePairings([]);
    setIsWineSearching(false);
    setSelectedWinePairing(null);
  };

  const openWineModal = () => {
    resetWineModal();
    setIsWineModalOpen(true);
  };

  const openAlexaModal = () => {
    setIsAlexaModalOpen(true);
  };

  const openCharcuterieModal = () => {
    setCharcuterieResult(null);
    setIsDietaryMenuOpen(false);
    setIsCharcuterieModalOpen(true);
  };

  const closeAlexaModal = () => {
    setIsAlexaModalOpen(false);
  };

  const closeCharcuterieModal = () => {
    setIsDietaryMenuOpen(false);
    setIsCharcuterieModalOpen(false);
  };

  const handleBuildCharcuterieBoard = async () => {
    const peopleCount = Math.max(1, Number.parseInt(charcuteriePeople, 10) || 1);
    const budgetValue = Math.max(1, Number.parseInt(charcuterieBudget, 10) || 1);

    setIsCharcuterieBuilding(true);

    try {
      const result = await fetchCharcuterieBoard({
        occasion: charcuterieOccasion,
        boardType: charcuterieBoardStyle,
        people: peopleCount,
        budget: budgetValue,
        dietary: charcuterieDietary,
        locale: locale
      });

      console.log('[charcuterie] request payload', result.payload);
      console.log('[charcuterie] response', result.responseJson);
      setCharcuterieResult(result.board);
      setIsDietaryMenuOpen(false);
    } catch (e) {
      console.log('[charcuterie] build failed', e?.message || e);
      Alert.alert(t('build_failed'), t('build_failed_desc'));
    } finally {
      setIsCharcuterieBuilding(false);
    }
  };

  const handleBuildAnotherCharcuterieBoard = () => {
    setCharcuterieResult(null);
  };

  const flattenCharcuterieShoppingItems = (board) => {
    if (!board || !Array.isArray(board.shoppingList)) return [];

    return board.shoppingList.flatMap((group) => {
      const category = String(group?.category || 'Board').trim();
      if (!Array.isArray(group?.items)) return [];
      return group.items
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .map((item) => ({
          item,
          category,
        }));
    });
  };

  const addCharcuterieItemsToShoppingList = async (itemsToAdd, successMessage) => {
    if (!itemsToAdd.length) {
      Alert.alert(t('no_items'), t('no_items_desc'));
      return;
    }

    const existingItems = Array.isArray(data.shopping) ? data.shopping : [];
    const existingSignatures = new Set(
      existingItems.map((entry) => `${String(entry?.text || '').trim().toLowerCase()}|${String(entry?.recipe || '').trim().toLowerCase()}`)
    );

    const additions = itemsToAdd
      .filter(({ item, category }) => {
        const signature = `${item.toLowerCase()}|charcuterie board (${category.toLowerCase()})`;
        return !existingSignatures.has(signature);
      })
      .map(({ item, category }, index) => ({
        id: `charcuterie-${Date.now()}-${index}`,
        text: item,
        recipe: `CHARCUTERIE BOARD (${category.toUpperCase()})`,
        checked: false,
      }));

    if (!additions.length) {
      Alert.alert(t('already_added'), t('charcuterie_items_already_added_desc'));
      return;
    }

    const nextShopping = [...existingItems, ...additions];

    setIsAddingCharcuterieToList(true);

    try {
      await AsyncStorage.setItem('rv4_master_shop', JSON.stringify(nextShopping));

      const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
      await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({
        ...cache,
        shopping: nextShopping,
      }));

      await pushAllFromStorage();
      await pull();
      Alert.alert(t('added_title'), successMessage || t('items_added_success'));
    } catch (e) {
      console.log('[charcuterie] failed to add shopping items', e?.message || e);
      Alert.alert(t('could_not_add_items_title'), t('save_error_desc'));
    } finally {
      setIsAddingCharcuterieToList(false);
    }
  };

  const handleAddSingleCharcuterieItem = async (item, category) => {
    const trimmedItem = String(item || '').trim();
    const trimmedCategory = String(category || 'Board').trim();
    if (!trimmedItem) return;

    await addCharcuterieItemsToShoppingList(
      [{ item: trimmedItem, category: trimmedCategory }],
      `${trimmedItem} was added to your shopping list.`
    );
  };

  const handleAddAllCharcuterieItems = async () => {
    const items = flattenCharcuterieShoppingItems(charcuterieResult);
    await addCharcuterieItemsToShoppingList(items, 'Charcuterie shopping list was added to your shopping list.');
  };

  const handleSaveCharcuterieBoard = async () => {
    if (!charcuterieResult) return;

    setIsSavingCharcuterieBoard(true);

    try {
      const existingBoards = JSON.parse(await AsyncStorage.getItem('fern_saved_charcuterie_boards') || '[]');
      const nextBoards = [
        {
          id: `charcuterie-board-${Date.now()}`,
          createdAt: new Date().toISOString(),
          board: charcuterieResult,
        },
        ...(Array.isArray(existingBoards) ? existingBoards : []),
      ];

      await AsyncStorage.setItem('fern_saved_charcuterie_boards', JSON.stringify(nextBoards));
      Alert.alert(t('saved_title'), t('board_saved_success'));
    } catch (e) {
      console.log('[charcuterie] failed to save board', e?.message || e);
      Alert.alert(t('save_failed'), t('save_failed_desc'));
    } finally {
      setIsSavingCharcuterieBoard(false);
    }
  };

  const handleAskFernCharcuterie = () => {
    closeCharcuterieModal();
    if (!isListening) {
      start();
    }
  };

  const resetLeftoverMagicModal = () => {
    setLeftoverIngredientsInput('');
    setIsLeftoverSearching(false);
    setLeftoverPhoto(null);
    leftover.reset();
  };

  // Only one <Modal> can be reliably presented at a time, so the results list modal is
  // hidden (not closed — its state stays intact) while the recipe detail modal is open.
  const closeLeftoverRecipeDetail = () => {
    leftover.setSelectedRecipe(null);
    setIsLeftoverMagicOpen(true);
  };

  const openLeftoverMagicModal = () => {
    resetLeftoverMagicModal();
    setIsLeftoverMagicOpen(true);
  };

  const closeLeftoverMagicModal = () => {
    setIsLeftoverMagicOpen(false);
    resetLeftoverMagicModal();
  };

  const handleAskFernLeftover = () => {
    closeLeftoverMagicModal();
    if (!isListening) {
      start();
    }
  };

  const handleSearchLeftoverRecipes = async () => {
    const input = leftoverIngredientsInput.trim();
    if (!input && !leftoverPhoto) {
      Alert.alert(t('dish_required'), t('leftover_ingredients_required_desc'));
      return;
    }

    setIsLeftoverSearching(true);
    leftover.setRecipes([]);

    try {
      const result = await fetchLeftoverRecipes({
        ingredients: input,
        photos: leftoverPhoto ? [leftoverPhoto] : [],
        locale,
      });

      console.log('[leftover-magic] request payload', result.payload);
      console.log('[leftover-magic] response', result.responseJson);

      leftover.setRecipes(result.recipes);

      if (!result.recipes.length) {
        Alert.alert(t('no_results'), t('leftover_no_results_desc'));
      }
    } catch (e) {
      console.log('[leftover-magic] search failed', e?.message || e);
      Alert.alert(t('search_failed'), t('leftover_search_failed_desc'));
    } finally {
      setIsLeftoverSearching(false);
    }
  };

  const handleViewLeftoverRecipe = (recipe) => {
    leftover.viewRecipe(recipe, { onOpenDetail: () => setIsLeftoverMagicOpen(false) });
  };

  const pickLeftoverPhoto = async (fromCamera) => {
    const result = fromCamera ? await pickPhotoFromCamera() : await pickPhotoFromLibrary();
    if (result.permissionDenied) {
      Alert.alert(t('permission_needed_title'), t('photo_permission_denied_desc'));
      return;
    }
    if (!result.photo) return;
    setLeftoverPhoto(result.photo);
  };

  const resetFridgeChallengeModal = () => {
    setFridgeChallengeStep('intro');
    setFridgeChallengeIngredientsInput('');
    setFridgeChallengePhotos([null, null, null]);
    setIsFridgeChallengeSearching(false);
    fridgeChallenge.reset();
  };

  const closeFridgeChallengeRecipeDetail = () => {
    fridgeChallenge.setSelectedRecipe(null);
    setIsFridgeChallengeOpen(true);
  };

  const openFridgeChallengeModal = () => {
    resetFridgeChallengeModal();
    setIsFridgeChallengeOpen(true);
  };

  const closeFridgeChallengeModal = () => {
    setIsFridgeChallengeOpen(false);
    resetFridgeChallengeModal();
  };

  const handleAskFernFridgeChallenge = () => {
    closeFridgeChallengeModal();
    if (!isListening) {
      start();
    }
  };

  const pickFridgeChallengePhoto = async (slotIndex, fromCamera) => {
    const result = fromCamera ? await pickPhotoFromCamera() : await pickPhotoFromLibrary();
    if (result.permissionDenied) {
      Alert.alert(t('permission_needed_title'), t('photo_permission_denied_desc'));
      return;
    }
    if (!result.photo) return;

    setFridgeChallengePhotos((current) => {
      const next = [...current];
      next[slotIndex] = result.photo;
      return next;
    });
  };

  const goToFridgeChallengePhotos = () => {
    setFridgeChallengeStep('photos');
  };

  const handleSearchFridgeChallengeRecipes = async () => {
    const input = fridgeChallengeIngredientsInput.trim();
    const photos = fridgeChallengePhotos.filter(Boolean);

    if (!input && !photos.length) {
      Alert.alert(t('dish_required'), t('fridge_challenge_ingredients_required_desc'));
      return;
    }

    setIsFridgeChallengeSearching(true);
    fridgeChallenge.setRecipes([]);

    try {
      const result = await fetchFridgeChallengeRecipes({
        photos,
        ingredients: input,
        locale,
      });

      console.log('[fridge-challenge] request payload', result.payload);
      console.log('[fridge-challenge] response', result.responseJson);

      fridgeChallenge.setRecipes(result.recipes);
      setFridgeChallengeStep('results');

      await AsyncStorage.setItem(FRIDGE_CHALLENGE_LAST_PLAYED_KEY, todayKey());
      setHasPlayedFridgeChallengeToday(true);

      if (!result.recipes.length) {
        Alert.alert(t('no_results'), t('fridge_challenge_no_results_desc'));
      }
    } catch (e) {
      console.log('[fridge-challenge] search failed', e?.message || e);
      Alert.alert(t('search_failed'), t('fridge_challenge_search_failed_desc'));
    } finally {
      setIsFridgeChallengeSearching(false);
    }
  };

  const handleViewFridgeChallengeRecipe = (recipe) => {
    fridgeChallenge.viewRecipe(recipe, { onOpenDetail: () => setIsFridgeChallengeOpen(false) });
  };

  const resetQuickDinnerModal = () => {
    setQuickDinnerSelectedPicks([]);
    setQuickDinnerIngredientsInput('');
    setIsQuickDinnerSearching(false);
    setQuickDinnerHasError(false);
    quickDinner.reset();
  };

  const closeQuickDinnerRecipeDetail = () => {
    quickDinner.setSelectedRecipe(null);
    setIsQuickDinnerOpen(true);
  };

  const openQuickDinnerModal = () => {
    resetQuickDinnerModal();
    setIsQuickDinnerOpen(true);
  };

  const closeQuickDinnerModal = () => {
    setIsQuickDinnerOpen(false);
    resetQuickDinnerModal();
  };

  const handleAskFernQuickDinner = () => {
    closeQuickDinnerModal();
    if (!isListening) {
      start();
    }
  };

  const toggleQuickDinnerPick = (option) => {
    setQuickDinnerSelectedPicks((current) => (
      current.includes(option) ? current.filter((item) => item !== option) : [...current, option]
    ));
  };

  const goBackToQuickDinnerSelection = () => {
    quickDinner.setRecipes([]);
    setQuickDinnerHasError(false);
  };

  const runQuickDinnerSearch = async () => {
    if (!quickDinnerSelectedPicks.length && !quickDinnerIngredientsInput.trim()) {
      Alert.alert(t('dish_required'), t('quick_dinner_selection_required_desc'));
      return;
    }

    setIsQuickDinnerSearching(true);
    setQuickDinnerHasError(false);
    quickDinner.setRecipes([]);

    try {
      const result = await fetchQuickDinnerRecipes({
        quickPicks: quickDinnerSelectedPicks,
        ingredients: quickDinnerIngredientsInput.trim(),
        servings: 4,
        locale,
      });

      console.log('[quick-dinner] request payload', result.payload);
      console.log('[quick-dinner] response', result.responseJson);

      const recipesWithImages = await Promise.all(result.recipes.map(async (recipe) => {
        const image = await fetchRecipeImage(`${recipe.title} ${recipe.cuisine} food`.trim());
        return { ...recipe, image };
      }));

      quickDinner.setRecipes(recipesWithImages);

      if (!recipesWithImages.length) {
        setQuickDinnerHasError(true);
      }
    } catch (e) {
      console.log('[quick-dinner] search failed', e?.message || e);
      setQuickDinnerHasError(true);
    } finally {
      setIsQuickDinnerSearching(false);
    }
  };

  const handleViewQuickDinnerRecipe = (recipe) => {
    quickDinner.viewRecipe(recipe, { onOpenDetail: () => setIsQuickDinnerOpen(false) });
  };

  const handleAddQuickDinnerRecipeToList = (recipe) => {
    quickDinner.addIngredientsToShoppingList(recipe);
  };

  const selectedAiRecipe = leftover.selectedRecipe || fridgeChallenge.selectedRecipe || quickDinner.selectedRecipe;
  const activeAiRecipeCollection = leftover.selectedRecipe
    ? leftover
    : fridgeChallenge.selectedRecipe
      ? fridgeChallenge
      : quickDinner.selectedRecipe
        ? quickDinner
        : null;
  const closeSelectedAiRecipeDetail = leftover.selectedRecipe
    ? closeLeftoverRecipeDetail
    : fridgeChallenge.selectedRecipe
      ? closeFridgeChallengeRecipeDetail
      : closeQuickDinnerRecipeDetail;

  const closeWineModal = () => {
    setIsWineModalOpen(false);
    resetWineModal();
  };

  const closeWineDetailModal = () => {
    setSelectedWinePairing(null);
  };

  const handleFindWinePairings = async () => {
    const dish = wineDishInput.trim();
    if (!dish) {
      Alert.alert(t('dish_required'), t('dish_required_desc'));
      return;
    }

    setIsWineSearching(true);
    setWineSummary('');
    setWinePairings([]);

    try {
      const result = await fetchWinePairings({
        userId: user?.id || '7c36273e-07b1-410c-ad1b-4c2b0295e140',
        dish, locale
      });
      console.log('[wine-pairing] request payload', result.payload);
      console.log('[wine-pairing] response', result.responseJson);

      setWineSummary(result.summary);
      setWinePairings(result.pairings);

      if (!result.summary && !result.pairings.length) {
        Alert.alert(t('no_results'), t('no_results_desc'));
      }
    } catch (e) {
      console.log('[wine-pairing] search failed', e?.message || e);
      Alert.alert(t('search_failed'), t('search_failed_desc'));
    } finally {
      setIsWineSearching(false);
    }
  };

  const getPairingIcon = (itemOrCategory) => {
    const rawValue = typeof itemOrCategory === 'object' && itemOrCategory !== null
      ? itemOrCategory.category || itemOrCategory.type || itemOrCategory.kind || ''
      : itemOrCategory;
    const normalized = String(rawValue || '').trim().toLowerCase();
    if (normalized.includes('wine')) return '🍷';
    if (normalized.includes('beer')) return '🍺';
    return '💧';
  };

  const getPairingTitle = (item, index) => {
    const parts = [];
    if (index === 0) {
      parts.push('✨');
    }
    parts.push(getPairingIcon(item));
    parts.push(item?.name || t('pairing_fallback_label'));
    if (item?.region) {
      parts.push(`• ${item.region}`);
    }
    return parts.join(' ');
  };

  const handleAddWineToShoppingList = async () => {
    if (!selectedWinePairing?.name) {
      return;
    }

    const itemName = String(selectedWinePairing.name).trim();
    if (!itemName) {
      return;
    }

    const existingItems = Array.isArray(data.shopping) ? data.shopping : [];
    const alreadyExists = existingItems.some((item) => {
      const text = String(item?.text || item?.name || item?.title || item?.item || '').trim().toLowerCase();
      const recipe = String(item?.recipe || item?.recipe_name || item?.sourceRecipe || '').trim().toLowerCase();
      return text === itemName.toLowerCase() && recipe === 'wine pairing';
    });

    if (alreadyExists) {
      Alert.alert(t('already_added'), t('pairing_already_added_desc'));
      return;
    }

    const nextShopping = [
      ...existingItems,
      {
        id: `wine-pairing-${Date.now()}`,
        text: itemName,
        recipe: 'WINE PAIRING',
        checked: false,
      },
    ];

    setIsAddingWineToList(true);

    try {
      await AsyncStorage.setItem('rv4_master_shop', JSON.stringify(nextShopping));

      const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
      await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({
        ...cache,
        shopping: nextShopping,
      }));

      await pushAllFromStorage();
      await pull();
      closeWineDetailModal();
      Alert.alert(t('added_title'), t('item_added_success', { item: itemName }));
    } catch (e) {
      console.log('[wine-pairing] failed to add shopping item', e?.message || e);
      Alert.alert(t('could_not_add_item_title'), t('save_error_desc'));
    } finally {
      setIsAddingWineToList(false);
    }
  };

  const userName = user?.name?.split(' ')[0] || 'Frank';
  const dietary = data?.userProfile?.dietary || data?.profile?.dietary || user?.dietary || t('dietary_fallback_vegan');

  const tinyProgressDots = (value, total = 7) => (
    <View style={styles.tinyDotsRow}>
      {Array.from({ length: total }, (_, i) => {
        const active = i < Math.min(value, total);
        return (
          <View
            key={`dot-${i}`}
            style={[styles.tinyDot, active ? styles.tinyDotActive : null]}
          />
        );
      })}
    </View>
  );

  const handleAskFernPress = () => {
    if (isListening) {
      stop();
      return;
    }
    start();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.screenScroll}
        contentContainerStyle={styles.screenContent}>

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting(t)}, {"\n"}{userName}</Text>
            <Text style={styles.subheading}>{t('food_life_glance')}</Text>
          </View>

          <View style={styles.headerActions}>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>{t('pro_max')}</Text>
            </View>
            <View style={styles.iconBadge}>
              <Text style={styles.iconBadgeText}>👤</Text>
            </View>
            <TouchableOpacity
              style={styles.langBadge}
              activeOpacity={0.85}
              onPress={() => setIsLanguageModalOpen(true)}
            >
              <Text style={styles.langBadgeText}>🌍 {locale.toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.forest} />
            <Text style={styles.loadingText}>{t('syncing_data')}</Text>
          </View>
        ) : null}

        {lastTranscript ? (
          <View style={styles.voiceBar}>
            <Text style={styles.voiceTranscript}>{t('you')}: {lastTranscript}</Text>
            {fernReply ? <Text style={styles.voiceReply}>{t('fern')}: {fernReply}</Text> : null}
          </View>
        ) : null}

        <View style={styles.mainCardRow}>
          {[
            { label: 'Alexa Skill', val: '🔊', color: 'rgb(30, 57, 30)' },
            { label: 'Charcuterie', val: '🧀', color: 'rgb(56, 89, 45)' },
            { label: 'Dinner Party', val: `🎉`, color: 'rgb(216, 109, 51)' },
            { label: 'Wine Pairing', val: '🍷', color: 'rgb(30, 57, 30)' },
            { label: 'Personal Shopper', val: '🛒', color: 'rgb(56, 89, 45)' },
            { label: 'Weekly Nutrition', val: '🥗', color: 'rgb(216, 109, 51)' },
          ].map(({ label, val, color }) => (
            <TouchableOpacity
              key={label}
              activeOpacity={0.88}
              onPress={
                label === 'Alexa Skill'
                  ? () => setIsAlexaModalOpen(true)
                  : label === 'Charcuterie'
                    ? () => setIsCharcuterieModalOpen(true)
                    : label === 'Dinner Party'
                      ? () => setIsEventPlannerOpen(true)
                      : label === 'Wine Pairing'
                        ? () => setIsWineModalOpen(true)
                        : label === 'Personal Shopper'
                          ? () => navigation.navigate('Shopping')
                          : undefined
              }
              style={[
                styles.mainCard,
                shadow.card,
                { backgroundColor: color }
              ]}
            >
              <Text style={styles.mainVal}>{val}</Text>
              <Text style={styles.mainLabel}>{t(toolKeysMap[label] || label)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.statsRow}>
          {[
            { label: 'Recipes Saved', val: `${recipesCount}`, route: 'Recipes', params: { openTab: 'recipes' } },
            { label: 'Cookbooks', val: `${booksCount}`, route: 'Recipes', params: { openTab: 'cookbooks', openSection: 'cookbooks' } },
            { label: 'Bloggers Following', val: `${followersCount}`, color: 'rgb(216, 109, 51)', route: 'Find', params: { openBloggers: true } },
            { label: 'Meals Planned', val: `${mealsPlannedCount}` },
          ].map(({ label, val, color, route, params }) => {
            const statKeysMap = {
              'Recipes Saved': 'stat_recipes_saved',
              'Cookbooks': 'stat_cookbooks',
              'Bloggers Following': 'stat_bloggers',
              'Meals Planned': 'stat_meals_planned'
            };
            return (
              <TouchableOpacity
                key={label}
                activeOpacity={route ? 0.85 : 1}
                disabled={!route}
                onPress={route ? () => navigation.navigate(route, { ...params, requestKey: Date.now() }) : undefined}
                style={[styles.statCard, shadow.card]}
              >
                <Text style={[styles.statVal, { color: color }]}>{val}</Text>
                <Text style={styles.statLabel}>{t(statKeysMap[label] || label)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.mealStatsRow}>
          <View style={[styles.mealCard, shadow.card]}>
            <Text style={styles.mealCardTitle}>{t('meals_planned_title')}</Text>
            {tinyProgressDots(mealsPlannedCount)}
            <View style={styles.mealDaysRow}>
              {weekDays.map((d) => (
                <Text
                  key={`mp-${d.key}`}
                  style={[styles.mealDayText, d.isToday ? styles.mealDayTextToday : null]}
                >
                  {d.day}
                </Text>
              ))}
            </View>
          </View>

          <View style={[styles.mealCard, shadow.card]}>
            <Text style={styles.mealCardTitle}>{t('recipes_saved_title')}</Text>
            {tinyProgressDots(recipesCount)}
            <View style={styles.mealDaysRow}>
              {weekDays.map((d) => (
                <Text
                  key={`rs-${d.key}`}
                  style={[styles.mealDayText, d.isToday ? styles.mealDayTextToday : null]}
                >
                  {d.day}
                </Text>
              ))}
            </View>
          </View>
        </View>

        <View style={[styles.panelCard, shadow.card]}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.panelTitle}>{t('my_stores')}</Text>
            <TouchableOpacity style={styles.smallActionBtn} activeOpacity={0.85} onPress={openAddStoreModal}>
              <Text style={styles.smallActionBtnText}>{t('add_store_btn')}</Text>
            </TouchableOpacity>
          </View>

          {userStoresLocal.length ? (
            <View style={styles.storeList}>
              {userStoresLocal.map((store, index) => (
                <View key={`${store.name || 'store'}-${index}`}>
                  <View style={styles.storeRow}>
                    <View style={styles.storeIconWrap}>
                      <Text style={styles.storeIcon}>🏪</Text>
                    </View>

                    <View style={styles.storeInfo}>
                      <Text numberOfLines={2} style={styles.storeName}>
                        {store.name || t('store_fallback_label')}
                      </Text>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.storeAddress}>
                        {store.address || t('address_unavailable_label')}
                      </Text>
                    </View>

                    <TouchableOpacity style={styles.scanCircularBtn} activeOpacity={0.85}>
                      <Text style={styles.scanCircularBtnText}>{t('scan_circular')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.storeDeleteBtn}
                      activeOpacity={0.85}
                      onPress={() => handleDeleteStore(index)}
                    >
                      <Text style={styles.storeDeleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {index < userStoresLocal.length - 1 ? <View style={styles.storeDivider} /> : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.panelSubtleText}>{t('no_stores')}</Text>
          )}
        </View>

        <View style={[styles.panelCard, shadow.card]}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.panelTitle}>{t('this_week')}</Text>
            <TouchableOpacity activeOpacity={0.8}>
              <Text style={styles.panelLink}>{t('plan_link')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.weekCircleRow}>
            {weekDays.map((d) => (
              <View key={`wk-${d.key}`} style={styles.weekCircleCol}>
                <Text style={[styles.weekCircleLabel, d.isToday ? styles.weekCircleLabelToday : null]}>
                  {d.day}
                </Text>
                <View style={[
                  styles.weekCircle,
                  d.isToday ? styles.weekCircleToday : null,
                  d.meals.dinner ? styles.weekCircleFilled : null,
                ]}>
                  {d.meals.dinner ? (
                    <Text style={styles.weekCircleEmoji}>{sanitizeEmoji(d.mealEmojis?.dinner)}</Text>
                  ) : (
                    <View style={styles.weekCircleInner} />
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.panelCard, shadow.card]}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.panelTitle}>{t('shopping_list_title')}</Text>
            <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('Shopping')}>
              <Text style={styles.panelLink}>{t('view_link')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.panelSubtleText}>
            {shoppingCount
              ? (shoppingCount > 1
                ? t('items_waiting_plural', { count: shoppingCount })
                : t('items_waiting_singular', { count: shoppingCount }))
              : t('shopping_empty')}
          </Text>
        </View>

        <View style={[styles.fernKnowledgeCard, shadow.card]}>
          <View style={styles.fernKnowledgeHeader}>
            <Text style={styles.fernKnowledgeTitle}>{t('fern_knows_title')}</Text>
            <TouchableOpacity style={styles.fernEditBtn} activeOpacity={0.85}>
              <Text style={styles.fernEditText}>{t('edit_btn')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fernKnowledgeRow}>
            <View style={styles.fernKnowledgeItem}>
              <Text style={styles.fernKnowledgeLabel}>{t('dietary_label')}</Text>
              <Text style={styles.fernKnowledgeValue}>{dietary}</Text>
            </View>

            <View style={styles.fernKnowledgeItem}>
              <Text style={styles.fernKnowledgeLabel}>{t('name_label')}</Text>
              <Text style={styles.fernKnowledgeValue}>{userName}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.toolsHeading}>{t('tool_your_tools')}</Text>

        <View style={styles.mainCardRow}>
          {[
            { label: 'Fridge Challenge', val: '🧊', color: 'rgb(30, 57, 30)' },
            { label: 'Leftover Magic', val: '🧙‍♂️', color: 'rgb(56, 89, 45)' },
            { label: '20-Min Dinner', val: '⚡', color: 'rgb(216, 109, 51)' },
            { label: 'Budget Planner', val: '💰', color: 'rgb(30, 57, 30)' },
            { label: 'AI Meal Planner', val: '🗓', color: 'rgb(56, 89, 45)' },
            { label: 'Semi-Homemade', val: '🥫', color: 'rgb(30, 57, 30)' },
            { label: 'Family Vault', val: '📖', color: 'rgb(216, 109, 51)' },
          ].map(({ label, val, color }) => {
            const toolHandlers = {
              'Leftover Magic': openLeftoverMagicModal,
              'Fridge Challenge': openFridgeChallengeModal,
              '20-Min Dinner': openQuickDinnerModal,
            };
            const onPress = toolHandlers[label];

            return (
            <TouchableOpacity
              key={label}
              activeOpacity={onPress ? 0.88 : 1}
              disabled={!onPress}
              onPress={onPress}
              style={[
                styles.mainCard,
                shadow.card,
                { backgroundColor: color }
              ]}
            >
              <Text style={styles.mainVal}>{val}</Text>
              <Text style={styles.mainLabel}>{t(toolKeysMap[label] || label)}</Text>
            </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.bottomSpacer} />

      </ScrollView >

      <Modal
        transparent
        animationType="slide"
        visible={isAddStoreModalOpen}
        onRequestClose={closeAddStoreModal}
      >
        <KeyboardAvoidingView
          style={styles.addStoreBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.addStoreSheet}>
              <View style={styles.addStoreHeaderRow}>
                <Text style={styles.addStoreTitle}>{t('add_store_title')}</Text>
                <TouchableOpacity style={styles.addStoreCloseBtn} activeOpacity={0.85} onPress={closeAddStoreModal}>
                  <Text style={styles.addStoreCloseText}>×</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.addStorePresetRow}>
                {STORE_PRESETS.map((label) => {
                  const plainName = toPlainStoreName(label);
                  const selected = storeNameInput.trim().toLowerCase() === plainName.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={label}
                      activeOpacity={0.85}
                      onPress={() => setStoreNameInput(plainName)}
                      style={[styles.addStorePresetChip, selected ? styles.addStorePresetChipActive : null]}
                    >
                      <Text style={[styles.addStorePresetText, selected ? styles.addStorePresetTextActive : null]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.addStoreFieldLabel}>{t('or_enter_store')}</Text>
              <TextInput
                value={storeNameInput}
                onChangeText={setStoreNameInput}
                placeholder={t('store_name_placeholder')}
                placeholderTextColor="#A3A3A3"
                style={styles.addStoreInput}
              />

              <Text style={styles.addStoreFieldLabel}>{t('your_zip_code')}</Text>
              <View style={styles.addStoreZipRow}>
                <TextInput
                  value={zipCodeInput}
                  onChangeText={setZipCodeInput}
                  placeholder={t('zip_code_placeholder')}
                  placeholderTextColor="#A3A3A3"
                  style={[styles.addStoreInput, styles.addStoreZipInput]}
                  keyboardType="number-pad"
                />
                <TouchableOpacity
                  style={[styles.addStoreFindBtn, isFindingStore ? styles.addStoreFindBtnDisabled : null]}
                  activeOpacity={0.85}
                  onPress={handleFindStore}
                  disabled={isFindingStore}
                >
                  <Text style={styles.addStoreFindBtnText}>{isFindingStore ? t('finding_btn') : t('find_btn')}</Text>
                </TouchableOpacity>
              </View>

              {foundStoreCandidate ? (
                <View style={styles.addStoreResultCard}>
                  <Text style={styles.addStoreResultName}>{foundStoreCandidate.name}</Text>
                  <Text style={styles.addStoreResultAddress}>{foundStoreCandidate.address}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.addStoreSaveBtn, isSavingStore ? styles.addStoreSaveBtnDisabled : null]}
                activeOpacity={0.85}
                onPress={handleAddStore}
                disabled={isSavingStore}
              >
                <Text style={styles.addStoreSaveBtnText}>{isSavingStore ? t('saving_btn') : t('add_this_store_btn')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      <LanguageModal
        visible={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
        currentLanguage={locale}
        onSelectLanguage={changeLanguage}
        t={t}
      />

      <CharcuterieModal
        visible={isCharcuterieModalOpen}
        onClose={closeCharcuterieModal}
        charcuterieOccasion={charcuterieOccasion}
        setCharcuterieOccasion={setCharcuterieOccasion}
        charcuterieBoardStyle={charcuterieBoardStyle}
        setCharcuterieBoardStyle={setCharcuterieBoardStyle}
        charcuteriePeople={charcuteriePeople}
        setCharcuteriePeople={setCharcuteriePeople}
        charcuterieBudget={charcuterieBudget}
        setCharcuterieBudget={setCharcuterieBudget}
        charcuterieDietary={charcuterieDietary}
        setCharcuterieDietary={setCharcuterieDietary}
        isDietaryMenuOpen={isDietaryMenuOpen}
        setIsDietaryMenuOpen={setIsDietaryMenuOpen}
        isCharcuterieBuilding={isCharcuterieBuilding}
        charcuterieResult={charcuterieResult}
        isAddingCharcuterieToList={isAddingCharcuterieToList}
        isSavingCharcuterieBoard={isSavingCharcuterieBoard}
        onBuild={handleBuildCharcuterieBoard}
        onBuildAnother={handleBuildAnotherCharcuterieBoard}
        onAddSingleShoppingItem={handleAddSingleCharcuterieItem}
        onAddAllShoppingItems={handleAddAllCharcuterieItems}
        onSaveBoard={handleSaveCharcuterieBoard}
        onAskFern={handleAskFernCharcuterie}
      />

      <AlexaSkillModal
        visible={isAlexaModalOpen}
        onClose={closeAlexaModal}
      />

      <WinePairingModal
        visible={isWineModalOpen}
        onClose={closeWineModal}
        wineDishInput={wineDishInput}
        setWineDishInput={setWineDishInput}
        isWineSearching={isWineSearching}
        onFindWinePairings={handleFindWinePairings}
        wineSummary={wineSummary}
        winePairings={winePairings}
        selectedWinePairing={selectedWinePairing}
        setSelectedWinePairing={setSelectedWinePairing}
        onCloseWineDetail={closeWineDetailModal}
        getPairingIcon={getPairingIcon}
        getPairingTitle={getPairingTitle}
        isAddingWineToList={isAddingWineToList}
        onAddWineToShoppingList={handleAddWineToShoppingList}
      />

      <LeftoverMagicModal
        visible={isLeftoverMagicOpen}
        onClose={closeLeftoverMagicModal}
        ingredientsInput={leftoverIngredientsInput}
        setIngredientsInput={setLeftoverIngredientsInput}
        isSearching={isLeftoverSearching}
        onSearch={handleSearchLeftoverRecipes}
        photo={leftoverPhoto}
        onTakePhoto={() => pickLeftoverPhoto(true)}
        onPickPhotoFromLibrary={() => pickLeftoverPhoto(false)}
        onRemovePhoto={() => setLeftoverPhoto(null)}
        recipes={leftover.recipes}
        onViewRecipe={handleViewLeftoverRecipe}
        onSaveRecipe={leftover.handleSaveFromCard}
        savingRecipeKey={leftover.savingKey}
        isRecipeSaved={leftover.isRecipeSaved}
        onAskFern={handleAskFernLeftover}
      />

      <FridgeChallengeModal
        visible={isFridgeChallengeOpen}
        onClose={closeFridgeChallengeModal}
        onAskFern={handleAskFernFridgeChallenge}
        step={fridgeChallengeStep}
        onGoToPhotos={goToFridgeChallengePhotos}
        onBackToIntro={() => setFridgeChallengeStep('intro')}
        ingredientsInput={fridgeChallengeIngredientsInput}
        setIngredientsInput={setFridgeChallengeIngredientsInput}
        isSearching={isFridgeChallengeSearching}
        onSearch={handleSearchFridgeChallengeRecipes}
        photos={fridgeChallengePhotos}
        onPickPhoto={pickFridgeChallengePhoto}
        onRemovePhoto={(slotIndex) => setFridgeChallengePhotos((current) => {
          const next = [...current];
          next[slotIndex] = null;
          return next;
        })}
        hasPlayedToday={hasPlayedFridgeChallengeToday}
        recipes={fridgeChallenge.recipes}
        onViewRecipe={handleViewFridgeChallengeRecipe}
        onSaveRecipe={fridgeChallenge.handleSaveFromCard}
        savingRecipeKey={fridgeChallenge.savingKey}
        isRecipeSaved={fridgeChallenge.isRecipeSaved}
      />

      <TwentyMinDinnerModal
        visible={isQuickDinnerOpen}
        onClose={closeQuickDinnerModal}
        onAskFern={handleAskFernQuickDinner}
        selectedQuickPicks={quickDinnerSelectedPicks}
        onToggleQuickPick={toggleQuickDinnerPick}
        ingredientsInput={quickDinnerIngredientsInput}
        setIngredientsInput={setQuickDinnerIngredientsInput}
        isSearching={isQuickDinnerSearching}
        hasError={quickDinnerHasError}
        onSearch={runQuickDinnerSearch}
        onRetry={runQuickDinnerSearch}
        recipes={quickDinner.recipes}
        onChangeSelection={goBackToQuickDinnerSelection}
        onViewRecipe={handleViewQuickDinnerRecipe}
        onAddToList={handleAddQuickDinnerRecipeToList}
      />

      <RecipeDetailModal
        recipe={selectedAiRecipe}
        onClose={closeSelectedAiRecipeDetail}
        noteText={activeAiRecipeCollection?.noteText ?? ''}
        onChangeNoteText={activeAiRecipeCollection?.setNoteText ?? (() => { })}
        isSaving={activeAiRecipeCollection?.isSaving ?? false}
        onSaveNote={() => activeAiRecipeCollection?.persistSelectedNote(closeSelectedAiRecipeDetail)}
        isAlreadySaved={selectedAiRecipe ? Boolean(activeAiRecipeCollection?.isRecipeSaved(selectedAiRecipe)) : false}
        showSavedIndicator
        onDeleteRecipe={selectedAiRecipe && activeAiRecipeCollection?.isRecipeSaved(selectedAiRecipe) ? () => activeAiRecipeCollection.handleDeleteSelected(closeSelectedAiRecipeDetail) : undefined}
        onAddToList={() => activeAiRecipeCollection?.handleAddToShoppingList()}
      />

      <EventPlannerIntakeModal
        visible={isEventPlannerOpen}
        onClose={() => setIsEventPlannerOpen(false)}
        user={user}
        locale={locale}
      />
    </View >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F0EA',
  },
  screenScroll: {
    flex: 1,
  },
  screenContent: {
    paddingBottom: 12,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8
  },

  headerLeft: {
    flex: 1,
    paddingRight: 8,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 1,
    paddingTop: 2,
  },

  greeting: {
    fontSize: 22,
    lineHeight: 24,
    fontFamily: 'PlayfairDisplay-Bold',
    color: '#2C1D12',
  },

  subheading: {
    fontSize: 12,
    color: colors.brown,
    marginTop: 2,
    fontFamily: 'Jost-Medium',
    fontStyle: 'italic',
  },

  proBadge: {
    borderWidth: 1,
    borderColor: '#DD8A4A',
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#F4EBDD',
  },

  iconBadge: {
    borderWidth: 1,
    borderColor: '#D4CABB',
    borderRadius: radius.full,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEE7DB',
  },

  iconBadgeText: {
    fontSize: 18,
  },

  langBadge: {
    borderWidth: 1,
    borderColor: '#D4CABB',
    borderRadius: radius.full,
    paddingHorizontal: 12,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEE7DB',
  },

  askFernBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: '#E96B1E',
  },

  askFernBadgeActive: {
    backgroundColor: '#14502B',
  },

  askFernBadgeText: {
    color: '#FFF9EE',
    fontSize: 12,
    fontFamily: 'Jost-Bold',
    letterSpacing: 0.2,
  },

  langBadgeText: {
    color: colors.ink,
    fontSize: 11,
    fontFamily: 'Jost-Medium',
    letterSpacing: 0.3,
  },

  proBadgeText: {
    color: '#D06F2E',
    fontSize: 10,
    fontFamily: 'Jost-Bold',
    letterSpacing: 0.6,
  },

  voiceBar: {
    backgroundColor: '#1B3D20',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },

  voiceTranscript: {
    color: '#D8E7D0',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 4,
    fontFamily: 'Jost-Regular',
  },

  voiceReply: {
    color: '#F4F0EA',
    fontSize: 13,
    fontFamily: 'Jost-Medium',
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 12,
    color: colors.brown,
    fontFamily: 'Jost-Regular',
  },

  mainCardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 6,
  },

  mainCard: {
    width: '31%',
    backgroundColor: colors.paper,
    borderRadius: 22,
    minHeight: 50,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: -4,
  },

  statCard: {
    width: '48%',
    backgroundColor: '#EDE7DE',
    borderRadius: 18,
    padding: 14,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#D4C9BA',
  },

  mealStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: -2,
  },

  mealCard: {
    width: '48%',
    backgroundColor: '#EDE7DE',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D4C9BA',
  },

  mealCardTitle: {
    fontSize: 12,
    color: '#695B4F',
    fontFamily: 'Jost-Bold',
    letterSpacing: 1.2,
  },

  tinyDotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 24,
    marginBottom: 8,
  },

  tinyDot: {
    flex: 1,
    height: 4,
    borderRadius: 99,
    backgroundColor: '#CFC6B8',
  },

  tinyDotActive: {
    backgroundColor: '#E4722A',
  },

  mealDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  mealDayText: {
    color: '#7A6C60',
    fontSize: 7,
    fontFamily: 'Jost-Medium',
  },

  mealDayTextToday: {
    color: '#E4722A',
    fontFamily: 'Jost-Bold',
  },

  panelCard: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: '#EDE7DE',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D4C9BA',
    padding: 16,
  },

  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  panelTitle: {
    color: '#55463A',
    fontSize: 12,
    fontFamily: 'Jost-Bold'
  },

  panelLink: {
    color: '#184029',
    fontSize: 14,
    fontFamily: 'Jost-Bold',
  },

  panelSubtleText: {
    marginTop: 10,
    color: '#7E7063',
    fontSize: 12,
    fontStyle: 'italic',
    fontFamily: 'Jost-Medium',
  },

  smallActionBtn: {
    backgroundColor: '#E96B1E',
    borderRadius: radius.full,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },

  smallActionBtnText: {
    color: '#FFF9EE',
    fontSize: 10,
    fontFamily: 'Jost-Bold',
  },

  storeList: {
    marginTop: 14,
  },

  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  storeIconWrap: {
    width: 35,
    height: 35,
    borderRadius: 10,
    backgroundColor: '#1C512A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  storeIcon: {
    fontSize: 16,
  },

  storeInfo: {
    flex: 1,
    minWidth: 0,
  },

  storeName: {
    fontSize: 12,
    color: '#1F130A',
    fontFamily: 'Jost-Bold',
  },

  storeAddress: {
    color: '#866F54',
    fontSize: 8,
    fontFamily: 'Jost-Medium',
  },

  scanCircularBtn: {
    backgroundColor: '#E96B1E',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  scanCircularBtnText: {
    color: '#FFF9EE',
    fontSize: 10,
    fontFamily: 'Jost-Bold',
  },

  storeDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E8BAC0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4E7E7',
  },

  storeDeleteBtnText: {
    color: '#D2606E',
    fontSize: 12,
    lineHeight: 12,
    fontFamily: 'Jost-Medium',
  },

  storeDivider: {
    marginTop: 8,
    marginBottom: 8,
    height: 1,
    backgroundColor: '#DCCFBF',
  },

  weekCircleRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  weekCircleCol: {
    alignItems: 'center',
    width: '14.2%',
  },

  weekCircleLabel: {
    color: '#6F5E50',
    fontSize: 10,
    fontFamily: 'Jost-Bold',
    marginBottom: 6,
  },

  weekCircleLabelToday: {
    color: '#E4722A',
  },

  weekCircle: {
    width: 38,
    height: 38,
    borderRadius: 99,
    borderWidth: 2,
    borderColor: '#BFB6AA',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F0EA',
  },

  weekCircleToday: {
    borderColor: '#E4722A',
  },

  weekCircleFilled: {
    backgroundColor: '#1C512A',
    borderColor: '#1C512A',
  },

  weekCircleInner: {
    width: 6,
    height: 6,
    borderRadius: 99,
  },

  weekCircleEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },

  weekCircleInnerFilled: {
    backgroundColor: '#2A4E33',
  },

  fernKnowledgeCard: {
    marginHorizontal: 20,
    marginTop: 18,
    backgroundColor: '#1C512A',
    borderRadius: 18,
    padding: 16,
  },

  fernKnowledgeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  fernKnowledgeTitle: {
    color: '#A5C8A2',
    fontSize: 11,
    fontFamily: 'Jost-Bold',
    letterSpacing: 1.5,
  },

  fernEditBtn: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  fernEditText: {
    color: '#EAF3E8',
    fontSize: 11,
    fontFamily: 'Jost-Bold',
  },

  fernKnowledgeRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  fernKnowledgeItem: {
    width: '47%',
  },

  fernKnowledgeLabel: {
    color: '#B8D2B8',
    fontSize: 12,
    fontFamily: 'Jost-Bold',
  },

  fernKnowledgeValue: {
    color: '#F3F7F3',
    fontSize: 16,
    marginTop: 4,
    fontFamily: 'Jost-Bold',
  },

  toolsHeading: {
    marginTop: 20,
    paddingHorizontal: 20,
    color: '#372C22',
    fontSize: 13,
    fontFamily: 'Jost-Bold',
    letterSpacing: 1.5,
  },

  mainLabel: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Jost-Bold',
    color: '#F7EFE2',
    lineHeight: 14,
  },

  mainVal: {
    textAlign: 'center',
    fontSize: 26,
    marginBottom: 6,
  },

  statLabel: {
    fontSize: 11,
    fontFamily: 'Jost-Bold',
    color: '#5D4F42',
    marginTop: 4
  },

  statVal: {
    fontSize: 35,
    fontFamily: 'Playfair-Medium',
    color: 'rgb(56, 89, 45)',
    marginTop: 6
  },

  bottomSpacer: {
    height: 24,
  },

  addStoreBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  addStoreSheet: {
    backgroundColor: '#F5F2ED',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 22,
    maxHeight: '88%',
  },
  addStoreHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addStoreTitle: {
    fontFamily: 'PlayfairDisplay-Bold',
    color: '#2A1A11',
    fontSize: 20,
    lineHeight: 56,
  },
  addStoreCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEE7DD',
  },
  addStoreCloseText: {
    fontSize: 22,
    color: '#2886E8',
    marginTop: -2,
  },
  addStorePresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  addStorePresetChip: {
    borderWidth: 2,
    borderColor: '#CEBFA6',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#F8F5F0',
  },
  addStorePresetChipActive: {
    backgroundColor: '#1B4F22',
    borderColor: '#1B4F22',
  },
  addStorePresetText: {
    color: '#0F7BEA',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
  },
  addStorePresetTextActive: {
    color: '#FFFFFF',
  },
  addStoreFieldLabel: {
    marginTop: 4,
    marginBottom: 6,
    color: '#7B5C3A',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
  },
  addStoreInput: {
    borderWidth: 2,
    borderColor: '#CEBFA6',
    borderRadius: 14,
    backgroundColor: '#F6F3ED',
    color: '#2A1A11',
    fontFamily: 'Jost-Regular',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  addStoreZipRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  addStoreZipInput: {
    flex: 1,
    marginBottom: 0,
  },
  addStoreFindBtn: {
    backgroundColor: '#194D22',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  addStoreFindBtnDisabled: {
    opacity: 0.65,
  },
  addStoreFindBtnText: {
    color: '#EAF2E6',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
  },
  addStoreResultCard: {
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#CEBFA6',
    borderRadius: 14,
    backgroundColor: '#F0ECE4',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addStoreResultName: {
    color: '#2A1A11',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
  },
  addStoreResultAddress: {
    marginTop: 4,
    color: '#7A5E41',
    fontFamily: 'Jost-Regular',
    fontSize: 10,
  },
  addStoreSaveBtn: {
    marginTop: 14,
    backgroundColor: '#1A4C21',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  addStoreSaveBtnDisabled: {
    opacity: 0.65,
  },
  addStoreSaveBtnText: {
    color: '#EAF3E7',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
  },

});
