import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

// ── Fern Voice ────────────────────────────────────────────────────────────
// Talks to the SAME shared TTS backend the web app uses
// (netlify/functions/fern-speak.js in click-pick-and-cook), so no new
// backend work is needed and the voice matches across both clients.
//
// This hook exists to carry forward a fix made on the web app: Fern's
// speech had no consistent, app-wide "is she allowed to talk right now"
// gate. Most call sites worked fine, but one concrete case (the store-
// arrival geofence greeting) had NO voice-preference check at all, and
// could speak out loud completely unprompted, in public, the moment GPS
// detected a store arrival, with no way to have opted out. The fix there
// was a single global preference checked once inside the shared speak
// function, so every current and future call site respects it
// automatically instead of relying on each call site remembering to check.
//
// Native has no voice OUTPUT feature yet (only speech-to-text input via
// useContinuousMic.js). This hook is that same discipline, built in from
// the very first line of native TTS code, rather than added after the same
// class of bug ships. Every future feature that wants Fern to talk out
// loud should call speak() from here -- never Audio.Sound directly -- so
// this stays the single enforcement point, the same way fernSpeak() is on
// web.
//
// DEFAULT IS OFF. This is a deliberate, more conservative choice than the
// web app's default-on (which was preserving already-existing behavior for
// people who'd used it for months). Native voice has shipped to nobody yet
// -- there's no existing behavior to preserve, and a phone unexpectedly
// talking out loud in someone's pocket or a public space is a more
// disruptive UX than a website making a sound in a tab the person is
// actively looking at. Opt-in first, not opt-out.

const TTS_URL = 'https://app.clickpickandcook.com/.netlify/functions/fern-speak';
const STORAGE_KEY = 'fern_voice_pref'; // same key name as the web app's localStorage entry, for conceptual parity (storage is separate -- AsyncStorage vs localStorage don't share data across web/native)

// RN/Hermes has no Buffer, so ArrayBuffer -> base64 needs a manual,
// chunked implementation (chunked to avoid call-stack limits from
// String.fromCharCode(...hugeArray) on longer clips).
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  if (typeof global.btoa === 'function') return global.btoa(binary);
  // Minimal base64 fallback if btoa isn't polyfilled in this RN runtime.
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < binary.length; i += 3) {
    const b1 = binary.charCodeAt(i);
    const b2 = i + 1 < binary.length ? binary.charCodeAt(i + 1) : NaN;
    const b3 = i + 2 < binary.length ? binary.charCodeAt(i + 2) : NaN;
    out += chars[b1 >> 2];
    out += chars[((b1 & 3) << 4) | (isNaN(b2) ? 0 : b2 >> 4)];
    out += isNaN(b2) ? '=' : chars[((b2 & 15) << 2) | (isNaN(b3) ? 0 : b3 >> 6)];
    out += isNaN(b3) ? '=' : chars[b3 & 63];
  }
  return out;
}

export function useFernVoice() {
  const [voiceEnabled, setVoiceEnabledState] = useState(false); // off by default -- see note above
  const [ready, setReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const soundRef = useRef(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => { if (!cancelled) setVoiceEnabledState(saved === 'on'); })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  const stop = useCallback(async () => {
    tokenRef.current++;
    setSpeaking(false);
    if (soundRef.current) {
      const s = soundRef.current;
      soundRef.current = null;
      try { await s.stopAsync(); } catch (e) {}
      try { await s.unloadAsync(); } catch (e) {}
    }
  }, []);

  const setVoiceEnabled = useCallback((enabled) => {
    setVoiceEnabledState(!!enabled);
    AsyncStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off').catch(() => {});
    if (!enabled) stop();
  }, [stop]);

  // speak(text, { onEnd, locale }) -- mirrors the web app's fernSpeak()
  // contract: when voice is off, onEnd still fires (after a short delay)
  // so any caller using it to advance a conversation/flow step keeps
  // working, just silently. A failed network/audio call also still fires
  // onEnd rather than leaving a caller stuck waiting forever.
  const speak = useCallback(async (text, { onEnd, locale = 'en' } = {}) => {
    if (!text) return;

    if (!voiceEnabled) {
      if (onEnd) setTimeout(onEnd, 200);
      return;
    }

    await stop(); // cancel anything currently playing before starting new speech
    const myToken = tokenRef.current;
    setSpeaking(true);

    try {
      const res = await fetch(TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: String(text).slice(0, 1000), lang: locale }),
      });
      if (!res.ok) throw new Error('TTS request failed: ' + res.status);

      const buffer = await res.arrayBuffer();
      if (tokenRef.current !== myToken) return; // superseded by a newer call while awaiting

      const uri = 'data:audio/mpeg;base64,' + arrayBufferToBase64(buffer);
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });

      if (tokenRef.current !== myToken) { // superseded while loading
        sound.unloadAsync().catch(() => {});
        return;
      }
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if ((status.didJustFinish || status.error) && tokenRef.current === myToken) {
          setSpeaking(false);
          const s = soundRef.current;
          soundRef.current = null;
          if (s) s.unloadAsync().catch(() => {});
          if (onEnd) onEnd();
        }
      });
    } catch (e) {
      console.warn('[useFernVoice] speak failed:', e.message);
      if (tokenRef.current === myToken) {
        setSpeaking(false);
        if (onEnd) onEnd(); // never leave a caller stuck waiting on a failed speak call
      }
    }
  }, [voiceEnabled, stop]);

  useEffect(() => () => { stop(); }, [stop]); // stop + unload on unmount

  return { speak, stop, speaking, voiceEnabled, setVoiceEnabled, ready };
}
