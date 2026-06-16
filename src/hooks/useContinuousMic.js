import { useState, useRef, useCallback } from 'react';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';

export function useContinuousMic({ onTranscript, onError } = {}) {
  const [isListening, setIsListening]   = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const chunkTimerRef = useRef(null);
  const activeRef     = useRef(false);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const processChunk = useCallback(async () => {
    if (!activeRef.current) return;
    try {
      setIsProcessing(true);
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (uri) {
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
      }

      if (activeRef.current) {
        await audioRecorder.record();
      }
      setIsProcessing(false);
    } catch (e) {
      setIsProcessing(false);
      if (activeRef.current) onError?.(e.message);
    }
  }, [audioRecorder, onTranscript, onError]);

  const start = useCallback(async () => {
    try {
      // 1. Request permission
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        onError?.('Microphone permission denied');
        return;
      }

      // 2. ✅ Enable recording mode — this was the missing step
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      // 3. Prepare and start recording
      await audioRecorder.prepareToRecordAsync();
      await audioRecorder.record();
      activeRef.current = true;
      setIsListening(true);

      // 4. Send chunks every 3 seconds
      chunkTimerRef.current = setInterval(() => processChunk(), 3000);

    } catch (e) {
      onError?.(e.message);
    }
  }, [audioRecorder, processChunk, onError]);

  const stop = useCallback(async () => {
    activeRef.current = false;
    clearInterval(chunkTimerRef.current);
    try {
      await audioRecorder.stop();
      // Restore normal audio mode when done
      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
      });
    } catch {}
    setIsListening(false);
    setIsProcessing(false);
  }, [audioRecorder]);

  return { isListening, isProcessing, start, stop };
}
