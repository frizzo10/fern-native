# DATAMODEL.md

Exhaustive reference for Fern Native's local persisted state and remote API surface. This is the companion doc to [CLAUDE.md](CLAUDE.md), which stays conceptual — this file has the exact field-by-field shapes. If you change a payload shape, an `AsyncStorage` key, or add a new Netlify function call, update this file in the same change.

There is no backend in this repo. Everything under "API reference" below is a remote Netlify function at `https://app.clickpickandcook.com/.netlify/functions/<name>`, except the one explicitly-flagged Groq call. The client is otherwise a thin, local-first cache over that remote API.

## Local-first sync architecture

`src/hooks/useSync.js` is the source of truth for app data at runtime. On mount it:
1. **Hydrates instantly** from the `fern_sync_cache` AsyncStorage key (`loadCache()`), so the UI has data before any network round-trip.
2. **Refreshes in the background** by POSTing `{ action: 'pull', userId, token }` to the `sync` function and re-persisting everything.

### `useSync.js` return shape

```js
data: {
  recipes: [],      // ← rv4_saved
  mealPlan: {},      // ← rv4_meal_plan
  shopping: [],       // ← rv4_master_shop
  books: [],            // ← rv4_books
  activities: [],        // only lives inside fern_sync_cache — no dedicated rv4_* key, pull-only (see below)
  followers: [],          // ← cpc_followed_bloggers
  userProfile: {},         // ← remi_explicit
  userStores: [],           // ← cpc_user_stores
  availableCoupons: [],      // ← available_coupons (server-owned catalog, pull-only — see below)
  walletCoupons: [],          // ← wallet_coupons
}
```

