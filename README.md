# 🌿 Fern Native

Native iOS + Android app for Fern AI — hands-free meal planning with continuous mic.

---

## Setup (one command)

```bash
git clone https://github.com/frizzo10/fern-native.git
cd fern-native
bash setup.sh
```

That's it. The script installs everything, fills in the Supabase keys, and tells you exactly what to do next.

The only thing you need to add manually is the **Groq API key** (Frank provides this):
```
EXPO_PUBLIC_GROQ_KEY=gsk_your_key_here
```
Get one free at **console.groq.com** → API Keys → Create Key.

---

## Preview (no build needed)

```bash
npx expo start
```
Scan the QR code with **Expo Go** (free on App Store / Google Play). App loads instantly.

---

## Build for distribution

```bash
# iOS → .ipa → send to Frank via AltStore
eas build --platform ios --profile preview

# Android → .apk → send directly to Frank's Android phone  
eas build --platform android --profile preview

# Both at once
eas build --platform all --profile preview
```

Builds run on Expo's servers (~10-15 min). Download link appears in terminal when done.

---

## What's built

| Screen | Status |
|--------|--------|
| Login | ✅ Done — same credentials as app.clickpickandcook.com, EN/ES toggle |
| Home / Family Hub | ✅ Done — real week plan, meals, activities from Supabase |
| Continuous mic | ✅ Done — always listening, Groq Whisper, no tap-to-speak |
| Find Recipes | ✅ Done — AI search via the shared `/ai` function, save to My Recipes |
| My Recipes | ✅ Done — view, add ingredients to Shopping List, remove |
| Shopping List | ✅ Done — check off, add custom items, clear checked/all |
| Localization (EN/ES) | ✅ Done — see `src/i18n/` |
| Fern's voice (TTS output) | ✅ Done, off by default — see "Fern's Voice" section below |

---

## Key files

| File | What it does |
|------|-------------|
| `setup.sh` | One-command setup |
| `App.js` | Entry — auth gate + tab navigator |
| `src/constants/tokens.js` | All DS colors — matches web app exactly |
| `src/hooks/useContinuousMic.js` | Always-on mic → Groq Whisper → Fern AI |
| `src/hooks/useFernVoice.js` | Fern's TTS output — see "Fern's Voice" section below |
| `src/hooks/useSync.js` | Pulls/pushes all data from the same backend as the web app |
| `src/hooks/useAuth.js` | Login/logout, secure session storage |
| `src/i18n/LocaleContext.js` + `translations.js` | EN/ES localization |
| `src/screens/HomeScreen.js` | Family Hub with real synced data |
| `src/screens/LoginScreen.js` | Sign in screen |
| `src/screens/FindScreen.js` | AI recipe search |
| `src/screens/RecipesScreen.js` | Saved recipes ("My Recipes") |
| `src/screens/ShoppingScreen.js` | Shopping list |

---

## Design system

All colors in `src/constants/tokens.js` match `app.clickpickandcook.com` exactly.
Forest `#1C3A1A` · Orange `#E8651A` · Sage `#A8D5A2` · Parchment `#FDFAF6`

---

## Fern's Voice — the rule for any future voice feature

Fern can speak out loud (TTS), via `useFernVoice.js`. Before touching this,
read this section — it exists because of a real bug found and fixed on the
web app.

**What happened on web:** there was no single, app-wide "is Fern allowed to
talk right now" check. Every place that could make Fern speak (~140 of them
— tours, chat, meal planning, etc.) had to remember to check the right
condition itself, and most did, but one didn't: the store-arrival geofence
greeting had **no check at all**. Fern could start talking out loud,
completely unprompted, the instant GPS detected someone walked into a
store — no way to have opted out, no warning, could happen in public with
the phone in a pocket. It shipped like that for a while before anyone
caught it.

**The fix on web:** one global preference, checked in exactly one place —
inside the single shared `fernSpeak()` function — so every call site,
present and future, respects it automatically. Nobody has to remember
anything.

**The rule here, carried over to native:**

1. **Never call `Audio.Sound` / any TTS directly.** Always go through
   `speak()` from `useFernVoice.js`. That's the single enforcement point —
   the whole reason this bug is fixable in one place instead of ~140.
2. **Default is off**, not on. Nobody has ever heard native Fern speak
   before — there's no existing behavior to preserve, and a phone
   unexpectedly talking out loud in someone's pocket is worse than a
   website making noise in an open tab. Opt-in, not opt-out.
3. If you're building something that wants to talk automatically /
   proactively (a background notification, a geofence-style trigger, a
   "welcome back" message on launch) — **that is exactly the failure mode
   that bit the web app.** Stop and think about whether the person
   actually asked for this before wiring it up, not after it ships.
4. Muting must never break app logic. `speak()` still fires its `onEnd`
   callback when voice is off — just faster, without audio — because
   several web-app flows use that callback to advance a conversation step,
   not just for cleanup. Keep that contract if you extend this hook.

---

*Fern AI · myaifern.com · Patent Pending USPTO May 2026*

---

## Sending updates (no reinstall needed)

After the first build is installed on Frank's phone, you can push updates without a new .ipa/.apk:

```bash
# Push a UI/JS update — Frank sees it next time he opens the app
eas update --branch production --message "Description of what changed"
```

This covers ~90% of updates (screen changes, bug fixes, new features).

Only need a full rebuild (`eas build`) when adding new native packages.


---

## ⚠️ Do NOT use Expo Go

This app uses native modules (`expo-av` for mic recording and Fern's voice playback, `expo-location` for geofencing) that **Expo Go does not support**. Running `npx expo start` and scanning with Expo Go will give errors like `Cannot find native module 'ExponentAV'`.

(Deliberately using `expo-av`, not the newer `expo-audio` — as of this Expo SDK version, `expo-audio` is still beta with documented stability issues. Worth revisiting once it's stable, but not blindly swapped in without real device testing.)

**Skip Expo Go entirely. Go straight to EAS build:**

```bash
eas login
eas build --platform ios --profile preview    # → .ipa
eas build --platform android --profile preview # → .apk
```

Or use a Development Build if you want fast iteration:
```bash
npx expo install expo-dev-client
npx expo run:ios    # builds and runs on simulator or USB-connected device
```
