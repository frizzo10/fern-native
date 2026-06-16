import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Animated, ActivityIndicator,
} from 'react-native';
import { colors, radius, shadow } from '../constants/tokens';
import { useContinuousMic } from '../hooks/useContinuousMic';
import { useSync } from '../hooks/useSync';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MEALS = ['Breakfast','Lunch','Dinner'];

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

function DayCard({ day, date, isToday, meals, activities, weather }) {
  return (
    <View style={[styles.dayCard, isToday && styles.dayCardToday, shadow.card]}>
      <View style={styles.dayHeader}>
        <View style={styles.dayLeft}>
          <Text style={[styles.dayName, isToday && styles.dayNameToday]}>{day}</Text>
          <Text style={[styles.dayDate, isToday && styles.dayDateToday]}> {date}</Text>
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
          <View key={meal} style={[styles.mealSlot, recipe ? styles.mealSlotFilled : styles.mealSlotEmpty]}>
            <Text style={styles.mealLabel}>{meal.toUpperCase()}</Text>
            {recipe
              ? <Text style={styles.mealName} numberOfLines={2}>{recipe}</Text>
              : <Text style={styles.mealEmpty}>+ Add</Text>
            }
          </View>
        );
      })}

      {activities?.map((act, i) => (
        <View key={i} style={styles.activityRow}>
          <View style={[styles.actDot, { backgroundColor: colors.bright }]} />
          <Text style={styles.actText}>{act.emoji} {act.label}{act.startTime ? ` · ${act.startTime}` : ''}</Text>
        </View>
      ))}
    </View>
  );
}

