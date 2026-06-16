import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Animated, Pressable,
} from 'react-native';
import { colors, radius, shadow } from '../constants/tokens';
import { useContinuousMic } from '../hooks/useContinuousMic';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MEALS = ['Breakfast','Lunch','Dinner'];

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function DayCard({ day, date, isToday, meals, activities, weather }) {
  return (
    <View style={[styles.dayCard, isToday && styles.dayCardToday, shadow.card]}>
      <View style={styles.dayHeader}>
        <View style={styles.dayLeft}>
          <Text style={[styles.dayName, isToday && styles.dayNameToday]}>{day}</Text>
          <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>{date}</Text>
        </View>
        <View style={styles.dayRight}>
          {weather ? <Text style={styles.weather}>{weather}</Text> : null}
          {isToday && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>TODAY</Text>
            </View>
          )}
        </View>
      </View>

      {MEALS.map(meal => {
        const recipe = meals?.[meal.toLowerCase()];
        return (
          <TouchableOpacity
            key={meal}
            style={[styles.mealSlot, recipe ? styles.mealSlotFilled : styles.mealSlotEmpty]}
            activeOpacity={0.7}
          >
            {recipe ? (
              <>
                <Text style={styles.mealLabel}>{meal.toUpperCase()}</Text>
                <Text style={styles.mealName} numberOfLines={2}>{recipe}</Text>
              </>
            ) : (
              <>
                <Text style={styles.mealLabel}>{meal.toUpperCase()}</Text>
                <Text style={styles.mealEmpty}>+ Add</Text>
              </>
            )}
          </TouchableOpacity>
        );
      })}

      {activities?.map((act, i) => (
        <View key={i} style={styles.activityRow}>
          <View style={[styles.actDot, { backgroundColor: colors.bright }]} />
          <Text style={styles.actText}>{act}</Text>
        </View>
      ))}
    </View>
  );
}

