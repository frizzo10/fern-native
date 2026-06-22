import React, { useState, useEffect, useRef } from 'react';
import {
  Image, View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated, ActivityIndicator,

} from 'react-native';
import {
  SafeAreaView,
  SafeAreaProvider,
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { colors, radius, shadow } from '../constants/tokens';
import { useContinuousMic } from '../hooks/useContinuousMic';
import { useSync } from '../hooks/useSync';
import { useFonts } from 'expo-font';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MEALS = ['Breakfast','Lunch','Dinner'];

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
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
    <View style={styles.container}>
    <View style= {styles.headerSize}>

    <View style={styles.mainHeaderView}>

    <Image
      source={require('../../assets/icon.png')}
      style={styles.headerImage}
    />
      <View>

        <Text style={styles.headerTextView}>
        fern
        </Text>

        <Text style={styles.headerTitle}>
          WEEKLY AD TO DINNER TABLE • PATENT{"\n"}PENDING
        </Text>

      </View>

    </View>
  ),

</View>
      <ScrollView
        vertical
        showsHorizontalScrollIndicator = {false}
        style={styles.weekScrollOuter} >

      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}, {"\n"} {userName} </Text>
          <Text style={styles.subheading}>"Here's your food life at a glance"</Text>
        </View>
        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>✦✦ PRO MAX</Text>
        </View>
          <View style={styles.langBadge}>
          <Text style={styles.langBadgeText}>🌍 EN</Text>
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

<View style={styles.mainCardRow}>
  {[
    { label: 'Alexa Skill', val: '🔊', color: 'rgb(30, 57, 30)' },
    { label: 'Charcuterie', val: '🧀', color: 'rgb(56, 89, 45)' },
    { label: 'Dinner Party', val: `🎉`, color: 'rgb(216, 109, 51)' },
    { label: 'Wine Pairing', val: '🍷', color: 'rgb(30, 57, 30)' },
    { label: 'Personal Shopper', val: '🛒', color: 'rgb(56, 89, 45)' },
    { label: 'Nutrition', val: '🥗', color: 'rgb(216, 109, 51)' },
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



      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Recipes Saved',    val: `2` },
          { label: 'Cookbooks', val: '1' },
          { label: 'Bloggers Following',   val: `2` },
          { label: 'Meals Planned',    val: '0' },
        ].map(({ label, val }) => (
          <View key={label} style={[styles.statCard, shadow.card]}>

            <Text style={styles.statVal}>{val}</Text>

            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Voice orb */}
      <VoiceOrb
        isListening={isListening}
        isProcessing={isProcessing}
        onPress={isListening ? stop : start}
      />
    </ScrollView>
  </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.parch },
  header:          { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', paddingHorizontal:20, paddingTop:16, paddingBottom:12 },
  greeting:        { fontSize:16, fontWeight:'700', color:colors.ink },
  subheading:      { fontSize:13, color:colors.brown, marginTop:2 },

  proBadge: {
  borderWidth: 1,
  borderColor: colors.orange,
  borderRadius: radius.full,
  paddingHorizontal: 10,
  paddingVertical: 5,
  marginLeft: 5,
},
  langBadge: {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.full,
  paddingHorizontal: 10,
  paddingVertical: 10,
  marginLeft: 5,
},
  askFernBadge: {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.full,
  paddingHorizontal: 10,
  paddingVertical: 10,
  marginLeft: 5,
},
  askFernBadgeText:    { color:colors.orange, fontSize:8, fontWeight:'800', letterSpacing:0.5 },
  langBadgeText:    { color:colors.black, fontSize:10, fontWeight:'500', letterSpacing:0.5 },
  proBadgeText:    { color:colors.orange, fontSize:9, fontWeight:'700', letterSpacing:0.5 },

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

mainCardRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  paddingHorizontal: 10,
  paddingVertical: 10,
  marginTop: 10,
},

mainCard: {
  width: '33%',
  backgroundColor: colors.paper,
  borderRadius: radius.md,
  padding: 15,
  borderWidth: 1,
  borderColor: colors.border,
  padding: 15,
  marginBottom: 10,
  alignItems: 'center',
  justifyContent: 'center',
},

statsRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
  paddingHorizontal: 10,
  paddingVertical: 10,
  marginTop: -10,
},

statCard: {
  width: '48%',
  backgroundColor: colors.paper,
  borderRadius: radius.md,
  padding: 10,
  borderWidth: 1,
  borderColor: colors.border,
},

mealStatsRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
  paddingHorizontal: 10,
  paddingVertical: 10,
  marginTop: -10,
},

mealCard: {
  width: '48%',
  backgroundColor: colors.paper,
  borderRadius: radius.md,
  padding: 10,
  borderWidth: 1,
  borderColor: colors.border,
},

  mainLabel:       { textAlign: 'center', fontSize:12, fontFamily:"Jost-Medium", color:"#fff" },
  mainVal:         { textAlign: 'center', fontSize:28, fontFamily:"Playfair-Medium", color:colors.ink},

  statLabel:       { fontSize:12, fontFamily:"Jost-Regular",letterSpacing: 0, color:colors.brown, marginTop:5 },
  statVal:         { fontSize:28, fontFamily:"Playfair-Medium", color:colors.ink, marginTop:15},

  booksRow:        { flexDirection:'row', gap:16, paddingHorizontal:20, marginTop:8 },
  booksLabel:      { fontSize:12, color:colors.brown, fontWeight:'700' },

  orbWrap:         { alignItems:'center', paddingVertical:16 },
  orb:             { width:64, height:64, borderRadius:32, backgroundColor:colors.forest, alignItems:'center', justifyContent:'center', marginBottom:6 },
  orbActive:       { backgroundColor:colors.voiceRed },
  orbProcessing:   { backgroundColor:colors.orange },
  orbIcon:         { fontSize:28 },

  
  orbLabel:        { fontSize:11, fontWeight:'700', color:colors.brown, letterSpacing:0.5, textTransform:'uppercase' },
    headerSize:  { 
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#1C3A1A",
    },

  headerImage: {
    width: 42,
    height: 42,
    resizeMode: 'contain',
    marginRight: 20,
    marginTop: 30
    },

  headerTitle:{
    fontSize: 8,
    fontFamily:'Jost_700Bold',
    color: '#A8D5A2',
    letterSpacing: 2,
    textTransform: 'uppercase',
    },

  mainHeaderView: {
    flexDirection: 'row',
    height: 50,
    paddingVertical: 0,
    alignItems: 'center',
    },

  headerTextView: {
    color: '#F5EFE6',
    marginTop: 20,
    fontFamily:'Jost_700Bold',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 1,
  }
});
