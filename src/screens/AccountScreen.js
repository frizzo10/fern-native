import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, shadow } from '../constants/tokens';
import useLanguage from '../hooks/useLanguage';
import { useSync } from '../hooks/useSync';
import { useTour } from '../services/TourContext';
import { TOUR_LIST } from '../constants/tourContent';

const FRIDGE_CHALLENGE_LAST_PLAYED_KEY = 'fern_fridge_challenge_last_played';

const TOOL_SECTIONS = [
  {
    titleKey: 'account_pro_tools',
    icon: '⭐',
    items: [
      { key: 'end_to_end', icon: '✨', labelKey: 'account_end_to_end', tourKey: 'home' },
      { key: 'instacart', icon: '🛍️', labelKey: 'account_order_via_instacart', tourKey: 'shopping' },
      { key: 'fridge_challenge', icon: '🧊', labelKey: 'tool_fridge_challenge', completionKey: 'fridge_challenge' },
      { key: 'leftover_magic', icon: '📸', labelKey: 'tool_leftover_magic' },
      { key: 'twenty_min', icon: '⚡', labelKey: 'tool_20min_dinner' },
      { key: 'budget_planner', icon: '💰', labelKey: 'tool_budget_planner' },
      { key: 'ai_meal_plan', icon: '📅', labelKey: 'tool_ai_meal_planner' },
      { key: 'semi_homemade', icon: '🥫', labelKey: 'tool_semi_homemade' },
      { key: 'family_vault', icon: '📖', labelKey: 'tool_family_vault', tourKey: 'recipes' },
      { key: 'alexa_skill', icon: '🔵', labelKey: 'tool_alexa' },
      { key: 'recipe_nutrition', icon: '📊', labelKey: 'account_recipe_nutrition', tourKey: 'recipes' },
      { key: 'weekly_nutrition', icon: '🥗', labelKey: 'tool_weekly_nutrition' },
      { key: 'cook_mode', icon: '🎙️', labelKey: 'account_cook_mode', tourKey: 'home' },
      { key: 'shopping_mode', icon: '🛒', labelKey: 'account_shopping_mode', tourKey: 'shopping' },
      { key: 'ask_fern', icon: '🎤', labelKey: 'ask_fern_craving_title', tourKey: 'find' },
    ],
  },
  {
    titleKey: 'account_pro_max_tools',
    icon: '✦',
    items: [
      { key: 'charcuterie', icon: '🧀', labelKey: 'tool_charcuterie' },
      { key: 'wine_pairing', icon: '🍷', labelKey: 'tool_wine_pairing', tourKey: 'find' },
      { key: 'dinner_party', icon: '🎉', labelKey: 'tool_dinner_party' },
      { key: 'personal_shopper', icon: '🤝', labelKey: 'tool_personal_shopper', tourKey: 'scan_circular' },
    ],
  },
];

