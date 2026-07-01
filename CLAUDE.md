# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

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

**This is a thin native client over an existing web app's backend**, not a standalone app with its own API. There is no backend code in this repo — all server logic lives in Netlify functions hosted at `app.clickpickandcook.com/.netlify/functions/`:

- `auth` — login (custom REST, not Supabase auth directly)
- `sync` — pull/push of all user data (recipes, meal plan, shopping list, etc.)
- `ai` — Fern AI chat replies (Groq-backed)
- `fern-speak` — text-to-speech, returns mp3 bytes
- `geocode` — store address → lat/lon lookup (used by geofencing)
- `recipe-tools` — wine pairing, recipe utilities
- `charcuterie-board`, `get-recipe-image` — other AI/content generation endpoints

Supabase is used in two different, inconsistent ways:
- `src/hooks/useAuth.js` calls the custom `auth` Netlify function for login (not Supabase), but uses `supabase.auth.signUp`/`signOut` directly for signup/logout. It instantiates its own `createClient` separately from `src/lib/supabase.js` (which uses `expo-secure-store` for token storage, vs. `useAuth`'s own client using `AsyncStorage`). Be aware these are two distinct Supabase client instances with different storage adapters — don't assume changes to one affect the other.

**Local-first data with legacy storage keys.** `src/hooks/useSync.js` is the source of truth for app data: it loads a cached snapshot from `AsyncStorage` (`fern_sync_cache`) instantly, then silently refreshes from the `sync` Netlify function in the background. Pushes go through `pushChangedFromStorage`, which reads individual `AsyncStorage` keys, merges in changed fields, and POSTs the whole payload back. The individual key names (`rv4_saved`, `rv4_books`, `rv4_meal_plan`, `rv4_master_shop`, `remi_explicit`, `cpc_followed_bloggers`, `cpc_user_stores`) are carried over from the web app's own storage scheme (`rv4` = recipe vault, `remi` = an earlier assistant name, `cpc` = clickpickandcook) — they're required for sync compatibility with the web app, not arbitrary. `useAuth.js` independently writes the same keys after login/signup, so the two write paths must be kept in sync if the schema changes.

**Voice pipeline.** There are two parallel hooks for the same Groq-backed voice loop:
- `useContinuousMic` — always-listening hands-free mode with voice-activity detection (silence threshold `SILENCE_DB`/`SILENCE_MS` in the hook, auto-stops after `MAX_RECORDING_MS`), records via `expo-audio`, uploads to Groq Whisper directly from the client (`EXPO_PUBLIC_GROQ_KEY`), then round-trips through `ai` and `fern-speak` for a spoken reply, and re-arms itself after playback finishes.
- `useFernVoice` — a simpler one-shot "speak this text" / "get a reply, optionally speak it" hook used by individual screens (no recording/VAD).

Both write synthesized speech to a local mp3 in `FileSystem.cacheDirectory` (manual base64 decode, since `expo-file-system/legacy` is used) and play it with `expo-audio`'s `useAudioPlayer`.

**Geofencing** (`src/hooks/useGeofence.js`) polls `Location.getCurrentPositionAsync` on a 2-minute interval (not OS-level geofencing) against a list of `{ name, lat, lon }` stores, computes great-circle distance manually, and fires a local notification + `onArrival` callback when within `GEOFENCE_RADIUS_M` (150m), with a 30-minute per-store cooldown. `App.js` currently passes an empty array as `userStores` ("Mock stores — replace with sync from useSync") — store geofencing is wired up but not yet fed real data.

**Design tokens are duplicated.** `src/constants/tokens.js` (exports `colors`, `fonts`, lowercase) is what screens actually import. `src/lib/tokens.js` (exports `Colors`, `Fonts`, capitalized, with extra color values) appears to be a stale/divergent copy — check which one a file imports before editing colors, and don't assume editing one updates the other.

**Navigation** is a single bottom tab navigator in `App.js` (`Home`, `Find`, `Family`, `Recipes`, `Shopping`, `Logout`). `Shopping` is reachable only programmatically (hidden tab button, opened via the store-arrival banner), and `Logout` is a tab that intercepts `tabPress` to sign out instead of navigating. Auth gating happens in `App.js` itself: `useAuth()` controls whether `LoginScreen` or the tab navigator renders.

Screens are large and self-contained (`HomeScreen.js` ~1700 lines, `SearchScreen.js` ~1400, `RecipesScreen.js` ~1180) — each screen fetches/normalizes its own data rather than going through shared state management; `src/utils/recipeNormalize.js` and the `src/services/*Service.js` files hold the shared normalization/fetch logic that's reused across screens and modals.

**Translations (EN/ES).** All UI copy goes through a single i18n module, not per-screen strings:
- `src/constants/translations.js` — flat `{ en: {...}, es: {...} }` dictionary. Both locales must stay key-for-key identical (currently 345 keys each) — a missing key on one side falls back silently to English via `useLanguage`'s `t()`, so a typo'd key won't crash, it'll just render the wrong language.
- `src/services/LanguageContext.js` — `LanguageProvider` (wraps the app in `App.js`) holds `locale` state, persists the choice to `AsyncStorage` under `fern_user_locale`, and exposes `t(key, params)` which does literal `{paramName}` substitution (e.g. `t('item_added_success', { item: itemName })` for a string like `"{item} was added..."`).
- `src/hooks/useLanguage.js` — thin `useContext` wrapper; every screen/component that renders user-facing text calls `const { t } = useLanguage();` directly (each component gets its own hook call — `t` is not threaded down as a prop, except `LanguageModal` which HomeScreen passes `t` into explicitly).
- `src/components/modals/LanguageModal.js` — the EN/ES picker sheet, opened from a button on `HomeScreen`.
- When adding new UI text: add the key to **both** `en` and `es` blocks in `translations.js` in the same edit (don't add English-only and leave Spanish to "later" — that's how the dictionary drifts out of sync), then call `t('your_key')` at the call site. Don't invent a key that duplicates existing copy — grep `translations.js` first (e.g. `already_saved_indicator`, `dish_required`, `save_error_desc` are intentionally reused across multiple screens for identical strings).
- Some data that flows into synced shopping-list payloads (e.g. `ShoppingScreen.js`'s `QUICK_ADD_ITEMS`/`FERN_STARTER_ITEMS` grocery names, and the `'Manual Add'`/`'Fern Starter'` `recipe` grouping field) is intentionally left untranslated — it's stored/synced with the web app's backend in English, and localizing it risks a mismatch with the web app's own data expectations (see the local-first sync note above).