function VoiceOrb({ isListening, isProcessing, onPress }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isListening) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.2, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])).start();
    } else {
      pulse.stopAnimation();
      Animated.timing(pulse, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [isListening]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.orbWrap}>
      <Animated.View style={[
        styles.orb,
        isListening  && styles.orbActive,
        isProcessing && styles.orbProcessing,
        { transform: [{ scale: pulse }] },
        shadow.strong,
      ]}>
        <Text style={styles.orbIcon}>{isProcessing ? '⋯' : '🎙'}</Text>
      </Animated.View>
      <Text style={styles.orbLabel}>
        {isProcessing ? 'Thinking...' : isListening ? 'Listening...' : 'Ask Fern'}
      </Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ user }) {
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
      } catch {}
    },
    onError: (e) => console.warn('Mic error:', e),
  });

  // Build week from today
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
      day: DAYS[d.getDay()],
      date: d.getDate(),
      isToday: key === dateKey(today),
      meals: dayMeals,
      activities: dayActivities,
    };
  });

  // Stats
  const totalDinners   = weekDays.filter(d => d.meals.dinner).length;
  const totalActivities = (data.activities || []).length;
  const shoppingCount  = (data.shopping || []).length;
  const unplanned      = weekDays.filter(d => !d.meals.dinner).length;
  const recipesCount   = (data.recipes || []).length;
  const booksCount     = (data.books || []).length;
  const userName       = user?.name?.split(' ')[0] || 'Frank';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}, {userName}</Text>
          <Text style={styles.subheading}>Here's your week at a glance</Text>
        </View>
        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>✦✦ PRO MAX</Text>
        </View>
      </View>

      {/* Voice bar */}
      {(lastTranscript || fernReply) ? (
        <View style={styles.voiceBar}>
          {lastTranscript ? <Text style={styles.voiceTranscript}>"{lastTranscript}"</Text> : null}
          {fernReply      ? <Text style={styles.voiceReply}>{fernReply}</Text> : null}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.forest} />
          <Text style={styles.loadingText}>Syncing your data...</Text>
        </View>
      ) : null}

      {/* Week scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.weekScroll}
        style={styles.weekScrollOuter}
      >
        {weekDays.map((d, i) => <DayCard key={i} {...d} />)}
      </ScrollView>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Dinners',    val: `${totalDinners}/7` },
          { label: 'Activities', val: String(totalActivities) },
          { label: 'Shopping',   val: `${shoppingCount} items` },
          { label: 'Recipes',    val: String(recipesCount) },
        ].map(({ label, val }) => (
          <View key={label} style={[styles.statCard, shadow.card]}>
            <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
            <Text style={styles.statVal}>{val}</Text>
          </View>
        ))}
      </View>

      {/* Cookbooks strip */}
      {booksCount > 0 && (
        <View style={styles.booksRow}>
          <Text style={styles.booksLabel}>📚 {booksCount} Cookbooks</Text>
          <Text style={styles.booksLabel}>·  {recipesCount} Recipes</Text>
        </View>
      )}

      {/* Voice orb */}
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
  header:          { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', paddingHorizontal:20, paddingTop:16, paddingBottom:12 },
  greeting:        { fontSize:26, fontWeight:'800', color:colors.ink, fontFamily:'serif' },
  subheading:      { fontSize:13, color:colors.brown, marginTop:2 },
  proBadge:        { backgroundColor:colors.forest, borderRadius:radius.full, paddingHorizontal:10, paddingVertical:4 },
  proBadgeText:    { color:colors.onFern, fontSize:10, fontWeight:'800', letterSpacing:0.5 },

  voiceBar:        { backgroundColor:colors.forest, marginHorizontal:16, borderRadius:radius.lg, padding:12, marginBottom:8 },
  voiceTranscript: { color:colors.muted, fontSize:13, fontStyle:'italic', marginBottom:4 },
  voiceReply:      { color:colors.onFern, fontSize:14, fontWeight:'600' },

  loadingRow:      { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:20, marginBottom:8 },
  loadingText:     { fontSize:12, color:colors.brown },

  weekScrollOuter: { flexGrow:0 },
  weekScroll:      { paddingHorizontal:16, paddingVertical:8, gap:10 },

  dayCard:         { width:180, backgroundColor:'#fff', borderRadius:radius.lg, padding:12, borderWidth:1, borderColor:colors.border },
  dayCardToday:    { borderColor:colors.orange, borderWidth:2 },
  dayHeader:       { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 },
  dayLeft:         { flexDirection:'row', alignItems:'baseline' },
  dayName:         { fontSize:15, fontWeight:'800', color:colors.ink },
  dayNameToday:    { color:colors.orange },
  dayDate:         { fontSize:20, fontWeight:'800', color:colors.ink },
  dayDateToday:    { color:colors.orange },
  dayRight:        { alignItems:'flex-end', gap:4 },
  weather:         { fontSize:12, color:colors.brown },
  todayBadge:      { backgroundColor:colors.orange, borderRadius:6, paddingHorizontal:6, paddingVertical:2 },
  todayBadgeText:  { color:'#fff', fontSize:9, fontWeight:'800', letterSpacing:0.5 },

  mealSlot:        { borderRadius:8, padding:8, marginBottom:5 },
  mealSlotFilled:  { backgroundColor:colors.paper, borderWidth:1, borderColor:colors.border },
  mealSlotEmpty:   { borderWidth:1, borderColor:colors.border, borderStyle:'dashed' },
  mealLabel:       { fontSize:9, fontWeight:'800', color:colors.brown, letterSpacing:0.8, marginBottom:2 },
  mealName:        { fontSize:12, fontWeight:'700', color:colors.ink },
  mealEmpty:       { fontSize:12, color:colors.brown, opacity:0.5 },

  activityRow:     { flexDirection:'row', alignItems:'center', gap:5, marginTop:6 },
  actDot:          { width:7, height:7, borderRadius:99 },
  actText:         { fontSize:11, color:colors.brown, fontWeight:'600', flexShrink:1 },

  statsRow:        { flexDirection:'row', gap:8, paddingHorizontal:16, marginTop:8 },
  statCard:        { flex:1, backgroundColor:colors.paper, borderRadius:radius.md, padding:10, borderWidth:1, borderColor:colors.border },
  statLabel:       { fontSize:8, fontWeight:'800', color:colors.brown, letterSpacing:0.8, marginBottom:2 },
  statVal:         { fontSize:16, fontWeight:'800', color:colors.ink },

  booksRow:        { flexDirection:'row', gap:16, paddingHorizontal:20, marginTop:8 },
  booksLabel:      { fontSize:12, color:colors.brown, fontWeight:'700' },

  orbWrap:         { alignItems:'center', paddingVertical:16 },
  orb:             { width:64, height:64, borderRadius:32, backgroundColor:colors.forest, alignItems:'center', justifyContent:'center', marginBottom:6 },
  orbActive:       { backgroundColor:colors.voiceRed },
  orbProcessing:   { backgroundColor:colors.orange },
  orbIcon:         { fontSize:28 },
  orbLabel:        { fontSize:11, fontWeight:'700', color:colors.brown, letterSpacing:0.5, textTransform:'uppercase' },
});