function VoiceOrb({ isListening, isProcessing, onPress }) {
  const pulse = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [isListening]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.orbWrap}>
      <Animated.View style={[
        styles.orb,
        isListening && styles.orbActive,
        isProcessing && styles.orbProcessing,
        { transform: [{ scale: pulse }] }
      ]}>
        <Text style={styles.orbIcon}>{isProcessing ? '⋯' : isListening ? '🎙' : '🎙'}</Text>
      </Animated.View>
      <Text style={styles.orbLabel}>
        {isProcessing ? 'Thinking...' : isListening ? 'Listening...' : 'Ask Fern'}
      </Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const [transcript, setTranscript] = useState('');
  const [fernReply, setFernReply] = useState('');
  const [weekPlan, setWeekPlan] = useState({});

  const { isListening, isProcessing, start, stop } = useContinuousMic({
    onTranscript: async (text) => {
      setTranscript(text);
      // Send to Fern AI
      try {
        const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, context: 'family_hub' }),
        });
        const data = await res.json();
        setFernReply(data.reply || '');
      } catch (e) {}
    },
    onError: (e) => console.warn('Mic error:', e),
  });

  // Mock week data — replace with Supabase fetch
  const today = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + i);
    return {
      day: DAYS[d.getDay()],
      date: d.getDate(),
      isToday: d.toDateString() === today.toDateString(),
      meals: i === today.getDay() ? {
        breakfast: 'Greek Yogurt Bowl',
        dinner: 'Grilled Steak Fajitas',
      } : {},
      activities: i === today.getDay() ? ['Soccer · 4pm'] : [],
      weather: ['☁️ 66°','🌧 58°','☀️ 71°','⛅ 64°','☀️ 75°','☀️ 77°','☀️ 74°'][i],
    };
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}, Frank</Text>
          <Text style={styles.subheading}>Here's your week at a glance</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.proBadge}>
            <Text style={styles.proBadgeText}>✦✦ PRO MAX</Text>
          </View>
        </View>
      </View>

      {/* Voice bar */}
      {(transcript || fernReply) ? (
        <View style={styles.voiceBar}>
          {transcript ? <Text style={styles.voiceTranscript}>"{transcript}"</Text> : null}
          {fernReply ? <Text style={styles.voiceReply}>{fernReply}</Text> : null}
        </View>
      ) : null}

      {/* Week scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.weekScroll}
        style={styles.weekScrollOuter}
      >
        {weekDays.map((d, i) => (
          <DayCard key={i} {...d} />
        ))}
      </ScrollView>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {[
          { label: 'Dinners', val: '6/5' },
          { label: 'Activities', val: '4' },
          { label: 'Shopping', val: '41 items' },
          { label: 'Unplanned', val: '1 dinner' },
        ].map(({ label, val }) => (
          <View key={label} style={[styles.statCard, shadow.card]}>
            <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
            <Text style={styles.statVal}>{val}</Text>
          </View>
        ))}
      </View>

      {/* Voice orb — always visible */}
      <VoiceOrb
        isListening={isListening}
        isProcessing={isProcessing}
        onPress={isListening ? stop : start}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.parch },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  greeting:        { fontSize: 26, fontWeight: '800', color: colors.ink, fontFamily: 'serif' },
  subheading:      { fontSize: 13, color: colors.brown, marginTop: 2 },
  headerRight:     { alignItems: 'flex-end', gap: 6 },
  proBadge:        { backgroundColor: colors.forest, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  proBadgeText:    { color: colors.onFern, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  voiceBar:        { backgroundColor: colors.forest, marginHorizontal: 16, borderRadius: radius.lg, padding: 12, marginBottom: 8 },
  voiceTranscript: { color: colors.muted, fontSize: 13, fontStyle: 'italic', marginBottom: 4 },
  voiceReply:      { color: colors.onFern, fontSize: 14, fontWeight: '600' },

  weekScrollOuter: { flexGrow: 0 },
  weekScroll:      { paddingHorizontal: 16, paddingVertical: 8, gap: 10 },

  dayCard:         { width: 180, backgroundColor: '#fff', borderRadius: radius.lg, padding: 12, borderWidth: 1, borderColor: colors.border },
  dayCardToday:    { borderColor: colors.orange, borderWidth: 2, backgroundColor: '#fff' },
  dayHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  dayLeft:         { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  dayName:         { fontSize: 15, fontWeight: '800', color: colors.ink },
  dayNameToday:    { color: colors.orange },
  dayNum:          { fontSize: 20, fontWeight: '800', color: colors.ink },
  dayNumToday:     { color: colors.orange },
  dayRight:        { alignItems: 'flex-end', gap: 4 },
  weather:         { fontSize: 12, color: colors.brown },
  todayBadge:      { backgroundColor: colors.orange, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  todayBadgeText:  { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  mealSlot:        { borderRadius: 8, padding: 8, marginBottom: 5 },
  mealSlotFilled:  { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  mealSlotEmpty:   { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  mealLabel:       { fontSize: 9, fontWeight: '800', color: colors.brown, letterSpacing: 0.8, marginBottom: 2 },
  mealName:        { fontSize: 12, fontWeight: '700', color: colors.ink },
  mealEmpty:       { fontSize: 12, color: colors.brown, opacity: 0.5 },

  activityRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  actDot:          { width: 7, height: 7, borderRadius: 99 },
  actText:         { fontSize: 11, color: colors.brown, fontWeight: '600' },

  statsRow:        { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 8 },
  statCard:        { flex: 1, backgroundColor: colors.paper, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: colors.border },
  statLabel:       { fontSize: 8, fontWeight: '800', color: colors.brown, letterSpacing: 0.8, marginBottom: 2 },
  statVal:         { fontSize: 16, fontWeight: '800', color: colors.ink },

  orbWrap:         { alignItems: 'center', paddingVertical: 16 },
  orb:             { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', marginBottom: 6, ...shadow.strong },
  orbActive:       { backgroundColor: colors.voiceRed },
  orbProcessing:   { backgroundColor: colors.orange },
  orbIcon:         { fontSize: 28 },
  orbLabel:        { fontSize: 11, fontWeight: '700', color: colors.brown, letterSpacing: 0.5, textTransform: 'uppercase' },
});
