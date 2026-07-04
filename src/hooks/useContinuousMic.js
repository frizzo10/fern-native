import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';

const CHUNK_MS   = 3000;
const GROQ_URL   = 'https://api.groq.com/openai/v1/audio/transcriptions';
const RECORD_OPTIONS = {
  android: {
    extension:      '.m4a',
    outputFormat:   Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder:   Audio.AndroidAudioEncoder.AAC,
    sampleRate:     16000,
    numberOfChannels: 1,
    bitRate:        128000,
  },
  ios: {
    extension:       '.m4a',
    outputFormat:    Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality:    Audio.IOSAudioQuality.MEDIUM,
    sampleRate:      16000,
    numberOfChannels: 1,
    bitRate:         128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat:     false,
  },
  web: {},
};

export function useContinuousMic({ onTranscript, onError, locale = 'en' } = {}) {
  const [isListening,  setIsListening]  = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const recordingRef  = useRef(null);
  const activeRef     = useRef(false);
  const processingRef = useRef(false);
  const timerRef      = useRef(null);
  // Keep the latest locale in a ref so an in-flight recording cycle
  // always sends the current value to Whisper, even if the caller's
  // locale changes between recordings (e.g. the user switches language
  // mid-session) without needing to restart the mic loop.
  const localeRef     = useRef(locale);
  useEffect(() => { localeRef.current = locale; }, [locale]);

  // ── Send chunk to Groq ────────────────────────────────────────────────────
  const sendChunk = useCallback(async (uri) => {
    if (!uri) return;
    try {
      const body = new FormData();
      body.append('file', { uri, name: 'audio.m4a', type: 'audio/mp4' });
      body.append('model', 'whisper-large-v3');
      // Was hardcoded to 'en' regardless of the app's selected locale --
      // Whisper's language parameter tells the model what language the
      // AUDIO ITSELF is in, not what to translate to, so forcing 'en' on
      // Spanish speech would have caused genuinely garbled
      // transcriptions (a worse failure mode than the pattern-matching
      // bugs found in the web app tonight, which just failed to
      // recognize an intent -- this would misinterpret the actual words).
      // Not yet wired into any screen, so not a live user-facing bug yet,
      // but fixed now before anything comes to depend on this behavior.
      body.append('language', localeRef.current);

      const res = await fetch(GROQ_URL, {
        method:  'POST',
        headers: { Authorization: `Bearer ${process.env.EXPO_PUBLIC_GROQ_KEY}` },
        body,
      });

      if (!res.ok) { console.warn('[mic] Groq:', await res.text()); return; }
      const { text } = await res.json();
      if (text?.trim()) onTranscript?.(text.trim());
    } catch (e) {
      console.warn('[mic] sendChunk:', e.message);
    }
  }, [onTranscript]);

  // ── Create a fresh recording object ──────────────────────────────────────
  const startNewRecording = useCallback(async () => {
    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(RECORD_OPTIONS);
    await rec.startAsync();
    recordingRef.current = rec;
  }, []);

  // ── Cycle: stop current → send → start new ───────────────────────────────
  const runCycle = useCallback(async () => {
    if (!activeRef.current || processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);

    const rec = recordingRef.current;
    recordingRef.current = null;

    try {
      if (rec) {
        await rec.stopAndUnloadAsync();
        const { uri } = await rec.getStatusAsync().catch(() => ({ uri: rec.getURI() }));
        const fileUri = uri || rec.getURI();
        sendChunk(fileUri); // non-blocking
      }

      if (activeRef.current) {
        await startNewRecording();
      }
    } catch (e) {
      console.warn('[mic] cycle:', e.message);
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [sendChunk, startNewRecording]);

  // ── Start ─────────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    if (activeRef.current) return;
    try {
      // 1. Permission
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { onError?.('Microphone permission denied'); return; }

      // 2. Audio mode — expo-av SDK 52 stable API
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:         true,
        playsInSilentModeIOS:       true,
        staysActiveInBackground:    true,
        interruptionModeIOS:        Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        shouldDuckAndroid:          true,
        interruptionModeAndroid:    Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false,
      });

      // 3. Start first recording
      await startNewRecording();
      activeRef.current = true;
      setIsListening(true);

      // 4. Cycle every 3s
      timerRef.current = setInterval(runCycle, CHUNK_MS);

    } catch (e) {
      console.warn('[mic] start:', e.message);
      onError?.(e.message);
    }
  }, [startNewRecording, runCycle, onError]);

  // ── Stop ──────────────────────────────────────────────────────────────────
  const stop = useCallback(async () => {
    activeRef.current = false;
    clearInterval(timerRef.current);

    const rec = recordingRef.current;
    recordingRef.current = null;
    if (rec) {
      try { await rec.stopAndUnloadAsync(); } catch {}
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:   false,
        playsInSilentModeIOS: false,
      });
    } catch {}

    setIsListening(false);
    setIsProcessing(false);
  }, []);

  // Cleanup
  useEffect(() => () => {
    activeRef.current = false;
    clearInterval(timerRef.current);
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {});
    }
  }, []);

  return { isListening, isProcessing, start, stop };
}
