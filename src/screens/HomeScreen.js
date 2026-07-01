import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Animated, ActivityIndicator,
} from 'react-native';
import { colors, radius, shadow } from '../constants/tokens';
import { useContinuousMic } from '../hooks/useContinuousMic';
import { useFernVoice } from '../hooks/useFernVoice';
import { useSync } from '../hooks/useSync';
import { useTranslation } from '../i18n/LocaleContext';

function getGreeting(t) {
  const h = new Date().getHours();
  return h < 12 ? t('goodMorning') : h < 17 ? t('goodAfternoon') : t('goodEvening');
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

function DayCard({ day, date, isToday, meals, activities, weather, t, mealKeys }) {
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
              <Text style={styles.todayBadgeText}>{t('today')}</Text>
            </View>
          )}
        </View>
      </View>

      {mealKeys.map(({ label, key }) => {
        const recipe = meals?.[key];
        return (
          <View key={key} style={[styles.mealSlot, recipe ? styles.mealSlotFilled : styles.mealSlotEmpty]}>
            <Text style={styles.mealLabel}>{label.toUpperCase()}</Text>
            {recipe
              ? <Text style={styles.mealName} numberOfLines={2}>{recipe}</Text>
              : <Text style={styles.mealEmpty}>{t('addMeal')}</Text>
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

function VoiceOrb({ isListening, isProcessing, onPress, t }) {
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
        {isProcessing ? t('thinking') : isListening ? t('listening') : t('askFern')}
      </Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ user }) {
  const { t, locale } = useTranslation();
  const [fernReply, setFernReply] = useState('');
  const [fernError, setFernError] = useState(false);
  const [askingFern, setAskingFern] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const { data, loading } = useSync(user);
  const { speak, voiceEnabled, setVoiceEnabled, speaking } = useFernVoice();

  const { isListening, isProcessing, start, stop } = useContinuousMic({
    onTranscript: async (text) => {
      setLastTranscript(text);
      setFernError(false);
      setAskingFern(true);
      try {
        const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system: 'You are Fern, a warm and decisive AI family assistant helping with meal planning, recipes, and the weekly schedule. Keep replies short — 2-4 sentences.',
            messages: [{ role: 'user', content: text }],
            feature: 'family_hub',
            locale,
          }),
        });
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          throw new Error(`ai request failed: ${res.status} ${errBody.slice(0, 200)}`);
        }
        const d = await res.json();
        const reply = (d.content && d.content[0] && d.content[0].text) || '';
        if (!reply) throw new Error('ai response had no content.text — got: ' + JSON.stringify(d).slice(0, 200));
        setFernReply(reply);
        // Only speaks it aloud if the person has explicitly turned voice on
        // (see useFernVoice.js -- off by default). The reply is always
        // shown as text either way, so nothing is lost when voice is off.
        speak(reply, { locale });
      } catch (e) {
        // Previously an empty catch block swallowed every failure here
        // completely silently -- no log, no UI change, nothing -- which
        // made 'Fern isn't replying' reports undiagnosable. Now it's
        // logged for debugging and surfaced in the UI so it's visibly a
        // failure, not confused with Fern simply having nothing to say.
        console.warn('[HomeScreen] Ask Fern failed:', e.message);
        setFernError(true);
      } finally {
        setAskingFern(false);
      }
    },
    onError: (e) => console.warn('Mic error:', e),
  });

  // Translated display labels, paired with the fixed English internal keys
  // used to match against synced meal-plan data (the backend always stores
  // slot names as English Breakfast/Lunch/Dinner regardless of UI language).
  const days = t('days');
  const mealLabels = t('meals');
  const mealKeys = [
    { key: 'breakfast', label: mealLabels[0] },
    { key: 'lunch',     label: mealLabels[1] },
    { key: 'dinner',    label: mealLabels[2] },
  ];

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
      day: days[d.getDay()],
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
          <Text style={styles.greeting}>{getGreeting(t)}, {userName}</Text>
          <Text style={styles.subheading}>{t('weekAtGlance')}</Text>
        </View>
        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>{t('proMaxBadge')}</Text>
        </View>
      </View>

      {/* Voice bar */}
      {(lastTranscript || fernReply || askingFern || fernError) ? (
        <View style={styles.voiceBar}>
          {lastTranscript ? <Text style={styles.voiceTranscript}>"{lastTranscript}"</Text> : null}
          {askingFern     ? <Text style={styles.voiceReply}>{t('thinking')}</Text> : null}
          {fernError      ? <Text style={styles.voiceError}>{t('askFernError')}</Text> : null}
          {(!askingFern && !fernError && fernReply) ? <Text style={styles.voiceReply}>{fernReply}</Text> : null}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.forest} />
          <Text style={styles.loadingText}>{t('syncingData')}</Text>
        </View>
      ) : null}

      {/* Week scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.weekScroll}
        style={styles.weekScrollOuter}
      >
        {weekDays.map((d, i) => <DayCard key={i} {...d} t={t} mealKeys={mealKeys} />)}
      </ScrollView>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: t('statDinners'),    val: `${totalDinners}/7` },
          { label: t('statActivities'), val: String(totalActivities) },
          { label: t('statShopping'),   val: t('itemsCount', shoppingCount) },
          { label: t('statRecipes'),    val: String(recipesCount) },
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
          <Text style={styles.booksLabel}>{t('cookbooksCount', booksCount)}</Text>
          <Text style={styles.booksLabel}>{t('recipesCount', recipesCount)}</Text>
        </View>
      )}

      {/* Voice orb */}
      <VoiceOrb
        isListening={isListening}
        isProcessing={isProcessing}
        onPress={isListening ? stop : start}
        t={t}
      />

      {/* Fern Voice on/off -- see useFernVoice.js for why this defaults to
          off. Small and out of the way rather than a prominent setting,
          since most people won't need to touch it, but it must be
          reachable, not buried. */}
      <TouchableOpacity
        style={styles.voiceToggle}
        onPress={() => setVoiceEnabled(!voiceEnabled)}
        activeOpacity={0.7}
      >
        <Text style={styles.voiceToggleText}>
          {voiceEnabled ? '🔊' : '🔇'} {t(voiceEnabled ? 'fernVoiceOn' : 'fernVoiceOff')}
        </Text>
      </TouchableOpacity>
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
  voiceError:      { color:colors.voiceRed, fontSize:14, fontWeight:'600' },

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

  voiceToggle: { alignSelf:'center', marginTop:10, marginBottom:6, paddingVertical:6, paddingHorizontal:14 },
  voiceToggleText: { fontSize:11, fontWeight:'700', color:colors.muted, letterSpacing:0.3 },
});
