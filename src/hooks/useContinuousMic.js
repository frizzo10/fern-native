import { useState, useRef, useCallback, useEffect } from 'react';
import {
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  RecordingPresets,
} from 'expo-audio';

const CHUNK_MS = 3000;
const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

export function useContinuousMic({ onTranscript, onError } = {}) {
  const [isListening,  setIsListening]  = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const activeRef     = useRef(false);
  const processingRef = useRef(false);
  const chunkTimerRef = useRef(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // ── Send audio chunk to Groq Whisper ─────────────────────────────────────
  const sendChunk = useCallback(async (uri) => {
    if (!uri) return;
    try {
      const body = new FormData();
      body.append('file', {
        uri,
        name: 'chunk.m4a',
        type: 'audio/mp4',   // React Native requires audio/mp4 for .m4a
      });
      body.append('model',    'whisper-large-v3');
      body.append('language', 'en');

      const res = await fetch(GROQ_URL, {
        method:  'POST',
        headers: { Authorization: `Bearer ${process.env.EXPO_PUBLIC_GROQ_KEY}` },
        // No Content-Type — fetch sets multipart boundary automatically
        body,
      });

      if (!res.ok) {
        console.warn('[mic] Groq error:', await res.text());
        return;
      }
      const { text } = await res.json();
      if (text?.trim()) onTranscript?.(text.trim());
    } catch (e) {
      console.warn('[mic] sendChunk error:', e.message);
    }
  }, [onTranscript]);

  // ── One record cycle: stop → send → prepare → record ─────────────────────
  const runCycle = useCallback(async () => {
    if (!activeRef.current || processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;

      sendChunk(uri); // non-blocking — restart recording while Groq processes

      if (activeRef.current) {
        await recorder.prepareToRecordAsync();
        await recorder.record();
      }
    } catch (e) {
      console.warn('[mic] cycle error:', e.message);
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [recorder, sendChunk]);

  // ── Start ─────────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    if (activeRef.current) return;
    try {
      // 1. Permission
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { onError?.('Microphone permission denied'); return; }

      // 2. Set audio mode — SDK 56 property names
      await setAudioModeAsync({
        allowsRecording:       true,   // was allowsRecordingIOS
        playsInSilentMode:     true,   // was playsInSilentModeIOS
        shouldPlayInBackground: true,  // was staysActiveInBackground
      });

      // 3. Prepare and record
      await recorder.prepareToRecordAsync();
      await recorder.record();

      activeRef.current = true;
      setIsListening(true);

      // 4. Chunk every 3s
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
    try { await recorder.stop(); } catch {}
    try {
      await setAudioModeAsync({
        allowsRecording:   false,
        playsInSilentMode: false,
      });
    } catch {}
    setIsListening(false);
    setIsProcessing(false);
  }, [recorder]);

  useEffect(() => () => {
    activeRef.current = false;
    clearInterval(chunkTimerRef.current);
  }, []);

  return { isListening, isProcessing, start, stop };
}
