import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, radius, shadow } from '../constants/tokens';
import { useContinuousMic } from '../hooks/useContinuousMic';
import { useSync } from '../hooks/useSync';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

export default function HomeScreen({ user }) {
  const navigation = useNavigation();
  const [fernReply, setFernReply] = useState('');
  const [lastTranscript, setLastTranscript] = useState('');
  const { data, loading } = useSync(user);

  const { isListening, isProcessing, start, stop } = useContinuousMic({
    onTranscript: async (text) => {
      setLastTranscript(text);
      try {
        const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, context: 'family_hub', userId: user?.id }),
        });
        const d = await res.json();
        setFernReply(d.reply || '');
      } catch { }
    },
    onError: (e) => console.warn('Mic error:', e),
  });

  // Build week from Sunday to Saturday for current week.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + i);
    const key = dateKey(d);
    const dayMeals = {};

    // Extract meals from mealPlan
    const planDay = data.mealPlan?.[key] || [];
    planDay.forEach(m => {
      if (m.slot) dayMeals[m.slot.toLowerCase()] = m.title;
    });

    // Activities for this day
    const dayActivities = (data.activities || []).filter(a => a.dateKey === key);

    return {
      key,
      day: DAYS[d.getDay()],
      date: d.getDate(),
      isToday: key === dateKey(today),
      meals: dayMeals,
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
  const userName = user?.name?.split(' ')[0] || 'Frank';
  const dietary = data?.userProfile?.dietary || data?.profile?.dietary || user?.dietary || 'Vegan';

  const weekFromToday = useMemo(() => {
    const idx = today.getDay();
    return [...weekDays.slice(idx), ...weekDays.slice(0, idx)];
  }, [weekDays, today]);

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

        <View style={styles.statsRow}>
          {[
            { label: 'Recipes Saved', val: `${recipesCount}`, route: 'Recipes' },
            { label: 'Cookbooks', val: `${booksCount}` },
            { label: 'Bloggers Following', val: `${followersCount}`, color: 'rgb(216, 109, 51)' },
            { label: 'Meals Planned', val: `${mealsPlannedCount}` },
          ].map(({ label, val, color, route }) => (
            <TouchableOpacity
              key={label}
              activeOpacity={route ? 0.85 : 1}
              disabled={!route}
              onPress={route ? () => navigation.navigate(route) : undefined}
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
              {weekFromToday.map((d) => (
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
              {weekFromToday.map((d) => (
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
            <TouchableOpacity style={styles.smallActionBtn} activeOpacity={0.85}>
              <Text style={styles.smallActionBtnText}>+ Add Store</Text>
            </TouchableOpacity>
          </View>

          {userStores.length ? (
            <View style={styles.storeList}>
              {userStores.map((store, index) => (
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

                    <TouchableOpacity style={styles.storeDeleteBtn} activeOpacity={0.85}>
                      <Text style={styles.storeDeleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {index < userStores.length - 1 ? <View style={styles.storeDivider} /> : null}
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
            {weekFromToday.map((d) => (
              <View key={`wk-${d.key}`} style={styles.weekCircleCol}>
                <Text style={[styles.weekCircleLabel, d.isToday ? styles.weekCircleLabelToday : null]}>
                  {d.day}
                </Text>
                <View style={[styles.weekCircle, d.isToday ? styles.weekCircleToday : null]}>
                  <View style={[styles.weekCircleInner, d.meals.dinner ? styles.weekCircleInnerFilled : null]} />
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.panelCard, shadow.card]}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.panelTitle}>🛒 SHOPPING LIST</Text>
            <TouchableOpacity activeOpacity={0.8}>
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
    fontSize: 13,
    fontFamily: 'Jost-Bold',
    letterSpacing: 1.2,
  },

  panelLink: {
    color: '#184029',
    fontSize: 16,
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

  weekCircleInner: {
    width: 6,
    height: 6,
    borderRadius: 99,
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
    fontSize: 12,
    fontFamily: 'Jost-Bold',
    color: '#5D4F42',
    marginTop: 4,
  },

  statVal: {
    fontSize: 35,
    fontFamily: 'Playfair-Medium',
    color: 'rgb(56, 89, 45)',
    marginTop: 6,
    lineHeight: 40,
  },

  bottomSpacer: {
    height: 24,
  },

});
