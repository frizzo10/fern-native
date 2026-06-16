# Fern Native

React Native / Expo app for Fern AI — hands-free meal planning with continuous mic.

## Setup
```bash
npm install
cp .env.example .env
# Fill in your keys in .env
npx expo start
```

## Key differentiator
True continuous microphone — no tap-to-speak. Listens always, sends 3-second audio chunks to Groq Whisper, responds via Fern AI.

## Build for distribution
```bash
npx eas build --platform ios --profile preview    # → .ipa for AltStore
npx eas build --platform android --profile preview # → .apk for direct install
```

## Design system
All colors, fonts, and radii in `src/constants/tokens.js` match the web app at app.clickpickandcook.com exactly.
