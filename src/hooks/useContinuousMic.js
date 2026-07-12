import { useState, useRef, useCallback, useEffect } from 'react';
import { useAudioPlayer, AudioModule, useAudioRecorder, RecordingPresets } from 'expo-audio';

import * as FileSystem from 'expo-file-system/legacy';
const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_AI = 'https://app.clickpickandcook.com/.netlify/functions/ai';
const GROQ_SPEAK = 'https://app.clickpickandcook.com/.netlify/functions/fern-speak';


export function useContinuousMic({ onTranscript, onError, autoSpeakReply = true, locale = 'en' } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const activeRef = useRef(false);
  const processingRef = useRef(false);
  const [audioUri, setAudioUri] = useState(null);

  //VAD 
  const SILENCE_DB = -30;
  const SILENCE_MS = 1500;
  const MAX_RECORDING_MS = 30000;
  const vadIntervalRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const maxRecordingTimeoutRef = useRef(null);
  const hasSpeechRef = useRef(false);
  const stoppedBySilenceRef = useRef(false);

  //Player
  const player = useAudioPlayer(
    audioUri ? { uri: audioUri } : null
  );

  //Recorder
  const recorder = useAudioRecorder(
    RecordingPresets.HIGH_QUALITY
  );
  useEffect(() => {

    console.log("=========================This is language name ======================", { locale });

  }, []);

  const processFernReply = useCallback(async (transcript) => {
    try {
      const aiResponse = await fetch(GROQ_AI, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: transcript,
            },
          ],
          system:
            'You are Fern, a personal AI food assistant. Be brief and conversational.',
          locale,
        }),
      });

      const aiData = await aiResponse.json();
      const fernReply =
        aiData?.content?.[0]?.text ??
        aiData?.data?.content?.[0]?.text ??
        '';

      if (!fernReply) {
        console.warn('[fern] empty response');
        return;
      }

      console.log('[fern] reply:', fernReply);

      const speechResponse = await fetch(GROQ_SPEAK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: fernReply,
          locale,
        }),
      });
      const arrayBuffer = await speechResponse.arrayBuffer();

      const bytes = new Uint8Array(arrayBuffer);

      let binary = '';

      for (let i = 0; i < bytes.length; i++) {

        binary += String.fromCharCode(bytes[i]);

      }

      const base64 = global.btoa(binary);

      const audioPath =

        `${FileSystem.cacheDirectory}fern-${Date.now()}.mp3`;

      await FileSystem.writeAsStringAsync(

        audioPath,

        base64,

        {

          encoding: FileSystem.EncodingType.Base64,

        }

      );

      console.log('[tts] saved:', audioPath);

      setAudioUri(audioPath);

    } catch (err) {
      console.warn('[fern] error:', err);
    }
  }, [recorder, locale]);

  useEffect(() => {
    if (!audioUri || !player) return;

    try {
      player.seekTo(0);
      player.play();

      console.log('[tts] playing');
    } catch (e) {
      console.warn('[tts] play error', e);
    }
  }, [audioUri, player]);

  useEffect(() => {
    if (!player) return;

    const sub = player.addListener(
      'playbackStatusUpdate',
      async (status) => {
        if (status.didJustFinish) {

          console.log('[tts] finished');

          if (!activeRef.current) {
            await start();
          }
        }
      }
    );

    return () => sub?.remove?.();
  }, [player, start]);

  const stopPlayback = useCallback(() => {

    try {

      if (!player) return;

      player.pause();

      player.seekTo(0);

      console.log('[tts] playback stopped');

    } catch (e) {

      console.warn('[tts]', e);

    }

  }, [player]);

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

            language: locale,

          },

          headers: {

            Authorization: `Bearer ${process.env.EXPO_PUBLIC_GROQ_KEY}`,

          },

        }

      );

      console.log('[mic] upload result:', result.body);

      const data = JSON.parse(result.body);

      if (data?.text?.trim()) {
        const transcript = data.text.trim();

        onTranscript?.(transcript);

        if (autoSpeakReply) {
          await processFernReply(transcript);
        }

      }

    } catch (error) {

      console.warn('[mic] upload error:', error);

    }

  }, [onTranscript, autoSpeakReply, processFernReply]);

  const start = useCallback(async () => {
    try {
      if (activeRef.current) return;

      if (AudioModule.setAudioModeAsync) {
        await AudioModule.setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
      }

      await recorder.prepareToRecordAsync({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });

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

      console.log('[mic] recorder prepared');

      await recorder.record();
      hasSpeechRef.current = false;

      maxRecordingTimeoutRef.current = setTimeout(() => {
        console.log('[vad] max recording reached');

        if (
          activeRef.current &&
          !processingRef.current
        ) {
          stop();
        }
      }, MAX_RECORDING_MS);

      vadIntervalRef.current = setInterval(async () => {
        try {
          if (
            !activeRef.current ||
            processingRef.current
          ) {
            return;
          }

          const status = await recorder.getStatus();

          const db = status?.metering;

          if (db == null) return;

          console.log('[vad]', db);

          // User spoke at least once
          if (db > SILENCE_DB) {
            hasSpeechRef.current = true;
          }

          // Voice detected
          if (db > SILENCE_DB) {

            if (silenceTimeoutRef.current) {
              console.log('[vad] cancel timer');

              clearTimeout(silenceTimeoutRef.current);
              silenceTimeoutRef.current = null;
            }

            return;
          }

          // Silence detected
          if (
            hasSpeechRef.current &&
            !silenceTimeoutRef.current
          ) {
            console.log('[vad] start timer');
            stoppedBySilenceRef.current = false;
            silenceTimeoutRef.current = setTimeout(() => {

              console.log('[vad] silence detected');
              stoppedBySilenceRef.current = true;
              silenceTimeoutRef.current = null;

              if (
                activeRef.current &&
                !processingRef.current
              ) {
                stop();
              }

            }, SILENCE_MS);
          }

        } catch (e) {
          console.warn('[vad]', e);
        }
      }, 100);

      console.log('[mic] recording started');

      activeRef.current = true;
      setIsListening(true);

    } catch (error) {
      console.warn('[mic] start error:', error);

      onError?.(
        error?.message ?? 'Failed to start microphone'
      );
    }
  }, [recorder, onError]);

  const stop = useCallback(async () => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    if (maxRecordingTimeoutRef.current) {

      clearTimeout(maxRecordingTimeoutRef.current);

      maxRecordingTimeoutRef.current = null;

    }

    if (!activeRef.current) return;

    activeRef.current = false;
    setIsListening(false);

    processingRef.current = true;
    setIsProcessing(true);

    try {
      await recorder.stop();

      const uri = recorder.uri;

      console.log('[mic] final uri:', uri);

      if (uri) {
        await sendChunk(uri);
      }

      if (AudioModule.setAudioModeAsync) {
        await AudioModule.setAudioModeAsync({
          allowsRecording: false,
        });
      }
    } catch (error) {
      console.warn('[mic] stop error:', error);

      onError?.(
        error?.message ??
        'Failed to stop recording'
      );
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [recorder, sendChunk, onError]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
    };
  }, []);

  return {
    isListening,
    isProcessing,
    start,
    stop,
  };
}