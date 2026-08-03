# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md
@DATAMODEL.md

DATAMODEL.md (imported above) has the exhaustive local-storage key inventory and Netlify-function API reference — this file stays conceptual/architectural, DATAMODEL.md has the exact field-by-field tables.

## Commands

```bash
npx expo start            # dev server (see "Do NOT use Expo Go" below)
npx expo run:ios           # build + run dev client on simulator/device
npx expo run:android       # build + run dev client on Android
eas build --platform ios --profile preview      # .ipa for internal distribution
eas build --platform android --profile preview  # .apk for internal distribution
eas update --branch production --message "..."  # push JS/UI-only update (no native changes)
```

There is no test suite, linter, or typechecker configured in this repo — `package.json` only has the four scripts above (`start`, `android`, `ios`, `web`).

**Do NOT use Expo Go.** This app depends on native modules (`expo-audio`, `expo-location` background geofencing) that Expo Go cannot run. Use a dev client build (`expo run:ios` / `expo run:android`) or an EAS build instead.

This project targets **Expo SDK 56**, which changed significantly from earlier SDKs (e.g. `expo-audio` replaces `expo-av`, `expo-file-system/legacy` is required for the old `FileSystem.writeAsStringAsync`/`uploadAsync` API). Always check current usage against https://docs.expo.dev/versions/v56.0.0/ before assuming an API from a prior SDK still applies.

## Architecture

**This is a thin native client over an existing web app's backend**, not a standalone app with its own API. There is no backend code in this repo — all server logic lives in Netlify functions hosted at `app.clickpickandcook.com/.netlify/functions/`. See [DATAMODEL.md](DATAMODEL.md#api-reference) for the full endpoint-by-endpoint reference (request/response shapes, every call site). One exception worth knowing up front: Groq Whisper transcription (`useContinuousMic.js`) is called **directly from the client** (`api.groq.com`, with `EXPO_PUBLIC_GROQ_KEY` embedded as a bearer token) rather than proxied through a Netlify function — everything else goes through `clickpickandcook.com`.

