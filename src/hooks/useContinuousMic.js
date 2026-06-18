import { useState, useRef, useCallback, useEffect } from 'react';
import {
  createAudioPlayer,
  setAudioModeAsync,
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const AI_URL = 'https://app.clickpickandcook.com/.netlify/functions/ai';
const SPEAK_URL = 'https://app.clickpickandcook.com/.netlify/functions/fern-speak';

const METERING_INTERVAL_MS = 100;
const SILENCE_DURATION_MS = 1200;
const MIN_SPEECH_MS = 400;
const MAX_RECORDING_MS = 30000;
const CALIBRATION_MS = 600;
const MIN_SIGNAL_RANGE_DB = 6;

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function parseFernReply(data) {
  return (
    data?.content?.[0]?.text?.trim() ??
    data?.reply?.trim() ??
    data?.text?.trim() ??
    ''
  );
}

export function useContinuousMic({ onTranscript, onReply, onError } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const activeRef = useRef(false);
  const busyRef = useRef(false);
  const monitorRef = useRef(null);
  const speechStartedRef = useRef(false);
  const speechStartRef = useRef(null);
  const silenceStartRef = useRef(null);
  const recordingStartRef = useRef(null);
  const playerRef = useRef(null);
  const minMeterRef = useRef(-160);
  const maxMeterRef = useRef(-160);
  const meteringSeenRef = useRef(false);
  const processUtteranceRef = useRef(null);

  const recorder = useAudioRecorder(RECORDING_OPTIONS);

  const clearMonitor = useCallback(() => {
    if (monitorRef.current) {
      clearInterval(monitorRef.current);
      monitorRef.current = null;
    }
  }, []);

  const releasePlayer = useCallback(() => {
    if (playerRef.current) {
      try {
        playerRef.current.release();
      } catch {}
      playerRef.current = null;
    }
  }, []);

  const transcribe = useCallback(async (uri) => {
    const result = await FileSystem.uploadAsync(GROQ_URL, uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: 'audio/mp4',
      parameters: {
        model: 'whisper-large-v3',
        language: 'en',
      },
      headers: {
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_GROQ_KEY}`,
      },
    });

    const data = JSON.parse(result.body);
    return data?.text?.trim() ?? '';
  }, []);

  const askFern = useCallback(async (text) => {
    const res = await fetch(AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: text }],
      }),
    });

    if (!res.ok) {
      throw new Error(`AI request failed (${res.status})`);
    }

    const data = await res.json();
    const reply = parseFernReply(data);
    if (!reply && data?.error) {
      throw new Error(data.error);
    }
    return reply;
  }, []);

  const speakFern = useCallback(async (text) => {
    const res = await fetch(SPEAK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      throw new Error(`Speech request failed (${res.status})`);
    }

    const buffer = await res.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    const uri = `${FileSystem.cacheDirectory}fern-speak-${Date.now()}.mp3`;

    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });

    releasePlayer();
    const player = createAudioPlayer({ uri });
    playerRef.current = player;

    await new Promise((resolve, reject) => {
      const subscription = player.addListener('playbackStatusUpdate', (status) => {
        if (status.error) {
          subscription.remove();
          reject(new Error(status.error));
          return;
        }
        if (status.didJustFinish) {
          subscription.remove();
          resolve();
        }
      });
      player.play();
    });

    releasePlayer();

    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {}
  }, [releasePlayer]);

  const resetVadState = useCallback(() => {
    speechStartedRef.current = false;
    speechStartRef.current = null;
    silenceStartRef.current = null;
    recordingStartRef.current = null;
    minMeterRef.current = -160;
    maxMeterRef.current = -160;
    meteringSeenRef.current = false;
  }, []);

  const isSpeechLevel = useCallback((metering, now) => {
    const range = maxMeterRef.current - minMeterRef.current;
    if (now - recordingStartRef.current < CALIBRATION_MS) {
      return false;
    }
    if (range < MIN_SIGNAL_RANGE_DB) {
      return metering > -50;
    }
    const speechLevel = minMeterRef.current + range * 0.4;
    return metering >= speechLevel;
  }, []);

  const isSilenceLevel = useCallback((metering) => {
    const range = maxMeterRef.current - minMeterRef.current;
    if (range < MIN_SIGNAL_RANGE_DB) {
      return metering <= -52;
    }
    const silenceLevel = minMeterRef.current + range * 0.2;
    return metering <= silenceLevel;
  }, []);

  const tickVad = useCallback(() => {
    if (!activeRef.current || busyRef.current) return;

    const status = recorder.getStatus();
    if (!status.isRecording) return;

    const now = Date.now();
    if (!recordingStartRef.current) {
      recordingStartRef.current = now;
    }

    if (now - recordingStartRef.current >= MAX_RECORDING_MS) {
      processUtteranceRef.current?.();
      return;
    }

    const metering = status.metering;
    if (typeof metering === 'number') {
      meteringSeenRef.current = true;
      minMeterRef.current = Math.min(minMeterRef.current, metering);
      maxMeterRef.current = Math.max(maxMeterRef.current, metering);
    } else if (!meteringSeenRef.current) {
      const elapsed = now - recordingStartRef.current;
      if (elapsed >= 5000 && status.durationMillis >= MIN_SPEECH_MS) {
        processUtteranceRef.current?.();
      }
      return;
    }

    if (isSpeechLevel(metering, now)) {
      if (!speechStartedRef.current) {
        speechStartedRef.current = true;
        speechStartRef.current = now;
      }
      silenceStartRef.current = null;
      return;
    }

    if (!speechStartedRef.current) return;

    if (!silenceStartRef.current) {
      silenceStartRef.current = now;
      return;
    }

    const silenceMs = now - silenceStartRef.current;
    const speechMs = now - (speechStartRef.current ?? now);

    if (
      silenceMs >= SILENCE_DURATION_MS &&
      speechMs >= MIN_SPEECH_MS &&
      isSilenceLevel(metering)
    ) {
      processUtteranceRef.current?.();
    }
  }, [isSilenceLevel, isSpeechLevel, recorder]);

  const beginListeningRef = useRef(null);

  const processUtterance = useCallback(async () => {
    if (!activeRef.current || busyRef.current) return;

    busyRef.current = true;
    clearMonitor();
    setIsListening(false);
    setIsProcessing(true);

    try {
      await recorder.stop();
      const uri = recorder.uri ?? recorder.getStatus().url;

      if (!uri) {
        throw new Error('No recording captured');
      }

      const transcript = await transcribe(uri);
      if (!transcript) {
        throw new Error('Could not understand audio');
      }

      onTranscript?.(transcript);

      const reply = await askFern(transcript);
      if (!reply) {
        throw new Error('Fern did not return a reply');
      }

      onReply?.(reply);

      setIsProcessing(false);
      setIsSpeaking(true);
      await speakFern(reply);
    } catch (error) {
      console.warn('[mic] pipeline error:', error);
      onError?.(error?.message ?? 'Voice request failed');
    } finally {
      setIsProcessing(false);
      setIsSpeaking(false);
      busyRef.current = false;

      if (activeRef.current) {
        await beginListeningRef.current?.();
      }
    }
  }, [askFern, clearMonitor, onError, onReply, onTranscript, recorder, speakFern, transcribe]);

  processUtteranceRef.current = processUtterance;

  const beginListening = useCallback(async () => {
    if (!activeRef.current || busyRef.current) return;

    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      resetVadState();
      recordingStartRef.current = Date.now();

      await recorder.prepareToRecordAsync(RECORDING_OPTIONS);
      recorder.record();

      const status = recorder.getStatus();
      if (!status.isRecording) {
        throw new Error('Microphone failed to start');
      }

      setIsListening(true);

      clearMonitor();
      monitorRef.current = setInterval(tickVad, METERING_INTERVAL_MS);
    } catch (error) {
      console.warn('[mic] listen error:', error);
      onError?.(error?.message ?? 'Failed to start microphone');
      activeRef.current = false;
      setIsListening(false);
    }
  }, [clearMonitor, onError, recorder, resetVadState, tickVad]);

  beginListeningRef.current = beginListening;

  const start = useCallback(async () => {
    try {
      if (activeRef.current) return;

      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        onError?.('Microphone permission denied');
        return;
      }

      activeRef.current = true;
      await beginListening();
    } catch (error) {
      console.warn('[mic] start error:', error);
      onError?.(error?.message ?? 'Failed to start microphone');
    }
  }, [beginListening, onError]);

  const stop = useCallback(async () => {
    activeRef.current = false;
    clearMonitor();
    releasePlayer();
    resetVadState();

    try {
      await recorder.stop();
    } catch {}

    try {
      await setAudioModeAsync({ allowsRecording: false });
    } catch {}

    setIsListening(false);
    setIsProcessing(false);
    setIsSpeaking(false);
    busyRef.current = false;
  }, [clearMonitor, recorder, releasePlayer, resetVadState]);

  const sendNow = useCallback(() => {
    if (!activeRef.current || busyRef.current) return;

    const duration = recorder.getStatus().durationMillis ?? 0;
    if (!speechStartedRef.current && duration < MIN_SPEECH_MS) {
      onError?.('Keep talking a moment, then tap again to send');
      return;
    }

    processUtteranceRef.current?.();
  }, [onError, recorder]);

  const handleOrbPress = useCallback(async () => {
    if (isProcessing || isSpeaking) {
      await stop();
      return;
    }
    if (isListening) {
      const duration = recorder.getStatus().durationMillis ?? 0;
      if (duration < 300) {
        await stop();
        return;
      }
      sendNow();
      return;
    }
    await start();
  }, [isListening, isProcessing, isSpeaking, recorder, sendNow, start, stop]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      clearMonitor();
      releasePlayer();
    };
  }, [clearMonitor, releasePlayer]);

  return {
    isListening,
    isProcessing,
    isSpeaking,
    start,
    sendNow,
    stop,
    handleOrbPress,
  };
}
