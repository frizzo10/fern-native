import React, { useEffect, useRef, useState } from 'react';
import { AutopilotModePicker } from '../components/home/AutopilotCard';
import { Alert, AppState, Linking, Modal, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, shadow } from '../constants/tokens';
import useLanguage from '../hooks/useLanguage';
import { useSync } from '../hooks/useSync';
import { useTour } from '../services/TourContext';
import { TOUR_LIST } from '../constants/tourContent';
import useEntitlement from '../hooks/useEntitlement';
import { TIERS } from '../constants/tiers';
import UpgradeGateModal from '../components/UpgradeGateModal';
import ShoppingDayPicker from '../components/ShoppingDayPicker';
import { getShoppingDay, saveShoppingDay } from '../utils/staples';
import { LAUNCH_ALL_FREE } from '../constants/launch';
import { fetchCalendarLink } from '../services/calendarLinkService';
import { useRevenueCat } from '../services/RevenueCatContext';
import { consumeToursScroll } from '../services/helpBus';
import { openChat } from '../services/chatBus';
import { usePlansModal } from '../services/PlansModalContext';
import * as Updates from 'expo-updates';
import appJson from '../../app.json';
import { CODE_VERSION } from '../constants/codeVersion';

const TIER_BY_TOUR_KEY = TOUR_LIST.reduce((acc, entry) => {
    acc[entry.key] = entry.tier;
    return acc;
}, {});

function versionLines() {
    let upd = 'built-in (no update installed)';
    try {
        if (Updates.updateId) {
            const when = Updates.createdAt ? new Date(Updates.createdAt).toLocaleString() : '';
            upd = `${String(Updates.updateId).slice(0, 8)}${when ? ` · ${when}` : ''}`;
        }
    } catch (e) { /* expo-updates not available */ }
    return [`Fern ${appJson?.expo?.version || ''}  ·  code ${CODE_VERSION}`, `Update: ${upd}`];
}

const FRIDGE_CHALLENGE_LAST_PLAYED_KEY = 'fern_fridge_challenge_last_played';
const FERN_VOICE_ENABLED_KEY = 'fern_voice_enabled';

function isFernVoiceEnabledValue(raw) {
    if (raw == null) return true;
    const normalized = String(raw).trim().toLowerCase();
    return !['0', 'false', 'off', 'disabled'].includes(normalized);
}

const TOOL_SECTIONS = [
    {
        titleKey: 'account_pro_tools',
        icon: '⭐',
        items: [
            { key: 'end_to_end', icon: '✨', labelKey: 'account_end_to_end', tourKey: 'end_to_end' },
            { key: 'instacart', icon: '🛍️', labelKey: 'account_order_via_instacart', tourKey: 'instacart' },
            { key: 'fridge_challenge', icon: '🧊', labelKey: 'tool_fridge_challenge', tourKey: 'fridge_challenge', completionKey: 'fridge_challenge' },
            { key: 'leftover_magic', icon: '📸', labelKey: 'tool_leftover_magic', tourKey: 'leftover_magic' },
            { key: 'twenty_min', icon: '⚡', labelKey: 'tool_20min_dinner', tourKey: 'quick_dinner' },
            { key: 'budget_planner', icon: '💰', labelKey: 'tool_budget_planner', tourKey: 'budget_planner' },
            { key: 'ai_meal_plan', icon: '📅', labelKey: 'tool_ai_meal_planner', tourKey: 'meal_planner' },
            { key: 'semi_homemade', icon: '🥫', labelKey: 'tool_semi_homemade', tourKey: 'semi_homemade' },
            { key: 'family_vault', icon: '📖', labelKey: 'tool_family_vault', tourKey: 'family_vault' },
            { key: 'alexa_skill', icon: '🔵', labelKey: 'tool_alexa', tourKey: 'alexa_skill' },
            { key: 'recipe_nutrition', icon: '📊', labelKey: 'account_recipe_nutrition', tourKey: 'nutrition' },
            { key: 'weekly_nutrition', icon: '🥗', labelKey: 'tool_weekly_nutrition', tourKey: 'weekly_nutrition' },
            { key: 'cook_mode', icon: '🎙️', labelKey: 'account_cook_mode', tourKey: 'cook_mode' },
            { key: 'shopping_mode', icon: '🛒', labelKey: 'account_shopping_mode', tourKey: 'shopping_mode' },
            { key: 'ask_fern', icon: '🎤', labelKey: 'ask_fern_craving_title', tourKey: 'ask_fern' },
        ],
    },
    {
        titleKey: 'account_pro_max_tools',
        icon: '✦',
        items: [
            { key: 'charcuterie', icon: '🧀', labelKey: 'tool_charcuterie', tourKey: 'charcuterie' },
            { key: 'wine_pairing', icon: '🍷', labelKey: 'tool_wine_pairing', tourKey: 'wine_pairing' },
            { key: 'dinner_party', icon: '🎉', labelKey: 'tool_dinner_party', tourKey: 'dinner_party' },
            { key: 'personal_shopper', icon: '🤝', labelKey: 'tool_personal_shopper', tourKey: 'personal_shopper' },
        ],
    },
];