Supabase is used in two different, inconsistent ways:
- `src/hooks/useAuth.js` calls the custom `auth` Netlify function for login (not Supabase), but uses `supabase.auth.signUp`/`signOut` directly for signup/logout. It instantiates its own `createClient` separately from `src/lib/supabase.js` (which uses `expo-secure-store` for token storage, vs. `useAuth`'s own client using `AsyncStorage`). Be aware these are two distinct Supabase client instances with different storage adapters — don't assume changes to one affect the other.

**Local-first data with legacy storage keys.** `src/hooks/useSync.js` is the source of truth for app data: it loads a cached snapshot from `AsyncStorage` (`fern_sync_cache`) instantly, then silently refreshes from the `sync` Netlify function in the background. Pushes go through `pushChangedFromStorage`, which reads individual `AsyncStorage` keys, merges in changed fields, and POSTs the whole payload back. The individual key names (`rv4_saved`, `rv4_books`, `rv4_meal_plan`, `rv4_master_shop`, `remi_explicit`, `cpc_followed_bloggers`, `cpc_user_stores`) are carried over from the web app's own storage scheme (`rv4` = recipe vault, `remi` = an earlier assistant name, `cpc` = clickpickandcook) — they're required for sync compatibility with the web app, not arbitrary. `useAuth.js` independently writes the same keys after login/signup via its own `syncPull`, and it has genuinely drifted from `useSync.pull()` — it never writes `fern_sync_cache`, skips the corrupted-emoji repair pass, and signup can clobber a fresh `remi_explicit.userName` write with an empty server profile. See [DATAMODEL.md](DATAMODEL.md#usesyncjs-vs-useauthjs-known-divergence) for the exact divergence; keep the two write paths in sync if you touch either.

**Voice pipeline.** There are two parallel hooks for the same Groq-backed voice loop:
- `useContinuousMic` — always-listening hands-free mode with voice-activity detection (silence threshold `SILENCE_DB`/`SILENCE_MS` in the hook, auto-stops after `MAX_RECORDING_MS`), records via `expo-audio`, uploads to Groq Whisper directly from the client (`EXPO_PUBLIC_GROQ_KEY`), then round-trips through `ai` and `fern-speak` for a spoken reply, and re-arms itself after playback finishes. Gated at the `fern_voice_enabled` AsyncStorage flag (set from `AccountScreen`).
- `useFernVoice` — a simpler one-shot "speak this text" / "get a reply, optionally speak it" hook used by individual screens (no recording/VAD).

Both write synthesized speech to a local mp3 in `FileSystem.cacheDirectory` (manual base64 decode, since `expo-file-system/legacy` is used) and play it with `expo-audio`'s `useAudioPlayer`.

**Known dead/orphaned code** — don't build on these without checking they're actually wired up first:
- `src/hooks/useGeofence.js` — a fully-implemented polling geofence (2-minute `Location.getCurrentPositionAsync` interval, manual great-circle distance, 150m radius, 30-min per-store cooldown, local notification on arrival) that **nothing in `src/` imports**. `App.js` does call a similarly-named arrival-banner flow, but its `userStores` is hardcoded to `[]` ("Mock stores — replace with sync from useSync") — real store data (`cpc_user_stores`, populated in `HomeScreen.js`) was never wired into it.
- `src/screens/FindScreen.js` — a complete voice-chat UI, imported in `App.js` but never registered on any route. The `Find` tab actually renders `SearchScreen.js` (AI recipe search + bloggers), not this file. Looks like an earlier implementation of the tab that was superseded but never deleted.
- `src/components/modals/EventPlanResultModal.js` — a fully-built results view for the event/dinner-party planner, not imported anywhere; `EventPlannerIntakeModal.js` renders its results inline instead.
- `src/lib/tokens.js` — the stale/divergent copy of `src/constants/tokens.js`, zero import references left in `src/`. `src/lib/supabase.js` (referenced above) is separate and still live — don't confuse the two `lib/` files.

**Design tokens are duplicated.** `src/constants/tokens.js` (exports `colors`, `fonts`, lowercase) is what every screen actually imports. `src/lib/tokens.js` (capitalized `Colors`/`Fonts`, extra color values, different font fallbacks) is dead — see above.

## Screens & navigation

Provider nesting in `App.js` (outer → inner): `SafeAreaProvider → LanguageProvider → AccountModalProvider → PlansModalProvider → TourProvider → MainAppContent`. Auth gating happens in `MainAppContent`: `useAuth()` renders nothing while `loading`, `LoginScreen` directly (no navigator at all) when there's no `user`, or the full tab navigator once authenticated.

Bottom tab navigator (`AppNavigator` in `App.js`):

| Tab | Screen | Notes |
|---|---|---|
| `Home` | `HomeScreen.js` | Dashboard + launcher grid for nearly every AI feature. ~2835 lines — by far the largest screen; owns 6 separate `useAiRecipeCollection` instances and most of the feature-modal state. |
| `Find` | `SearchScreen.js` | AI recipe search (`ai` endpoint) + "Featured Food Bloggers" follow/browse. Despite the tab label, this is **not** `FindScreen.js` (see dead code above). |
| `Family` | `FamilyScreen.js` | "Family Hub" — a swipeable week-of-meals view driven by `useSync`'s `data.mealPlan` (`rv4_meal_plan`, keyed `YYYY-MM-DD`). The 7 displayed days are **always today → today+6**, recomputed fresh every render (`buildRollingWeekDateKeys`) rather than derived from whatever keys happen to exist in the synced data — so past days roll off automatically and the DINNERS/UNPLANNED stats can't drift past 7. Tapping any populated meal fetches its full recipe via `mealPlanRecipeService.fetchMealPlanRecipeDetail` (the `ai` endpoint) and opens the shared `RecipeDetailModal`. Tapping "+" on an empty Breakfast/Lunch opens `FamilyAddSavedMealModal` (search/pick from `data.recipes`); Dinner's own "+" and "Add Activity" are still stubs. "✦ AI Fill Week" calls `mealPlanRecipeService.fetchDinnerIdeas` for exactly as many ideas as there are empty-dinner days in the window, confirms via `Alert.alert`, then fills only those gaps. All writes (`add`/`remove`/`AI fill`) go through `pushChangedFromStorage({ meal_plan })`. PRO-gated with a non-dismissable `UpgradeGateModal` (`onClose` is a no-op) for non-PRO users. The screen's previous entire content — a continuous-mic voice-loop test harness — was extracted to `src/components/FamilyVoiceExampleScreen.js` and is still reachable via a small low-opacity "🧪" toggle in the top-right corner of Family Hub, kept for future voice-feature reference rather than deleted. |
| `Recipes` | `RecipesScreen.js` | Saved recipes + Cookbooks, toggled by an internal tab state; deep-linkable via `route.params.openTab`. |
| `Shopping` | `ShoppingScreen.js` | Hidden from the tab bar (`tabBarButton: () => null`); reached only via `navigationRef.navigate('Shopping')` from the geofence arrival banner or `AccountScreen`. |
| `More` | *(no screen)* | Intercepts `tabPress` to open a `MoreSheet` bottom sheet (Profile / Cookbooks / Help / Logout) instead of navigating. |

`AccountScreen` and `PlansScreen` are not routes — they're always-mounted overlays in `AppNavigator`, visibility driven by `AccountModalContext`/`PlansModalContext` rather than navigation. `LoginScreen` is likewise outside the navigator entirely, swapped in before `NavigationContainer` mounts. `ChatSheetModal` ("Ask Fern") and `TourModal`/`HelpModal` are also mounted globally in `App.js`, available from any tab via a floating action button.

Screens are large and self-contained — each fetches/normalizes its own data rather than going through shared state management (`SearchScreen.js` and `RecipesScreen.js` even have independent, duplicate "save a recipe to `rv4_saved`" implementations rather than sharing one). `src/utils/recipeNormalize.js` and the `src/services/*Service.js` files hold the shared normalization/fetch logic that *is* reused, mostly for the AI-generation features on `HomeScreen.js`.

## Features (modals)

Nearly every premium feature is a controlled modal component in `src/components/modals/`, rendered from `HomeScreen.js` (unless noted) and receiving all state/handlers as props rather than owning its own fetch logic. Every gated modal follows `if (visible && !hasAccess(TIER)) return <UpgradeGateModal .../>` and calls `maybeAutoStart('<tour_key>')` from `TourContext` on open (tour keys/content live in `src/constants/tourContent.js`). Tiers are `FREE` / `PRO` / `PRO_MAX` (`src/constants/tiers.js`); `useEntitlement()` is the single choke point to swap in real billing (currently hardcoded to `CURRENT_TIER = TIERS.PRO`, pending RevenueCat).

**AI recipe/meal generation** (all call a dedicated `src/services/*Service.js` → Netlify function, see DATAMODEL.md):
- `LeftoverMagicModal` (PRO) — photo or typed ingredients → recipe ideas.
- `FridgeChallengeModal` (PRO) — multi-step "what's in your fridge" photo/text flow → recipes, with a once-per-day cooldown (`fern_fridge_challenge_last_played`).
- `TwentyMinDinnerModal` (PRO) — quick-pick chips + ingredients → fast recipes.
- `SemiHomemadeModal` (PRO) — store-bought shortcut chips + custom items + vibe text → "doctored up" recipes.
- `CharcuterieModal` (PRO_MAX) — occasion/style/people/budget/dietary form → a full board plan; boards can be saved locally (`fern_saved_charcuterie_boards`, device-only, never synced).
- `BudgetPlannerModal` (PRO) — weekly/per-person budget form → 7 dinners + shopping list, with a confirm-step to pick which items actually get added.
- `WinePairingModal` (PRO_MAX) — typed dish → pairing summary + suggestions, add-to-list per wine.
- `NutritionTrackerModal` (PRO) — goal form → AI weekly analysis; goals/results cached locally (`fern_nutrition_goals`/`fern_nutrition_analysis`, device-only) so reopening restores the last result.

**Planning:**
- `EventPlannerIntakeModal` (PRO_MAX) — multi-question wizard (`EventPlannerQuestionFlow`/`EventPlannerQuestionTypes`) → full dinner-party menu plan, rendered inline (not via `EventPlanResultModal`, which is dead — see above).
- `ScanCircularModal` (ungated) — photograph a store flyer → detected sale items → AI "deal ideas" → recipes or shopping-list adds. Rendered by both `HomeScreen.js` and `SearchScreen.js`.

**Utility/account:**
- `AlexaSkillModal` (PRO_MAX) — static setup instructions, no dynamic data.
- `LanguageModal` (ungated) — EN/ES picker, backs `LanguageContext`.
- `HelpModal` (ungated), `ChatSheetModal` (ungated) — mounted globally by `App.js`, not per-screen.

**Shared infra components** (`src/components/`, not `modals/`): `RecipeDetailModal` (generic recipe viewer/editor reused across screens/modals), `UpgradeGateModal` (the paywall stand-in every gated modal renders), `TourModal` (onboarding bubble UI, global), `EventPlannerQuestionFlow`/`EventPlannerQuestionTypes` (the event planner's wizard engine).

## Translations (EN/ES)

All UI copy goes through a single i18n module, not per-screen strings:
- `src/constants/translations.js` — flat `{ en: {...}, es: {...} }` dictionary, **961 keys per locale**, verified key-for-key parity. A missing key on one side falls back silently to English via `useLanguage`'s `t()`, so a typo'd key won't crash, it'll just render the wrong language.
- `src/services/LanguageContext.js` — `LanguageProvider` (wraps the app in `App.js`) holds `locale` state, persists the choice to `AsyncStorage` under `fern_user_locale`, and exposes `t(key, params)` which does literal `{paramName}` substitution (e.g. `t('item_added_success', { item: itemName })` for a string like `"{item} was added..."`).
- `src/hooks/useLanguage.js` — thin `useContext` wrapper; every screen/component that renders user-facing text calls `const { t } = useLanguage();` directly (each component gets its own hook call — `t` is not threaded down as a prop, except `LanguageModal` which HomeScreen passes `t` into explicitly).
- `src/components/modals/LanguageModal.js` — the EN/ES picker sheet, opened from a button on `HomeScreen`.
- When adding new UI text: add the key to **both** `en` and `es` blocks in `translations.js` in the same edit (don't add English-only and leave Spanish to "later" — that's how the dictionary drifts out of sync), then call `t('your_key')` at the call site. Don't invent a key that duplicates existing copy — grep `translations.js` first (e.g. `already_saved_indicator`, `dish_required`, `save_error_desc` are intentionally reused across multiple screens for identical strings).
- Some data that flows into synced shopping-list payloads (e.g. `ShoppingScreen.js`'s `QUICK_ADD_ITEMS`/`FERN_STARTER_ITEMS` grocery names, and the `'Manual Add'`/`'Fern Starter'` `recipe` grouping field) is intentionally left untranslated — it's stored/synced with the web app's backend in English, and localizing it risks a mismatch with the web app's own data expectations (see the local-first sync note above).
