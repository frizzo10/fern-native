# Fern Native: Handoff (2026-10-16)

Owner: Frank Rizzo (non-coder; Claude is the engineering partner). Repo `frizzo10/fern-native`, branch `main`, Expo SDK 56. Backend lives in `click-pick-and-cook` (Netlify functions). Read `CLAUDE.md` and `DATAMODEL.md` first; every change is logged there as a dated paragraph.

## How we work (Frank's rules)
- One change, one deploy, one sign-off.
- Give the OTA command as a single code block. Claude cannot run `eas`; Frank does.
- New copy goes in both EN and ES in `src/constants/translations.js`.
- Add a dated paragraph to `CLAUDE.md` for every change. Commit and push to `main`.
- Syntax-check edited files with `npx esbuild <file> --loader:.js=jsx`. There is no test suite.
- Python edit pitfall: anchors like `s.index("  if (voiceOnly) {")` match nested blocks. Use unique anchors and assert `count==1`.

## Deploy (JS-only, no native build needed)
```
cd ~/fern-native && git pull origin main && eas update --branch production --environment production --message "..."
```
The app must be closed and reopened twice before an update shows. `runtimeVersion` policy is `sdkVersion`. Version 1.1.7 exists in App Store Connect for screenshots only; do not submit it.

## What was built this stretch (all pushed)
| Commit | Change |
|---|---|
| a45eab3 | Faster, calmer voice loop: `silenceMs` 800 for the leaf, `speakChunks` (first sentence plays while the rest is fetched), mic re-arm 200 ms, lighter voice prompt, context warm-up |
| 6e18665 | Leaf is the whole UI (no cover or window): it pulses by phase, the app jumps to what she changed (`onShow`, `watch` from `executeAgentActions`), new `add_recipe_to_list` action, LET THEM CHOOSE rule for dish names |
| b3d3b8f | Timeouts: `ai` 25 s, `transcribe` 20 s, coupon catalog 4 s; the label above the leaf always shows something |
| d6ae198 | Label shows the stage: `“heard”`, `⏳ “heard”`, `🔊 said`, `💬 said`, or the error |
| a3d9934 | Finishing a tour from Account/Plans opens the feature (`launchAfterTour`) |
| 01aa9f6 | Tour Done now opens the tool through `src/services/toolBus.js` instead of navigation params |

## Open problems
1. **Leaf goes silent after she hears Frank.** He said "add tacos to Tuesday night's menu" and got no reply. The cause is unknown. Candidate causes: a slow or failed `ai` call (the backend uses a reasoning model, gpt-oss-20b via Groq, and `ai` is not in the 26 s timeout override in `netlify.toml`), or speech not playing. The sandbox cannot reach production, so latency has not been measured. **Next step:** ask Frank which label state he sees after speaking. ⏳ stuck means the AI call is slow or failing. 🔊 with text means audio is not playing. An error line names the failure. Remove the diagnostic label once fixed; Frank dislikes the chat-box look.
2. **Tour Done → feature.** Frank reported it did not take him to the app (a3d9934). The hand-off was rebuilt as 01aa9f6 and is untested. Test with the Fridge Challenge tour from Account. If it still fails, check which tour he ran, whether the OTA applied, and that `HomeScreen` subscribed (`subscribeOpenTool`) and found a tool whose `featureKey` matches.

## Backlog
- Scanner accuracy on casual photos and multi-buy prices (backend `scan-circular-background.js`).
- `EXPO_PUBLIC_GROQ_KEY` is still embedded client-side (`transcribe` now proxies, so this may be removable).
- Auto-OTA on push (needs an Expo token).
- Optional: remove the 🌳 tour avatar; Kokoro voice engine via Netlify env `TTS_PROVIDER=deepinfra`; wake word (declined for now).
- Decide the end date for `LAUNCH_ALL_FREE` (while true, everyone is Pro Max and chat is capped at 25 per day).
- App Store screenshots: wait for Apple's refresh of 1.1.6.
- Distribution to 3 testers.

## Key files
- Voice: `src/hooks/useFernVoice.js`, `useContinuousMic.js`, `src/components/modals/ChatSheetModal.js` (`voiceOnly`), `src/services/fernAgent.js` (prompt, actions, `executeAgentActions`)
- App shell and leaf UI: `App.js` (`leafPhase`, `leafNote`, `launchAfterTour`)
- Tours: `src/services/TourContext.js`, `src/components/TourModal.js`, `src/constants/tourContent.js`
- Tool launching: `src/services/toolBus.js`, `HomeScreen.js` (`openToolRef`, `newHomeToolDefs`)
- Follow-along: `FamilyScreen.js` (`showNonce` → jump to day)
