import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioModule, useAudioRecorder, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
const CHUNK_MS = 3000;
const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

export function useContinuousMic({ onTranscript, onError } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const activeRef = useRef(false);
  const processingRef = useRef(false);
  const chunkTimerRef = useRef(null);

  const recorder = useAudioRecorder(
    RecordingPresets.HIGH_QUALITY
  );
  const sendChunk = useCallback(async (uri) => {
    console.log(
      'MULTIPART:',
      FileSystem.FileSystemUploadType.MULTIPART
    );
    if (!uri) return;

    try {

      const result = await FileSystem.uploadAsync(

        'https://api.groq.com/openai/v1/audio/transcriptions',

        uri,

        {

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

        }

      );

      console.log('[mic] upload result:', result.body);

      const data = JSON.parse(result.body);

      if (data?.text?.trim()) {

        onTranscript?.(data.text.trim());

      }

    } catch (error) {

      console.warn('[mic] upload error:', error);

    }

  }, [onTranscript]);

  const runCycle = useCallback(async () => {
    if (!activeRef.current) return;
    if (processingRef.current) return;

    processingRef.current = true;
    setIsProcessing(true);

    try {
      await recorder.stop();

      const uri = recorder.uri;

      console.log('[mic] chunk uri:', uri);

      if (uri) {
        sendChunk(uri);
      }

      if (activeRef.current) {
        await recorder.prepareToRecordAsync();
        await recorder.record();
      }
    } catch (error) {
      console.warn('[mic] cycle error:', error);

      if (activeRef.current) {
        onError?.(error?.message ?? 'Recording failed');
      }
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [recorder, sendChunk, onError]);

  const start = useCallback(async () => {
    try {
      if (activeRef.current) return;

      const permission =
        await AudioModule.requestRecordingPermissionsAsync();

      console.log('[mic] permission:', permission);

      if (!permission.granted) {
        onError?.('Microphone permission denied');
        return;
      }

      console.log(
        '[mic] AudioModule keys:',
        Object.keys(AudioModule)
      );

      // DEBUG: verify method exists
      console.log(
        '[mic] setAudioModeAsync:',
        typeof AudioModule.setAudioModeAsync
      );

      if (AudioModule.setAudioModeAsync) {
        await AudioModule.setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      }

      await recorder.prepareToRecordAsync();

      console.log('[mic] recorder prepared');

      await recorder.record();

      console.log('[mic] recording started');

      activeRef.current = true;
      setIsListening(true);

      chunkTimerRef.current = setInterval(
        runCycle,
        CHUNK_MS
      );
    } catch (error) {
      console.warn('[mic] start error:', error);

      onError?.(
        error?.message ?? 'Failed to start microphone'
      );
    }
  }, [recorder, runCycle, onError]);

  const stop = useCallback(async () => {
    activeRef.current = false;

    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }

    try {
      await recorder.stop();
    } catch {}

    try {
      if (AudioModule.setAudioModeAsync) {
        await AudioModule.setAudioModeAsync({
          allowsRecording: false,
        });
      }
    } catch {}

    setIsListening(false);
    setIsProcessing(false);
  }, [recorder]);

  useEffect(() => {
    return () => {
      activeRef.current = false;

      if (chunkTimerRef.current) {
        clearInterval(chunkTimerRef.current);
      }
    };
  }, []);

  return {
    isListening,
    isProcessing,
    start,
    stop,
  };
}