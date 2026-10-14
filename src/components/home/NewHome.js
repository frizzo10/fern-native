// New Home layout: flyer scan + stores + Ask Fern up top, "Family this week"
// underneath, and every other feature folded into one collapsible list.
//
// Purely presentational: HomeScreen owns all state, handlers and tier checks and
// passes them in, so no feature, gate or label logic lives (or can drift) here.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatDayLabel } from '../../utils/familyDates';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/tokens';
import { fetchRecipeImage } from '../../utils/recipeImage';
import MealPlannerImage from '../MealPlannerImage';

const FOREST = '#1C3A1A';
const ORANGE = '#E8651A';
const CREAM = '#F3EEE4';
const SAGE = '#A8D5A2';
const BORDER = '#E6DCCF';
const BROWN = '#7A5C3A';

function ToolRow({ item, last }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={item.onPress}
      disabled={!item.onPress}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      style={[styles.toolRow, !last && styles.toolRowDivider]}
    >
      <View style={styles.toolIconWrap}>
        <Ionicons name={item.icon} size={20} color="#C4521A" />
      </View>
      <Text style={styles.toolLabel} numberOfLines={1}>{item.label}</Text>
      {item.value != null ? <Text style={styles.toolValue}>{item.value}</Text> : null}
      {item.badge ? (
        <View style={[styles.lockBadge, item.badgeMax ? styles.lockBadgeMax : null]}>
          <Text style={[styles.lockBadgeText, item.badgeMax ? styles.lockBadgeTextMax : null]}>{item.badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color="#9A8870" />
    </TouchableOpacity>
  );
}

export default function NewHome({
  t,
  user,
  localeLabel,
  tierBadgeLabel,
  onOpenPlans,
  onOpenAccount,
  onOpenLanguage,
  onScan,
  stores,
  onStorePress,
  onFixStoreLocation,
  onRemoveStore,
  onAddStore,
  onAskFern,
  weekDays,
  onOpenFamily,
  onPlanTonight,
  onFamilyLayout,
  onOpenMeal,
  mealOpening,
  onAddForDay,
  tools,
  libraryItems,
  notice,
}) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null); // dateKey of the highlighted day (null = today)

  const todayEntry = weekDays[0] || {};
  const selectedDay = weekDays.find((d) => d.key === selectedKey) || todayEntry;
  const tonightTitle = todayEntry.meals?.dinner || '';
  const tonightEmoji = todayEntry.mealEmojis?.dinner || '';
  const tonightActivity = (todayEntry.activities || [])[0] || null;
  const openDinners = weekDays.filter((d) => !d.meals?.dinner).length;

  // Photo for tonight's dinner, looked up by title like every other recipe photo
  // in the app. Emoji stays as the fallback when there is none.
  // The scan button pulses gently: it is where every week starts.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    let cancelled = false;
    setPhotoUrl(null);
    if (!tonightTitle) return undefined;
    fetchRecipeImage(tonightTitle, user?.token).then((url) => {
      if (!cancelled && url) setPhotoUrl(url);
    });
    return () => { cancelled = true; };
  }, [tonightTitle, user?.token]);

  const visibleStores = (stores || []).slice(0, 5);

  return (
    <View>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.brand}>
          <Ionicons name="leaf" size={24} color="#2D5A27" />
          <Text style={styles.brandText}>fern</Text>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.tierPill} activeOpacity={0.85} onPress={onOpenPlans}>
            <Text style={styles.tierPillText}>{tierBadgeLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roundBtn, toolsOpen ? styles.roundBtnOn : null]}
            activeOpacity={0.85}
            onPress={() => setToolsOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={t('home_tools_menu_a11y')}
            accessibilityState={{ expanded: toolsOpen }}
          >
            <Ionicons name={toolsOpen ? 'close' : 'apps-outline'} size={20} color={toolsOpen ? CREAM : FOREST} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.roundBtn} activeOpacity={0.85} onPress={onOpenAccount} accessibilityRole="button" accessibilityLabel={t('home_profile_a11y')}>
            <Ionicons name="person-outline" size={20} color={FOREST} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.roundBtn, styles.langBtn]} activeOpacity={0.85} onPress={onOpenLanguage} accessibilityRole="button">
            <Text style={styles.langText}>{localeLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tools menu (opened from the top bar) */}
      {toolsOpen ? (
        <View style={styles.accordion}>
          {tools.map((item, i) => (
            <ToolRow key={item.key} item={item} last={i === tools.length - 1} />
          ))}
          <Text style={styles.groupLabel}>{t('home_library_group')}</Text>
          {libraryItems.map((item, i) => (
            <ToolRow key={item.key} item={item} last={i === libraryItems.length - 1} />
          ))}
        </View>
      ) : null}

      {notice || null}

      {/* Scan card */}
      <View style={styles.hero}>
        <View style={styles.scanWrap}>
          <Animated.View pointerEvents="none" style={[styles.scanHalo, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }] }]} />
          <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.05, 1] }) }] }}>
            <TouchableOpacity style={styles.scanBtn} activeOpacity={0.88} onPress={onScan} accessibilityRole="button">
              <Ionicons name="camera-outline" size={40} color="#fff" />
              <Text style={styles.scanBtnText}>{t('home_scan_flyer')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <Text style={styles.heroLabel}>{t('home_your_stores')}</Text>
        <View style={styles.storeList}>
          {visibleStores.map((s, i) => (
            <TouchableOpacity key={`${s.name || 'store'}-${i}`} style={styles.storeLine} activeOpacity={0.8} onPress={() => (onStorePress ? onStorePress(s) : onScan())}>
              <Ionicons name="location-outline" size={15} color={SAGE} />
              <Text style={styles.storeLineText} numberOfLines={1}>{s.name || t('store_fallback_label')}</Text>
              {onFixStoreLocation ? (
                <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }} onPress={() => onFixStoreLocation(i)} accessibilityRole="button" accessibilityLabel={t('store_here_btn')}>
                  <Ionicons name="navigate-circle-outline" size={20} color={SAGE} />
                </TouchableOpacity>
              ) : null}
              {onRemoveStore ? (
                <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }} onPress={() => onRemoveStore(i)} accessibilityRole="button" accessibilityLabel={t('store_remove_a11y')}>
                  <Ionicons name="close-circle-outline" size={20} color={SAGE} />
                </TouchableOpacity>
              ) : null}
              <Ionicons name="chevron-forward" size={14} color={SAGE} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.storeLine} activeOpacity={0.8} onPress={onAddStore} accessibilityRole="button">
            <Ionicons name="add" size={16} color={SAGE} />
            <Text style={[styles.storeLineText, { color: SAGE }]} numberOfLines={1}>{t('home_add_store_a11y')}</Text>
          </TouchableOpacity>
        </View>
        {!visibleStores.length ? <Text style={styles.heroHint}>{t('home_no_stores_hint')}</Text> : null}
      </View>

      {/* Family this week */}
      <View onLayout={onFamilyLayout}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>{t('home_family_this_week')}</Text>
        <TouchableOpacity activeOpacity={0.8} onPress={onOpenFamily}>
          <Text style={styles.sectionLink}>{t('home_family_hub_link')}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity activeOpacity={0.9} onPress={tonightTitle ? () => onOpenMeal?.({ title: tonightTitle, slot: 'Dinner', emoji: tonightEmoji }) : onPlanTonight} style={[styles.tonight, mealOpening ? { opacity: 0.6 } : null]}>
        <View style={styles.photoBox}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
          ) : (
            <Text style={styles.photoEmoji}>{tonightEmoji || '🍽️'}</Text>
          )}
        </View>
        <View style={styles.tonightText}>
          <Text style={styles.tonightLabel}>{t('home_tonight')}</Text>
          <Text style={styles.tonightTitle} numberOfLines={2}>
            {tonightTitle || t('home_no_dinner_tonight')}
          </Text>
          {tonightActivity ? (
            <View style={styles.activityChip}>
              <Text style={styles.activityChipText} numberOfLines={1}>
                {`${tonightActivity.emoji ? tonightActivity.emoji + ' ' : ''}${tonightActivity.label || ''}${tonightActivity.time ? ' · ' + tonightActivity.time : ''}`}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>

      <View style={styles.weekRow}>
        {weekDays.map((d) => (
          <TouchableOpacity
            key={`nh-${d.key}`}
            activeOpacity={0.8}
            onPress={() => setSelectedKey(d.key)}
            accessibilityRole="button"
            accessibilityLabel={formatDayLabel(d.key)}
            accessibilityState={{ selected: d.key === selectedDay.key }}
            style={[styles.dayCell, d.isToday ? styles.dayCellToday : null, d.key === selectedDay.key ? styles.dayCellSelected : null]}
          >
            <Text style={[styles.dayName, d.isToday ? styles.dayNameToday : null]}>{d.day}</Text>
            <Text style={[styles.dayNum, d.isToday ? styles.dayNumToday : null]}>{d.date}</Text>
            <Ionicons
              name={d.meals?.dinner ? 'checkmark' : 'add'}
              size={16}
              color={d.meals?.dinner ? (d.isToday ? SAGE : '#2D5A27') : '#C4521A'}
            />
            <View style={[styles.actDot, d.activities && d.activities.length ? styles.actDotOn : null]} />
          </TouchableOpacity>
        ))}
      </View>

      {selectedDay.key !== todayEntry.key ? (
      <View style={styles.dayPanel}>
        <Text style={styles.dayPanelTitle}>{formatDayLabel(selectedDay.key || '')}</Text>
        {!Object.keys(selectedDay.meals || {}).length && !(selectedDay.activities || []).length ? (
          <Text style={styles.sheetEmpty}>{t('home_day_nothing')}</Text>
        ) : null}
        {['breakfast', 'lunch', 'dinner'].filter((slot) => selectedDay.meals?.[slot]).map((slot) => (
          <TouchableOpacity
            key={slot}
            style={[styles.sheetRow, { alignItems: 'center' }, mealOpening ? { opacity: 0.6 } : null]}
            activeOpacity={0.8}
            onPress={() => onOpenMeal?.({ title: selectedDay.meals[slot], slot: slot.charAt(0).toUpperCase() + slot.slice(1), emoji: selectedDay.mealEmojis?.[slot] })}
          >
            <View style={{ width: 44, height: 44 }}>
              <MealPlannerImage title={selectedDay.meals[slot]} variant="thumb" fallback={<Text style={styles.photoEmoji}>{selectedDay.mealEmojis?.[slot] || '🍽️'}</Text>} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetSlot}>{t('meal_planner_slot_' + slot)}</Text>
              <Text style={styles.sheetItem} numberOfLines={2}>{selectedDay.meals[slot]}</Text>
            </View>
          </TouchableOpacity>
        ))}
        {(selectedDay.activities || []).map((a, i) => (
          <View key={`a-${i}`} style={styles.sheetRow}>
            <Text style={styles.sheetSlot}>{a.time || ''}</Text>
            <Text style={styles.sheetItem} numberOfLines={2}>{`${a.emoji ? a.emoji + ' ' : ''}${a.label || ''}`}</Text>
          </View>
        ))}
      </View>
      ) : null}

      <View style={styles.addRow}>
        <TouchableOpacity style={styles.addBtn} activeOpacity={0.85} onPress={() => onAddForDay(selectedDay.key, 'meal')} accessibilityRole="button">
          <Ionicons name="add" size={14} color={FOREST} />
          <Text style={styles.addBtnText}>{t('home_add_meal')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} activeOpacity={0.85} onPress={() => onAddForDay(selectedDay.key, 'activity')} accessibilityRole="button">
          <Ionicons name="add" size={14} color={FOREST} />
          <Text style={styles.addBtnText}>{t('home_add_activity')}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity activeOpacity={0.8} onPress={openDinners ? onScan : onOpenFamily} style={styles.openLine}>
        {openDinners ? <Ionicons name="add" size={16} color="#C4521A" /> : <Ionicons name="checkmark" size={16} color="#2D5A27" />}
        <Text style={styles.openLineText}>
          {openDinners
            ? t(openDinners === 1 ? 'home_open_dinners_one' : 'home_open_dinners_other', { count: openDinners })
            : t('home_week_all_planned')}
        </Text>
      </TouchableOpacity>
      </View>


    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { fontFamily: 'Playfair-Bold', fontSize: 24, color: FOREST },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierPill: { backgroundColor: '#F6E3C4', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  tierPillText: { fontFamily: 'Jost-Bold', fontSize: 11, letterSpacing: 0.8, color: '#8A4A0E' },
  roundBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  langBtn: { width: undefined, paddingHorizontal: 12 },
  langText: { fontFamily: 'Jost-SemiBold', fontSize: 13, color: FOREST },

  hero: { backgroundColor: FOREST, borderRadius: 28, padding: 18, shadowColor: FOREST, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 6 },
  scanWrap: { alignItems: 'center', justifyContent: 'center', height: 190, marginBottom: 6 },
  scanHalo: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: ORANGE },
  scanBtn: { width: 150, height: 150, borderRadius: 75, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 14, borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)' },
  scanBtnText: { fontFamily: 'Jost-Bold', fontSize: 17, lineHeight: 20, color: '#fff', textAlign: 'center' },
  heroLabel: { fontFamily: 'Jost-Bold', fontSize: 11, letterSpacing: 1.4, color: SAGE, marginTop: 18, marginBottom: 10, marginLeft: 2 },
  storeList: { marginTop: 2 },
  storeLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(168,213,162,0.25)' },
  storeLineText: { flex: 1, fontFamily: 'Jost-SemiBold', fontSize: 14, color: CREAM },
  storeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  storeChip: { height: 44, maxWidth: 170, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(168,213,162,0.35)', backgroundColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'center', gap: 7 },
  storeChipText: { fontFamily: 'Jost-SemiBold', fontSize: 14, color: CREAM, flexShrink: 1 },
  addChip: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(168,213,162,0.5)', alignItems: 'center', justifyContent: 'center' },
  heroHint: { fontFamily: 'Jost-Regular', fontSize: 13, color: '#B7C7AE', marginTop: 8, marginLeft: 2 },
  askBar: { marginTop: 16, height: 54, borderRadius: 18, backgroundColor: CREAM, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 6 },
  askPlaceholder: { flex: 1, fontFamily: 'Jost-Regular', fontSize: 15, color: BROWN },
  micBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: FOREST, alignItems: 'center', justifyContent: 'center' },

  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22, marginBottom: 10, paddingHorizontal: 4 },
  sectionLabel: { fontFamily: 'Jost-Bold', fontSize: 12, letterSpacing: 1.2, color: BROWN },
  sectionLink: { fontFamily: 'Jost-SemiBold', fontSize: 13, color: '#2D5A27' },

  tonight: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 20, padding: 10 },
  photoBox: { width: 104, height: 104, borderRadius: 14, backgroundColor: '#EFE4D0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  photoEmoji: { fontSize: 40 },
  tonightText: { flex: 1, justifyContent: 'center', gap: 5 },
  tonightLabel: { fontFamily: 'Jost-Bold', fontSize: 12, letterSpacing: 1, color: '#C4521A' },
  tonightTitle: { fontFamily: 'Playfair-SemiBold', fontSize: 19, lineHeight: 24, color: colors.ink },
  activityChip: { alignSelf: 'flex-start', backgroundColor: '#F5EFE6', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, maxWidth: '100%' },
  activityChipText: { fontFamily: 'Jost-SemiBold', fontSize: 12, color: BROWN },

  weekRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  dayCell: { flex: 1, alignItems: 'center', gap: 3, paddingTop: 8, paddingBottom: 7, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER },
  dayCellToday: { backgroundColor: FOREST, borderColor: FOREST },
  dayCellSelected: { borderColor: '#C4521A', borderWidth: 2 },
  dayPanel: { marginTop: 12, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, paddingVertical: 12 },
  dayPanelTitle: { fontFamily: 'Playfair-Bold', fontSize: 18, color: FOREST, marginBottom: 6 },
  dayName: { fontFamily: 'Jost-SemiBold', fontSize: 11, color: BROWN },
  dayNameToday: { color: SAGE },
  dayNum: { fontFamily: 'Jost-Bold', fontSize: 15, color: colors.ink },
  dayNumToday: { color: CREAM },
  actDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  actDotOn: { backgroundColor: ORANGE },
  openLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 4, minHeight: 32 },
  openLineText: { flex: 1, fontFamily: 'Jost-Regular', fontSize: 13, lineHeight: 18, color: '#5E4A33' },

  roundBtnOn: { backgroundColor: FOREST, borderColor: FOREST },
  accordion: { marginBottom: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 18, paddingHorizontal: 14 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  addBtn: { height: 34, paddingHorizontal: 14, borderRadius: 11, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addBtnText: { fontFamily: 'Jost-SemiBold', fontSize: 12, color: FOREST },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(20,30,15,0.45)', justifyContent: 'flex-end' },
  sheetDismiss: { flex: 1 },
  sheet: { backgroundColor: '#FDFAF6', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34 },
  sheetTitle: { fontFamily: 'Playfair-Bold', fontSize: 22, color: FOREST, marginBottom: 10 },
  sheetEmpty: { fontFamily: 'Jost-Regular', fontSize: 14, color: BROWN, marginBottom: 6 },
  sheetRow: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EFE6DA' },
  sheetSlot: { width: 96, fontFamily: 'Jost-Bold', fontSize: 12, letterSpacing: 0.4, color: '#C4521A' },
  sheetItem: { flex: 1, fontFamily: 'Jost-SemiBold', fontSize: 15, color: colors.ink },
  sheetBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  sheetPrimary: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: FOREST, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  sheetPrimaryText: { fontFamily: 'Jost-Bold', fontSize: 14, color: CREAM, textAlign: 'center' },
  sheetClose: { alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: 8 },
  sheetCloseText: { fontFamily: 'Jost-SemiBold', fontSize: 15, color: BROWN },
  accHead: { flexDirection: 'row', alignItems: 'center', height: 54, gap: 8 },
  accTitle: { flex: 1, fontFamily: 'Jost-Bold', fontSize: 15, color: colors.ink },
  accCount: { fontFamily: 'Jost-Regular', fontSize: 12, color: BROWN },
  groupLabel: { fontFamily: 'Jost-Bold', fontSize: 11, letterSpacing: 1.2, color: BROWN, marginTop: 14, marginBottom: 4, paddingHorizontal: 2 },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 2 },
  toolRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EFE6DA' },
  toolIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F5EFE6', alignItems: 'center', justifyContent: 'center' },
  toolLabel: { flex: 1, fontFamily: 'Jost-SemiBold', fontSize: 15, color: colors.ink },
  toolValue: { fontFamily: 'Jost-Bold', fontSize: 14, color: FOREST },
  lockBadge: { backgroundColor: '#E8F1E3', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  lockBadgeMax: { backgroundColor: '#F6E3C4' },
  lockBadgeText: { fontFamily: 'Jost-Bold', fontSize: 10, letterSpacing: 0.6, color: '#2D5A27' },
  lockBadgeTextMax: { color: '#8A4A0E' },
});
