import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../../constants/tokens';
import { FEATURE_TIERS } from '../../constants/featureAccess';
import useLanguage from '../../hooks/useLanguage';
import useEntitlement from '../../hooks/useEntitlement';
import {
    buildSortedShoppingList,
    chatWithPersonalShopper,
    fetchDinnerSuggestions,
    fetchNeededIngredients,
    startPersonalShopper,
} from '../../services/personalShopperService';
import { fetchMealPlanRecipeDetail } from '../../services/mealPlanRecipeService';
import { scanCircular } from '../../services/scanCircularService';
import { fetchStoreDeals } from '../../services/storeDealsService';
import { pickPhotoFromCamera, pickPhotoFromLibrary } from '../../services/photoPickerService';
import { addRecipeIngredientsToShoppingList } from '../../utils/shoppingListSync';
import { buildRollingWeekDateKeys, formatDayLabel, normalizeSlot, parseDateKey } from '../../utils/familyDates';
import { toList } from '../../utils/recipeNormalize';
import UpgradeGateModal from '../UpgradeGateModal';

// Grocery names are stored/synced in English on purpose (see CLAUDE.md →
// Translations), so these are not run through t().
const STAPLES = ['eggs', 'butter', 'milk', 'bread', 'olive oil', 'garlic', 'onions', 'pasta'];
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const STEP_META = {
    circular: { n: 1, labelKey: 'psp_label_circular' },
    about: { n: 1, labelKey: 'psp_label_about' },
    staples: { n: 1, labelKey: 'psp_label_staples' },
    dinners: { n: 2, labelKey: 'psp_label_dinners' },
    hubcheck: { n: 3, labelKey: 'psp_label_week' },
    activities: { n: 3, labelKey: 'psp_label_activities' },
    ingredients: { n: 4, labelKey: 'psp_label_ingredients' },
    listcheck: { n: 5, labelKey: 'psp_label_list' },
};

function newSession() {
    return {
        systemPrompt: '',
        forecast: [],
        recurringActs: [],
        history: [],        // [{ role: 'system'|'assistant'|'user', content }] — sent back to the `chat` action
        listItems: [],      // [{ name, fromRecipe }] — what the user said they need to buy
        recipes: [],        // dinners to check ingredients for: [{ title, ingredients: string[] | null }]
        recipeIdx: 0,
        staplesHave: [],
        deals: [],          // sale items scanned from the store flyer (Pro Max arrival flow)
        dealsStore: '',
        startReply: '',     // Fern's opening message, held back until the flyer step is done
        profile: {},        // answers to the "about your household" questions: { householdSize, dietary, dinnersWanted, vibe }
        aboutDone: false,
        storedDeals: [],    // this week's ad(s) already on file for the user's saved stores: [{ store, scannedAt, deals[] }]
        aboutQ: 0,
        step: 'staples',
    };
}

