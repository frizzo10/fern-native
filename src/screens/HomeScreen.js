import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  TextInput,
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

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function dateKey(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toPlainStoreName(label) {
  return String(label || '')
    .replace(/^\s*[^\w]+\s*/u, '')
    .trim();
}

export default function HomeScreen({ user }) {
  const navigation = useNavigation();
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
  const [wineDishInput, setWineDishInput] = useState('');
  const [isWineSearching, setIsWineSearching] = useState(false);
  const [wineSummary, setWineSummary] = useState('');
  const [winePairings, setWinePairings] = useState([]);
  const [selectedWinePairing, setSelectedWinePairing] = useState(null);
  const [isAddingWineToList, setIsAddingWineToList] = useState(false);
  const { data, loading, pull, pushAllFromStorage } = useSync(user);

  useFocusEffect(
    useMemo(() => () => {
      pull();
    }, [pull])
  );

  const { isListening, isProcessing, start, stop } = useContinuousMic({
    onTranscript: async (text) => {
      setLastTranscript(text);
      try {
        const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/ai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FernApp/1.0 (myaifern.com)',
          },
          body: JSON.stringify({ message: text, context: 'family_hub', userId: user?.id }),
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
        dayMealEmojis[slotKey] = m.emoji || '';
      }
    });

    // Activities for this day
    const dayActivities = (data.activities || []).filter(a => a.dateKey === key);

    return {
      key,
      day: DAYS[d.getDay()],
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
      Alert.alert('Required', 'Store name is required.');
      return;
    }
    if (!trimmedZip) {
      Alert.alert('Required', 'ZIP code is required.');
      return;
    }

    setIsFindingStore(true);
    setFoundStoreCandidate(null);

    try {
      const location = await findStoreLocationByZip(trimmedName, trimmedZip);
      console.log('[stores-sync] finding store', { storeName: trimmedName, zipCode: trimmedZip, found: Boolean(location) });

      if (!location) {
        Alert.alert('Not found', 'No location found for this ZIP code.');
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
      Alert.alert('Lookup failed', 'Could not search store right now. Please try again.');
    } finally {
      setIsFindingStore(false);
    }
  };

  const handleAddStore = async () => {
    const trimmedName = storeNameInput.trim();
    const trimmedZip = zipCodeInput.trim();

    if (!trimmedName) {
      Alert.alert('Required', 'Store name is required.');
      return;
    }
    if (!trimmedZip) {
      Alert.alert('Required', 'ZIP code is required.');
      return;
    }
    if (!foundStoreCandidate) {
      Alert.alert('Find required', 'Tap Find to lookup the store location first.');
      return;
    }

    const exists = userStoresLocal.some((s) => {
      const sameName = String(s?.name || '').trim().toLowerCase() === trimmedName.toLowerCase();
      const sameAddress = String(s?.address || '').trim().toLowerCase() === String(foundStoreCandidate.address || '').trim().toLowerCase();
      return sameName && sameAddress;
    });
    if (exists) {
      Alert.alert('Already added', 'This store is already in your list.');
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
      Alert.alert('Sync error', 'Could not add this store right now. Please try again.');
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

  const closeAlexaModal = () => {
    setIsAlexaModalOpen(false);
  };

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
      Alert.alert('Required', 'Dish or meal is required.');
      return;
    }

    setIsWineSearching(true);
    setWineSummary('');
    setWinePairings([]);

    try {
      const result = await fetchWinePairings({
        userId: user?.id || '7c36273e-07b1-410c-ad1b-4c2b0295e140',
        dish,
      });
      console.log('[wine-pairing] request payload', result.payload);
      console.log('[wine-pairing] response', result.responseJson);

      setWineSummary(result.summary);
      setWinePairings(result.pairings);

      if (!result.summary && !result.pairings.length) {
        Alert.alert('No results', 'No pairing suggestions were returned. Try another dish.');
      }
    } catch (e) {
      console.log('[wine-pairing] search failed', e?.message || e);
      Alert.alert('Search failed', 'Could not find wine pairings right now. Please try again.');
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
    parts.push(item?.name || 'Pairing');
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
      Alert.alert('Already added', 'This pairing is already in your shopping list.');
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
      Alert.alert('Added', `${itemName} was added to your shopping list.`);
    } catch (e) {
      console.log('[wine-pairing] failed to add shopping item', e?.message || e);
      Alert.alert('Could not add item', 'Please try again.');
    } finally {
      setIsAddingWineToList(false);
    }
  };

  const userName = user?.name?.split(' ')[0] || 'Frank';
  const dietary = data?.userProfile?.dietary || data?.profile?.dietary || user?.dietary || 'Vegan';

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
            <Text style={styles.greeting}>{getGreeting()}, {"\n"}{userName}</Text>
            <Text style={styles.subheading}>Here's your food life at a glance</Text>
          </View>

          <View style={styles.headerActions}>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>✦✦ PRO MAX</Text>
            </View>
            <View style={styles.iconBadge}>
              <Text style={styles.iconBadgeText}>👤</Text>
            </View>
            <View style={styles.langBadge}>
              <Text style={styles.langBadgeText}>🌍 EN</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.forest} />
            <Text style={styles.loadingText}>Syncing your data...</Text>
          </View>
        ) : null}

        {lastTranscript ? (
          <View style={styles.voiceBar}>
            <Text style={styles.voiceTranscript}>You: {lastTranscript}</Text>
            {fernReply ? <Text style={styles.voiceReply}>Fern: {fernReply}</Text> : null}
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
                  ? openAlexaModal
                  : label === 'Wine Pairing'
                    ? openWineModal
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
              <Text style={styles.mainLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.statsRow}>
          {[
            { label: 'Recipes Saved', val: `${recipesCount}`, route: 'Recipes', params: { openTab: 'recipes' } },
            { label: 'Cookbooks', val: `${booksCount}`, route: 'Recipes', params: { openTab: 'cookbooks', openSection: 'cookbooks' } },
            { label: 'Bloggers Following', val: `${followersCount}`, color: 'rgb(216, 109, 51)', route: 'Find', params: { openBloggers: true } },
            { label: 'Meals Planned', val: `${mealsPlannedCount}` },
          ].map(({ label, val, color, route, params }) => (
            <TouchableOpacity
              key={label}
              activeOpacity={route ? 0.85 : 1}
              disabled={!route}
              onPress={route ? () => navigation.navigate(route, { ...params, requestKey: Date.now() }) : undefined}
              style={[styles.statCard, shadow.card]}
            >
              <Text style={[styles.statVal, { color: color }]}>{val}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.mealStatsRow}>
          <View style={[styles.mealCard, shadow.card]}>
            <Text style={styles.mealCardTitle}>MEALS PLANNED</Text>
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
            <Text style={styles.mealCardTitle}>RECIPES SAVED</Text>
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
            <Text style={styles.panelTitle}>MY STORES</Text>
            <TouchableOpacity style={styles.smallActionBtn} activeOpacity={0.85} onPress={openAddStoreModal}>
              <Text style={styles.smallActionBtnText}>+ Add Store</Text>
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
                        {store.name || 'Store'}
                      </Text>
                      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.storeAddress}>
                        {store.address || 'Address unavailable'}
                      </Text>
                    </View>

                    <TouchableOpacity style={styles.scanCircularBtn} activeOpacity={0.85}>
                      <Text style={styles.scanCircularBtnText}>Scan Circular</Text>
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
            <Text style={styles.panelSubtleText}>No stores added yet</Text>
          )}
        </View>

        <View style={[styles.panelCard, shadow.card]}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.panelTitle}>THIS WEEK</Text>
            <TouchableOpacity activeOpacity={0.8}>
              <Text style={styles.panelLink}>Plan →</Text>
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
                    <Text style={styles.weekCircleEmoji}>{d.mealEmojis?.dinner || '🍽️'}</Text>
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
            <Text style={styles.panelTitle}>🛒 SHOPPING LIST</Text>
            <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('Shopping')}>
              <Text style={styles.panelLink}>View →</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.panelSubtleText}>
            {shoppingCount ? `${shoppingCount} item${shoppingCount > 1 ? 's' : ''} waiting` : 'Your list is empty'}
          </Text>
        </View>

        <View style={[styles.fernKnowledgeCard, shadow.card]}>
          <View style={styles.fernKnowledgeHeader}>
            <Text style={styles.fernKnowledgeTitle}>WHAT FERN KNOWS ABOUT YOU</Text>
            <TouchableOpacity style={styles.fernEditBtn} activeOpacity={0.85}>
              <Text style={styles.fernEditText}>✎ Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fernKnowledgeRow}>
            <View style={styles.fernKnowledgeItem}>
              <Text style={styles.fernKnowledgeLabel}>🥗 DIETARY</Text>
              <Text style={styles.fernKnowledgeValue}>{dietary}</Text>
            </View>

            <View style={styles.fernKnowledgeItem}>
              <Text style={styles.fernKnowledgeLabel}>🙂 NAME</Text>
              <Text style={styles.fernKnowledgeValue}>{userName}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.toolsHeading}>YOUR TOOLS</Text>

        <View style={styles.mainCardRow}>
          {[
            { label: 'Fridge Challenge', val: '🧊', color: 'rgb(30, 57, 30)' },
            { label: 'Leftover Magic', val: '🧙‍♂️', color: 'rgb(56, 89, 45)' },
            { label: '20-Min Dinner', val: '⚡', color: 'rgb(216, 109, 51)' },
            { label: 'Budget Planner', val: '💰', color: 'rgb(30, 57, 30)' },
            { label: 'AI Meal Planner', val: '🗓', color: 'rgb(56, 89, 45)' },
            { label: 'Semi-Homemade', val: '🥫', color: 'rgb(30, 57, 30)' },
            { label: 'Family Vault', val: '📖', color: 'rgb(216, 109, 51)' },
          ].map(({ label, val, color }) => (
            <View
              key={label}
              style={[
                styles.mainCard,
                shadow.card,
                { backgroundColor: color }
              ]}
            >
              <Text style={styles.mainVal}>{val}</Text>
              <Text style={styles.mainLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.bottomSpacer} />

      </ScrollView >

      <Modal
        transparent
        animationType="slide"
        visible={isAddStoreModalOpen}
        onRequestClose={closeAddStoreModal}
      >
        <View style={styles.addStoreBackdrop}>
          <View style={styles.addStoreSheet}>
            <View style={styles.addStoreHeaderRow}>
              <Text style={styles.addStoreTitle}>Add a Store</Text>
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

            <Text style={styles.addStoreFieldLabel}>OR ENTER STORE NAME</Text>
            <TextInput
              value={storeNameInput}
              onChangeText={setStoreNameInput}
              placeholder="Store name"
              placeholderTextColor="#A3A3A3"
              style={styles.addStoreInput}
            />

            <Text style={styles.addStoreFieldLabel}>YOUR ZIP CODE</Text>
            <View style={styles.addStoreZipRow}>
              <TextInput
                value={zipCodeInput}
                onChangeText={setZipCodeInput}
                placeholder="ZIP code"
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
                <Text style={styles.addStoreFindBtnText}>{isFindingStore ? 'Finding...' : 'Find →'}</Text>
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
              <Text style={styles.addStoreSaveBtnText}>{isSavingStore ? 'Saving...' : 'Add This Store'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="slide"
        visible={isAlexaModalOpen}
        onRequestClose={closeAlexaModal}
      >
        <View style={styles.alexaBackdrop}>
          <View style={styles.alexaSheet}>
            <TouchableOpacity style={styles.alexaCloseBtn} activeOpacity={0.85} onPress={closeAlexaModal}>
              <Text style={styles.alexaCloseText}>×</Text>
            </TouchableOpacity>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.alexaContentScroll}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.alexaHeaderRow}>
                <View style={styles.alexaIconWrap}>
                  <Text style={styles.alexaIcon}>🔊</Text>
                </View>
                <View style={styles.alexaHeaderTextWrap}>
                  <Text style={styles.alexaTitle}>Alexa Skill</Text>
                  <Text style={styles.alexaSubtitle}>Pro Max · Hands-free cooking</Text>
                </View>
              </View>

              <View style={styles.alexaHeroCard}>
                <Text style={styles.alexaHeroLeaf}>🌿</Text>
                <Text style={styles.alexaHeroTitle}>fern for Alexa</Text>
                <Text style={styles.alexaHeroSubtitle}>Hands-free cooking, your weekly plan, and real-time shopping guidance on Echo Show.</Text>
              </View>

              <Text style={styles.alexaHowTitle}>HOW TO CONNECT</Text>

              {[
                { step: '1', emoji: '📱', title: 'Open the Alexa app', sub: 'On your iPhone or Android' },
                { step: '2', emoji: '🔎', title: 'Search for Fern', sub: 'Skills & Games → Search' },
                { step: '3', emoji: '🔗', title: 'Enable skill & link account', sub: 'Sign in with your Fern credentials' },
                { step: '4', emoji: '🔊', title: 'Say "Alexa, open Fern"', sub: 'On any Echo or Echo Show device' },
              ].map((item, idx) => (
                <View key={`alexa-step-${item.step}`}>
                  <View style={styles.alexaStepRow}>
                    <View style={styles.alexaStepBadge}>
                      <Text style={styles.alexaStepBadgeText}>{item.step}</Text>
                    </View>
                    <Text style={styles.alexaStepEmoji}>{item.emoji}</Text>
                    <View style={styles.alexaStepTextWrap}>
                      <Text style={styles.alexaStepTitle}>{item.title}</Text>
                      <Text style={styles.alexaStepSub}>{item.sub}</Text>
                    </View>
                  </View>
                  {idx < 3 ? <View style={styles.alexaStepDivider} /> : null}
                </View>
              ))}

              <View style={styles.alexaSkillIdCard}>
                <Text style={styles.alexaSkillIdLabel}>SKILL ID</Text>
                <Text style={styles.alexaSkillIdText}>amzn1.ask.skill.76006692-3bd6-42c3-9d38-348501ea9099</Text>
              </View>

              <TouchableOpacity style={styles.alexaConnectBtn} activeOpacity={0.85} onPress={closeAlexaModal}>
                <Text style={styles.alexaConnectBtnText}>Got it — Connected now</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="slide"
        visible={isWineModalOpen}
        onRequestClose={closeWineModal}
      >
        <View style={styles.wineBackdrop}>
          <View style={styles.wineSheet}>
            <TouchableOpacity style={styles.wineCloseBtn} activeOpacity={0.85} onPress={closeWineModal}>
              <Text style={styles.wineCloseText}>×</Text>
            </TouchableOpacity>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.wineContentScroll}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.wineHero}>🍷</Text>
              <Text style={styles.wineTitle}>Wine Pairing</Text>
              <Text style={styles.wineSubtitle}>Tell us what you're eating or the dish you're making.</Text>

              <Text style={styles.wineFieldLabel}>DISH OR MEAL</Text>
              <TextInput
                value={wineDishInput}
                onChangeText={setWineDishInput}
                placeholder="e.g. grilled salmon, mushroom risotto, spicy Thai curry"
                placeholderTextColor="#B0AEA9"
                style={styles.wineInput}
              />

              <TouchableOpacity
                style={[styles.wineFindBtn, isWineSearching ? styles.wineFindBtnDisabled : null]}
                activeOpacity={0.85}
                onPress={handleFindWinePairings}
                disabled={isWineSearching}
              >
                <Text style={styles.wineFindBtnText}>{isWineSearching ? 'Searching...' : '🍷 FIND MY PAIRINGS'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.wineAskFernBtn} activeOpacity={0.85}>
                <Text style={styles.wineAskFernText}>🌿 Ask Fern to Walk Me Through It</Text>
              </TouchableOpacity>

              {(wineSummary || winePairings.length) ? (
                <View style={styles.wineResultsContent}>
                  {wineSummary ? <Text style={styles.wineSummaryText}>"{wineSummary}"</Text> : null}
                  {winePairings.map((item, index) => (
                    <TouchableOpacity
                      key={`wine-pairing-${index}`}
                      activeOpacity={0.86}
                      style={styles.wineCard}
                      onPress={() => setSelectedWinePairing(item)}
                    >
                      <View style={styles.wineCardTopRow}>
                        <Text style={styles.wineCardTitle} numberOfLines={2}>
                          {getPairingTitle(item, index)}
                        </Text>
                        <Text style={styles.wineCardChevron}>›</Text>
                      </View>
                      <Text style={styles.wineCardMeta}>{item.type.toUpperCase()}{item.price ? ` · ${item.price}` : ''}</Text>
                      {item.description ? <Text style={styles.wineCardDescription}>{item.description}</Text> : null}
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </ScrollView>

            {selectedWinePairing ? (
              <View style={styles.wineDetailOverlay}>
                <TouchableOpacity style={styles.wineDetailScrim} activeOpacity={1} onPress={closeWineDetailModal} />
                <View style={styles.wineDetailSheet}>
                  <View style={styles.wineDetailHeader}>
                    <View style={styles.wineDetailHeaderTextWrap}>
                      <Text style={styles.wineDetailTitle}>
                        {`${getPairingIcon(selectedWinePairing)} ${selectedWinePairing.name}${selectedWinePairing.region ? ` • ${selectedWinePairing.region}` : ''}`}
                      </Text>
                      <Text style={styles.wineDetailMeta}>
                        {selectedWinePairing.type?.toUpperCase() || 'PAIRING'}{selectedWinePairing.price ? ` · ${selectedWinePairing.price}` : ''}
                      </Text>
                    </View>

                    <TouchableOpacity style={styles.wineDetailCloseBtn} activeOpacity={0.85} onPress={closeWineDetailModal}>
                      <Text style={styles.wineDetailCloseText}>×</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.wineDetailBody}>
                    <Text style={styles.wineDetailSectionLabel}>WHY IT WORKS</Text>
                    <Text style={styles.wineDetailDescription}>
                      {selectedWinePairing.description || 'No additional tasting notes were provided for this pairing.'}
                    </Text>
                  </View>

                  <View style={styles.wineDetailActions}>
                    <TouchableOpacity
                      style={[styles.wineDetailAddBtn, isAddingWineToList ? styles.wineDetailBtnDisabled : null]}
                      activeOpacity={0.85}
                      onPress={handleAddWineToShoppingList}
                      disabled={isAddingWineToList}
                    >
                      <Text style={styles.wineDetailAddBtnText}>{isAddingWineToList ? 'Adding...' : '🛒 Add to list'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.wineDetailDoneBtn} activeOpacity={0.85} onPress={closeWineDetailModal}>
                      <Text style={styles.wineDetailDoneBtnText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
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

  alexaBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'flex-end',
  },
  alexaSheet: {
    backgroundColor: '#F5F2ED',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: '#D9CFBF',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    height: '80%',
  },
  alexaCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#D4C3AD',
    backgroundColor: '#EFE9DF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  alexaCloseText: {
    fontSize: 26,
    lineHeight: 28,
    color: '#8C6B46',
    marginTop: -1,
  },
  alexaContentScroll: {
    paddingTop: 10,
    paddingBottom: 30,
  },
  alexaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingRight: 54,
  },
  alexaIconWrap: {
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: '#174B22',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alexaIcon: {
    fontSize: 20,
  },
  alexaHeaderTextWrap: {
    flex: 1,
  },
  alexaTitle: {
    color: '#20140B',
    fontFamily: 'Jost-Bold',
    fontSize: 18,
    lineHeight: 24,
  },
  alexaSubtitle: {
    color: '#8D6D48',
    fontFamily: 'Jost-Medium',
    fontSize: 12,
  },
  alexaHeroCard: {
    marginTop: 8,
    borderRadius: 22,
    backgroundColor: colors.forest,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  alexaHeroLeaf: {
    fontSize: 38,
    lineHeight: 48,
  },
  alexaHeroTitle: {
    marginTop: 10,
    color: '#F0EBDD',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 22,
    lineHeight: 30,
    textAlign: 'center',
  },
  alexaHeroSubtitle: {
    marginTop: 10,
    color: '#C6D5C3',
    fontFamily: 'Jost-Regular',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  alexaHowTitle: {
    marginTop: 22,
    marginBottom: 8,
    color: '#8D734E',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
    letterSpacing: 1.2,
  },
  alexaStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  alexaStepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#174B22',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alexaStepBadgeText: {
    color: '#EAF3E7',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
  },
  alexaStepEmoji: {
    fontSize: 26,
    marginRight: 8,
  },
  alexaStepTextWrap: {
    flex: 1,
  },
  alexaStepTitle: {
    color: '#20140B',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
    lineHeight: 22,
  },
  alexaStepSub: {
    marginTop: 4,
    color: '#8D734E',
    fontFamily: 'Jost-Medium',
    fontSize: 12
  },
  alexaStepDivider: {
    height: 1,
    backgroundColor: '#D6C7B1',
  },
  alexaSkillIdCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#D4C3AD',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#F1ECE3',
  },
  alexaSkillIdLabel: {
    color: '#a49379',
    fontFamily: 'Jost-Bold',
    fontSize: 10
  },
  alexaSkillIdText: {
    marginTop: 8,
    color: '#907353',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
    lineHeight: 20,
  },
  alexaConnectBtn: {
    marginTop: 16,
    backgroundColor: '#EC6518',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  alexaConnectBtnText: {
    color: '#FFF5EC',
    fontFamily: 'Jost-Bold',
    fontSize: 16,
  },

  wineBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'flex-end',
  },
  wineSheet: {
    backgroundColor: '#F5F2ED',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: '#D9CFBF',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    height: '78%',
  },
  wineCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#D8D8D8',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  wineCloseText: {
    fontSize: 26,
    lineHeight: 28,
    color: '#F4F4F4',
    marginTop: -1,
  },
  wineHero: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 50,
    lineHeight: 64,
  },
  wineTitle: {
    marginTop: 4,
    textAlign: 'center',
    color: '#2A1A11',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 24,
    lineHeight: 40,
  },
  wineSubtitle: {
    marginTop: 6,
    textAlign: 'center',
    color: '#7B5E3E',
    fontFamily: 'Jost-Regular',
    fontSize: 12,
  },
  wineFieldLabel: {
    marginTop: 18,
    marginBottom: 8,
    color: '#7B5C3A',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
    letterSpacing: 1.2,
  },
  wineInput: {
    borderWidth: 2,
    borderColor: '#CEBFA6',
    borderRadius: 14,
    backgroundColor: '#F6F3ED',
    color: '#2A1A11',
    fontFamily: 'Jost-Regular',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  wineFindBtn: {
    marginTop: 14,
    backgroundColor: '#184D22',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  wineFindBtnDisabled: {
    opacity: 0.65,
  },
  wineFindBtnText: {
    color: '#EAF3E7',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  wineAskFernBtn: {
    marginTop: 10,
    backgroundColor: '#EC6518',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  wineAskFernText: {
    color: '#FFF5EC',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
  },
  wineContentScroll: {
    paddingTop: 6,
    paddingBottom: 30,
  },
  wineResultsContent: {
    marginTop: 12,
    paddingBottom: 8,
  },
  wineSummaryText: {
    color: '#2E2117',
    fontFamily: 'Jost-Italic',
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  wineCard: {
    borderWidth: 2,
    borderColor: '#D0C0A7',
    borderRadius: 18,
    backgroundColor: '#F8F6F2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  wineCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wineCardTitle: {
    flex: 1,
    color: '#2A1A11',
    fontFamily: 'Jost-Bold',
    fontSize: 15,
    lineHeight: 22,
  },
  wineCardMeta: {
    marginTop: 2,
    color: '#7B1E3A',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
    letterSpacing: 0.7,
  },
  wineCardChevron: {
    marginLeft: 12,
    color: '#B4AA9C',
    fontSize: 20,
    lineHeight: 20,
    fontFamily: 'Jost-Bold',
  },
  wineCardDescription: {
    marginTop: 4,
    color: '#7B5E3E',
    fontFamily: 'Jost-Regular',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  wineDetailOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  wineDetailScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(33,25,18,0.48)',
  },
  wineDetailSheet: {
    backgroundColor: '#F8F5F0',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  wineDetailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#D8CAB5',
  },
  wineDetailHeaderTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  wineDetailTitle: {
    color: '#7B1E3A',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 18,
    lineHeight: 30,
  },
  wineDetailMeta: {
    marginTop: 2,
    color: '#7B5E3E',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
    letterSpacing: 0.7,
  },
  wineDetailCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wineDetailCloseText: {
    color: '#B8B0A6',
    fontSize: 28,
    lineHeight: 28,
  },
  wineDetailBody: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#D8CAB5',
  },
  wineDetailSectionLabel: {
    color: '#7B5C3A',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  wineDetailDescription: {
    color: '#2E2117',
    fontFamily: 'Jost-Italic',
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 28,
  },
  wineDetailActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 18,
  },
  wineDetailAddBtn: {
    flex: 1,
    backgroundColor: '#194D22',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  wineDetailBtnDisabled: {
    opacity: 0.7,
  },
  wineDetailAddBtnText: {
    color: '#F6F3EE',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
  },
  wineDetailDoneBtn: {
    flex: 1,
    backgroundColor: '#F3EBDD',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8CAB5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  wineDetailDoneBtnText: {
    color: '#2E2117',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
  },

});