export default function AccountScreen({ visible, onClose, user, signOut, onOpenShopping }) {
    const { t } = useLanguage();
    const [shoppingDayValue, setShoppingDayValue] = useState(null);
    useEffect(() => { getShoppingDay().then(setShoppingDayValue); }, []);
    const pickShoppingDayValue = async (day) => {
        setShoppingDayValue(day);
        await saveShoppingDay(day, { title: t('everyday_nudge_title'), body: t('everyday_nudge_body') });
    };
    const { data, pushChangedFromStorage } = useSync(user);
    // "About you": name (synced in remi_explicit.userName), people cooked for and diet (device-only fern_shopper_prefs, the same
    // answers the dinner planner reads), edited inline in the profile card.
    const [editingProfile, setEditingProfile] = useState(false);
    const [savedName, setSavedName] = useState('');
    const [nameInput, setNameInput] = useState('');
    const [peopleInput, setPeopleInput] = useState('');
    const [dietInput, setDietInput] = useState('');
    const [aboutPrefs, setAboutPrefs] = useState({});
    useEffect(() => {
        if (!visible) return;
        AsyncStorage.getItem('fern_shopper_prefs').then((raw) => {
            try { setAboutPrefs(JSON.parse(raw || '{}') || {}); } catch (e) { setAboutPrefs({}); }
        }).catch(() => {});
    }, [visible]);
    const { startTour } = useTour();
    const scrollRef = useRef(null);
    const toursY = useRef(0);
    useEffect(() => {
        if (!visible || !consumeToursScroll()) return undefined;
        const id = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, toursY.current - 8), animated: true }), 600);
        return () => clearTimeout(id);
    }, [visible]);
    const { tier, hasAccess } = useEntitlement();
    const { presentCustomerCenter, restore } = useRevenueCat();
    const { open: openPlans } = usePlansModal();
    const [seenTours, setSeenTours] = useState({});
    const [restoring, setRestoring] = useState(false);
    const [fridgeChallengeDone, setFridgeChallengeDone] = useState(false);
    const [fernVoiceEnabled, setFernVoiceEnabled] = useState(true);
    const [lockedTier, setLockedTier] = useState(null);
    const [notifGranted, setNotifGranted] = useState(false);

    // Current OS notification permission; re-checked when this page opens and when
    // the app returns from iPhone Settings.
    const refreshNotifStatus = async () => {
        try {
            const { status } = await Notifications.getPermissionsAsync();
            setNotifGranted(status === 'granted');
        } catch {
            // leave as-is
        }
    };

    useEffect(() => {
        if (!visible) return undefined;
        refreshNotifStatus();
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') refreshNotifStatus();
        });
        return () => sub.remove();
    }, [visible]);

    const handleNotificationsPress = async () => {
        try {
            const current = await Notifications.getPermissionsAsync();
            if (current.status !== 'granted' && current.canAskAgain) {
                const result = await Notifications.requestPermissionsAsync();
                setNotifGranted(result.status === 'granted');
                return;
            }
        } catch {
            // fall through to the Settings prompt
        }
        // Already on, or previously declined: iOS only lets the user change it in Settings.
        Alert.alert(t('account_notifications'), t('account_notifications_settings_desc'), [
            { text: t('cancel_btn'), style: 'cancel' },
            { text: t('account_open_settings'), onPress: () => Linking.openSettings() },
        ]);
    };

    useEffect(() => {
        if (!visible) return;
        AsyncStorage.multiGet([
            ...TOUR_LIST.map((tour) => tour.storageKey),
            FRIDGE_CHALLENGE_LAST_PLAYED_KEY,
            FERN_VOICE_ENABLED_KEY,
        ]).then((pairs) => {
            const nextTours = {};
            let fridgePlayed = false;
            let voiceEnabled = true;

            pairs.forEach(([key, value]) => {
                if (key === FRIDGE_CHALLENGE_LAST_PLAYED_KEY) {
                    fridgePlayed = Boolean(value);
                    return;
                }
                if (key === FERN_VOICE_ENABLED_KEY) {
                    voiceEnabled = isFernVoiceEnabledValue(value);
                    return;
                }
                const tour = TOUR_LIST.find((entry) => entry.storageKey === key);
                if (tour) nextTours[tour.key] = Boolean(value);
            });

            setSeenTours(nextTours);
            setFridgeChallengeDone(fridgePlayed);
            setFernVoiceEnabled(voiceEnabled);
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
        savedName ||
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

    const startEditProfile = () => {
        setNameInput(savedName || data.userProfile?.userName || data.userProfile?.name || '');
        setPeopleInput(String(aboutPrefs.householdSize || ''));
        setDietInput(aboutPrefs.dietary && aboutPrefs.dietary !== 'none' ? String(aboutPrefs.dietary) : '');
        setEditingProfile(true);
    };

    const saveProfile = async () => {
        try {
            const name = nameInput.trim();
            let prefsRaw = {};
            try { prefsRaw = JSON.parse((await AsyncStorage.getItem('fern_shopper_prefs')) || '{}') || {}; } catch (e) { prefsRaw = {}; }
            const nextPrefs = { ...prefsRaw, householdSize: peopleInput.replace(/[^0-9]/g, ''), dietary: dietInput.trim() || 'none' };
            await AsyncStorage.setItem('fern_shopper_prefs', JSON.stringify(nextPrefs));
            let prof = {};
            try { prof = JSON.parse((await AsyncStorage.getItem('remi_explicit')) || '{}') || {}; } catch (e) { prof = {}; }
            const nextProf = name ? { ...prof, userName: name } : prof;
            await AsyncStorage.setItem('remi_explicit', JSON.stringify(nextProf));
            try {
                const cache = JSON.parse((await AsyncStorage.getItem('fern_sync_cache')) || 'null');
                if (cache) await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({ ...cache, userProfile: nextProf }));
            } catch (e) { /* cache patch is best effort */ }
            setAboutPrefs(nextPrefs);
            if (name) setSavedName(name);
            setEditingProfile(false);
            pushChangedFromStorage?.({ remi_explicit: nextProf });
        } catch (e) {
            Alert.alert(t('save_error_title'), t('save_error_desc'));
        }
    };

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

    const toggleFernVoice = async () => {
        const next = !fernVoiceEnabled;
        setFernVoiceEnabled(next);
        try {
            await AsyncStorage.setItem(FERN_VOICE_ENABLED_KEY, next ? 'on' : 'off');
        } catch {
            // Keep UI and persisted value aligned.
            setFernVoiceEnabled(!next);
            Alert.alert(t('sync_error'), t('sync_error_desc'));
        }
    };

    const handleManageSubscription = () => {
        if (LAUNCH_ALL_FREE) return; // launch period: nothing to manage
        if (tier === TIERS.FREE) {
            onClose();
            openPlans();
            return;
        }
        presentCustomerCenter();
    };

    // "Add Fern to my calendar": a private subscription link (activities + planned meals), one way.
    const [calBusy, setCalBusy] = useState(false);
    const handleAddToCalendar = async () => {
        if (calBusy) return;
        setCalBusy(true);
        try {
            const link = await fetchCalendarLink(user?.token);
            Alert.alert(t('cal_title'), t('cal_desc'), [
                { text: t('cal_apple'), onPress: () => Linking.openURL(link.webcal).catch(() => Share.share({ message: link.url })) },
                { text: t('cal_share'), onPress: () => Share.share({ message: link.url }) },
                { text: t('cancel_btn'), style: 'cancel' },
            ]);
        } catch (e) {
            Alert.alert(t('cal_title'), t('cal_failed'));
        } finally {
            setCalBusy(false);
        }
    };

    const handleRestore = async () => {
        setRestoring(true);
        try {
            const info = await restore();
            const hasEntitlement = Object.keys(info?.entitlements?.active || {}).length > 0;
            Alert.alert(
                hasEntitlement ? t('restore_success_title') : t('restore_none_found_title'),
                hasEntitlement ? t('restore_success_desc') : t('restore_none_found_desc')
            );
        } catch (err) {
            Alert.alert(t('restore_error_title'), t('restore_error_desc'));
        } finally {
            setRestoring(false);
        }
    };

    const isCardDone = (item) => {
        if (item.completionKey === 'fridge_challenge') return fridgeChallengeDone;
        if (item.tourKey) return Boolean(seenTours[item.tourKey]);
        return false;
    };

    const handleToolPress = (item) => {
        const requiredTier = item.tourKey ? TIER_BY_TOUR_KEY[item.tourKey] : null;
        if (requiredTier && !hasAccess(requiredTier)) {
            setLockedTier(requiredTier);
            return;
        }

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

                    <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                        <Text style={styles.headerTitle}>{t('my_account_title')}</Text>

                        <View style={styles.profileWrap}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{profileInitial}</Text>
                            </View>
                            <Text style={styles.profileName}>{profileName}</Text>
                            {profileEmail ? <Text style={styles.profileEmail}>{profileEmail}</Text> : null}
                        </View>

                        <View style={styles.infoCard}>
                            <Text style={styles.infoLabel}>{t('shopday_title')}</Text>
                            <Text style={styles.infoValue}>{t('everyday_day_hint')}</Text>
                            <ShoppingDayPicker t={t} day={shoppingDayValue} onPick={pickShoppingDayValue} />
                        </View>

                        <View style={styles.infoCard}>
                            <Text style={styles.infoLabel}>{t('account_your_library')}</Text>
                            <Text style={styles.infoValue}>{t('account_library_summary', { recipes: recipesCount, books: booksCount })}</Text>
                        </View>

                        <View style={styles.infoCard}>
                            <View style={styles.aboutHeader}>
                                <Text style={styles.infoLabel}>{t('profile_about_title').toUpperCase()}</Text>
                                {editingProfile ? null : (
                                    <TouchableOpacity activeOpacity={0.85} onPress={startEditProfile}>
                                        <Text style={styles.rowEditText}>{t('account_edit')}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            {editingProfile ? (
                                <View>
                                    <Text style={styles.aboutFieldLabel}>{t('profile_name')}</Text>
                                    <TextInput style={styles.aboutInput} value={nameInput} onChangeText={setNameInput} autoCapitalize="words" returnKeyType="done" />
                                    <Text style={styles.aboutFieldLabel}>{t('profile_people')}</Text>
                                    <TextInput style={styles.aboutInput} value={peopleInput} onChangeText={setPeopleInput} keyboardType="number-pad" maxLength={2} />
                                    <Text style={styles.aboutFieldLabel}>{t('profile_diet')}</Text>
                                    <TextInput style={styles.aboutInput} value={dietInput} onChangeText={setDietInput} placeholder={t('profile_diet_hint')} placeholderTextColor="#A89883" returnKeyType="done" />
                                    <View style={styles.aboutBtnRow}>
                                        <TouchableOpacity style={styles.aboutCancel} activeOpacity={0.85} onPress={() => setEditingProfile(false)}>
                                            <Text style={styles.aboutCancelText}>{t('profile_cancel')}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.aboutSave} activeOpacity={0.85} onPress={saveProfile}>
                                            <Text style={styles.aboutSaveText}>{t('profile_save')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View>
                                    <Text style={styles.infoValue}>{profileName}</Text>
                                    <Text style={styles.aboutSummary}>
                                        {aboutPrefs.householdSize ? t('profile_people_summary', { count: aboutPrefs.householdSize }) : t('account_not_set')}
                                        {' · '}
                                        {aboutPrefs.dietary && aboutPrefs.dietary !== 'none' ? aboutPrefs.dietary : t('profile_no_restrictions')}
                                    </Text>
                                </View>
                            )}
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
                                <Text style={styles.settingDesc}>{fernVoiceEnabled ? t('account_fern_voice_on_desc') : t('account_fern_voice_off_desc')}</Text>
                            </View>
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={toggleFernVoice}
                                style={fernVoiceEnabled ? styles.statePill : styles.statePillOff}
                            >
                                <Text style={fernVoiceEnabled ? styles.statePillText : styles.statePillOffText}>
                                    {fernVoiceEnabled ? `✓ ${t('account_on')}` : t('account_enable')}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.settingCard}>
                            <View style={styles.settingTextWrap}>
                                <Text style={styles.settingTitle}>🔔 {t('account_notifications')}</Text>
                                <Text style={styles.settingDesc}>{notifGranted ? t('account_notifications_on_desc') : t('account_notifications_off_desc')}</Text>
                            </View>
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={handleNotificationsPress}
                                style={notifGranted ? styles.statePill : styles.statePillOff}
                            >
                                <Text style={notifGranted ? styles.statePillText : styles.statePillOffText}>
                                    {notifGranted ? `✓ ${t('account_on')}` : t('account_enable')}
                                </Text>
                            </TouchableOpacity>
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

                        <View style={styles.settingCard}>
                            <View style={styles.settingTextWrap}>
                                <Text style={styles.settingTitle}>💎 {t('account_manage_subscription')}</Text>
                                <Text style={styles.settingDesc}>
                                    {tier === TIERS.PRO_MAX ? t('pro_max') : tier === TIERS.PRO ? t('pro') : t('account_free_badge')}
                                </Text>
                            </View>
                            <TouchableOpacity activeOpacity={0.85} onPress={handleManageSubscription} style={styles.statePill}>
                                <Text style={styles.statePillText}>
                                    {tier === TIERS.FREE ? t('upgrade_required_cta') : t('account_manage_subscription')}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.restoreLinkBtn} activeOpacity={0.8} onPress={handleRestore} disabled={restoring}>
                            <Text style={styles.restoreLinkBtnText}>
                                {restoring ? t('account_restore_purchases') + '…' : t('account_restore_purchases')}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.versionBox}>
                            {versionLines().map((line) => (
                                <Text key={line} style={styles.versionText} selectable>{line}</Text>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={styles.preferencesBtn}
                            activeOpacity={0.85}
                            onPress={startEditProfile}
                        >
                            <Text style={styles.preferencesBtnText}>🍳 {t('account_update_cooking_preferences').toUpperCase()}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.preferencesBtn, { marginTop: 10 }]}
                            activeOpacity={0.85}
                            onPress={handleAddToCalendar}
                            disabled={calBusy}
                        >
                            <Text style={styles.preferencesBtnText}>📅 {t('cal_btn').toUpperCase()}{calBusy ? '…' : ''}</Text>
                        </TouchableOpacity>

                        <AutopilotModePicker />

                        <View onLayout={(e) => { toursY.current = e.nativeEvent.layout.y; }} style={styles.toursHeadBlock}>
                            <Text style={styles.toursTitle}>{t('tours_title')}</Text>
                            <Text style={styles.toursSub}>{t('tours_sub')}</Text>
                            <TouchableOpacity style={styles.toursBtn} activeOpacity={0.88} onPress={() => { onClose(); setTimeout(() => startTour('home', 0), 450); }}>
                                <Text style={styles.toursBtnText}>▶  {t('faq_replay_tour')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.toursBtn, { marginTop: 8 }]} activeOpacity={0.88} onPress={() => { onClose(); setTimeout(() => openChat(), 450); }}>
                                <Text style={styles.toursBtnText}>🌿  {t('faq_ask_fern')}</Text>
                            </TouchableOpacity>
                        </View>

                        {TOOL_SECTIONS.map((section) => (
                            <View key={section.titleKey} style={styles.sectionBlock}>
                                
                                <View style={styles.toolsGrid}>
                                    {section.items.map((item) => {
                                        const done = isCardDone(item);
                                        const requiredTier = item.tourKey ? TIER_BY_TOUR_KEY[item.tourKey] : null;
                                        const locked = requiredTier && !hasAccess(requiredTier);
                                        return (
                                            <TouchableOpacity
                                                key={item.key}
                                                style={styles.toolCard}
                                                activeOpacity={0.85}
                                                onPress={() => handleToolPress(item)}
                                            >
                                                <Text style={styles.toolTitle}>{item.icon} {t(item.labelKey)}</Text>
                                                <Text style={[styles.toolStatus, done ? styles.toolStatusDone : null, locked ? styles.toolStatusLocked : null]}>
                                                    {locked
                                                        ? `🔒 ${requiredTier === TIERS.PRO_MAX ? t('pro_max') : t('pro')}`
                                                        : done ? `✓ ${t('account_done')}` : `${t('account_tour_start')} →`}
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
            <UpgradeGateModal
                visible={!!lockedTier}
                tier={lockedTier}
                onClose={() => setLockedTier(null)}
            />
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
    aboutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    aboutFieldLabel: { color: colors.brown, fontFamily: 'Jost-Regular', fontSize: 12, marginTop: 12, marginBottom: 4 },
    aboutInput: { borderWidth: 1, borderColor: '#D9CFBF', borderRadius: 12, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Jost-Regular', fontSize: 15, color: '#2F2015' },
    aboutBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
    aboutCancel: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#D9CFBF' },
    aboutCancelText: { color: colors.brown, fontFamily: 'Jost-SemiBold', fontSize: 14 },
    aboutSave: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, backgroundColor: colors.forest },
    aboutSaveText: { color: '#F5F0E7', fontFamily: 'Jost-Bold', fontSize: 14 },
    aboutSummary: { color: colors.brown, fontFamily: 'Jost-Regular', fontSize: 13, marginTop: 4 },
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
    statePillOff: {
        borderWidth: 2,
        borderColor: '#9C7A53',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#F8F4EC',
    },
    statePillOffText: {
        color: '#7F5E39',
        fontFamily: 'Jost-SemiBold',
        fontSize: 12,
    },

    versionBox: { alignItems: 'center', paddingVertical: 8 },
    versionText: { fontSize: 12, color: colors.brown, textAlign: 'center' },
    restoreLinkBtn: {
        alignItems: 'center',
        paddingVertical: 10,
        marginBottom: 4,
    },
    restoreLinkBtnText: {
        color: colors.brown,
        fontFamily: 'Jost-SemiBold',
        fontSize: 12,
        textDecorationLine: 'underline',
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

    toursHeadBlock: { marginTop: 26 },
    toursTitle: { color: '#5d361c', fontFamily: 'Jost-Bold', fontSize: 24, marginBottom: 4 },
    toursSub: { color: '#2C241B', fontFamily: 'Jost-Regular', fontSize: 13, lineHeight: 18, marginBottom: 12 },
    toursBtn: { backgroundColor: colors.forest, borderRadius: 16, alignItems: 'center', paddingVertical: 13 },
    toursBtnText: { color: '#F5F0E7', fontFamily: 'Jost-Bold', fontSize: 15 },
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
    toolStatusLocked: {
        color: colors.brown,
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