async function readJson(key, fallback) {
    try {
        const raw = await AsyncStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

// Maps a typed reply or a quick-reply chip to an intent. Chips pass their
// intent explicitly (so they work in any language); typed text is matched
// against English and Spanish words, like the web app's regex routing.
function inferIntent(text) {
    const s = String(text || '').trim().toLowerCase();
    if (/\b(some|algun[oa]s?|unos|unas)\b/.test(s)) return 'some';
    if (/^(no|nope|nah|nada)\b|\bneed\b|\bmost\b|\bnecesito\b/.test(s)) return 'no';
    if (/\b(next|skip|siguiente|saltar|omitir)\b/.test(s)) return 'next';
    if (/\b(yes|yeah|yep|sure|ok|okay|all|done|good|set|perfect|great|those|them|s[ií]|claro|listo|vale|bien|todo|todas|dale|perfecto)\b/.test(s)) return 'yes';
    return null;
}

function Checkbox({ checked }) {
    return (
        <View style={[styles.checkbox, checked ? styles.checkboxOn : null]}>
            {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
        </View>
    );
}

// Plan the week with Fern: dinner suggestions → week review → (recurring
// activities) → staples → per-recipe ingredients → sorted shopping list, with
// free-form chat available at every step. Mirrors the web app's Personal
// Shopper (personal-shopper-plan function); the web app's voice mode and
// in-store guide are not part of this modal.
export default function PersonalShopperModal({
    visible,
    onClose,
    user,
    data,
    pushChangedFromStorage,
    pull,
    navigation,
    startWithCircular = false, // opened from the store-arrival notification: scan the flyer first
    arrivedStoreName = '',
}) {
    const { t, locale } = useLanguage();
    const { hasAccess } = useEntitlement();
    const insets = useSafeAreaInsets();
    const allowed = hasAccess(FEATURE_TIERS.personal_shopper);
    const token = user?.token;
    const dateLocale = locale === 'es' ? 'es-ES' : 'en-US';

    const scrollRef = useRef(null);
    const nextMessageId = useRef(1);
    const session = useRef(newSession());

    const [phase, setPhase] = useState('intro'); // intro | chat
    const [messages, setMessages] = useState([]);
    const [step, setStep] = useState('dinners');
    const [typing, setTyping] = useState(false);
    const [chips, setChips] = useState([]);
    const [panel, setPanel] = useState(null);
    const [input, setInput] = useState('');
    const [listInput, setListInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [circularMode, setCircularMode] = useState(false);

    useEffect(() => {
        // Fresh session each time the modal opens; also invalidates any async
        // work still in flight from a previous run (they compare their `run`).
        session.current = newSession();
        setPhase('intro');
        setMessages([]);
        setStep('dinners');
        setTyping(false);
        setChips([]);
        setPanel(null);
        setInput('');
        setListInput('');
        setBusy(false);
        setCircularMode(false);
        // Opened from the arrival notification: skip the intro and go straight to the flyer.
        if (visible && allowed && startWithCircular) startCircularPlanning();
    }, [visible]);

    if (visible && !allowed) {
        return <UpgradeGateModal visible={visible} onClose={onClose} tier={FEATURE_TIERS.personal_shopper} />;
    }

    // ── small helpers ────────────────────────────────────────────────────────

    const say = (text) => {
        if (!text) return;
        session.current.history.push({ role: 'assistant', content: text });
        setMessages((prev) => [...prev, { id: nextMessageId.current++, role: 'assistant', text }]);
    };

    const userSays = (text) => {
        session.current.history.push({ role: 'user', content: text });
        setMessages((prev) => [...prev, { id: nextMessageId.current++, role: 'user', text }]);
    };

    const goStep = (next) => {
        session.current.step = next;
        setStep(next);
    };

    const weekdayName = (dateKey) => parseDateKey(dateKey).toLocaleDateString(dateLocale, { weekday: 'long' });

    const readPlanState = async () => ({
        mealPlan: await readJson('rv4_meal_plan', {}),
        activities: await readJson('rv4_activities', []),
    });

    const refreshAfterWrite = async () => {
        try {
            await pull?.();
        } catch (e) {
            console.log('[personal-shopper] refresh after write failed', e?.message || e);
        }
    };

    const addListItem = (run, name, fromRecipe) => {
        const key = String(name || '').trim().toLowerCase();
        if (!key || run.listItems.some((item) => item.name.toLowerCase() === key)) return;
        run.listItems.push({ name: String(name).trim(), fromRecipe: fromRecipe || '' });
    };

    // ── step 2: dinner suggestions ───────────────────────────────────────────

    const suggestDinners = async (run) => {
        setTyping(true);
        setChips([]);
        setPanel(null);
        try {
            const { mealPlan, activities } = await readPlanState();
            const res = await fetchDinnerSuggestions({
                savedRecipes: data?.recipes,
                forecast: run.forecast,
                activities,
                mealPlan,
                userProfile: { ...(data?.userProfile || {}), ...(run.profile || {}) },
                locale,
                deals: run.deals,
                dealsStore: run.dealsStore,
            });
            if (run !== session.current) return;
            setTyping(false);

            // The backend builds its 7-day window from *its* "today" (UTC), so in
            // the evening west of UTC its window starts a day after the user's
            // local today. Its dates are still real calendar dates, so keep the
            // ones that fall inside the local rolling week and drop the rest.
            const localKeys = buildRollingWeekDateKeys();
            const seen = new Set();
            const items = [];
            res.suggestions.forEach((suggestion) => {
                const dateKey = localKeys.includes(suggestion.date) ? suggestion.date : null;
                if (!dateKey || seen.has(dateKey)) return;
                const hasDinner = (Array.isArray(mealPlan[dateKey]) ? mealPlan[dateKey] : []).some((entry) => normalizeSlot(entry) === 'dinner');
                if (hasDinner) return;
                seen.add(dateKey);
                items.push({ ...suggestion, dateKey, dayLabel: weekdayName(dateKey), checked: items.length < (parseInt(run.profile?.dinnersWanted, 10) || 99) });
            });

            if (!items.length) {
                say(t('psp_no_suggestions'));
                setChips([{ label: t('psp_suggest_again_btn'), intent: 'retry' }]);
                return;
            }

            say(res.pitch || t('psp_dinners_pitch_fallback'));
            setPanel({ type: 'dinners', items });
        } catch (e) {
            console.log('[personal-shopper] suggest dinners failed', e?.message || e);
            if (run !== session.current) return;
            setTyping(false);
            say(t('psp_dinners_error'));
            setChips([{ label: t('psp_suggest_again_btn'), intent: 'retry' }]);
        }
    };

    const startPlanning = async () => {
        const run = newSession();
        session.current = run;
        setPhase('chat');
        setMessages([]);
        setPanel(null);
        setChips([]);
        goStep('staples');
        setTyping(true);

        const { mealPlan, activities } = await readPlanState();
        const store = Array.isArray(data?.userStores) ? data.userStores[0] : null;
        try {
            const res = await startPersonalShopper({
                userProfile: data?.userProfile,
                lat: store?.lat,
                lon: store?.lng ?? store?.lon,
                mealPlan,
                savedRecipes: data?.recipes,
                activities,
                locale,
            });
            if (run !== session.current) return;
            run.systemPrompt = res.systemPrompt;
            run.forecast = res.forecast;
            run.recurringActs = res.recurringActs;
            run.history.push({ role: 'system', content: res.systemPrompt });
            setTyping(false);
            say(res.reply || t('psp_start_fallback'));
            // Fern's opening message already asks about the basics: just offer the
            // answer buttons and wait. Dinners start once the user has answered.
            setChips(stapleChips());
        } catch (e) {
            console.log('[personal-shopper] start failed', e?.message || e);
            if (run !== session.current) return;
            setTyping(false);
            say(t('psp_start_fallback'));
            startStaples(); // opening message failed, so ask the question ourselves
        }
    };

    // ── optional first step: scan the store flyer (arrival notification) ─────

    // Same as startPlanning, but the opening message is held back: the user is
    // standing in the store, so the flyer comes first, then the staples question,
    // then dinners built around what's on sale.
    const startCircularPlanning = async () => {
        const run = newSession();
        session.current = run;
        setCircularMode(true);
        setPhase('chat');
        setMessages([]);
        setPanel(null);
        setChips([]);
        goStep('circular');
        setTyping(true);

        const { mealPlan, activities } = await readPlanState();
        const store = Array.isArray(data?.userStores) ? data.userStores[0] : null;
        run.dealsStore = String(arrivedStoreName || '').trim();
        try {
            const res = await startPersonalShopper({
                userProfile: data?.userProfile,
                lat: store?.lat,
                lon: store?.lng ?? store?.lon,
                mealPlan,
                savedRecipes: data?.recipes,
                activities,
                locale,
            });
            if (run !== session.current) return;
            run.systemPrompt = res.systemPrompt;
            run.forecast = res.forecast;
            run.recurringActs = res.recurringActs;
            run.history.push({ role: 'system', content: res.systemPrompt });
            run.startReply = res.reply || t('psp_start_fallback');
        } catch (e) {
            console.log('[personal-shopper] start failed', e?.message || e);
            if (run !== session.current) return;
            run.startReply = t('psp_staples_prompt');
        }
        // Has anyone already scanned this week's ad for the user's saved stores? Then Fern
        // already knows the sales and the user doesn't need to photograph anything.
        const known = await fetchStoreDeals({
            token,
            stores: (Array.isArray(data?.userStores) ? data.userStores : []).map((st) => st?.name),
        });
        if (run !== session.current) return;
        setTyping(false);
        if (known.length) {
            run.storedDeals = known.map((k) => ({
                store: k.store,
                scannedAt: k.scannedAt,
                deals: k.items.slice(0, 15).map((it) => ({ name: it.name, salePrice: it.price || '', isBogo: Boolean(it.isBogo), store: k.store })),
            }));
            const total = known.reduce((n, k) => n + k.itemCount, 0);
            const newest = known.map((k) => new Date(k.scannedAt).getTime()).filter(Boolean).sort((a, b) => b - a)[0];
            const days = newest ? Math.max(0, Math.floor((Date.now() - newest) / 86400000)) : 0;
            const when = days === 0 ? t('psp_when_today') : days === 1 ? t('psp_when_yesterday') : t('psp_when_days_ago', { n: days });
            say(t('psp_deals_known', { stores: known.map((k) => k.store).join(', '), n: total, when }));
            setChips([
                { label: t('psp_deals_use_btn'), intent: 'usedeals' },
                { label: t('psp_deals_scan_btn'), intent: 'scannew' },
            ]);
            return;
        }
        say(run.dealsStore ? t('psp_circular_prompt', { store: run.dealsStore }) : t('psp_circular_prompt_nostore'));
        setPanel({ type: 'circular' });
    };

    // After the flyer step (scanned or skipped): Fern's usual opening + staples question.
    const proceedToStaplesAfterCircular = () => {
        const run = session.current;
        // A few quick questions about the household come before staples/dinners.
        if (!run.aboutDone) {
            startAbout();
            return;
        }
        setPanel(null);
        goStep('staples');
        say(run.startReply || t('psp_staples_prompt'));
        setChips(stapleChips());
    };

    const scanFlyer = async (fromCamera) => {
        if (busy) return;
        const run = session.current;
        const result = fromCamera ? await pickPhotoFromCamera() : await pickPhotoFromLibrary();
        if (result.permissionDenied) {
            Alert.alert(t('permission_needed_title'), t('photo_permission_denied_desc'));
            return;
        }
        if (!result.photo?.base64) return;

        setBusy(true);
        setPanel(null);
        say(t('psp_circular_scanning'));
        setTyping(true);
        let scan;
        try {
            scan = await scanCircular({
                userId: user?.id,
                base64: result.photo.base64,
                mimeType: result.photo.mimeType,
                token,
            });
        } catch (e) {
            console.log('[personal-shopper] flyer scan failed', e?.message || e);
            if (run !== session.current) return;
            setBusy(false);
            setTyping(false);
            Alert.alert(t('scan_circular_scan_failed_title'), t('scan_circular_scan_failed_desc'));
            setPanel({ type: 'circular' });
            return;
        }
        if (run !== session.current) return;
        setBusy(false);
        setTyping(false);

        // Best deals first; the server takes up to 30.
        const items = (scan.items || []).filter((item) => item.name);
        const ranked = [...items].sort((a, b) => (Number(b.cookable) - Number(a.cookable)) || (b.dealScore - a.dealScore));
        const scannedStore = String(scan.store || '').trim();
        const scannedDeals = ranked.slice(0, 30).map((item) => ({
            name: item.name,
            salePrice: item.salePrice || '',
            isBogo: Boolean(item.isBogo),
            ...(scannedStore && run.storedDeals.length ? { store: scannedStore } : {}),
        }));
        // Deals already on file for the user's OTHER stores stay in, so the plan can compare stores.
        const sameStore = (a) => {
            const x = String(a || '').toLowerCase();
            const y = scannedStore.toLowerCase();
            return Boolean(x && y) && (x.includes(y) || y.includes(x));
        };
        const otherStores = run.storedDeals.filter((k) => !sameStore(k.store)).flatMap((k) => k.deals);
        run.deals = [...scannedDeals, ...otherStores];
        run.dealsStore = otherStores.length ? '' : scannedStore;

        if (!run.deals.length) {
            say(t('psp_circular_none'));
        } else {
            say(run.dealsStore
                ? t('psp_circular_found', { n: run.deals.length, store: run.dealsStore })
                : t('psp_circular_found_nostore', { n: run.deals.length }));
        }
        proceedToStaplesAfterCircular();
    };

    const skipFlyer = () => {
        userSays(t('psp_circular_skip_btn'));
        proceedToStaplesAfterCircular();
    };

    const confirmDinners = async () => {
        const run = session.current;
        const picked = (panel?.items || []).filter((item) => item.checked);

        if (!picked.length) {
            setPanel(null);
            say(t('psp_no_dinners_selected'));
            setChips([
                { label: t('psp_suggest_again_btn'), intent: 'retry' },
                { label: t('psp_ill_pick_btn'), intent: 'pick' },
            ]);
            return;
        }

        setBusy(true);
        try {
            const mealPlan = await readJson('rv4_meal_plan', {});
            const saved = Array.isArray(data?.recipes) ? data.recipes : [];
            let next = { ...mealPlan };
            picked.forEach((suggestion) => {
                const dayMeals = Array.isArray(next[suggestion.dateKey]) ? next[suggestion.dateKey] : [];
                if (dayMeals.some((entry) => normalizeSlot(entry) === 'dinner')) return;
                const match = saved.find((recipe) => String(recipe?.title || '').trim().toLowerCase() === suggestion.title.toLowerCase());
                const matchId = match ? (match._id ?? match.id) : null;
                next = {
                    ...next,
                    [suggestion.dateKey]: [
                        ...dayMeals,
                        {
                            slot: 'Dinner',
                            title: suggestion.title,
                            emoji: match?.emoji || '🍽️',
                            ...(matchId != null ? { recipeId: matchId } : {}),
                        },
                    ],
                };
            });
            await AsyncStorage.setItem('rv4_meal_plan', JSON.stringify(next));
            await pushChangedFromStorage?.({ meal_plan: next });
            await refreshAfterWrite();
        } catch (e) {
            console.log('[personal-shopper] saving dinners failed', e?.message || e);
            setBusy(false);
            Alert.alert(t('save_failed'), t('save_error_desc'));
            return;
        }
        setBusy(false);

        userSays(t(picked.length === 1 ? 'psp_dinners_added_singular' : 'psp_dinners_added_plural', { n: picked.length }));
        setPanel(null);
        if (run === session.current) await showWeekReview();
    };

    // ── step 3: week review, then recurring activities ───────────────────────

    const showWeekReview = async () => {
        goStep('hubcheck');
        setChips([]);
        say(t('psp_great_choices_week'));

        const { mealPlan, activities } = await readPlanState();
        const days = buildRollingWeekDateKeys().map((key, index) => {
            const date = parseDateKey(key);
            const dayMeals = Array.isArray(mealPlan[key]) ? mealPlan[key] : [];
            return {
                key,
                isToday: index === 0,
                label: `${weekdayName(key)} · ${date.getMonth() + 1}/${date.getDate()}`,
                meals: ['breakfast', 'lunch', 'dinner']
                    .map((slot) => dayMeals.find((entry) => normalizeSlot(entry) === slot))
                    .filter(Boolean)
                    .map((entry) => ({ slot: entry.slot, title: String(entry.title || '').replace(/\s*\(exact match\)/gi, '') })),
                acts: (Array.isArray(activities) ? activities : []).filter((activity) => activity?.dateKey === key),
            };
        });
        setPanel({ type: 'week', days });
    };

    const addRecurringActivities = async (run) => {
        const activities = await readJson('rv4_activities', []);
        const keys = buildRollingWeekDateKeys();
        const next = Array.isArray(activities) ? [...activities] : [];
        let changed = false;

        run.recurringActs.forEach((pattern) => {
            const match = pattern.match(/^(.+?) on (\w+)s\b/i);
            if (!match) return;
            const label = match[1].trim();
            const dow = DAY_NAMES.indexOf(match[2].toLowerCase());
            if (dow < 0) return;
            const dateKey = keys.find((key) => parseDateKey(key).getDay() === dow);
            if (!dateKey) return;
            if (next.some((activity) => activity?.dateKey === dateKey && String(activity?.label || '').toLowerCase() === label.toLowerCase())) return;
            const pretty = label.charAt(0).toUpperCase() + label.slice(1);
            next.push({ day: formatDayLabel(dateKey), time: '', emoji: '📅', label: pretty, dateKey, startTime: '', endTime: '', _origLabel: pretty });
            changed = true;
        });

        if (changed) {
            await AsyncStorage.setItem('rv4_activities', JSON.stringify(next));
            await pushChangedFromStorage?.({ activities: next });
            await refreshAfterWrite();
        }
        return changed;
    };

    const approveWeek = () => {
        const run = session.current;
        setPanel(null);
        if (run.recurringActs.length) {
            goStep('activities');
            say(t('psp_activities_prompt', { acts: run.recurringActs.slice(0, 2).join(` ${t('psp_and')} `) }));
            setChips([
                { label: t('psp_yes_add_btn'), intent: 'yes' },
                { label: t('psp_no_thanks_btn'), intent: 'no' },
            ]);
            return;
        }
        proceedToIngredients();
    };

    const changeInFamilyHub = () => {
        onClose();
        navigation?.navigate('Family');
    };

    // ── "about your household": a few tap-to-answer questions before planning ──

    const ABOUT_PREFS_KEY = 'fern_shopper_prefs'; // device-only, remembers the last answers

    const aboutQuestions = () => [
        {
            key: 'householdSize',
            prompt: t('psp_about_q_people'),
            chips: [['1', 'psp_about_people_1'], ['2', 'psp_about_people_2'], ['4', 'psp_about_people_4'], ['6', 'psp_about_people_6']],
            parse: (text) => { const n = parseInt(String(text).replace(/\D+/g, ''), 10); return n > 0 && n < 30 ? String(n) : null; },
        },
        {
            key: 'dietary',
            prompt: t('psp_about_q_diet'),
            chips: [['none', 'psp_about_diet_none'], ['vegetarian', 'psp_about_diet_vegetarian'], ['gluten-free', 'psp_about_diet_glutenfree'], ['dairy-free', 'psp_about_diet_dairyfree'], ['nut-free', 'psp_about_diet_nutfree']],
            parse: (text) => String(text).trim().slice(0, 80) || null,
        },
        {
            key: 'dinnersWanted',
            prompt: t('psp_about_q_dinners'),
            chips: [['3', 'psp_about_dinners_3'], ['5', 'psp_about_dinners_5'], ['7', 'psp_about_dinners_7']],
            parse: (text) => { const n = parseInt(String(text).replace(/\D+/g, ''), 10); return n >= 1 && n <= 7 ? String(n) : null; },
        },
        {
            key: 'vibe',
            prompt: t('psp_about_q_vibe'),
            chips: [['quick and easy weeknight meals', 'psp_about_vibe_quick'], ['comfort food', 'psp_about_vibe_comfort'], ['new and adventurous dishes', 'psp_about_vibe_new']],
            parse: (text) => String(text).trim().slice(0, 80) || null,
        },
    ];

    const askAboutQuestion = (run) => {
        const q = aboutQuestions()[run.aboutQ];
        if (!q) return;
        say(q.prompt);
        setChips(q.chips.map(([value, labelKey]) => ({ label: t(labelKey), intent: `ans:${value}` })));
    };

    const startAbout = async () => {
        const run = session.current;
        setPanel(null);
        goStep('about');
        run.aboutQ = 0;
        const saved = await readJson(ABOUT_PREFS_KEY, null);
        if (run !== session.current) return;
        if (saved && saved.householdSize && saved.dinnersWanted) {
            run.profile = { ...saved };
            const diet = saved.dietary && saved.dietary !== 'none' ? saved.dietary : t('psp_about_diet_none').toLowerCase();
            say(t('psp_about_remembered', { people: saved.householdSize, diet, dinners: saved.dinnersWanted }));
            setChips([{ label: t('psp_about_keep_btn'), intent: 'ans:keep' }, { label: t('psp_about_change_btn'), intent: 'ans:change' }]);
            return;
        }
        say(t('psp_about_intro'));
        askAboutQuestion(run);
    };

    const finishAbout = async () => {
        const run = session.current;
        run.aboutDone = true;
        try {
            await AsyncStorage.setItem(ABOUT_PREFS_KEY, JSON.stringify(run.profile));
        } catch (e) {
            console.log('[personal-shopper] could not save household answers', e?.message || e);
        }
        say(t('psp_about_done'));
        proceedToStaplesAfterCircular();
    };

    const handleAboutAnswer = async (text, explicitIntent) => {
        const run = session.current;
        const answered = typeof explicitIntent === 'string' && explicitIntent.startsWith('ans:') ? explicitIntent.slice(4) : null;

        if (answered === 'keep') { await finishAbout(); return; }
        if (answered === 'change') { run.profile = {}; run.aboutQ = 0; askAboutQuestion(run); return; }

        const q = aboutQuestions()[run.aboutQ];
        if (!q) { await finishAbout(); return; }
        // A chip carries its value; a typed reply is parsed. Unparseable replies just re-ask.
        const value = answered != null ? answered : q.parse(text);
        if (!value) { askAboutQuestion(run); return; }
        run.profile[q.key] = value;
        run.aboutQ += 1;
        if (run.aboutQ >= aboutQuestions().length) await finishAbout();
        else askAboutQuestion(run);
    };

    // ── step 1: staples ──────────────────────────────────────────────────────

    const stapleChips = () => [
        { label: t('psp_staples_yes_btn'), intent: 'yes' },
        { label: t('psp_staples_no_btn'), intent: 'no' },
        { label: t('psp_staples_some_btn'), intent: 'some' },
    ];

    const startStaples = () => {
        goStep('staples');
        setPanel(null);
        say(t('psp_staples_prompt'));
        setChips(stapleChips());
    };

    // Staples are answered first; dinners follow.
    const proceedToDinners = async () => {
        setPanel(null);
        setChips([]);
        say(t('psp_got_it_dinners'));
        goStep('dinners');
        await suggestDinners(session.current);
    };

    const proceedToIngredients = async () => {
        setPanel(null);
        setChips([]);
        say(t('psp_got_it_ingredients'));
        await startIngredients();
    };

    const handleStaplesIntent = async (intent) => {
        const run = session.current;
        if (intent === 'yes') {
            run.staplesHave = [...STAPLES];
            await proceedToDinners();
        } else if (intent === 'no') {
            STAPLES.forEach((name) => addListItem(run, name, ''));
            await proceedToDinners();
        } else if (intent === 'some') {
            say(t('psp_staples_pick_prompt'));
            setPanel({ type: 'staples', items: STAPLES.map((name) => ({ name, checked: false })) });
        }
    };

    const confirmStaples = async () => {
        const run = session.current;
        (panel?.items || []).forEach((item) => {
            if (item.checked) addListItem(run, item.name, '');
            else run.staplesHave.push(item.name);
        });
        await proceedToDinners();
    };

    // ── step 4: ingredients, one dinner at a time ────────────────────────────

    const startIngredients = async () => {
        const run = session.current;
        goStep('ingredients');
        const mealPlan = await readJson('rv4_meal_plan', {});
        const saved = Array.isArray(data?.recipes) ? data.recipes : [];
        const seen = new Set();
        const recipes = [];

        buildRollingWeekDateKeys().forEach((key) => {
            (Array.isArray(mealPlan[key]) ? mealPlan[key] : []).forEach((entry) => {
                const title = String(entry?.title || '').replace(/\s*\(exact match\)/gi, '').trim();
                const lookup = title.toLowerCase();
                if (!title || seen.has(lookup)) return;
                seen.add(lookup);
                const match = saved.find((recipe) => String(recipe?.title || '').trim().toLowerCase() === lookup);
                const ingredients = match ? (toList(match.ingredients).length ? toList(match.ingredients) : toList(match._ingredients)) : [];
                // null = not a saved recipe (e.g. a fresh AI suggestion) — its
                // ingredients are fetched when its turn comes.
                recipes.push({ title, ingredients: ingredients.length ? ingredients : null });
            });
        });

        run.recipes = recipes;
        run.recipeIdx = 0;
        await nextIngredients();
    };

    const nextIngredients = async () => {
        const run = session.current;
        if (run.recipeIdx >= run.recipes.length) {
            await finishList();
            return;
        }

        const recipe = run.recipes[run.recipeIdx];
        setTyping(true);
        setPanel(null);
        setChips([]);
        try {
            let ingredients = recipe.ingredients;
            if (!ingredients) {
                const detail = await fetchMealPlanRecipeDetail({ title: recipe.title, locale, token });
                if (run !== session.current) return;
                ingredients = toList(detail?.ingredients);
                recipe.ingredients = ingredients;
            }
            if (!ingredients.length) throw new Error('recipe has no ingredients');

            let needed;
            let alreadyHave;
            try {
                const res = await fetchNeededIngredients({
                    title: recipe.title,
                    ingredients,
                    alreadyHave: run.staplesHave,
                    onList: run.listItems.map((item) => item.name.toLowerCase()),
                });
                needed = res.needed;
                alreadyHave = res.alreadyHave;
            } catch (e) {
                console.log('[personal-shopper] ingredient check failed, listing everything', e?.message || e);
                needed = ingredients;
                alreadyHave = [];
            }
            if (run !== session.current) return;
            setTyping(false);

            if (!needed.length) {
                say(t('psp_all_set_for', { title: recipe.title }));
                run.recipeIdx += 1;
                setTimeout(() => {
                    if (run === session.current) nextIngredients();
                }, 600);
                return;
            }

            setPanel({
                type: 'ingredients',
                title: recipe.title,
                items: needed.map((text) => ({ text, checked: true })),
                alreadyHave,
            });
            setChips([{ label: t('psp_skip_recipe_btn'), intent: 'next' }]);
        } catch (e) {
            console.log('[personal-shopper] recipe lookup failed', e?.message || e);
            if (run !== session.current) return;
            setTyping(false);
            say(t('psp_recipe_lookup_failed', { title: recipe.title }));
            run.recipeIdx += 1;
            await nextIngredients();
        }
    };

    const confirmIngredients = async () => {
        const run = session.current;
        const recipe = run.recipes[run.recipeIdx];
        const checked = (panel?.items || []).filter((item) => item.checked).map((item) => item.text);
        checked.forEach((name) => addListItem(run, name, recipe?.title || ''));
        userSays(t(checked.length === 1 ? 'psp_items_added_singular' : 'psp_items_added_plural', { n: checked.length, title: recipe?.title || '' }));
        setPanel(null);
        run.recipeIdx += 1;
        await nextIngredients();
    };

    const skipRecipe = async () => {
        const run = session.current;
        run.recipeIdx += 1;
        await nextIngredients();
    };

    // ── step 5: sorted shopping list ─────────────────────────────────────────

    // Writes everything gathered into the real shopping list (rv4_master_shop),
    // grouped by the recipe it came from, then syncs.
    const addPlannedItemsToShoppingList = async (run) => {
        if (!run.listItems.length) return;
        const groups = new Map();
        run.listItems.forEach((item) => {
            groups.set(item.fromRecipe, [...(groups.get(item.fromRecipe) || []), item.name]);
        });

        let shopping = await readJson('rv4_master_shop', []);
        let index = 0;
        for (const [title, ingredients] of groups) {
            const result = await addRecipeIngredientsToShoppingList(
                { id: `personal-shopper-${index}`, title: title || 'Personal Shopper', ingredients },
                shopping,
            );
            shopping = result.nextShopping;
            index += 1;
        }
        await pushChangedFromStorage?.({ shopping });
        await refreshAfterWrite();
    };

    const finishList = async () => {
        const run = session.current;
        goStep('listcheck');
        setPanel(null);
        setChips([]);
        say(t('psp_list_ready_msg'));
        setTyping(true);

        const names = run.listItems.map((item) => item.name);
        let sections = [];
        try {
            if (names.length) sections = await buildSortedShoppingList({ items: names, locale });
        } catch (e) {
            console.log('[personal-shopper] build list failed', e?.message || e);
        }
        if (run !== session.current) return;
        if (names.length && !sections.length) {
            sections = [{ id: 'all', name: t('psp_list_all_items'), emoji: '🛒', items: names }];
        }

        try {
            await addPlannedItemsToShoppingList(run);
        } catch (e) {
            console.log('[personal-shopper] adding to shopping list failed', e?.message || e);
            Alert.alert(t('save_failed'), t('save_error_desc'));
        }
        if (run !== session.current) return;
        setTyping(false);
        setPanel({ type: 'list', sections, done: {}, added: [] });
    };

    const addManualListItem = async () => {
        const name = listInput.trim();
        if (!name || panel?.type !== 'list') return;
        setListInput('');
        try {
            const shopping = await readJson('rv4_master_shop', []);
            if (!shopping.some((item) => String(item?.text || '').trim().toLowerCase() === name.toLowerCase())) {
                const next = [...shopping, { id: `manual-${Date.now()}`, text: name, recipe: 'Manual Add', checked: false }];
                await AsyncStorage.setItem('rv4_master_shop', JSON.stringify(next));
                const cache = await readJson('fern_sync_cache', {});
                await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({ ...cache, shopping: next }));
                await pushChangedFromStorage?.({ shopping: next });
                await refreshAfterWrite();
            }
            setPanel((prev) => (prev?.type === 'list' && !prev.added.includes(name) ? { ...prev, added: [...prev.added, name] } : prev));
        } catch (e) {
            console.log('[personal-shopper] adding item failed', e?.message || e);
            Alert.alert(t('save_failed'), t('save_error_desc'));
        }
    };

    const finishPlanning = () => {
        onClose();
        navigation?.navigate('Shopping');
        Alert.alert(t('psp_all_set_title'), t('psp_all_set_desc'));
    };

    // ── typed replies and chips ──────────────────────────────────────────────

    const handleUserReply = async (rawText, explicitIntent) => {
        const text = String(rawText || '').trim();
        if (!text || busy || typing) return;
        const run = session.current;
        const intent = explicitIntent || inferIntent(text);
        const stepNow = run.step;

        setInput('');
        setChips([]);
        userSays(text);

        if (stepNow === 'circular' && run.storedDeals.length && (intent === 'usedeals' || intent === 'yes')) {
            run.deals = run.storedDeals.flatMap((k) => k.deals);
            run.dealsStore = run.storedDeals.length === 1 ? run.storedDeals[0].store : '';
            proceedToStaplesAfterCircular();
            return;
        }
        if (stepNow === 'circular' && intent === 'scannew') {
            say(t('psp_circular_prompt_nostore'));
            setPanel({ type: 'circular' });
            return;
        }
        if (stepNow === 'about') {
            await handleAboutAnswer(text, explicitIntent);
            return;
        }

        if (intent === 'retry') {
            await suggestDinners(run);
            return;
        }
        if (stepNow === 'dinners' && intent === 'yes') {
            if (panel?.type === 'dinners') await confirmDinners();
            else await showWeekReview();
            return;
        }
        if (stepNow === 'hubcheck' && intent === 'yes') {
            approveWeek();
            return;
        }
        if (stepNow === 'activities') {
            if (intent === 'yes') {
                try {
                    if (await addRecurringActivities(run)) say(t('psp_activities_added'));
                } catch (e) {
                    console.log('[personal-shopper] adding activities failed', e?.message || e);
                }
            }
            await proceedToIngredients();
            return;
        }
        if (stepNow === 'staples' && (intent === 'yes' || intent === 'no' || intent === 'some')) {
            await handleStaplesIntent(intent);
            return;
        }
        if (stepNow === 'ingredients' && intent === 'next') {
            await skipRecipe();
            return;
        }
        if (stepNow === 'listcheck' && (intent === 'no' || intent === 'yes')) {
            finishPlanning();
            return;
        }

        // Anything else: open conversation with Fern.
        setTyping(true);
        try {
            const earlier = run.history.slice(0, -1); // the backend appends `userMessage` itself
            const trimmed = earlier.length > 21 && earlier[0]?.role === 'system' ? [earlier[0], ...earlier.slice(-20)] : earlier;
            const reply = await chatWithPersonalShopper({ conversationHistory: trimmed, userMessage: text, locale });
            if (run !== session.current) return;
            setTyping(false);
            say(reply || t('psp_chat_error'));
        } catch (e) {
            console.log('[personal-shopper] chat failed', e?.message || e);
            if (run !== session.current) return;
            setTyping(false);
            say(t('psp_chat_error'));
        }
        if (run !== session.current) return;
        if (stepNow === 'dinners') setChips([{ label: t('psp_chip_those_work'), intent: 'yes' }, { label: t('psp_chip_all_of_them'), intent: 'yes' }]);
        else if (stepNow === 'staples') setChips(stapleChips());
        else if (stepNow === 'ingredients') setChips([{ label: t('psp_skip_recipe_btn'), intent: 'next' }]);
        else if (stepNow === 'listcheck') setChips([{ label: t('psp_chip_thats_everything'), intent: 'no' }]);
    };

    const togglePanelItem = (index) => {
        setPanel((prev) => (prev?.items
            ? { ...prev, items: prev.items.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item)) }
            : prev));
    };

    const toggleListItem = (key) => {
        setPanel((prev) => (prev?.type === 'list' ? { ...prev, done: { ...prev.done, [key]: !prev.done[key] } } : prev));
    };

    // ── render ───────────────────────────────────────────────────────────────

    const baseMeta = STEP_META[step] || STEP_META.dinners;
    // The flyer step is step 1 when present, which pushes the others down by one.
    const meta = { ...baseMeta, n: baseMeta.n + (circularMode && step !== 'circular' ? 1 : 0) };

    const renderPanel = () => {
        if (!panel) return null;

        if (panel.type === 'circular') {
            return (
                <View style={styles.panelCard}>
                    <Text style={styles.shareNote}>{t('scan_share_note')}</Text>
                    <TouchableOpacity style={styles.orangeBtn} activeOpacity={0.85} onPress={() => scanFlyer(true)}>
                        <Text style={styles.orangeBtnText}>{t('psp_circular_take_btn')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.greenBtn} activeOpacity={0.85} onPress={() => scanFlyer(false)}>
                        <Text style={styles.greenBtnText}>{t('psp_circular_choose_btn')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.85} onPress={skipFlyer}>
                        <Text style={styles.ghostBtnText}>{t('psp_circular_skip_btn')}</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (panel.type === 'dinners') {
            return (
                <View style={styles.panelCard}>
                    <Text style={styles.panelTitle}>{t('psp_dinners_heading')}</Text>
                    {panel.items.map((item, index) => (
                        <TouchableOpacity key={item.dateKey} style={styles.checkRow} activeOpacity={0.8} onPress={() => togglePanelItem(index)}>
                            <Checkbox checked={item.checked} />
                            <View style={styles.checkRowText}>
                                <Text style={styles.checkRowTitle}>{item.title}</Text>
                                <Text style={styles.checkRowSub}>{item.dayLabel}{item.reason ? ` · ${item.reason}` : ''}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                        style={[styles.orangeBtn, busy ? styles.btnDisabled : null]}
                        activeOpacity={0.85}
                        onPress={confirmDinners}
                        disabled={busy}
                    >
                        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.orangeBtnText}>{t('psp_add_to_week_btn')}</Text>}
                    </TouchableOpacity>
                </View>
            );
        }

        if (panel.type === 'week') {
            return (
                <View style={styles.panelCard}>
                    <Text style={styles.panelTitle}>{t('psp_week_title')}</Text>
                    <Text style={styles.panelDesc}>{t('psp_week_desc')}</Text>
                    {panel.days.map((day) => (
                        <View key={day.key} style={[styles.dayCard, day.isToday ? styles.dayCardToday : null]}>
                            <Text style={[styles.dayLabel, day.isToday ? styles.dayLabelToday : null]}>
                                {day.label}{day.isToday ? ` · ${t('psp_today')}` : ''}
                            </Text>
                            {day.meals.length ? day.meals.map((meal) => (
                                <Text key={`${day.key}-${meal.slot}`} style={styles.dayMeal}>
                                    <Text style={styles.daySlot}>{`${meal.slot}  `}</Text>{meal.title}
                                </Text>
                            )) : <Text style={styles.dayEmpty}>{t('psp_no_meals_planned')}</Text>}
                            {day.acts.map((activity, index) => (
                                <Text key={`${day.key}-act-${index}`} style={styles.dayAct}>
                                    {`${activity.emoji || '📅'} ${activity.label}${activity.startTime ? ` · ${activity.startTime}` : ''}`}
                                </Text>
                            ))}
                        </View>
                    ))}
                    <TouchableOpacity style={styles.greenBtn} activeOpacity={0.85} onPress={approveWeek}>
                        <Text style={styles.greenBtnText}>{t('psp_week_looks_good_btn')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.85} onPress={changeInFamilyHub}>
                        <Text style={styles.ghostBtnText}>{t('psp_week_make_changes_btn')}</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (panel.type === 'staples') {
            return (
                <View style={styles.panelCard}>
                    {panel.items.map((item, index) => (
                        <TouchableOpacity key={item.name} style={styles.checkRow} activeOpacity={0.8} onPress={() => togglePanelItem(index)}>
                            <Checkbox checked={item.checked} />
                            <Text style={styles.checkRowTitle}>{item.name}</Text>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={styles.orangeBtn} activeOpacity={0.85} onPress={confirmStaples}>
                        <Text style={styles.orangeBtnText}>{t('psp_staples_add_btn')}</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (panel.type === 'ingredients') {
            return (
                <View style={styles.panelCard}>
                    <Text style={styles.panelTitle}>{t('psp_ingredients_for', { title: panel.title })}</Text>
                    <Text style={styles.panelDesc}>{t('psp_check_what_to_buy')}</Text>
                    {panel.items.map((item, index) => (
                        <TouchableOpacity key={`${item.text}-${index}`} style={styles.checkRow} activeOpacity={0.8} onPress={() => togglePanelItem(index)}>
                            <Checkbox checked={item.checked} />
                            <Text style={styles.checkRowTitle}>{item.text}</Text>
                        </TouchableOpacity>
                    ))}
                    {panel.alreadyHave.length ? (
                        <Text style={styles.alreadyHave}>{t('psp_already_have', { items: panel.alreadyHave.join(', ') })}</Text>
                    ) : null}
                    <TouchableOpacity style={styles.orangeBtn} activeOpacity={0.85} onPress={confirmIngredients}>
                        <Text style={styles.orangeBtnText}>{t('psp_add_checked_btn')}</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (panel.type === 'list') {
            return (
                <View style={styles.panelCard}>
                    <Text style={styles.panelTitle}>{`🛒 ${t('psp_list_heading')}`}</Text>
                    <Text style={styles.panelDesc}>{t('psp_list_desc')}</Text>

                    <View style={styles.addItemRow}>
                        <TextInput
                            value={listInput}
                            onChangeText={setListInput}
                            placeholder={t('psp_list_add_placeholder')}
                            placeholderTextColor="#B0AEA9"
                            style={styles.addItemInput}
                            returnKeyType="done"
                            onSubmitEditing={addManualListItem}
                        />
                        <TouchableOpacity style={styles.addItemBtn} activeOpacity={0.85} onPress={addManualListItem}>
                            <Text style={styles.addItemBtnText}>+</Text>
                        </TouchableOpacity>
                    </View>

                    {!panel.sections.length && !panel.added.length ? (
                        <Text style={styles.emptyList}>{t('psp_list_empty')}</Text>
                    ) : null}

                    {panel.sections.map((section) => (
                        <View key={section.id} style={styles.sectionBlock}>
                            <Text style={styles.sectionHeader}>{`${section.emoji} ${section.name}`.toUpperCase()}</Text>
                            {section.items.map((item, index) => {
                                const key = `${section.id}:${item}:${index}`;
                                return (
                                    <TouchableOpacity key={key} style={styles.checkRow} activeOpacity={0.8} onPress={() => toggleListItem(key)}>
                                        <Checkbox checked={Boolean(panel.done[key])} />
                                        <Text style={[styles.checkRowTitle, panel.done[key] ? styles.struck : null]}>{item}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ))}

                    {panel.added.length ? (
                        <View style={styles.sectionBlock}>
                            <Text style={styles.sectionHeader}>{t('psp_list_added_header')}</Text>
                            {panel.added.map((item) => {
                                const key = `added:${item}`;
                                return (
                                    <TouchableOpacity key={key} style={styles.checkRow} activeOpacity={0.8} onPress={() => toggleListItem(key)}>
                                        <Checkbox checked={Boolean(panel.done[key])} />
                                        <Text style={[styles.checkRowTitle, panel.done[key] ? styles.struck : null]}>{item}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ) : null}

                    <TouchableOpacity style={styles.orangeBtn} activeOpacity={0.85} onPress={finishPlanning}>
                        <Text style={styles.orangeBtnText}>{t('psp_ready_btn')}</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return null;
    };

    return (
        <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={[styles.screen, { paddingTop: insets.top }]}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.header}>
                    <View style={styles.headerText}>
                        <Text style={styles.headerKicker}>
                            {phase === 'chat'
                                ? `🌿 ${t('psp_step_of', { n: meta.n })}`
                                : `🌿 ${t('tool_personal_shopper')}`}
                        </Text>
                        <Text style={styles.headerTitle}>{phase === 'chat' ? t(meta.labelKey) : t('psp_intro_title')}</Text>
                    </View>
                    <TouchableOpacity style={styles.headerClose} activeOpacity={0.85} onPress={onClose}>
                        <Text style={styles.headerCloseText}>✕</Text>
                    </TouchableOpacity>
                </View>

                {phase === 'intro' ? (
                    <View style={styles.introWrap}>
                        <Text style={styles.introEmoji}>🛒</Text>
                        <Text style={styles.introDesc}>{t('psp_intro_desc')}</Text>
                        <TouchableOpacity style={styles.greenBtn} activeOpacity={0.85} onPress={startPlanning}>
                            <Text style={styles.greenBtnText}>{t('psp_intro_plan_btn')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.ghostBtn}
                            activeOpacity={0.85}
                            onPress={() => {
                                onClose();
                                navigation?.navigate('Shopping');
                            }}
                        >
                            <Text style={styles.ghostBtnText}>{t('psp_intro_list_btn')}</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <ScrollView
                            ref={scrollRef}
                            style={styles.chat}
                            contentContainerStyle={styles.chatContent}
                            keyboardShouldPersistTaps="handled"
                            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                        >
                            {messages.map((message) => (
                                <View
                                    key={message.id}
                                    style={[styles.bubble, message.role === 'user' ? styles.bubbleUser : styles.bubbleFern]}
                                >
                                    <Text style={[styles.bubbleText, message.role === 'user' ? styles.bubbleTextUser : null]}>{message.text}</Text>
                                </View>
                            ))}
                            {typing ? (
                                <View style={[styles.bubble, styles.bubbleFern, styles.typingBubble]}>
                                    <ActivityIndicator size="small" color={colors.forest} />
                                    <Text style={styles.typingText}>{t('psp_typing')}</Text>
                                </View>
                            ) : null}
                            {renderPanel()}
                        </ScrollView>

                        {chips.length ? (
                            <View style={styles.chipsRow}>
                                {chips.map((chip) => (
                                    <TouchableOpacity
                                        key={chip.label}
                                        style={styles.chip}
                                        activeOpacity={0.85}
                                        onPress={() => handleUserReply(chip.label, chip.intent)}
                                    >
                                        <Text style={styles.chipText}>{chip.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : null}

                        <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                            <TextInput
                                value={input}
                                onChangeText={setInput}
                                placeholder={t('psp_input_placeholder')}
                                placeholderTextColor="#B0AEA9"
                                style={styles.input}
                                returnKeyType="send"
                                onSubmitEditing={() => handleUserReply(input)}
                                editable={!busy}
                            />
                            <TouchableOpacity
                                style={[styles.sendBtn, (!input.trim() || typing || busy) ? styles.btnDisabled : null]}
                                activeOpacity={0.85}
                                onPress={() => handleUserReply(input)}
                                disabled={!input.trim() || typing || busy}
                            >
                                <Text style={styles.sendBtnText}>{t('psp_send_btn')}</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    shareNote: { fontFamily: 'Jost-Regular', fontSize: 12, lineHeight: 17, color: '#6B4A26', marginBottom: 10 },
    screen: { flex: 1, backgroundColor: colors.parch },
    header: {
        backgroundColor: colors.forest,
        paddingHorizontal: 18,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerText: { flex: 1 },
    headerKicker: { fontFamily: 'Jost-Bold', fontSize: 11, letterSpacing: 1.2, color: colors.sage, textTransform: 'uppercase' },
    headerTitle: { fontFamily: 'Playfair-Bold', fontSize: 18, color: '#F0E0B0', marginTop: 2 },
    headerClose: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.14)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCloseText: { color: '#F0E0B0', fontSize: 16 },

    introWrap: { flex: 1, padding: 24, justifyContent: 'center' },
    introEmoji: { fontSize: 54, textAlign: 'center', marginBottom: 12 },
    introDesc: {
        fontFamily: 'Jost-Regular',
        fontSize: 15,
        lineHeight: 22,
        color: colors.brown,
        textAlign: 'center',
        marginBottom: 24,
    },

    chat: { flex: 1 },
    chatContent: { padding: 16, paddingBottom: 24 },
    bubble: { maxWidth: '88%', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 10 },
    bubbleFern: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border },
    bubbleUser: { alignSelf: 'flex-end', backgroundColor: colors.forest },
    bubbleText: { fontFamily: 'Jost-Regular', fontSize: 15, lineHeight: 21, color: colors.ink },
    bubbleTextUser: { color: '#F0E0B0' },
    typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    typingText: { fontFamily: 'Jost-Regular', fontSize: 13, color: colors.brown, fontStyle: 'italic' },

    panelCard: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        padding: 14,
        marginTop: 4,
        marginBottom: 10,
    },
    panelTitle: { fontFamily: 'Playfair-Bold', fontSize: 17, color: colors.forest, marginBottom: 6 },
    panelDesc: { fontFamily: 'Jost-Regular', fontSize: 13, lineHeight: 19, color: colors.brown, marginBottom: 10 },

    checkRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 9,
        borderBottomWidth: 1,
        borderBottomColor: '#EFE6D8',
    },
    checkRowText: { flex: 1 },
    checkRowTitle: { flex: 1, fontFamily: 'Jost-SemiBold', fontSize: 15, color: colors.ink },
    checkRowSub: { fontFamily: 'Jost-Regular', fontSize: 12, color: colors.brown, marginTop: 2 },
    struck: { textDecorationLine: 'line-through', color: '#9A8D7A' },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: colors.orange,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1,
    },
    checkboxOn: { backgroundColor: colors.orange },
    checkboxMark: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', lineHeight: 16 },
    alreadyHave: { fontFamily: 'Jost-Regular', fontSize: 12, color: colors.brown, marginTop: 10 },

    dayCard: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.paper,
        padding: 10,
        marginBottom: 8,
    },
    dayCardToday: { borderColor: 'rgba(28,58,26,0.4)', backgroundColor: 'rgba(28,58,26,0.06)' },
    dayLabel: { fontFamily: 'Jost-Bold', fontSize: 12, letterSpacing: 0.8, color: colors.brown, textTransform: 'uppercase', marginBottom: 4 },
    dayLabelToday: { color: colors.forest },
    daySlot: { fontFamily: 'Jost-Regular', fontSize: 11, color: colors.brown },
    dayMeal: { fontFamily: 'Jost-SemiBold', fontSize: 14, color: colors.ink, paddingVertical: 1 },
    dayEmpty: { fontFamily: 'Jost-Regular', fontSize: 13, fontStyle: 'italic', color: '#A99A82' },
    dayAct: { fontFamily: 'Jost-Regular', fontSize: 12, color: colors.brown, marginTop: 3 },

    addItemRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    addItemInput: {
        flex: 1,
        backgroundColor: colors.parch,
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: radius.sm,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontFamily: 'Jost-Regular',
        fontSize: 15,
        color: colors.ink,
    },
    addItemBtn: {
        backgroundColor: colors.forest,
        borderRadius: radius.sm,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addItemBtnText: { color: '#F0E0B0', fontSize: 20, fontFamily: 'Jost-Bold' },
    emptyList: { fontFamily: 'Jost-Regular', fontSize: 14, color: colors.brown, textAlign: 'center', paddingVertical: 20 },
    sectionBlock: { marginTop: 10 },
    sectionHeader: { fontFamily: 'Jost-Bold', fontSize: 11, letterSpacing: 1.2, color: colors.brown, marginBottom: 2 },

    orangeBtn: { backgroundColor: colors.orange, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
    orangeBtnText: { fontFamily: 'Jost-Bold', fontSize: 14, color: '#FFFFFF' },
    greenBtn: { backgroundColor: colors.forest, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
    greenBtnText: { fontFamily: 'Jost-Bold', fontSize: 14, color: '#F0E0B0' },
    ghostBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
    ghostBtnText: { fontFamily: 'Jost-SemiBold', fontSize: 13, color: colors.brown },
    btnDisabled: { opacity: 0.5 },

    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
    chip: {
        backgroundColor: colors.paper,
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: 20,
        paddingVertical: 7,
        paddingHorizontal: 14,
    },
    chipText: { fontFamily: 'Jost-SemiBold', fontSize: 13, color: colors.ink },

    inputRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.parch,
    },
    input: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontFamily: 'Jost-Regular',
        fontSize: 15,
        color: colors.ink,
    },
    sendBtn: { backgroundColor: colors.forest, borderRadius: 22, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
    sendBtnText: { fontFamily: 'Jost-Bold', fontSize: 13, color: '#F0E0B0' },
});