export default function AccountScreen({ visible, onClose, user, signOut, onOpenShopping }) {
  const { t } = useLanguage();
  const { data } = useSync(user);
  const { startTour } = useTour();
  const [seenTours, setSeenTours] = useState({});
  const [fridgeChallengeDone, setFridgeChallengeDone] = useState(false);

  useEffect(() => {
    if (!visible) return;
    AsyncStorage.multiGet([
      ...TOUR_LIST.map((tour) => tour.storageKey),
      FRIDGE_CHALLENGE_LAST_PLAYED_KEY,
    ]).then((pairs) => {
      const nextTours = {};
      let fridgePlayed = false;

      pairs.forEach(([key, value]) => {
        if (key === FRIDGE_CHALLENGE_LAST_PLAYED_KEY) {
          fridgePlayed = Boolean(value);
          return;
        }
        const tour = TOUR_LIST.find((entry) => entry.storageKey === key);
        if (tour) nextTours[tour.key] = Boolean(value);
      });

      setSeenTours(nextTours);
      setFridgeChallengeDone(fridgePlayed);
    });
  }, [visible]);

  const followersCount = Array.isArray(data.followers) ? data.followers.length : 0;
  const isBloggerModeOn = followersCount > 0;
  const recipesCount = Array.isArray(data.recipes) ? data.recipes.length : 0;
  const booksCount = Array.isArray(data.books) ? data.books.length : 0;
  const shoppingCount = Array.isArray(data.shopping) ? data.shopping.length : 0;
  const rawStores = data.userStores || data.userProfile?.user_stores || [];
  const storesCount = Array.isArray(rawStores) ? rawStores.length : 0;

  const profileName =
    data.userProfile?.userName ||
    data.userProfile?.name ||
    user?.name ||
    user?.fullName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    'Fern';
  const profileEmail = user?.email || data.userProfile?.email || '';
  const profileInitial = String(profileName).trim().charAt(0).toUpperCase() || 'F';

  const comingSoon = (title) => Alert.alert(title, t('coming_soon'));

  const handleSignOut = () => {
    onClose();
    signOut?.();
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('account_delete_confirm_title'),
      t('account_delete_confirm_desc'),
      [
        { text: t('account_cancel'), style: 'cancel' },
        { text: t('account_delete_title'), style: 'destructive', onPress: () => comingSoon(t('account_delete_title')) },
      ]
    );
  };

  const handleStartTour = (tourKey) => {
    onClose();
    startTour(tourKey);
  };

  const isCardDone = (item) => {
    if (item.completionKey === 'fridge_challenge') return fridgeChallengeDone;
    if (item.tourKey) return Boolean(seenTours[item.tourKey]);
    return false;
  };

  const handleToolPress = (item) => {
    if (item.key === 'shopping_mode') {
      onClose();
      onOpenShopping?.();
      return;
    }

    if (item.tourKey) {
      handleStartTour(item.tourKey);
      return;
    }

    comingSoon(t(item.labelKey));
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, shadow.strong]}>
          <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.headerTitle}>{t('my_account_title')}</Text>

          <View style={styles.profileWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profileInitial}</Text>
            </View>
            <Text style={styles.profileName}>{profileName}</Text>
            {profileEmail ? <Text style={styles.profileEmail}>{profileEmail}</Text> : null}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>{t('account_your_library')}</Text>
            <Text style={styles.infoValue}>{t('account_library_summary', { recipes: recipesCount, books: booksCount })}</Text>
          </View>

          <View style={styles.rowInfoCard}>
            <View style={styles.rowInfoTextWrap}>
              <Text style={styles.rowInfoLabel}>{t('account_household_income').toUpperCase()}</Text>
              <Text style={styles.rowInfoValue}>{t('account_not_set')}</Text>
            </View>
            <TouchableOpacity activeOpacity={0.85} onPress={() => comingSoon(t('account_household_income'))}>
              <Text style={styles.rowEditText}>{t('account_edit')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rowInfoCard}>
            <View style={styles.rowInfoTextWrap}>
              <Text style={styles.rowInfoLabel}>{`${t('account_shopping_zip').toUpperCase()} · ${t('account_no_zip_set').toUpperCase()}`}</Text>
              <Text style={styles.rowInfoValue}>
                {storesCount > 0
                  ? t('account_stores_selected', { count: storesCount })
                  : t('account_no_stores_selected')}
              </Text>
            </View>
            <TouchableOpacity activeOpacity={0.85} onPress={() => comingSoon(t('account_shopping_zip'))}>
              <Text style={styles.rowEditText}>{t('account_edit')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.topTwoUpRow}>
            <TouchableOpacity
              style={styles.topTwoUpCard}
              activeOpacity={0.85}
              onPress={() => {
                onClose();
                onOpenShopping?.();
              }}
            >
              <Text style={styles.topTwoUpEmoji}>🛒</Text>
              <Text style={styles.topTwoUpTitle}>{t('account_shopping_list')}</Text>
              <Text style={styles.topTwoUpSub}>
                {shoppingCount > 0 ? t('account_items_count', { count: shoppingCount }) : t('account_empty')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.topTwoUpCard}
              activeOpacity={0.85}
              onPress={() => comingSoon(t('account_coupons'))}
            >
              <Text style={styles.topTwoUpEmoji}>🎟️</Text>
              <Text style={styles.topTwoUpTitle}>{t('account_coupons')}</Text>
              <Text style={styles.topTwoUpSub}>{t('account_none_saved')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cloudSyncText}>✓ {t('account_photos_synced')}</Text>

          <View style={styles.freeBadgePill}>
            <Text style={styles.freeBadgePillText}>✓ {t('account_free_badge')} →</Text>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingTitle}>🔊 {t('account_fern_voice')}</Text>
              <Text style={styles.settingDesc}>{t('account_fern_voice_on_desc')}</Text>
            </View>
            <View style={styles.statePill}>
              <Text style={styles.statePillText}>✓ {t('account_on')}</Text>
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingTitle}>✍️ {t('account_blogger_mode')}</Text>
              <Text style={styles.settingDesc}>
                {isBloggerModeOn ? t('account_blogger_active_desc') : t('account_blogger_inactive_desc')}
              </Text>
            </View>
            <View style={styles.statePill}>
              <Text style={styles.statePillText}>✓ {isBloggerModeOn ? t('account_on') : t('account_off')}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.preferencesBtn}
            activeOpacity={0.85}
            onPress={() => comingSoon(t('account_update_cooking_preferences'))}
          >
            <Text style={styles.preferencesBtnText}>🍳 {t('account_update_cooking_preferences').toUpperCase()}</Text>
          </TouchableOpacity>

          {TOOL_SECTIONS.map((section) => (
            <View key={section.titleKey} style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>{section.icon} {t(section.titleKey).toUpperCase()}</Text>
              <View style={styles.toolsGrid}>
                {section.items.map((item) => {
                  const done = isCardDone(item);
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={styles.toolCard}
                      activeOpacity={0.85}
                      onPress={() => handleToolPress(item)}
                    >
                      <Text style={styles.toolTitle}>{item.icon} {t(item.labelKey)}</Text>
                      <Text style={[styles.toolStatus, done ? styles.toolStatusDone : null]}>
                        {done ? `✓ ${t('account_done')}` : `${t('account_tour_start')} →`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.85} onPress={handleSignOut}>
            <Text style={styles.signOutText}>{t('account_sign_out').toUpperCase()}</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.85} onPress={handleDeleteAccount}>
            <Text style={styles.deleteBtnText}>🗑️ {t('account_delete_title')}</Text>
          </TouchableOpacity>
          <Text style={styles.deleteDesc}>{t('account_delete_desc')}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.parch,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: '#D9CFBF',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    height: '88%',
  },
  headerTitle: {
    color: '#2E1B0E',
    fontFamily: 'Jost-Bold',
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 12,
    paddingRight: 56,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8D3CB',
    backgroundColor: '#EEE9E0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  closeText: {
    fontSize: 26,
    color: '#8A755E',
    lineHeight: 28,
    marginTop: -2,
  },

  content: {
    paddingTop: 8,
    paddingBottom: 34,
  },

  profileWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.forest,
  },
  avatarText: {
    color: '#F2F0EA',
    fontFamily: 'Jost-Bold',
    fontSize: 30,
    lineHeight: 34,
  },
  profileName: {
    color: '#2E1B0E',
    fontFamily: 'Jost-Bold',
    fontSize: 20,
    lineHeight: 24,
    marginTop: 10,
  },
  profileEmail: {
    color: colors.brown,
    fontFamily: 'Jost-Regular',
    fontSize: 13,
    marginTop: 4,
  },

  infoCard: {
    backgroundColor: colors.paper,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E6D9C4',
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginBottom: 12,
  },
  infoLabel: {
    color: colors.brown,
    fontFamily: 'Jost-Regular',
    fontSize: 12,
  },
  infoValue: {
    color: '#2F2015',
    fontFamily: 'Jost-Bold',
    fontSize: 15,
    lineHeight: 20,
    marginTop: 6,
  },

  rowInfoCard: {
    backgroundColor: colors.paper,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E6D9C4',
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowInfoTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  rowInfoLabel: {
    color: colors.brown,
    fontFamily: 'Jost-Bold',
    fontSize: 10,
    letterSpacing: 1.2,
  },
  rowInfoValue: {
    color: '#2F2015',
    fontFamily: 'Jost-Bold',
    fontSize: 13,
    marginTop: 5,
  },
  rowEditText: {
    color: colors.forest,
    fontFamily: 'Jost-SemiBold',
    fontSize: 12,
    textDecorationLine: 'underline',
  },

  topTwoUpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  topTwoUpCard: {
    width: '48.5%',
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: '#D8C3A4',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 102,
    justifyContent: 'center',
  },
  topTwoUpEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  topTwoUpTitle: {
    color: '#2F2015',
    fontFamily: 'Jost-Bold',
    fontSize: 13,
    lineHeight: 18,
  },
  topTwoUpSub: {
    color: colors.brown,
    fontFamily: 'Jost-Regular',
    fontSize: 11,
    marginTop: 4,
  },

  cloudSyncText: {
    color: colors.brown,
    fontFamily: 'Jost-Regular',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
  },
  freeBadgePill: {
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: '#BFE0BE',
    backgroundColor: '#F3F9EE',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  freeBadgePillText: {
    color: '#2E8A3B',
    fontFamily: 'Jost-Bold',
    fontSize: 13,
  },

  settingCard: {
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#EEE3D1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  settingTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  settingTitle: {
    color: '#312116',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
    lineHeight: 20,
  },
  settingDesc: {
    color: colors.brown,
    fontFamily: 'Jost-Regular',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  statePill: {
    borderWidth: 2,
    borderColor: '#2E8A3B',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(46,138,59,0.06)',
  },
  statePillText: {
    color: '#2E8A3B',
    fontFamily: 'Jost-SemiBold',
    fontSize: 12,
  },

  preferencesBtn: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginTop: 2,
  },
  preferencesBtnText: {
    color: colors.brown,
    fontFamily: 'Jost-Bold',
    fontSize: 14,
    letterSpacing: 0.8,
  },

  sectionBlock: {
    marginTop: 18,
  },
  sectionTitle: {
    color: '#9A7C53',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 10,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  toolCard: {
    width: '48.5%',
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: '#DEC9AA',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    minHeight: 98,
    justifyContent: 'center',
  },
  toolTitle: {
    color: '#2F2015',
    fontFamily: 'Jost-Bold',
    fontSize: 13,
    lineHeight: 18,
  },
  toolStatus: {
    color: colors.orange,
    fontFamily: 'Jost-SemiBold',
    fontSize: 12,
    marginTop: 4,
  },
  toolStatusDone: {
    color: '#2D8E4C',
  },

  signOutBtn: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginTop: 8,
  },
  signOutText: {
    color: colors.brown,
    fontFamily: 'Jost-Bold',
    fontSize: 14,
    letterSpacing: 1.5,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },

  deleteBtn: {
    borderWidth: 2,
    borderColor: '#C73E2E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  deleteBtnText: {
    color: '#C73E2E',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
  },
  deleteDesc: {
    color: colors.brown,
    fontFamily: 'Jost-Regular',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
    paddingHorizontal: 6,
  },
});