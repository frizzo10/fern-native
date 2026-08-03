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
import { scanCircular, fetchDealRecipeIdeas, fetchFullRecipeForDealIdea } from '../services/scanCircularService';
import { fetchBudgetMealPlan } from '../services/budgetPlannerService';
import { fetchSemiHomemadeRecipe } from '../services/semiHomemadeService';
import { fetchSuggestedRecipeGroups, fetchQuickSuggestions, buildSuggestionsPrompt } from '../services/suggestedRecipesService';
import { fetchRecipeImage } from '../utils/recipeImage';
import { addRecipeIngredientsToShoppingList } from '../utils/shoppingListSync';
import { useAiRecipeCollection } from '../hooks/useAiRecipeCollection';
import AlexaSkillModal from '../components/modals/AlexaSkillModal';
import CharcuterieModal from '../components/modals/CharcuterieModal';
import WinePairingModal from '../components/modals/WinePairingModal';
import EventPlannerIntakeModal from '../components/modals/EventPlannerIntakeModal';
import LeftoverMagicModal from '../components/modals/LeftoverMagicModal';
import FridgeChallengeModal from '../components/modals/FridgeChallengeModal';
import ScanCircularModal from '../components/modals/ScanCircularModal';
import BudgetPlannerModal from '../components/modals/BudgetPlannerModal';
import NutritionTrackerModal from '../components/modals/NutritionTrackerModal';
import TwentyMinDinnerModal from '../components/modals/TwentyMinDinnerModal';
import SemiHomemadeModal from '../components/modals/SemiHomemadeModal';
import LoyaltyCardModal from '../components/modals/LoyaltyCardModal';
import { matchLoyaltyCard, fetchLinkedStoreCards, linkStoreCard, unlinkStoreCard } from '../services/loyaltyService';
import MealPlannerModal from '../components/modals/MealPlannerModal';
import { fetchMealPlan, generateMealPlan, saveMealPlan, regenerateMeal, fetchMealPlannerShoppingList } from '../services/mealPlannerService';
import RecipeDetailModal from '../components/RecipeDetailModal';
import SuggestedRecipesScreen from '../components/SuggestedRecipesScreen';
import CouponWalletScreen from '../components/CouponWalletScreen';
import CouponDetailModal from '../components/modals/CouponDetailModal';
import { normalizeCoupons } from '../utils/couponNormalize';
import useLanguage from '../hooks/useLanguage';
import LanguageModal from '../components/modals/LanguageModal';
import { useAccountModal } from '../services/AccountModalContext';
import { useTour } from '../services/TourContext';
import useEntitlement from '../hooks/useEntitlement';
import { usePlansModal } from '../services/PlansModalContext';
import { TIERS } from '../constants/tiers';

