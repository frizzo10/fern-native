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
| Login | ✅ Done — same credentials as app.clickpickandcook.com |
| Home / Family Hub | ✅ Done — real week plan, meals, activities from Supabase |
| Continuous mic | ✅ Done — always listening, Groq Whisper, no tap-to-speak |
| Find Recipes | ⏳ Placeholder |
| Shopping List | ⏳ Placeholder |
| My Recipes | ⏳ Placeholder |

---

## Key files

| File | What it does |
|------|-------------|
| `setup.sh` | One-command setup |
| `App.js` | Entry — auth gate + tab navigator |
| `src/constants/tokens.js` | All DS colors — matches web app exactly |
| `src/hooks/useContinuousMic.js` | Always-on mic → Groq Whisper → Fern AI |
| `src/hooks/useSync.js` | Pulls all data from same backend as web app |
| `src/hooks/useAuth.js` | Login/logout, secure session storage |
| `src/screens/HomeScreen.js` | Family Hub with real synced data |
| `src/screens/LoginScreen.js` | Sign in screen |

---

## Design system

All colors in `src/constants/tokens.js` match `app.clickpickandcook.com` exactly.
Forest `#1C3A1A` · Orange `#E8651A` · Sage `#A8D5A2` · Parchment `#FDFAF6`

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

This app uses native modules (`expo-audio` for mic, `expo-location` for geofencing) that **Expo Go does not support**. Running `npx expo start` and scanning with Expo Go will give errors like `Cannot find native module 'ExponentAV'`.

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
