import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioModule, useAudioRecorder, RecordingPresets } from 'expo-audio';

const CHUNK_MS = 3000;
const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

export function useContinuousMic({ onTranscript, onError } = {}) {
  const [isListening,   setIsListening]   = useState(false);
  const [isProcessing,  setIsProcessing]  = useState(false);

  const activeRef      = useRef(false);
  const processingRef  = useRef(false); // prevents overlap
  const chunkTimerRef  = useRef(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // ── Send one audio chunk to Groq Whisper ──────────────────────────────────
  const sendChunk = useCallback(async (uri) => {
    if (!uri) return;
    try {
      // React Native FormData — must use the object form, not Blob
      const body = new FormData();
      body.append('file', {
        uri,
        name:  'chunk.m4a',
        type:  'audio/mp4',   // m4a = audio/mp4 on iOS
      });
      body.append('model',    'whisper-large-v3');
      body.append('language', 'en');

      const res = await fetch(GROQ_URL, {
        method:  'POST',
        headers: {
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_GROQ_KEY}`,
          // Do NOT set Content-Type — let fetch set the multipart boundary
        },
        body,
      });

      if (!res.ok) {
        const err = await res.text();
        console.warn('[mic] Groq error:', err);
        return;
      }

      const data = await res.json();
      const text = data?.text?.trim();
      if (text) onTranscript?.(text);

    } catch (e) {
      console.warn('[mic] sendChunk error:', e.message);
    }
  }, [onTranscript]);

  // ── One record→stop→send cycle ────────────────────────────────────────────
  const runCycle = useCallback(async () => {
    if (!activeRef.current || processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);

    try {
      // Stop current recording
      await recorder.stop();
      const uri = recorder.uri;

      // Send to Groq (non-blocking for next cycle start)
      sendChunk(uri); // intentionally not awaited so we restart immediately

      // Start next cycle if still active
      if (activeRef.current) {
        await recorder.prepareToRecordAsync();
        await recorder.record();
      }
    } catch (e) {
      console.warn('[mic] cycle error:', e.message);
      if (activeRef.current) onError?.(e.message);
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [recorder, sendChunk, onError]);

  // ── Start ─────────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    if (activeRef.current) return;

    try {
      // 1. Permission
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) { onError?.('Microphone permission denied'); return; }

      // 2. Enable recording mode
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS:    true,
        playsInSilentModeIOS:  true,
        staysActiveInBackground: true,
      });

      // 3. Prepare and start first recording
      await recorder.prepareToRecordAsync();
      await recorder.record();

      activeRef.current = true;
      setIsListening(true);

      // 4. Kick off chunk cycle every CHUNK_MS
      chunkTimerRef.current = setInterval(runCycle, CHUNK_MS);

    } catch (e) {
      console.warn('[mic] start error:', e.message);
      onError?.(e.message);
    }
  }, [recorder, runCycle, onError]);

  // ── Stop ──────────────────────────────────────────────────────────────────
  const stop = useCallback(async () => {
    activeRef.current = false;
    clearInterval(chunkTimerRef.current);

    try {
      await recorder.stop();
    } catch {}

    try {
      // Restore normal audio mode
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS:   false,
        playsInSilentModeIOS: false,
      });
    } catch {}

    setIsListening(false);
    setIsProcessing(false);
  }, [recorder]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      clearInterval(chunkTimerRef.current);
    };
  }, []);

  return { isListening, isProcessing, start, stop };
}