const FRIDGE_CHALLENGE_LAST_PLAYED_KEY = 'fern_fridge_challenge_last_played';
const DISMISSED_SUGGESTIONS_KEY = 'fern_dismissed_suggestions';
const LOYALTY_CARD_KEY = 'rv4_loyalty_card';

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
  if (emoji.includes('�')) return defaultEmoji;
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
  const { open: openAccount } = useAccountModal();
  const { maybeAutoStart } = useTour();
  const { tier } = useEntitlement();
  const { open: openPlans } = usePlansModal();
  const tierBadgeLabel = tier === TIERS.PRO_MAX ? t('pro_max') : tier === TIERS.PRO ? t('pro') : t('free');

  useEffect(() => {
    maybeAutoStart('home');
  }, []);

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
  const [voiceHistory, setVoiceHistory] = useState([]); // {role:'user'|'assistant', content}[] — last few turns, so a follow-up like "what about tomorrow?" has something to refer back to
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
  const [isScanCircularOpen, setIsScanCircularOpen] = useState(false);
  const [scanCircularStep, setScanCircularStep] = useState('select');
  const [scanCircularPhoto, setScanCircularPhoto] = useState(null);
  const [scanCircularResult, setScanCircularResult] = useState(null);
  const [scanCircularSelectedItem, setScanCircularSelectedItem] = useState(null);
  const [scanCircularDealIdeas, setScanCircularDealIdeas] = useState([]);
  const [isLoadingScanCircularIdeas, setIsLoadingScanCircularIdeas] = useState(false);
  const [isAddingScanCircularItemToList, setIsAddingScanCircularItemToList] = useState(false);
  const [isNutritionTrackerOpen, setIsNutritionTrackerOpen] = useState(false);
  const [isBudgetPlannerOpen, setIsBudgetPlannerOpen] = useState(false);
  const [budgetPlannerStep, setBudgetPlannerStep] = useState('form');
  const [budgetType, setBudgetType] = useState('weekly');
  const [budgetInput, setBudgetInput] = useState('75');
  const [budgetPeople, setBudgetPeople] = useState(4);
  const [budgetDietary, setBudgetDietary] = useState('No restrictions');
  const [budgetPlan, setBudgetPlan] = useState(null);
  const [budgetShoppingItems, setBudgetShoppingItems] = useState([]);
  const [isAddingBudgetItemRowOpen, setIsAddingBudgetItemRowOpen] = useState(false);
  const [budgetNewItemText, setBudgetNewItemText] = useState('');
  const [budgetConfirmItems, setBudgetConfirmItems] = useState(null);
  const [isAddingBudgetItemsToShoppingList, setIsAddingBudgetItemsToShoppingList] = useState(false);
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
  const [isSemiHomemadeOpen, setIsSemiHomemadeOpen] = useState(false);
  const [semiHomemadeSelectedShortcuts, setSemiHomemadeSelectedShortcuts] = useState([]);
  const [semiHomemadeCustomItems, setSemiHomemadeCustomItems] = useState([]);
  const [semiHomemadeCustomItemInput, setSemiHomemadeCustomItemInput] = useState('');
  const [semiHomemadeVibeInput, setSemiHomemadeVibeInput] = useState('');
  const [semiHomemadeServings, setSemiHomemadeServings] = useState(4);
  const [isSemiHomemadeDesigning, setIsSemiHomemadeDesigning] = useState(false);
  const [semiHomemadeResult, setSemiHomemadeResult] = useState(null);
  const [isSavingSemiHomemadeRecipe, setIsSavingSemiHomemadeRecipe] = useState(false);
  const [isSemiHomemadeRecipeSaved, setIsSemiHomemadeRecipeSaved] = useState(false);
  const [isLoyaltyModalOpen, setIsLoyaltyModalOpen] = useState(false);
  const [loyaltyPhoneInput, setLoyaltyPhoneInput] = useState('');
  const [isLinkingLoyaltyCard, setIsLinkingLoyaltyCard] = useState(false);
  const [loyaltyCardError, setLoyaltyCardError] = useState('');
  const [linkedLoyaltyCard, setLinkedLoyaltyCard] = useState(null);
  const [storeLoyaltyCards, setStoreLoyaltyCards] = useState([]);
  const [isLoadingStoreLoyaltyCards, setIsLoadingStoreLoyaltyCards] = useState(false);
  const [storeCardNameInput, setStoreCardNameInput] = useState('');
  const [storeCardNumberInput, setStoreCardNumberInput] = useState('');
  const [isAddingStoreCard, setIsAddingStoreCard] = useState(false);
  const [removingStoreCardName, setRemovingStoreCardName] = useState(null);
  const [isSuggestedRecipesOpen, setIsSuggestedRecipesOpen] = useState(false);
  const [isCouponWalletOpen, setIsCouponWalletOpen] = useState(false);
  const [isMealPlannerOpen, setIsMealPlannerOpen] = useState(false);
  const [mealPlannerDays, setMealPlannerDays] = useState([]);
  const [isLoadingMealPlanner, setIsLoadingMealPlanner] = useState(false);
  const [isGeneratingMealPlan, setIsGeneratingMealPlan] = useState(false);
  const [selectedMealPlannerMeal, setSelectedMealPlannerMeal] = useState(null);
  const [isSwappingMeal, setIsSwappingMeal] = useState(false);
  const [mealPlannerShoppingList, setMealPlannerShoppingList] = useState([]);
  const [isLoadingMealPlannerShoppingList, setIsLoadingMealPlannerShoppingList] = useState(false);
  const [isSavingMealPlannerShoppingList, setIsSavingMealPlannerShoppingList] = useState(false);
  const [mealPlannerPreferences, setMealPlannerPreferences] = useState({
    mealsPerDay: 1,
    whichMeals: ['dinner'],
    cookTimeMax: 45,
    servings: 4,
    dietary: [],
    disliked: [],
  });
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [walletCouponsLocal, setWalletCouponsLocal] = useState([]);
  const [suggestedGroups, setSuggestedGroups] = useState([]);
  const [isLoadingSuggestedRecipes, setIsLoadingSuggestedRecipes] = useState(false);
  const [suggestedUpdatedAt, setSuggestedUpdatedAt] = useState(null);
  const [suggestedFilter, setSuggestedFilter] = useState('all');
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState([]);
  const [quickSuggestions, setQuickSuggestions] = useState([]);
  const { data, loading, pull, pushAllFromStorage, pushChangedFromStorage } = useSync(user);

  const leftover = useAiRecipeCollection({ source: 'leftover', data, pushAllFromStorage, pull, t, token: user?.token });
  const fridgeChallenge = useAiRecipeCollection({ source: 'fridge', data, pushAllFromStorage, pull, t, token: user?.token });
  const quickDinner = useAiRecipeCollection({ source: 'quick-dinner', data, pushAllFromStorage, pull, t, token: user?.token });
  const scanCircularDeals = useAiRecipeCollection({ source: 'scan_circular', data, pushAllFromStorage, pull, t, token: user?.token });
  const budgetPlanner = useAiRecipeCollection({ source: 'budget_planner', data, pushAllFromStorage, pull, t, token: user?.token });
  const semiHomemade = useAiRecipeCollection({ source: 'semi_homemade', data, pushAllFromStorage, pull, t, token: user?.token });
  const suggestedRecipes = useAiRecipeCollection({ source: 'suggested', data, pushAllFromStorage, pull, t, token: user?.token });

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

  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_SUGGESTIONS_KEY).then((raw) => {
      try {
        const parsed = JSON.parse(raw || '[]');
        if (Array.isArray(parsed)) setDismissedSuggestionIds(parsed);
      } catch { }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(LOYALTY_CARD_KEY).then((raw) => {
      try {
        const parsed = JSON.parse(raw || 'null');
        if (parsed) setLinkedLoyaltyCard(parsed);
      } catch { }
    });
  }, []);

  useEffect(() => {
    fetchQuickSuggestions({ locale }).then(setQuickSuggestions).catch(() => { });
  }, [locale]);

  const { isListening, isProcessing, start, stop } = useContinuousMic({
    locale: locale,
    token: user?.token,
    onTranscript: async (text) => {
      setLastTranscript(text);
      try {
        // The family_hub endpoint only ever took a single `message` string
        // (no messages array like useFernVoice/ChatSheetModal use), so a
        // follow-up such as "what about tomorrow?" had nothing to refer
        // back to. Folding the last few turns into the message text keeps
        // the request shape (message/context/userId/locale) unchanged
        // while giving the model something to work with.
        const transcript = voiceHistory
          .map((turn) => `${turn.role === 'user' ? 'You' : 'Fern'}: ${turn.content}`)
          .join('\n');
        const message = transcript ? `${transcript}\nYou: ${text}` : text;

        const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/ai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FernApp/1.0 (myaifern.com)',
          },
          body: JSON.stringify({ message, context: 'family_hub', userId: user?.id, token: user?.token, locale }),
        });
        const d = await res.json();
        const reply = d.reply || '';
        setFernReply(reply);
        setVoiceHistory((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: reply }].slice(-8));
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
  const availableCoupons = normalizeCoupons(data.availableCoupons);
  const walletCoupons = normalizeCoupons(data.walletCoupons);
  const couponsCount = walletCouponsLocal.length;
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

  useEffect(() => {
    setWalletCouponsLocal(walletCoupons);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.walletCoupons]);

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
      const location = await findStoreLocationByZip(trimmedName, trimmedZip, user?.token);
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
        locale: locale,
        token: user?.token,
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

  const resetSemiHomemadeModal = () => {
    setSemiHomemadeSelectedShortcuts([]);
    setSemiHomemadeCustomItems([]);
    setSemiHomemadeCustomItemInput('');
    setSemiHomemadeVibeInput('');
    setSemiHomemadeServings(4);
    setIsSemiHomemadeDesigning(false);
    setSemiHomemadeResult(null);
    setIsSemiHomemadeRecipeSaved(false);
  };

  const openSemiHomemadeModal = () => {
    resetSemiHomemadeModal();
    setIsSemiHomemadeOpen(true);
  };

  const closeSemiHomemadeModal = () => {
    setIsSemiHomemadeOpen(false);
    resetSemiHomemadeModal();
  };

  const toggleSemiHomemadeShortcut = (value) => {
    setSemiHomemadeSelectedShortcuts((current) => (
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    ));
  };

  const addSemiHomemadeCustomItem = () => {
    const trimmed = semiHomemadeCustomItemInput.trim();
    if (!trimmed) return;

    setSemiHomemadeCustomItems((current) => (
      current.includes(trimmed) ? current : [...current, trimmed]
    ));
    setSemiHomemadeCustomItemInput('');
  };

  const removeSemiHomemadeCustomItem = (item) => {
    setSemiHomemadeCustomItems((current) => current.filter((entry) => entry !== item));
  };

  const handleDesignSemiHomemadeRecipe = async () => {
    const items = [...semiHomemadeSelectedShortcuts, ...semiHomemadeCustomItems];
    if (!items.length) {
      Alert.alert(t('dish_required'), t('semi_homemade_pick_one_hint'));
      return;
    }

    setIsSemiHomemadeDesigning(true);
    setSemiHomemadeResult(null);
    setIsSemiHomemadeRecipeSaved(false);

    try {
      const result = await fetchSemiHomemadeRecipe({
        userId: user?.id,
        items,
        vibe: semiHomemadeVibeInput.trim(),
        servings: semiHomemadeServings,
        locale,
        token: user?.token,
      });

      console.log('[semi-homemade] request payload', result.payload);
      console.log('[semi-homemade] response', result.responseJson);

      const image = await fetchRecipeImage(`${result.recipe.title} food`.trim(), user?.token);
      setSemiHomemadeResult({ ...result.recipe, image });
    } catch (e) {
      console.log('[semi-homemade] design failed', e?.message || e);
      Alert.alert(t('search_failed'), t('semi_homemade_load_failed'));
    } finally {
      setIsSemiHomemadeDesigning(false);
    }
  };

  const handleTryAgainSemiHomemade = () => {
    setSemiHomemadeResult(null);
    setIsSemiHomemadeRecipeSaved(false);
  };

  const handleSaveSemiHomemadeRecipe = async () => {
    if (!semiHomemadeResult || isSemiHomemadeRecipeSaved) return;

    setIsSavingSemiHomemadeRecipe(true);
    try {
      await semiHomemade.saveToLibrary({
        id: `semi-homemade-${Date.now()}`,
        title: semiHomemadeResult.title,
        emoji: semiHomemadeResult.emoji,
        category: semiHomemadeVibeInput.trim() || 'Semi-Homemade',
        meal: 'Dinner',
        time: semiHomemadeResult.time,
        difficulty: semiHomemadeResult.difficulty,
        description: semiHomemadeResult.tagline,
        ingredients: semiHomemadeResult.ingredients,
        methodSteps: semiHomemadeResult.instructions,
        image: semiHomemadeResult.image,
      });
      setIsSemiHomemadeRecipeSaved(true);
    } catch (e) {
      console.log('[semi-homemade] save failed', e?.message || e);
      Alert.alert(t('save_failed'), t('save_recipe_failed_desc'));
    } finally {
      setIsSavingSemiHomemadeRecipe(false);
    }
  };

  const handleAddSemiHomemadeToList = () => {
    if (!semiHomemadeResult) return;

    const ingredients = semiHomemadeResult.shoppingList.length
      ? semiHomemadeResult.shoppingList
      : semiHomemadeResult.ingredients;

    semiHomemade.addIngredientsToShoppingList({
      id: `semi-homemade-${Date.now()}`,
      title: semiHomemadeResult.title,
      ingredients,
    });
  };

  const handleAskFernSemiHomemade = () => {
    closeSemiHomemadeModal();
    if (!isListening) {
      start();
    }
  };

  const loadStoreLoyaltyCards = async () => {
    setIsLoadingStoreLoyaltyCards(true);
    try {
      const cards = await fetchLinkedStoreCards({ token: user?.token });
      setStoreLoyaltyCards(cards);
    } catch (e) {
      console.log('[loyalty] failed to load store cards', e?.message || e);
    } finally {
      setIsLoadingStoreLoyaltyCards(false);
    }
  };

  const openLoyaltyModal = () => {
    setLoyaltyPhoneInput('');
    setLoyaltyCardError('');
    setStoreCardNameInput('');
    setStoreCardNumberInput('');
    setIsLoyaltyModalOpen(true);
    loadStoreLoyaltyCards();
  };

  const closeLoyaltyModal = () => {
    setIsLoyaltyModalOpen(false);
    setLoyaltyCardError('');
  };

  const handleRelinkLoyaltyCard = () => {
    setLinkedLoyaltyCard(null);
    setLoyaltyPhoneInput('');
    setLoyaltyCardError('');
  };

  const handleLinkLoyaltyCard = async () => {
    if (!loyaltyPhoneInput.trim()) {
      setLoyaltyCardError(t('loyalty_modal_phone_required'));
      return;
    }

    setIsLinkingLoyaltyCard(true);
    setLoyaltyCardError('');
    try {
      const result = await matchLoyaltyCard({ phone: loyaltyPhoneInput });
      const record = { ...result, linkedAt: Date.now() };
      setLinkedLoyaltyCard(record);
      await AsyncStorage.setItem(LOYALTY_CARD_KEY, JSON.stringify(record));
    } catch (e) {
      setLoyaltyCardError(t('loyalty_modal_link_error'));
    } finally {
      setIsLinkingLoyaltyCard(false);
    }
  };

  const handleAddStoreCard = async () => {
    if (!storeCardNameInput.trim() || !storeCardNumberInput.trim()) {
      Alert.alert(t('loyalty_store_cards_title'), t('loyalty_store_card_name_required'));
      return;
    }

    setIsAddingStoreCard(true);
    try {
      const cards = await linkStoreCard({
        token: user?.token,
        storeName: storeCardNameInput,
        cardNumber: storeCardNumberInput,
      });
      setStoreLoyaltyCards(cards);
      setStoreCardNameInput('');
      setStoreCardNumberInput('');
    } catch (e) {
      console.log('[loyalty] failed to link store card', e?.message || e);
      Alert.alert(t('save_failed'), t('save_error_desc'));
    } finally {
      setIsAddingStoreCard(false);
    }
  };

  const handleRemoveStoreCard = async (storeName) => {
    setRemovingStoreCardName(storeName);
    try {
      const cards = await unlinkStoreCard({ token: user?.token, storeName });
      setStoreLoyaltyCards(cards);
    } catch (e) {
      console.log('[loyalty] failed to unlink store card', e?.message || e);
      Alert.alert(t('save_failed'), t('save_error_desc'));
    } finally {
      setRemovingStoreCardName(null);
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
        token: user?.token,
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

  const resetScanCircularModal = () => {
    setScanCircularStep('select');
    setScanCircularPhoto(null);
    setScanCircularResult(null);
    setScanCircularSelectedItem(null);
    setScanCircularDealIdeas([]);
    setIsLoadingScanCircularIdeas(false);
  };

  const openScanCircularModal = () => {
    resetScanCircularModal();
    setIsScanCircularOpen(true);
  };

  const closeScanCircularModal = () => {
    setIsScanCircularOpen(false);
    resetScanCircularModal();
  };

  const pickScanCircularPhoto = async (fromCamera) => {
    const result = fromCamera ? await pickPhotoFromCamera() : await pickPhotoFromLibrary();
    if (result.permissionDenied) {
      Alert.alert(t('permission_needed_title'), t('photo_permission_denied_desc'));
      return;
    }
    if (!result.photo) return;
    setScanCircularPhoto(result.photo);
  };

  const handleScanCircularSubmit = async () => {
    if (!scanCircularPhoto?.base64) return;

    setScanCircularStep('loading');

    try {
      const result = await scanCircular({
        userId: user?.id || '7c36273e-07b1-410c-ad1b-4c2b0295e140',
        base64: scanCircularPhoto.base64,
        mimeType: scanCircularPhoto.mimeType,
        token: user?.token,
      });
      setScanCircularResult(result);
      setScanCircularStep('results');
    } catch (e) {
      console.log('[scan-circular] scan failed', e?.message || e);
      Alert.alert(t('scan_circular_scan_failed_title'), t('scan_circular_scan_failed_desc'));
      setScanCircularStep('select');
    }
  };

  const handleScanCircularAnother = () => {
    resetScanCircularModal();
  };

  const handleScanCircularAskFern = () => {
    closeScanCircularModal();
    if (!isListening) {
      start();
    }
  };

  const loadScanCircularDealIdeas = async (item) => {
    setScanCircularDealIdeas([]);
    setIsLoadingScanCircularIdeas(true);
    try {
      const ideas = await fetchDealRecipeIdeas({ itemName: item.name, locale, token: user?.token });
      setScanCircularDealIdeas(ideas);
      ideas.forEach((idea) => {
        fetchRecipeImage(idea.title, user?.token).then((url) => {
          if (!url) return;
          setScanCircularDealIdeas((prev) => prev.map((entry) => (entry.id === idea.id ? { ...entry, image: url } : entry)));
        });
      });
    } catch (e) {
      console.log('[scan-circular] deal ideas failed', e?.message || e);
      Alert.alert(t('scan_circular_ideas_failed_title'), t('scan_circular_ideas_failed_desc'));
    } finally {
      setIsLoadingScanCircularIdeas(false);
    }
  };

  const handleScanCircularFindRecipes = (item) => {
    setScanCircularSelectedItem(item);
    setScanCircularStep('item-detail');
    loadScanCircularDealIdeas(item);
  };

  const handleScanCircularBackToDeals = () => {
    setScanCircularStep('results');
  };

  const handleAddScanCircularItemToList = async () => {
    if (!scanCircularSelectedItem) return;

    setIsAddingScanCircularItemToList(true);
    try {
      const existingItems = Array.isArray(data.shopping) ? data.shopping : [];
      const syntheticRecipe = {
        id: scanCircularSelectedItem.id,
        title: scanCircularSelectedItem.name,
        ingredients: [scanCircularSelectedItem.name],
      };
      const { addedCount, checkedCount } = await addRecipeIngredientsToShoppingList(syntheticRecipe, existingItems);

      await pushAllFromStorage();
      await pull();

      Alert.alert(t('added_title'), t('shopping_list_updated_desc', { added: addedCount, checked: checkedCount }));
    } catch (e) {
      console.log('[scan-circular] add item to list failed', e?.message || e);
      Alert.alert(t('could_not_add_items_title'), t('save_error_desc'));
    } finally {
      setIsAddingScanCircularItemToList(false);
    }
  };

  const handleRegenerateScanCircularIdeas = () => {
    if (scanCircularSelectedItem) loadScanCircularDealIdeas(scanCircularSelectedItem);
  };

  const closeScanCircularRecipeDetail = () => {
    scanCircularDeals.setSelectedRecipe(null);
    setIsScanCircularOpen(true);
  };

  const handleChooseScanCircularIdea = async (idea) => {
    if (!scanCircularSelectedItem) return;

    try {
      const fullRecipe = await fetchFullRecipeForDealIdea({
        idea,
        itemName: scanCircularSelectedItem.name,
        locale,
        token: user?.token,
      });
      scanCircularDeals.viewRecipe(fullRecipe, { onOpenDetail: () => setIsScanCircularOpen(false) });
    } catch (e) {
      console.log('[scan-circular] full recipe failed', e?.message || e);
      Alert.alert(t('scan_circular_recipe_failed_title'), t('scan_circular_recipe_failed_desc'));
    }
  };

  const resetBudgetPlannerModal = () => {
    setBudgetPlannerStep('form');
    setBudgetType('weekly');
    setBudgetInput('75');
    setBudgetPeople(4);
    setBudgetDietary('No restrictions');
    setBudgetPlan(null);
    setBudgetShoppingItems([]);
    setIsAddingBudgetItemRowOpen(false);
    setBudgetNewItemText('');
    setBudgetConfirmItems(null);
  };

  const openBudgetPlannerModal = () => {
    resetBudgetPlannerModal();
    setIsBudgetPlannerOpen(true);
  };

  const closeBudgetPlannerModal = () => {
    setIsBudgetPlannerOpen(false);
    resetBudgetPlannerModal();
  };

  const handleAskFernBudgetPlanner = () => {
    closeBudgetPlannerModal();
    if (!isListening) {
      start();
    }
  };

  const handleChangeBudgetInput = (text) => {
    setBudgetInput(text.replace(/[^0-9]/g, ''));
  };

  const handleSelectBudgetPreset = (value) => {
    setBudgetInput(String(value));
  };

  const handleSelectBudgetPeople = (value) => {
    setBudgetPeople(value);
  };

  const handleSelectBudgetDietary = (value) => {
    setBudgetDietary(value);
  };

  const handlePlanBudgetWeek = async () => {
    const amount = Number.parseInt(budgetInput, 10) || 0;
    if (amount <= 0) {
      Alert.alert(t('budget_planner_budget_required_title'), t('budget_planner_budget_required_desc'));
      return;
    }

    const weeklyBudget = budgetType === 'per_person' ? amount * budgetPeople * 7 : amount;

    setBudgetPlannerStep('loading');

    try {
      const result = await fetchBudgetMealPlan({
        weeklyBudget,
        people: budgetPeople,
        dietary: budgetDietary,
        deals: [],
        locale,
        token: user?.token,
      });

      setBudgetPlan(result);
      setBudgetShoppingItems(result.shoppingItems);
      setBudgetPlannerStep('results');

      result.dinners.forEach((dinner) => {
        fetchRecipeImage(`${dinner.title} ${dinner.cuisine} food`.trim(), user?.token).then((url) => {
          if (!url) return;
          setBudgetPlan((current) => {
            if (!current) return current;
            return {
              ...current,
              dinners: current.dinners.map((entry) => (entry.id === dinner.id ? { ...entry, image: url } : entry)),
            };
          });
        });
      });
    } catch (e) {
      console.log('[budget-planner] plan failed', e?.message || e);
      Alert.alert(t('budget_planner_failed_title'), t('budget_planner_failed_desc'));
      setBudgetPlannerStep('form');
    }
  };

  const handleSaveBudgetDinner = (dinner) => {
    budgetPlanner.handleSaveFromCard(dinner);
  };

  const handleAddBudgetDinnerToList = (dinner) => {
    budgetPlanner.addIngredientsToShoppingList(dinner);
  };

  const closeBudgetPlannerRecipeDetail = () => {
    budgetPlanner.setSelectedRecipe(null);
    setIsBudgetPlannerOpen(true);
  };

  const handleViewBudgetDinner = (dinner) => {
    budgetPlanner.viewRecipe(dinner, { onOpenDetail: () => setIsBudgetPlannerOpen(false) });
  };

  const handleToggleBudgetShoppingItem = (id) => {
    setBudgetShoppingItems((current) => current.map((item) => (item.id === id ? { ...item, haveAlready: !item.haveAlready } : item)));
  };

  const handleRemoveBudgetShoppingItem = (id) => {
    setBudgetShoppingItems((current) => current.filter((item) => item.id !== id));
  };

  const handleToggleAddBudgetItemRow = () => {
    setIsAddingBudgetItemRowOpen((current) => !current);
    setBudgetNewItemText('');
  };

  const handleConfirmAddBudgetItem = () => {
    const text = budgetNewItemText.trim();
    if (!text) return;

    setBudgetShoppingItems((current) => [
      ...current,
      { id: `budget-shop-custom-${Date.now()}`, category: 'Other', text, haveAlready: false },
    ]);
    setBudgetNewItemText('');
    setIsAddingBudgetItemRowOpen(false);
  };

  const handleReviewBudgetShoppingList = () => {
    const confirmItems = budgetShoppingItems
      .filter((item) => !item.haveAlready)
      .map((item) => ({ id: item.id, text: item.text, selected: true }));
    setBudgetConfirmItems(confirmItems);
    setBudgetPlannerStep('confirm');
  };

  const handleToggleBudgetConfirmItem = (id) => {
    setBudgetConfirmItems((current) => current.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)));
  };

  const handleBackToBudgetResults = () => {
    setBudgetPlannerStep('results');
  };

  const handleConfirmAddBudgetItemsToShoppingList = async () => {
    const selectedTexts = (budgetConfirmItems || []).filter((item) => item.selected).map((item) => item.text);
    if (!selectedTexts.length) return;

    setIsAddingBudgetItemsToShoppingList(true);
    try {
      const existingItems = Array.isArray(data.shopping) ? data.shopping : [];
      const syntheticRecipe = { id: 'budget-plan', title: 'Budget Plan', ingredients: selectedTexts };
      const { addedCount, checkedCount } = await addRecipeIngredientsToShoppingList(syntheticRecipe, existingItems);

      await pushAllFromStorage();
      await pull();

      Alert.alert(t('added_title'), t('shopping_list_updated_desc', { added: addedCount, checked: checkedCount }));
      setBudgetPlannerStep('results');
    } catch (e) {
      console.log('[budget-planner] add to shopping list failed', e?.message || e);
      Alert.alert(t('could_not_add_items_title'), t('save_error_desc'));
    } finally {
      setIsAddingBudgetItemsToShoppingList(false);
    }
  };

  const handleNewBudgetPlan = () => {
    setBudgetPlannerStep('form');
    setBudgetPlan(null);
    setBudgetShoppingItems([]);
    setBudgetConfirmItems(null);
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
        token: user?.token,
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
        token: user?.token,
      });

      console.log('[quick-dinner] request payload', result.payload);
      console.log('[quick-dinner] response', result.responseJson);

      const recipesWithImages = await Promise.all(result.recipes.map(async (recipe) => {
        const image = await fetchRecipeImage(`${recipe.title} ${recipe.cuisine} food`.trim(), user?.token);
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

  const loadSuggestedRecipes = async () => {
    setIsLoadingSuggestedRecipes(true);
    try {
      const recentTitles = (data.recipes || [])
        .slice(-10)
        .map((r) => String(r?.title || r?.name || '').trim())
        .filter(Boolean);
      const storeNames = userStores.map((s) => s?.name).filter(Boolean);
      const prompt = buildSuggestionsPrompt({ dietary, household: 'solo', recentTitles, storeNames });

      const groups = await fetchSuggestedRecipeGroups({ prompt, locale, token: user?.token, userId: user?.id });
      setSuggestedGroups(groups);
      setSuggestedUpdatedAt(Date.now());

      groups.forEach((group) => {
        group.recipes.forEach((entry) => {
          const query = `${entry.recipe.title} ${entry.recipe.cuisine} food`.trim();
          fetchRecipeImage(query, user?.token).then((url) => {
            if (!url) return;
            setSuggestedGroups((current) => current.map((g) => (
              g.id !== group.id
                ? g
                : { ...g, recipes: g.recipes.map((r) => (r.id === entry.id ? { ...r, image: url } : r)) }
            )));
          });
        });
      });
    } catch (e) {
      console.log('[suggested-recipes] load failed', e?.message || e);
      Alert.alert(t('save_failed'), t('save_error_desc'));
    } finally {
      setIsLoadingSuggestedRecipes(false);
    }
  };

  const openSuggestedRecipes = () => {
    setIsSuggestedRecipesOpen(true);
    if (!suggestedGroups.length && !isLoadingSuggestedRecipes) {
      loadSuggestedRecipes();
    }
  };

  const handleViewSuggestedRecipe = (entry) => {
    suggestedRecipes.viewRecipe({ ...entry.recipe, image: entry.image }, {});
  };

  const openCouponWallet = () => {
    setIsCouponWalletOpen(true);
  };

  const openCouponDetail = (coupon) => {
    setSelectedCoupon(coupon);
  };

  const closeCouponDetail = () => {
    setSelectedCoupon(null);
  };

  // Updates local state first so the UI reacts instantly, then persists/pushes
  // in the background — waiting on the sync round-trip before updating made
  // "+ Add" feel slow, and a fresh pull() isn't needed since we already know
  // the resulting list.
  const addCouponToWallet = (coupon) => {
    if (!coupon || walletCouponsLocal.some((item) => item.id === coupon.id)) return;

    const nextWallet = [...walletCouponsLocal, coupon];
    setWalletCouponsLocal(nextWallet);

    AsyncStorage.setItem('rv4_wallet_coupons', JSON.stringify(nextWallet))
      .then(() => pushChangedFromStorage({ wallet_coupons: nextWallet }))
      .catch((e) => console.log('[coupons] failed to save wallet coupon', e?.message || e));
  };

  const removeCouponFromWallet = (coupon) => {
    if (!coupon) return;

    const nextWallet = walletCouponsLocal.filter((item) => item.id !== coupon.id);
    setWalletCouponsLocal(nextWallet);

    AsyncStorage.setItem('rv4_wallet_coupons', JSON.stringify(nextWallet))
      .then(() => pushChangedFromStorage({ wallet_coupons: nextWallet }))
      .catch((e) => console.log('[coupons] failed to remove wallet coupon', e?.message || e));
  };

  const handleToggleCouponWallet = (coupon) => {
    const isInWallet = walletCouponsLocal.some((item) => item.id === coupon.id);
    if (isInWallet) {
      removeCouponFromWallet(coupon);
    } else {
      addCouponToWallet(coupon);
    }
  };

  const loadMealPlan = async () => {
    setIsLoadingMealPlanner(true);
    try {
      const result = await fetchMealPlan({ userId: user?.id, token: user?.token });
      setMealPlannerDays(result.days);
    } catch (e) {
      console.log('[meal-planner] load failed', e?.message || e);
      Alert.alert(t('save_failed'), t('save_error_desc'));
    } finally {
      setIsLoadingMealPlanner(false);
    }
  };

  const openMealPlannerModal = () => {
    setIsMealPlannerOpen(true);
    if (!mealPlannerDays.length && !isLoadingMealPlanner) {
      loadMealPlan();
    }
  };

  // Returns a promise resolving true/false so MealPlannerModal knows whether
  // to switch back from Preferences to the newly generated plan.
  const handleGenerateMealPlan = (preferencesFromUi) => new Promise((resolve) => {
    Alert.alert(
      t('meal_planner_regenerate_confirm_title'),
      t('meal_planner_regenerate_confirm_desc'),
      [
        { text: t('cancel_btn'), style: 'cancel', onPress: () => resolve(false) },
        {
          text: t('meal_planner_regenerate_confirm_btn'),
          onPress: async () => {
            setIsGeneratingMealPlan(true);
            try {
              const savedRecipeTitles = (data.recipes || [])
                .map((recipe) => recipe?.title)
                .filter(Boolean);
              const result = await generateMealPlan({
                userId: user?.id,
                locale,
                savedRecipes: savedRecipeTitles,
                currentDays: mealPlannerDays,
              });
              setMealPlannerDays(result.days);
              setMealPlannerShoppingList([]); // stale — refetch next time it's opened
              resolve(true);

              const preferencesToSave = preferencesFromUi || mealPlannerPreferences;
              if (preferencesFromUi) setMealPlannerPreferences(preferencesFromUi);

              saveMealPlan({
                userId: user?.id,
                token: user?.token,
                days: result.days,
                preferences: preferencesToSave,
              }).catch((e) => console.log('[meal-planner] save failed', e?.message || e));
            } catch (e) {
              console.log('[meal-planner] generate failed', e?.message || e);
              Alert.alert(t('save_failed'), t('save_error_desc'));
              resolve(false);
            } finally {
              setIsGeneratingMealPlan(false);
            }
          },
        },
      ],
    );
  });

  const handleSelectMealPlannerMeal = (meal, dayLabel, dayIndex) => {
    setSelectedMealPlannerMeal({ ...meal, dayLabel, dayIndex });
  };

  const handleSwapMealPlannerMeal = async () => {
    if (!selectedMealPlannerMeal) return;

    const { dayIndex, slot, id, dayLabel } = selectedMealPlannerMeal;
    setIsSwappingMeal(true);
    try {
      const newMeal = await regenerateMeal({
        userId: user?.id,
        locale,
        currentDays: mealPlannerDays,
        dayIndex,
        slot,
      });

      // dayIndex + slot are the only things that identify which meal to
      // replace (titles can repeat) — splice it back in by position, keep
      // the existing local `id` so the detail view doesn't remount oddly.
      const nextDays = mealPlannerDays.map((day, di) => {
        if (di !== dayIndex) return day;
        return {
          ...day,
          meals: day.meals.map((existingMeal) => (
            existingMeal.slot === slot ? { ...newMeal, id: existingMeal.id } : existingMeal
          )),
        };
      });

      setMealPlannerDays(nextDays);
      setSelectedMealPlannerMeal({ ...newMeal, id, dayLabel, dayIndex });
      setMealPlannerShoppingList([]); // stale — refetch next time it's opened

      saveMealPlan({
        userId: user?.id,
        token: user?.token,
        days: nextDays,
        preferences: mealPlannerPreferences,
      }).catch((e) => console.log('[meal-planner] save after swap failed', e?.message || e));
    } catch (e) {
      console.log('[meal-planner] swap meal failed', e?.message || e);
      Alert.alert(t('save_failed'), t('save_error_desc'));
    } finally {
      setIsSwappingMeal(false);
    }
  };

  const loadMealPlannerShoppingList = async () => {
    setIsLoadingMealPlannerShoppingList(true);
    try {
      const result = await fetchMealPlannerShoppingList({
        userId: user?.id,
        locale,
        currentDays: mealPlannerDays,
      });
      setMealPlannerShoppingList(result.groups);
    } catch (e) {
      console.log('[meal-planner] shopping list load failed', e?.message || e);
      Alert.alert(t('save_failed'), t('save_error_desc'));
    } finally {
      setIsLoadingMealPlannerShoppingList(false);
    }
  };

  const handleOpenMealPlannerShoppingList = () => {
    if (!mealPlannerShoppingList.length && !isLoadingMealPlannerShoppingList) {
      loadMealPlannerShoppingList();
    }
  };

  const handleShopMealPlannerWithFern = async () => {
    const allItems = mealPlannerShoppingList.flatMap((group) => group.items);
    if (!allItems.length) {
      Alert.alert(t('no_items'), t('no_items_desc'));
      return;
    }

    setIsSavingMealPlannerShoppingList(true);
    try {
      const existingItems = Array.isArray(data.shopping) ? data.shopping : [];
      const syntheticRecipe = { id: 'meal-planner-week', title: 'Meal Plan', ingredients: allItems };
      await addRecipeIngredientsToShoppingList(syntheticRecipe, existingItems);

      await pushAllFromStorage();
      await pull();

      setIsMealPlannerOpen(false);
      setSelectedMealPlannerMeal(null);
      navigation.navigate('Shopping');
    } catch (e) {
      console.log('[meal-planner] shop with fern failed', e?.message || e);
      Alert.alert(t('could_not_add_items_title'), t('save_error_desc'));
    } finally {
      setIsSavingMealPlannerShoppingList(false);
    }
  };

  const toggleDismissSuggestion = async (id) => {
    const next = dismissedSuggestionIds.includes(id)
      ? dismissedSuggestionIds.filter((x) => x !== id)
      : [...dismissedSuggestionIds, id];
    setDismissedSuggestionIds(next);
    await AsyncStorage.setItem(DISMISSED_SUGGESTIONS_KEY, JSON.stringify(next));
  };

  const handleAddQuickDinnerRecipeToList = (recipe) => {
    quickDinner.addIngredientsToShoppingList(recipe);
  };

  const selectedAiRecipe = leftover.selectedRecipe || fridgeChallenge.selectedRecipe || quickDinner.selectedRecipe || scanCircularDeals.selectedRecipe || budgetPlanner.selectedRecipe || suggestedRecipes.selectedRecipe;
  const activeAiRecipeCollection = leftover.selectedRecipe
    ? leftover
    : fridgeChallenge.selectedRecipe
      ? fridgeChallenge
      : quickDinner.selectedRecipe
        ? quickDinner
        : scanCircularDeals.selectedRecipe
          ? scanCircularDeals
          : budgetPlanner.selectedRecipe
            ? budgetPlanner
            : suggestedRecipes.selectedRecipe
              ? suggestedRecipes
              : null;
  const closeSelectedAiRecipeDetail = leftover.selectedRecipe
    ? closeLeftoverRecipeDetail
    : fridgeChallenge.selectedRecipe
      ? closeFridgeChallengeRecipeDetail
      : quickDinner.selectedRecipe
        ? closeQuickDinnerRecipeDetail
        : scanCircularDeals.selectedRecipe
          ? closeScanCircularRecipeDetail
          : suggestedRecipes.selectedRecipe
            ? () => suggestedRecipes.setSelectedRecipe(null)
            : closeBudgetPlannerRecipeDetail;

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
        dish, locale,
        token: user?.token,
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

        {isCouponWalletOpen ? (
          <CouponWalletScreen
            onBack={() => setIsCouponWalletOpen(false)}
            availableCoupons={availableCoupons}
            walletCoupons={walletCouponsLocal}
            onAddToWallet={addCouponToWallet}
            onViewCoupon={openCouponDetail}
          />
        ) : isSuggestedRecipesOpen ? (
          <SuggestedRecipesScreen
            groups={suggestedGroups}
            isLoading={isLoadingSuggestedRecipes}
            updatedAt={suggestedUpdatedAt}
            filter={suggestedFilter}
            onChangeFilter={setSuggestedFilter}
            onRefresh={loadSuggestedRecipes}
            onBack={() => setIsSuggestedRecipesOpen(false)}
            onViewRecipe={handleViewSuggestedRecipe}
            isRecipeSaved={suggestedRecipes.isRecipeSaved}
            dismissedIds={dismissedSuggestionIds}
            onToggleDismiss={toggleDismissSuggestion}
          />
        ) : (
          <>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.greeting}>{getGreeting(t)}, {"\n"}{userName}</Text>
                <Text style={styles.subheading}>{t('food_life_glance')}</Text>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.proBadge} activeOpacity={0.85} onPress={openPlans}>
                  <Text style={styles.proBadgeText}>{tierBadgeLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBadge}
                  activeOpacity={0.85}
                  onPress={openAccount}
                >
                  <Text style={styles.iconBadgeText}>👤</Text>
                </TouchableOpacity>
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
                              : label === 'Weekly Nutrition'
                                ? () => setIsNutritionTrackerOpen(true)
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
                { label: 'Coupons', val: `${couponsCount}`, onPress: openCouponWallet },
              ].map(({ label, val, color, route, params, onPress }) => {
                const statKeysMap = {
                  'Recipes Saved': 'stat_recipes_saved',
                  'Cookbooks': 'stat_cookbooks',
                  'Bloggers Following': 'stat_bloggers',
                  'Coupons': 'stat_coupons'
                };
                const handlePress = onPress || (route ? () => navigation.navigate(route, { ...params, requestKey: Date.now() }) : undefined);
                return (
                  <TouchableOpacity
                    key={label}
                    activeOpacity={handlePress ? 0.85 : 1}
                    disabled={!handlePress}
                    onPress={handlePress}
                    style={[styles.statCard, shadow.card]}
                  >
                    <Text style={[styles.statVal, { color: color }]}>{val}</Text>
                    <Text style={styles.statLabel}>{t(statKeysMap[label] || label)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.statsRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.statCard, styles.suggestedMealsCard, shadow.card]}
                onPress={openSuggestedRecipes}
              >
                <Text style={styles.suggestedMealsText}>{t('suggested_meals_title')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.statCard, shadow.card]}
                onPress={openLoyaltyModal}
              >
                <Text style={styles.loyaltyCardTitle}>{t('loyalty_card_title')}</Text>
                <Text style={[styles.loyaltyCardIcon, linkedLoyaltyCard ? styles.loyaltyCardIconLinked : null]}>🛒</Text>
                {linkedLoyaltyCard ? (
                  <Text style={styles.loyaltyCardLinkedBadge}>{t('loyalty_card_linked_badge')}</Text>
                ) : (
                  <Text style={styles.loyaltyCardLink}>{t('link_card_btn')}</Text>
                )}
              </TouchableOpacity>
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

                        <TouchableOpacity style={styles.scanCircularBtn} activeOpacity={0.85} onPress={openScanCircularModal}>
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
                  'Budget Planner': openBudgetPlannerModal,
                  'AI Meal Planner': openMealPlannerModal,
                  'Semi-Homemade': openSemiHomemadeModal,
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
          </>
        )}

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

      <SemiHomemadeModal
        visible={isSemiHomemadeOpen}
        onClose={closeSemiHomemadeModal}
        onAskFern={handleAskFernSemiHomemade}
        selectedShortcuts={semiHomemadeSelectedShortcuts}
        onToggleShortcut={toggleSemiHomemadeShortcut}
        customItems={semiHomemadeCustomItems}
        customItemInput={semiHomemadeCustomItemInput}
        setCustomItemInput={setSemiHomemadeCustomItemInput}
        onAddCustomItem={addSemiHomemadeCustomItem}
        onRemoveCustomItem={removeSemiHomemadeCustomItem}
        vibeInput={semiHomemadeVibeInput}
        setVibeInput={setSemiHomemadeVibeInput}
        servings={semiHomemadeServings}
        setServings={setSemiHomemadeServings}
        isDesigning={isSemiHomemadeDesigning}
        result={semiHomemadeResult}
        onDesign={handleDesignSemiHomemadeRecipe}
        onTryAgain={handleTryAgainSemiHomemade}
        isSaving={isSavingSemiHomemadeRecipe}
        isSaved={isSemiHomemadeRecipeSaved}
        onSaveRecipe={handleSaveSemiHomemadeRecipe}
        isAddingToList={semiHomemade.isSaving}
        onAddToList={handleAddSemiHomemadeToList}
      />

      <LoyaltyCardModal
        visible={isLoyaltyModalOpen}
        onClose={closeLoyaltyModal}
        phoneInput={loyaltyPhoneInput}
        setPhoneInput={setLoyaltyPhoneInput}
        isLinking={isLinkingLoyaltyCard}
        error={loyaltyCardError}
        linkedCard={linkedLoyaltyCard}
        onLinkCard={handleLinkLoyaltyCard}
        onRelink={handleRelinkLoyaltyCard}
        storeCards={storeLoyaltyCards}
        isLoadingStoreCards={isLoadingStoreLoyaltyCards}
        storeNameInput={storeCardNameInput}
        setStoreNameInput={setStoreCardNameInput}
        cardNumberInput={storeCardNumberInput}
        setCardNumberInput={setStoreCardNumberInput}
        isAddingStoreCard={isAddingStoreCard}
        onAddStoreCard={handleAddStoreCard}
        removingStoreName={removingStoreCardName}
        onRemoveStoreCard={handleRemoveStoreCard}
      />

      <CouponDetailModal
        visible={Boolean(selectedCoupon)}
        coupon={selectedCoupon}
        isInWallet={selectedCoupon ? walletCouponsLocal.some((item) => item.id === selectedCoupon.id) : false}
        onClose={closeCouponDetail}
        onToggleWallet={handleToggleCouponWallet}
      />

      <MealPlannerModal
        visible={isMealPlannerOpen}
        onClose={() => {
          setIsMealPlannerOpen(false);
          setSelectedMealPlannerMeal(null);
        }}
        isLoading={isLoadingMealPlanner}
        isGenerating={isGeneratingMealPlan}
        days={mealPlannerDays}
        savedRecipesCount={(data.recipes || []).length}
        onSelectMeal={handleSelectMealPlannerMeal}
        onGenerate={handleGenerateMealPlan}
        onOpenShoppingList={handleOpenMealPlannerShoppingList}
        shoppingListGroups={mealPlannerShoppingList}
        isLoadingShoppingList={isLoadingMealPlannerShoppingList}
        onShopWithFern={handleShopMealPlannerWithFern}
        isSavingShoppingList={isSavingMealPlannerShoppingList}
        selectedMeal={selectedMealPlannerMeal}
        onCloseMealDetail={() => setSelectedMealPlannerMeal(null)}
        onSwapMeal={handleSwapMealPlannerMeal}
        isSwapping={isSwappingMeal}
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

      <ScanCircularModal
        visible={isScanCircularOpen}
        onClose={closeScanCircularModal}
        step={scanCircularStep}
        photo={scanCircularPhoto}
        onTakePhoto={() => pickScanCircularPhoto(true)}
        onPickFromLibrary={() => pickScanCircularPhoto(false)}
        onRemovePhoto={() => setScanCircularPhoto(null)}
        onSubmit={handleScanCircularSubmit}
        result={scanCircularResult}
        onScanAnother={handleScanCircularAnother}
        onAskFern={handleScanCircularAskFern}
        onFindRecipes={handleScanCircularFindRecipes}
        selectedItem={scanCircularSelectedItem}
        dealIdeas={scanCircularDealIdeas}
        isLoadingDealIdeas={isLoadingScanCircularIdeas}
        onBackToDeals={handleScanCircularBackToDeals}
        onAddItemToList={handleAddScanCircularItemToList}
        isAddingItemToList={isAddingScanCircularItemToList}
        onChooseIdea={handleChooseScanCircularIdea}
        onRegenerateIdeas={handleRegenerateScanCircularIdeas}
      />

      <BudgetPlannerModal
        visible={isBudgetPlannerOpen}
        onClose={closeBudgetPlannerModal}
        step={budgetPlannerStep}
        onAskFern={handleAskFernBudgetPlanner}
        budgetType={budgetType}
        onSelectBudgetType={setBudgetType}
        budgetInput={budgetInput}
        onChangeBudgetInput={handleChangeBudgetInput}
        onSelectPreset={handleSelectBudgetPreset}
        people={budgetPeople}
        onSelectPeople={handleSelectBudgetPeople}
        dietary={budgetDietary}
        onSelectDietary={handleSelectBudgetDietary}
        onPlan={handlePlanBudgetWeek}
        plan={budgetPlan}
        onSaveDinner={handleSaveBudgetDinner}
        onAddDinnerToList={handleAddBudgetDinnerToList}
        onViewDinner={handleViewBudgetDinner}
        isDinnerSaved={budgetPlanner.isRecipeSaved}
        savingDinnerKey={budgetPlanner.savingKey}
        shoppingItems={budgetShoppingItems}
        onToggleShoppingItem={handleToggleBudgetShoppingItem}
        onRemoveShoppingItem={handleRemoveBudgetShoppingItem}
        isAddingItemRowOpen={isAddingBudgetItemRowOpen}
        onToggleAddItemRow={handleToggleAddBudgetItemRow}
        newItemText={budgetNewItemText}
        onChangeNewItemText={setBudgetNewItemText}
        onConfirmAddItem={handleConfirmAddBudgetItem}
        onReviewShoppingList={handleReviewBudgetShoppingList}
        onNewPlan={handleNewBudgetPlan}
        confirmItems={budgetConfirmItems}
        onToggleConfirmItem={handleToggleBudgetConfirmItem}
        onConfirmAddToShoppingList={handleConfirmAddBudgetItemsToShoppingList}
        isAddingToShoppingList={isAddingBudgetItemsToShoppingList}
        onBackToResults={handleBackToBudgetResults}
      />

      <NutritionTrackerModal
        visible={isNutritionTrackerOpen}
        onClose={() => setIsNutritionTrackerOpen(false)}
        navigation={navigation}
        user={user}
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

  suggestedMealsCard: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  suggestedMealsText: {
    fontSize: 13,
    fontFamily: 'Jost-Bold',
    color: 'rgb(56, 89, 45)',
    textAlign: 'center',
  },

  loyaltyCardTitle: {
    fontSize: 11,
    fontFamily: 'Jost-Bold',
    color: '#5D4F42',
    letterSpacing: 1,
  },

  loyaltyCardIcon: {
    fontSize: 28,
    textAlign: 'center',
    marginVertical: 8,
    opacity: 0.5,
  },

  loyaltyCardIconLinked: {
    opacity: 1,
  },

  loyaltyCardLink: {
    fontSize: 13,
    fontFamily: 'Jost-Bold',
    color: 'rgb(216, 109, 51)',
    textAlign: 'center',
  },

  loyaltyCardLinkedBadge: {
    fontSize: 13,
    fontFamily: 'Jost-Bold',
    color: 'rgb(56, 89, 45)',
    textAlign: 'center',
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