- **`pull()`** — POSTs `{ action: 'pull', userId, token }` to `sync`. Takes `result.data` (`saved`, `meal_plan`, `shopping`, `books`, `activities`, `followed_bloggers`, `remi_explicit`, `user_stores`, `available_coupons`, `wallet_coupons`), runs an emoji-corruption repair pass over `saved` (fixes `�`-corrupted `recipe.emoji` fields), maps it into the `data` shape above, calls `setData(next)`, then writes **both** the combined object to `fern_sync_cache` **and** each field out to its own individual key (`rv4_saved`, `rv4_books`, `rv4_meal_plan`, `rv4_master_shop`, `remi_explicit`, `cpc_followed_bloggers`, `cpc_user_stores`, `rv4_available_coupons`, `rv4_wallet_coupons`). If the emoji repair changed anything, it immediately pushes the fix back to the server (including `wallet_coupons`, so that push doesn't clobber it — `available_coupons` is intentionally excluded from every push, see below).
- **`push(payload)`** — thin wrapper: POSTs `{ action: 'push', userId, token, ...payload }` verbatim; caller supplies the full payload, no AsyncStorage read.
- **`pushChangedFromStorage(changedData = {})`** — reads the 8 canonical keys fresh off disk (the original 7 plus `rv4_wallet_coupons`), builds `data: { saved, books, meal_plan, shopping, remi_explicit, followed_bloggers, user_stores, wallet_coupons, ...changedData }` (so in-memory `changedData` fields override what's on disk), POSTs `{ action: 'push', userId, token, data }`. This is what screens call after any local mutation.
- **`pushAllFromStorage()`** — `pushChangedFromStorage()` with no overrides, i.e. "push whatever's currently on disk."
- **Gap:** there is no push path for `activities` or for partial `userProfile` fields beyond the whole `remi_explicit` blob — `activities` is pull-only. `available_coupons` is likewise pull-only by design — it's the server's coupon catalog, not user data, so the client never pushes it back; only `wallet_coupons` (the user's saved coupons) is round-tripped.

### `useSync.js` vs `useAuth.js` (known divergence)

`src/hooks/useAuth.js` has its own `syncPull(userId, token)`, called right after both login and signup, which independently POSTs `{ action: 'pull', userId, token }` to the same `sync` endpoint and writes the 7 individual keys (`rv4_saved`, `rv4_books`, `rv4_meal_plan`, `rv4_master_shop`, `remi_explicit`, `cpc_followed_bloggers`, `cpc_user_stores`). It has drifted from `useSync.pull()` in three ways worth knowing before touching either:

1. **It never writes `fern_sync_cache`.** Only the 7 individual keys get written, so immediately post-login/signup the combined cache is stale until `useSync`'s own `pull()` fires on the next render.
2. **It skips the emoji-corruption repair pass** that `useSync.pull()` runs on `saved` — recipes with corrupted emoji are written verbatim at login time.
3. **Signup can clobber its own write:** `signUpWithSupabase` writes `remi_explicit = { userName: name }` first, then calls `syncPull`, which overwrites `remi_explicit` with `d.remi_explicit || {}` from the server response — if the new user has no server-side profile yet, the just-set `userName` gets wiped back to `{}`.

If you change the sync payload shape or add a new synced field, update both `useSync.pull()`/`pushChangedFromStorage()` **and** `useAuth.syncPull()`, or these will silently drift further.

### Auth session storage (separate from the sync cache)

Two stores, not one:
- **SecureStore key `fern_user`** — the primary, encrypted session: `{ id, email, token, refreshToken, ...user fields }`. Written on silent refresh, on the refresh-token fallback during a failed login, on successful login, and on signup. Deleted on `signOut()`.
- **AsyncStorage key `rv4_auth`** — a secondary, non-secure duplicate of just `{ id, email, token, refreshToken }`, written alongside every `fern_user` write. Read back only as a fallback source of `refreshToken` when the REST login call fails. **`signOut()` does not clear it** — a stale `rv4_auth` entry can survive logout.

Neither of these two keys is touched by `useSync.js` — `useSync` only ever consumes the `user` object it's given as a prop/param.

## Local storage key reference

All keys are `AsyncStorage` unless marked SecureStore. "Synced" means the key is part of the `useSync.js` pull/push cycle described above; "device-only" means it never leaves the device.

| Key | Shape | Written by | Read by | Synced? |
|---|---|---|---|---|
| `fern_sync_cache` | `{ recipes, mealPlan, shopping, books, activities, followers, userProfile, userStores }` — full mirror of `useSync`'s `data`. Frequently patched by individual screens as a same-tick UI-optimism store (`{ ...cache, shopping: nextShopping }`) before/alongside a push. | `useSync.pull()`; read-modify-write from `HomeScreen.js`, `ShoppingScreen.js`, `SearchScreen.js`, `RecipesScreen.js`, `useAiRecipeCollection.js`, `EventPlannerIntakeModal.js`, `shoppingListSync.js` | `useSync.js` (`loadCache`, boot hydrate) | Synced (read-side cache; see divergence note — `useAuth.syncPull` does **not** write this key) |
| `rv4_saved` | Array of normalized recipe objects (title, ingredients[], instructions[], cuisine, mealType, time, difficulty, emoji, image, description, servings, id, note, etc. — shape from `src/utils/recipeNormalize.js`) | `useSync.pull()`; `useAuth.syncPull`; `SearchScreen.js`; `RecipesScreen.js`; `useAiRecipeCollection.js` (save/note/delete); `EventPlannerIntakeModal.js` | same set of files | Synced |
| `rv4_books` | Array of cookbook objects (`id`/`uuid`/`book_id`, `title`/`name`/`book_title`, ...) | `useSync.pull()`; `useAuth.syncPull`; `RecipesScreen.js` | `useSync.js`; `RecipesScreen.js` | Synced |
| `rv4_meal_plan` | Object keyed by `YYYY-MM-DD` → array of `{ slot, title, emoji, ... }` meal entries. Non-date keys may be prefixed `_` (filtered out when counting planned meals). | `useSync.pull()`; `useAuth.syncPull` | `useSync.js`; `HomeScreen.js`; `NutritionTrackerModal.js` | Synced |
| `rv4_master_shop` | Array of shopping items: `{ id, text, recipe, checked }` — `recipe` is a comma-joined string of contributing recipe titles, or the literal `'Manual Add'`/`'Fern Starter'`. | `useSync.pull()`; `useAuth.syncPull`; `HomeScreen.js`; `ShoppingScreen.js`; `src/utils/shoppingListSync.js` (`addRecipeIngredientsToShoppingList`) | same set of files | Synced |
| `remi_explicit` | Single object, the user profile bag — at minimum `{ userName }`, otherwise whatever the backend returns (`name`, `email`, etc). | `useSync.pull()`; `useAuth.syncPull`/`signUp` (see divergence note above) | `useSync.js` (as `data.userProfile`); `FindScreen.js` (dead code) | Synced |
| `cpc_followed_bloggers` | Array of `{ id, url, name, color, emoji, specialty }` | `useSync.pull()`; `useAuth.syncPull`; `SearchScreen.js` | `useSync.js`; `SearchScreen.js` | Synced |
| `cpc_user_stores` | Array of `{ lat, lng, name, address }` | `useSync.pull()`; `useAuth.syncPull`; `HomeScreen.js` | `useSync.js`; `HomeScreen.js` (this is the "real" store data App.js's geofence stub never receives — see CLAUDE.md dead-code note) | Synced |
| `rv4_available_coupons` | Array of raw coupon objects from the server's catalog — field names aren't nailed down against a real API sample yet, so `src/utils/couponNormalize.js`'s `normalizeCoupon` reads several likely aliases per field (`store`/`storeName`/`retailer`/`brand`, `discountLabel`/`badge`/`discount`/`savings`/`offerLabel`, `image`/`imageUrl`/`photo`, `expiresAt`/`expiry`/`validUntil`/`expirationDate`, etc.) | `useSync.pull()`; `useAuth.syncPull` | `useSync.js` (as `data.availableCoupons`); `HomeScreen.js`/`CouponWalletScreen.js` (Browse tab) | Pull-only — refreshed wholesale on every pull, never part of any push (it's the server's catalog, not user data) |
| `rv4_wallet_coupons` | Array of normalized coupon objects the user has added from Browse (full snapshot, not just IDs) | `HomeScreen.js` (`addCouponToWallet`/`removeCouponFromWallet`); `useSync.pull()`; `useAuth.syncPull` | `useSync.js` (as `data.walletCoupons`); `HomeScreen.js`/`CouponWalletScreen.js` (My Wallet tab, and the Home "Coupons" stat count) | Synced — pushed as `wallet_coupons` via `pushChangedFromStorage` |
| `rv4_auth` | `{ id, email, token, refreshToken }` | `useAuth.js` (mirrors every `fern_user` SecureStore write) | `useAuth.js` (refresh-token fallback on failed login) | Not synced — device auth bookkeeping only, and not cleared on sign-out |
| `fern_user` *(SecureStore, not AsyncStorage)* | `{ id, email, token, refreshToken, ...user fields }` | `useAuth.js` — primary session store | `useAuth.js` (read once on mount) | Not synced |
| `fern_saved_charcuterie_boards` | Array of `{ id: 'charcuterie-board-<ts>', createdAt, board }`, newest first | `HomeScreen.js` (`CharcuterieModal` save action) | `HomeScreen.js` | Device-only — saved boards do not survive reinstall/relogin on another device |
| `fern_fridge_challenge_last_played` | Plain date-key string (one Fridge Challenge per day gate) | `HomeScreen.js` | `HomeScreen.js`; `AccountScreen.js` (via `multiGet`, shown as a completed badge) | Device-only |
| `fern_nutrition_goals` | `{ calorieTarget, proteinGoal, carbLimit, dietaryFocus }` | `NutritionTrackerModal.js` | `NutritionTrackerModal.js` | Device-only |
| `fern_nutrition_analysis` | `{ goals, result: { days[], weekly_avg, tip, off_goal_days[], goal_recipe_suggestion }, analyzedAt }` | `NutritionTrackerModal.js` | `NutritionTrackerModal.js` (restores last result instead of the form on reopen) | Device-only |
| `fern_voice_enabled` | `'on'`/`'off'` string (legacy `'0'/'false'/'off'/'disabled'` also treated as off) | `AccountScreen.js` | `AccountScreen.js`; `useFernVoice.js`; `useContinuousMic.js` | Device-only |
| `fern_user_locale` | `'en'` or `'es'` | `LanguageContext.js` | `LanguageContext.js` | Device-only |
| `rv4_loyalty_card` | `{ phone_hash, points, tier, linkedCards[], message, linkedAt }` — `phone_hash` is a client-side SHA-256 of the digits-only phone number (`src/utils/sha256.js`); the raw phone number itself is never persisted or sent anywhere but the one `loyalty` match call. | `HomeScreen.js` (`LoyaltyCardModal` link action) | `HomeScreen.js` (drives the Home loyalty tile's linked/unlinked state) | Device-only — `rv4` prefix per the web app's naming scheme, but not part of the `useSync` pull/push cycle (no corresponding sync field exists server-side yet) |
| *(per-tour flags)* | One flag per entry in `TOUR_LIST` (`src/constants/tourContent.js`, ~20 tours — `home`, `find`, `recipes`, `shopping`, `charcuterie`, `wine_pairing`, `fridge_challenge`, `leftover_magic`, `quick_dinner`, `budget_planner`, `semi_homemade`, `alexa_skill`, `nutrition`, etc), keyed by each entry's own `storageKey` | `TourModal.js` (`finish()`) | `TourContext.js` (`maybeAutoStart`, gates whether a tour auto-opens); `AccountScreen.js` (bulk `multiGet` across all `TOUR_LIST` storage keys) | Device-only onboarding state, per device |

Not real storage keys, despite matching a `fern_*`/grep pattern: `fern_chat`, `fern_label`, `fern_thinking`, `fern_knows_title`, `fern_starter_stocked*` are i18n keys in `translations.js`, unrelated to `AsyncStorage`.

**No local entitlement/tier cache exists** — `useEntitlement.js` has zero `AsyncStorage` references; the tier is purely the hardcoded `CURRENT_TIER` constant today (see CLAUDE.md).

**Naming inconsistency, not a bug to "fix" casually:** `rv4_*` (recipe vault v4), `cpc_*` (clickpickandcook), `remi_*` (an earlier assistant name), and `fern_*` prefixes coexist because these keys mirror the **web app's** storage scheme for sync compatibility — see the "Local-first data" note in CLAUDE.md before renaming anything.

## API reference

All endpoints are `POST https://app.clickpickandcook.com/.netlify/functions/<name>` with `Content-Type: application/json` unless noted otherwise. Most calls also send a `User-Agent: FernApp/1.0 (myaifern.com)` header (a few inline call sites omit it — not meaningful, just inconsistent).

### `ai` — general-purpose AI proxy (heaviest-used endpoint, 10 call sites)

Two distinct payload shapes are in use:
- **Structured** (most callers): `{ system, messages: [{ role: 'user'|'assistant', content }], feature?, locale, token, userId? }`. Response: `json.content[].find(p => p.type === 'text').text` (fallback `json.message`/`json.reply`), then the caller loose-JSON-parses that text (regex-extracts the first `{...}`/`[...]` if `JSON.parse` fails outright).
- **Legacy/simple** (`HomeScreen.js`'s Family Hub voice flow only): `{ message, context: 'family_hub', userId, token, locale }` → response `{ reply }`. This is the one caller that doesn't use the `messages` array shape — don't copy it for new features.

Call sites and what each expects back:

| Caller | `feature` | Expects back |
|---|---|---|
| `fridgeChallengeService.fetchFridgeChallengeRecipes` | `recipe_search` | `{"recipes":[{"title","description","time","difficulty","ingredients":[{"amount","unit","item"}],"instructions":[""],"cuisine","emoji"}]}` — exactly 3 (Easy/Medium/Ambitious) |
| `leftoverMagicService.fetchLeftoverRecipes` | `recipe_search` | same shape as above |
| `scanCircularService.fetchDealRecipeIdeas` | `fern_chat` | JSON array of 3 `{"title","time","emoji","why"}` |
| `scanCircularService.fetchFullRecipeForDealIdea` | `recipe_search` | single `{"title","cuisine","mealType","time","difficulty","description","ingredients":[""],"instructions":[""],"emoji"}` |
| `useContinuousMic.processFernReply` / `useFernVoice.getFernReply` | *(none)* | `{ content: [{ text }] }` (or `{ data: { content: [...] } }`) — plain conversational reply, then optionally piped to `fern-speak` |
| `ChatSheetModal` (inline) | *(none)* | reply text parsed by `parseChatResponse` into `{ reply, add_to_shopping_list: [] }` |
| `NutritionTrackerModal` (inline) | `nutrition` | `{"days":[{"day","calories","protein","carbs","fat","goal_met","highlight"}],"weekly_avg":{"calories","protein","carbs","fat"},"tip","off_goal_days":[],"goal_recipe_suggestion"}` |
| `FindScreen.talkToFern` (inline, dead screen) | *(none)* | plain reply text |
| `SearchScreen.performSearch` (inline) | `recipe_search` | JSON array of 6 recipe objects, normalized via `normalizeAiRecipe` |
| `HomeScreen` Family Hub voice (inline) | — | legacy shape, see above |
| `mealPlanRecipeService.fetchMealPlanRecipeDetail` | *(none)* | `{"title","ingredients":[""],"directions":[""],"time","servings"}` — full recipe for a single meal-plan title, requested via `messages: [{ role: 'user', content: 'Give me the recipe for: <title>' }]` rather than a `feature` flag. Caller: `FamilyScreen.js` (tapping a planned meal); result is fed into the same `useAiRecipeCollection.viewRecipe`/`RecipeDetailModal` flow used everywhere else, so it also picks up an image via `get-recipe-image` automatically. |
| `mealPlanRecipeService.fetchDinnerIdeas` | *(none)* | JSON array of `{"title","emoji","cuisine","time"}` — one idea per empty dinner slot. `system` is `'Generate dinner ideas. Return ONLY a JSON array of objects: [{title,emoji,cuisine,time}]. No markdown.'`; the user message is `'Give me {count} different quick weeknight dinner ideas. Vary cuisines.'` where `{count}` is however many of the current rolling 7-day window's days are missing a Dinner entry. Caller: `FamilyScreen.js`'s "✦ AI Fill Week" button (`handleAiFillWeek`) — only fills the empty days, confirmed via `Alert.alert` first, then writes each idea's `{slot:'Dinner', title, emoji}` into `rv4_meal_plan` and pushes via `pushChangedFromStorage`. |

### `fern-speak` — text-to-speech

Payload: `{ text, locale, token }`. Response is **not JSON** — raw mp3 bytes read via `response.arrayBuffer()`, manually base64-encoded, written to `FileSystem.cacheDirectory + 'fern-*.mp3'`, played with `expo-audio`. Called from `useContinuousMic.js`, `useFernVoice.js`, and `FindScreen.js` (dead screen).

### `auth` — login

- `{ action: 'refresh', refreshToken }` → `{ success, token, refreshToken }` (or a falsy/failed response, treated as `null`).
- `{ action: 'login', email, password }` → `{ user, access_token|token, refresh_token|refreshToken, error?, message? }`. On failure, `useAuth.js` falls back to the refresh-token flow using the `rv4_auth` AsyncStorage key. Signup does **not** go through this endpoint — `signUpWithSupabase` uses the Supabase JS SDK directly.
- Caller: `src/hooks/useAuth.js` only.

### `sync` — pull/push of all user data

See "Local-first sync architecture" above for the full pull/push shape. Payload is always `{ action: 'pull'|'push', userId, token, [data] }`. Called from `useSync.js` and independently from `useAuth.js`'s `syncPull`.

### `get-recipe-image`

Payload: `{ query, token }`. Response: `{ url }` (returns `null` silently on any error — callers treat a missing image as normal, not exceptional). Called from `src/utils/recipeImage.js`'s `fetchRecipeImage`, used by `eventPlannerService.js`, `useAiRecipeCollection.js`, `SearchScreen.js`, `HomeScreen.js`, `RecipesScreen.js`, `EventPlanResultModal.js` (dead), `TwentyMinDinnerModal.js`, `EventPlannerIntakeModal.js`.

### `budget-meal-planner`

Payload: `{ weeklyBudget, people, dietary, deals: [], locale, token }`. Response: `{ weeklyBudget, people, estimatedActualCost, savings, dealsUsed[], dinners: [{day,title,emoji,cuisine,time,costPerServing,totalCost,description,ingredients[],instructions[]}], shoppingList: [{category, items[]}], moneyTips[] }`. Normalized (adds local `id`s, `image: null`, `haveAlready: false`) in `src/services/budgetPlannerService.js`. Caller: `BudgetPlannerModal` via `HomeScreen.js`.

### `meal-planner`

Payload varies by `action` — `load_plan`, `generate`, `regenerate_meal`, `save_plan`, and `shopping_list` are all implemented client-side:
- `{ action: 'load_plan', userId, token }` → `{ plan: { days: [{ dayLabel, meals: [{ slot, title, emoji, time, difficulty, cuisine, ingredients: [""], instructions: [""] }] }] } }`. Normalized (adds local `id`s per day/meal) in `src/services/mealPlannerService.js`'s `fetchMealPlan`. Caller: `MealPlannerModal` via `HomeScreen.js` (`openMealPlannerModal`/`loadMealPlan`), which loads once per modal open. Tapping a meal feeds its already-embedded `ingredients`/`instructions` straight into the same `useAiRecipeCollection`/`RecipeDetailModal` flow used everywhere else (source `meal_planner`, folded into `HomeScreen.js`'s shared `selectedAiRecipe` chain) — no second AI call needed, it only auto-fetches an image via `get-recipe-image` the way that flow always does.
- `{ action: 'generate', userId, locale, savedRecipes: [""], plan: { days: [...] } }` → same `{ plan: { days: [...] } }` response shape as `load_plan`. Notably **no `token`** in this payload — confirmed from a captured request, unlike every other call in this app. `savedRecipes` is the user's saved-recipe titles (`data.recipes.map(r => r.title)`, duplicates included, not deduped); `plan` is the *currently displayed* plan round-tripped back (stripped of the client's local `id` fields via `denormalizeDaysForApi`) so the backend knows what's already been suggested and can avoid repeating it. Caller: `mealPlannerService.generateMealPlan`, triggered from `MealPlannerModal`'s "↺ Regenerate" button or the Preferences screen's "✨ Generate My Week" button, both gated behind a native confirm (`Alert.alert`) since it replaces the currently-loaded plan.
- `{ action: 'regenerate_meal', userId, locale, plan: { days: [...] }, dayIndex, slot }` ("Swap this meal") → `{ meal: { title, emoji, description, time, difficulty, cuisine, slot, ingredients: [""], instructions: [""], notes } }` — a single replacement meal, plus `description` and `notes` (a make-ahead/serving tip, rendered as the 💡 callout in `MealPlannerRecipeDetailView`) that `load_plan`/`generate` never include. No `token`, matching `generate`. **`dayIndex` + `slot` are the only identifiers for which meal to replace** — not title, since titles can repeat — so the caller (`HomeScreen.js`'s `handleSwapMealPlannerMeal`) splices the response into `mealPlannerDays[dayIndex].meals` by matching `slot`, keeping the existing local `id`, rather than searching by name.
- `{ action: 'shopping_list', userId, plan: { days: [...] }, locale }` → expected `{ shoppingList: [{ category, items: [""] }] }` (no confirmed sample response yet, so `mealPlannerService.fetchMealPlannerShoppingList` also checks `shopping_list`/`list` keys and a bare top-level array as fallbacks, degrading to an empty list rather than crashing if the real key differs). No `token`, matching `generate`/`regenerate_meal`. Caller: `MealPlannerShoppingListView` via `HomeScreen.js`'s `loadMealPlannerShoppingList`, triggered when the "🛒 Shopping List" button is tapped. "🛍️ Shop with Fern — section by section" flattens every group's items into one synthetic recipe and runs it through the same `addRecipeIngredientsToShoppingList` (`src/utils/shoppingListSync.js`) + `pushAllFromStorage`/`pull` flow every other "add to shopping list" action in the app uses, writing into `rv4_master_shop` — then closes the meal planner modal and navigates to the `Shopping` tab.
- `{ action: 'save_plan', userId, token, plan: { days: [...] }, preferences: { mealsPerDay, whichMeals: [""], cookTimeMax, servings, dietary: [""], disliked: [""] } }` → `{ success: true }`. Unlike `generate`/`regenerate_meal`, this one **does** carry `token`. Fired (fire-and-forget, not awaited by the UI) right after a successful `generate` *or* `regenerate_meal` in `HomeScreen.js`, passing the resulting plan plus whatever preferences produced it — collected from `MealPlannerPreferencesScreen.js`'s meals-per-day/which-meals/cook-time/servings/dietary/avoid-ingredients controls (lowercased for `whichMeals`/`dietary`), or the last-used preferences (`HomeScreen`'s `mealPlannerPreferences` state, defaulted to `{ mealsPerDay: 1, whichMeals: ['dinner'], cookTimeMax: 45, servings: 4, dietary: [], disliked: [] }`) when triggered from the quick "↺ Regenerate" button instead of the Preferences screen.

### `charcuterie-board`

Payload: `{ occasion, boardType, people, budget, dietary: 'None', locale, token }`. Response normalized via `normalizeCharcuterieBoard` in `src/services/charcuterieService.js`: `{ title, tagline, occasion, serves, estimatedCost, meats/cheeses/accompaniments/crackers: [{name,quantity,description,emoji,type,category}], garnishes[], drizzles[], drinks: [{name,why,emoji}], boardLayout, shoppingList: [{category,items}], hostTips[], prepTimeline, totalItems }`. Caller: `CharcuterieModal` via `HomeScreen.js`.

### `event-planner`

Payload: `{ action: 'generate', userId, token, locale, eventType: 'dinner_party', intake }`. Response `result.plan` normalized in `src/services/eventPlannerService.js`: `{ title, overview, timeline[], menu: { appetizers, mains, sides, desserts } (each recipe normalized like a saved recipe: id/title/emoji/category/meal/time/difficulty/image/description/servings/ingredients/methodSteps/note/bookIds), drinks[], shoppingList[], tableSettings, hostTips[], estimatedCost }`, then backfills images per recipe via `get-recipe-image`. Caller: `EventPlannerIntakeModal.js`.

### `semi-homemade`

Payload: `{ userId, locale, items: [], vibe, servings, token }` (`items` are emoji-prefixed shortcut strings, e.g. `"🍗 Rotisserie chicken"`, plus free-typed custom entries without emoji). Response normalized via `normalizeSemiHomemadeRecipe` in `src/services/semiHomemadeService.js` (reads `responseJson.recipe || responseJson`): `{ title, emoji, tagline, time, servings, difficulty, storeBought[], homemade[], ingredients[], instructions[], chefTip, shoppingList[], image: null }`. Caller: `SemiHomemadeModal` via `HomeScreen.js`.

### `whats-for-dinner`

Payload: `{ quickPicks: [], ingredients, servings, locale, token }`. Response `responseJson.recipes[]` normalized in `src/services/whatsForDinnerService.js` to `{ id, title, tagline, description, time, difficulty, cuisine, mealType, emoji, ingredients[], instructions[], chefTip, whyFast, servings }`. Caller: `TwentyMinDinnerModal` via `HomeScreen.js`.

### `recipe-tools` — wine pairing

Payload: `{ action: 'wine_pairing', userId, token, locale, recipe: { title, cuisine: '', description, ingredients: [] } }`. Response: `summary` from `responseJson.summary || .guidance || .message || .reply`; `pairings` from `responseJson.pairings || .recommendations || .results || .wines`, each mapped in `src/services/winePairingService.js` to `{ name, region, type, category, price, description, badge }`. Caller: `WinePairingModal` via `HomeScreen.js`.

### `scan-circular`

Payload: `{ mediaType: 'image/jpeg', userId, token, imageData: base64 }`. Response: `{ store, validDates, headline, sectionsFound[], items: [{id,name,brand,originalPrice,salePrice,unit,savings,category,emoji,dealScore,cookable,isBogo}] }`, with `sections` (grouped by category) and `totalSavings` computed client-side in `src/services/scanCircularService.js`. Caller: `ScanCircularModal` via both `HomeScreen.js` and `SearchScreen.js`.

### `loyalty`

Payload: `{ action: 'match', phone_hash }`, where `phone_hash` is a client-side SHA-256 hex digest (`src/utils/sha256.js`) of the digits-only phone number — the raw number never leaves the device. Response: `{ success, points, tier, linkedCards[], message }`. Caller: `src/services/loyaltyService.js`'s `matchLoyaltyCard`, used by `LoyaltyCardModal` via `HomeScreen.js`; the result is cached locally under `rv4_loyalty_card` (see local storage key table above) to drive the Home loyalty tile's linked state.

Three more `action`s manage a **separate** list of manually-entered per-store loyalty card numbers (store name + card number, not phone-hash-based) — no local caching, the `list` response is the sole source of truth, refetched every time `LoyaltyCardModal` opens:
- `{ action: 'list', token }` → `{ success, linkedCards: [{ storeName, cardNumber, linkedAt }] }`. Caller: `loyaltyService.fetchLinkedStoreCards`, called from `HomeScreen.js`'s `openLoyaltyModal`.
- `{ action: 'link', token, storeName, cardNumber }` → `{ success, linkedCards[], message }`. Caller: `loyaltyService.linkStoreCard`, from the modal's "Store Loyalty Cards" add form.
- `{ action: 'unlink', token, storeName }` → `{ success, linkedCards[] }`. Caller: `loyaltyService.unlinkStoreCard`, from each card row's "Remove" link.

All three take **`token` only** — no `userId`, no `phone_hash` — and all return the full updated `linkedCards[]`, which the caller just uses to replace local state directly rather than re-fetching.

### `instacart-list`, `kroger-list`, `albertsons-list` — send the shopping list to a store

Three separate functions, one per retailer, all called from `src/services/storeShoppingListService.js` via `ShoppingScreen.js`'s "SEND LIST TO" row (Instacart/Kroger/Safeway buttons). None take a `token`.

- `instacart-list` — payload `{ items: [""], title, linkbackUrl: 'https://app.clickpickandcook.com' }`. Response: `{ url }` — Instacart accepts the whole list in one shot, so `url` is a ready-to-open shopping list link. Opened via `Linking.openURL` (no in-app webview — none is installed in this project; see below).
- `kroger-list` — payload `{ items: [""], title, banner: 'Kroger', bannerUrl: 'https://www.kroger.com' }`. Response: `{ url, matched, total, provider, remainingItems: [""] }`. Kroger only supports a single-item search deep link, so `url` is a search-results page for just the *first* item — everything else comes back in `remainingItems`. The app opens `url` via `Linking.openURL` and shows `StoreRemainingItemsModal` with the rest, so the user can copy/paste them into the store's own search box.
- `albertsons-list` — same request/response shape as `kroger-list`, but payload uses `banner: 'Albertsons'`, `bannerUrl: 'https://www.albertsons.com'` (this is what the Shopping screen's "Safeway" button actually calls — Albertsons owns Safeway and this is the shared backend for both banners).

**No in-app browser yet**: this project has no webview library installed (`react-native-webview`, `expo-web-browser`, etc. are all absent from `package.json`). Adding one is a native-module change requiring `npx expo install` + a dev-client rebuild, so for now these links open via `Linking.openURL`, which hands off to the system browser rather than staying in-app. Revisit if/when an in-app browser is added.

### `geocode` — `GET /.netlify/functions/geocode?q=<storeName>&zip=<zip>[&token=<token>]`

The one **GET** endpoint, no body. Response: `{ lat, lon, address, source }`, validated and returned as `{ lat, lon, lng: lon, address, source }` (or `null` on failure). Caller: `src/services/storeLookupService.js`'s `findStoreLocationByZip`, used by `HomeScreen.js`'s store-management UI.

### Groq Whisper (not a Netlify function — direct external call)

`https://api.groq.com/openai/v1/audio/transcriptions`, called from `useContinuousMic.js` via `FileSystem.uploadAsync` (multipart, `{ model: 'whisper-large-v3', language: locale }`), authenticated with `EXPO_PUBLIC_GROQ_KEY` as a bearer token embedded in the client. This is the one place the app talks to a third party directly instead of proxying through `clickpickandcook.com` — worth knowing before assuming "all network calls go through the Netlify functions."
