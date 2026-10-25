// New Home layout: flyer scan + stores + Ask Fern up top, "Family this week"
// underneath, and every other feature folded into one collapsible list.
//
// Purely presentational: HomeScreen owns all state, handlers and tier checks and
// passes them in, so no feature, gate or label logic lives (or can drift) here.
import React, { useEffect, useRef, useState } from 'react';
import { Image, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getAutopilotMode, setAutopilotMode } from '../../services/autopilot';
import { formatDayLabel } from '../../utils/familyDates';
import { tourTargetRef } from '../../services/tourTargets';
import { openHelp } from '../../services/helpBus';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/tokens';
import { fetchRecipeImage } from '../../utils/recipeImage';
import { chainKey } from '../../utils/flyerStore';
import { streakWeeks, pagesThisWeek } from '../../utils/scanStats';
import { storeCouponUrl } from '../trip/DigitalCouponHowTo';
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
  greeting,
  shopCount,
  onOpenList,
  onOpenRecipes,
  stores,
  sharedChains,
  scanStats,
  onOpenScanBoard,
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
  onEditActivity,
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
  const [autoMode, setAutoMode] = useState(null); // null/'off' | 'ask' | 'auto'
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pick, setPick] = useState('ask');
  useEffect(() => { getAutopilotMode().then(setAutoMode).catch(() => {}); }, []);
  const autoOn = autoMode === 'ask' || autoMode === 'auto';
  const openPicker = () => { setPick(autoMode === 'auto' ? 'auto' : 'ask'); setPickerOpen(true); };
  const turnOn = async () => { await setAutopilotMode(pick); setAutoMode(pick); setPickerOpen(false); };
  const keepOff = async () => { await setAutopilotMode('off'); setAutoMode('off'); setPickerOpen(false); };

  useEffect(() => {
    let cancelled = false;
    setPhotoUrl(null);
    if (!tonightTitle) return undefined;
    fetchRecipeImage(tonightTitle, user?.token).then((url) => {
      if (!cancelled && url) setPhotoUrl(url);
    });
    return () => { cancelled = true; };
  }, [tonightTitle, user?.token]);

  // One affirmation per local calendar day (same all day, changes at midnight).
  const nowD = new Date();
  const affirmNo = ((nowD.getFullYear() * 372 + nowD.getMonth() * 31 + nowD.getDate()) % 14) + 1;

  const visibleStores = stores || [];
  // Scan game: a one-line status under each saved store (nobody has scanned it yet this week -> "be the first").
  const scanBadge = (s) => {
    const key = chainKey(s?.name);
    if (!key) return '';
    const pages = pagesThisWeek(scanStats, s?.name);
    if (pages > 0) return t('scan_game_row_mine', { n: pages });
    if (sharedChains && sharedChains.has(key)) return t('scan_game_row_shared');
    if (sharedChains) return t('scan_game_row_first');
    return '';
  };
  const streak = scanStats ? streakWeeks(scanStats) : 0; // every saved store (the page scrolls); it used to stop at 5

  return (
    <View>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.tierPill} activeOpacity={0.85} onPress={onOpenPlans}>
            <Text style={styles.tierPillText}>{tierBadgeLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity ref={tourTargetRef('help')} collapsable={false} style={styles.roundBtn} activeOpacity={0.85} onPress={openHelp} accessibilityRole="button" accessibilityLabel={t('faq_a11y')}>
            <Ionicons name="help-circle-outline" size={22} color={FOREST} />
          </TouchableOpacity>
          <TouchableOpacity
            ref={tourTargetRef('tools')}
            collapsable={false}
            style={[styles.roundBtn, toolsOpen ? styles.roundBtnOn : null]}
            activeOpacity={0.85}
            onPress={() => setToolsOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={t('home_tools_menu_a11y')}
            accessibilityState={{ expanded: toolsOpen }}
          >
            <Ionicons name={toolsOpen ? 'close' : 'apps-outline'} size={20} color={toolsOpen ? CREAM : FOREST} />
          </TouchableOpacity>
          <TouchableOpacity ref={tourTargetRef('profile')} collapsable={false} style={styles.roundBtn} activeOpacity={0.85} onPress={onOpenAccount} accessibilityRole="button" accessibilityLabel={t('home_profile_a11y')}>
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

      {/* Greeting */}
      <View style={{ paddingHorizontal: 4, marginBottom: 14 }}>
        <Text style={styles.greetTitle}>{greeting}</Text>
        <Text style={styles.greetSub}>{t('home_affirm_' + affirmNo)}</Text>
      </View>

      {/* Fern card */}
      <View style={styles.hero}>
        <TouchableOpacity style={styles.autoRow} activeOpacity={0.85} onPress={openPicker} accessibilityRole="button" accessibilityState={{ checked: autoOn }}>
          <Text style={styles.autoTitle}>{t('home_automate_short')}</Text>
          <View style={[styles.switchTrack, autoOn ? styles.switchTrackOn : null]}>
            <View style={[styles.switchKnob, autoOn ? { alignSelf: 'flex-end' } : null]} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.listRow} activeOpacity={0.85} onPress={onOpenList} accessibilityRole="button">
          <Ionicons name="cart-outline" size={26} color={FOREST} />
          <View style={{ flex: 1 }}>
            <Text style={styles.listTitle}>{t('home_shopping_list')}</Text>
            <Text style={styles.listSub}>{t(shopCount === 1 ? 'home_list_count_one' : 'home_list_count_other', { count: shopCount || 0 })}</Text>
          </View>
          <Text style={styles.listOpen}>{t('home_open')}</Text>
        </TouchableOpacity>

        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickBtn} activeOpacity={0.85} onPress={onOpenRecipes} accessibilityRole="button">
            <Ionicons name="book-outline" size={22} color={FOREST} />
            <Text style={styles.quickText}>{t('home_my_recipes')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.heroLabel}>{t('home_your_stores')}</Text>
        <Text style={styles.storeHint}>{t('home_stores_tap_hint')}</Text>
        <View ref={tourTargetRef('stores')} collapsable={false} style={styles.storeList}>
          {visibleStores.map((s, i) => (
            <TouchableOpacity key={`${s.name || 'store'}-${i}`} style={styles.storeLine} activeOpacity={0.8} onPress={() => onStorePress && onStorePress(s)}>
              <Ionicons name="location-outline" size={15} color={SAGE} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.storeLineText, { flex: 0 }]} numberOfLines={1}>{s.name || t('store_fallback_label')}</Text>
                {scanBadge(s) ? <Text style={styles.scanBadge} numberOfLines={1}>{scanBadge(s)}</Text> : null}
              </View>
              <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 8, right: 6 }} onPress={() => Linking.openURL(storeCouponUrl(s.name)).catch(() => {})} accessibilityRole="link" accessibilityLabel={t('store_coupons_a11y')}>
                <Ionicons name="ticket-outline" size={20} color={SAGE} />
              </TouchableOpacity>
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
        </View>
        <TouchableOpacity style={styles.addStoreBtn} activeOpacity={0.85} onPress={onAddStore} accessibilityRole="button">
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addStoreText}>{t('home_add_store_a11y')}</Text>
        </TouchableOpacity>
        {scanStats && scanStats.total > 0 ? (
          <Text style={styles.scanStatsLine}>{`📷 ${t('scan_game_stats', { pages: scanStats.total, items: scanStats.items })}${streak > 1 ? `  ·  🔥 ${t('scan_game_streak_short', { n: streak })}` : ''}`}</Text>
        ) : null}
        {onOpenScanBoard && visibleStores.length > 0 ? (
          <TouchableOpacity style={styles.boardBtn} activeOpacity={0.85} onPress={onOpenScanBoard} accessibilityRole="button">
            <Text style={styles.boardBtnText}>{`🏆 ${t('scan_board_btn')}`}</Text>
          </TouchableOpacity>
        ) : null}
        {!visibleStores.length ? <Text style={styles.heroHint}>{t('home_no_stores_hint')}</Text> : null}
      </View>

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.pickPage}>
          <TouchableOpacity onPress={() => setPickerOpen(false)} style={{ height: 44, justifyContent: 'center' }} accessibilityRole="button">
            <Text style={styles.pickBack}>{'‹ ' + t('automate_back')}</Text>
          </TouchableOpacity>
          <Text style={styles.pickTitle}>{t('automate_page_title')}</Text>
          <Text style={styles.pickSub}>{t('automate_page_sub')}</Text>
          {[['ask', 'automate_help'], ['auto', 'automate_all']].map(([k, base]) => (
            <TouchableOpacity key={k} activeOpacity={0.9} onPress={() => setPick(k)} style={[styles.pickCard, pick === k ? styles.pickCardOn : null]} accessibilityRole="button" accessibilityState={{ selected: pick === k }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={styles.pickCardTitle}>{t(base + '_title')}</Text>
                <Ionicons name={pick === k ? 'checkmark-circle' : 'ellipse-outline'} size={28} color={pick === k ? FOREST : '#BDB093'} />
              </View>
              <Text style={styles.pickCardBody}>{t(base + '_desc')}</Text>
              <View style={styles.pickEx}><Text style={styles.pickExText}>{t(base + '_example')}</Text></View>
            </TouchableOpacity>
          ))}
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.pickGo} activeOpacity={0.9} onPress={turnOn} accessibilityRole="button">
            <Text style={styles.pickGoText}>{t(pick === 'auto' ? 'automate_turn_on_all' : 'automate_turn_on_help')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ height: 48, alignItems: 'center', justifyContent: 'center' }} onPress={keepOff} accessibilityRole="button">
            <Text style={styles.pickOff}>{t('automate_keep_off')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

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
            <TouchableOpacity style={styles.activityChip} activeOpacity={0.7} onPress={() => onEditActivity?.(tonightActivity)} accessibilityRole="button" accessibilityLabel={t('activity_edit_a11y')}>
              <Text style={styles.activityChipText} numberOfLines={1}>
                {`${tonightActivity.emoji ? tonightActivity.emoji + ' ' : ''}${tonightActivity.label || ''}${tonightActivity.time ? ' · ' + tonightActivity.time : ''}  ✎`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>

      <View ref={tourTargetRef('week')} collapsable={false} style={styles.weekRow}>
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
          <TouchableOpacity key={`a-${i}`} style={styles.sheetRow} activeOpacity={0.7} onPress={() => onEditActivity?.(a)} accessibilityRole="button" accessibilityLabel={t('activity_edit_a11y')}>
            <Text style={styles.sheetSlot}>{a.time || t('activity_add_time')}</Text>
            <Text style={styles.sheetItem} numberOfLines={2}>{`${a.emoji ? a.emoji + ' ' : ''}${a.label || ''}  ✎`}</Text>
          </TouchableOpacity>
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

      <TouchableOpacity activeOpacity={0.8} onPress={onOpenFamily} style={styles.openLine}>
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 14 },
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
  guideBtn: { marginTop: 16, height: 50, borderRadius: 25, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  guideBtnText: { fontFamily: 'Jost-Bold', fontSize: 16, color: FOREST },
  heroLabel: { fontFamily: 'Jost-Bold', fontSize: 11, letterSpacing: 1.4, color: SAGE, marginTop: 18, marginBottom: 10, marginLeft: 2 },
  storeList: { marginTop: 2 },
  storeLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(168,213,162,0.25)' },
  scanBadge: { fontFamily: 'Jost-Medium', fontSize: 11, color: '#F5C98B', marginTop: 1 },
  boardBtn: { alignSelf: 'flex-start', marginTop: 8, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#F5C98B', alignItems: 'center', justifyContent: 'center' },
  boardBtnText: { fontFamily: 'Jost-SemiBold', fontSize: 14, color: '#F5C98B' },
  scanStatsLine: { fontFamily: 'Jost-SemiBold', fontSize: 13, color: '#F5C98B', marginTop: 10, marginLeft: 2 },
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
  greetTitle: { fontFamily: 'Playfair-Bold', fontSize: 28, color: FOREST },
  greetSub: { fontFamily: 'Jost-Regular', fontSize: 16, color: '#6B5F4E', marginTop: 4 },
  fernDot: { width: 40, height: 40, borderRadius: 20, backgroundColor: SAGE, alignItems: 'center', justifyContent: 'center' },
  fernName: { fontFamily: 'Jost-SemiBold', fontSize: 19, color: '#fff' },
  autoRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 10, marginTop: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999, paddingVertical: 6, paddingLeft: 14, paddingRight: 8 },
  autoTitle: { fontFamily: 'Jost-SemiBold', fontSize: 15, color: '#fff' },
  autoSub: { fontFamily: 'Jost-Regular', fontSize: 14, color: '#C9E3C4', marginTop: 2 },
  switchTrack: { width: 42, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.25)', padding: 3, justifyContent: 'center' },
  switchTrackOn: { backgroundColor: ORANGE },
  switchKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', alignSelf: 'flex-start' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, backgroundColor: '#F3EEDC', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 },
  listTitle: { fontFamily: 'Jost-SemiBold', fontSize: 18, color: FOREST },
  listSub: { fontFamily: 'Jost-Regular', fontSize: 14, color: '#5B4F3E' },
  listOpen: { fontFamily: 'Jost-SemiBold', fontSize: 16, color: '#B84A0C' },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  quickBtn: { flex: 1, height: 72, borderRadius: 18, backgroundColor: '#F3EEDC', alignItems: 'center', justifyContent: 'center', gap: 4 },
  quickText: { fontFamily: 'Jost-SemiBold', fontSize: 14, color: FOREST },
  storeHint: { fontFamily: 'Jost-Regular', fontSize: 14, color: '#C9E3C4', marginTop: -6, marginBottom: 6, marginLeft: 2 },
  addStoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: SAGE, marginTop: 10 },
  addStoreText: { fontFamily: 'Jost-SemiBold', fontSize: 16, color: '#fff' },
  pickPage: { flex: 1, backgroundColor: '#FBF8F1', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 28 },
  pickBack: { fontFamily: 'Jost-SemiBold', fontSize: 17, color: FOREST },
  pickTitle: { fontFamily: 'Playfair-Bold', fontSize: 28, color: FOREST, marginTop: 8 },
  pickSub: { fontFamily: 'Jost-Regular', fontSize: 17, color: '#6B5F4E', marginTop: 8, lineHeight: 24 },
  pickCard: { marginTop: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E7DEC8', borderRadius: 24, padding: 18 },
  pickCardOn: { borderWidth: 2, borderColor: FOREST },
  pickCardTitle: { flex: 1, fontFamily: 'Jost-SemiBold', fontSize: 21, color: FOREST },
  pickCardBody: { fontFamily: 'Jost-Regular', fontSize: 16, lineHeight: 23, color: '#2A2118', marginTop: 12 },
  pickEx: { marginTop: 12, backgroundColor: '#F6F1E3', borderRadius: 14, padding: 12 },
  pickExText: { fontFamily: 'Jost-Regular', fontSize: 15, lineHeight: 21, color: '#5B4F3E' },
  pickGo: { height: 56, borderRadius: 28, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  pickGoText: { fontFamily: 'Jost-SemiBold', fontSize: 18, color: '#fff' },
  pickOff: { fontFamily: 'Jost-Medium', fontSize: 16, color: '#6B5F4E' },
});
