import { useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';

export function useContinuousMic({ onTranscript, onError } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recordingRef = useRef(null);
  const chunkTimerRef = useRef(null);

  const start = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { onError?.('Microphone permission denied'); return; }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsListening(true);

      // Send chunks every 3s to Groq Whisper
      chunkTimerRef.current = setInterval(() => processChunk(), 3000);
    } catch (e) {
      onError?.(e.message);
    }
  }, [onTranscript, onError]);

  const processChunk = useCallback(async () => {
    if (!recordingRef.current) return;
    try {
      setIsProcessing(true);
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      const formData = new FormData();
      formData.append('file', { uri, name: 'audio.m4a', type: 'audio/m4a' });
      formData.append('model', 'whisper-large-v3');

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.EXPO_PUBLIC_GROQ_KEY}` },
        body: formData,
      });
      const { text } = await res.json();
      if (text?.trim()) onTranscript?.(text.trim());

      // Restart immediately — continuous
      const { recording: next } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = next;
      setIsProcessing(false);
    } catch (e) {
      setIsProcessing(false);
      onError?.(e.message);
    }
  }, [onTranscript, onError]);

  const stop = useCallback(async () => {
    clearInterval(chunkTimerRef.current);
    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
    }
    setIsListening(false);
    setIsProcessing(false);
  }, []);

  return { isListening, isProcessing, start, stop };
}
