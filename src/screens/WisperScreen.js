import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert
} from 'react-native';
import { useAudioPlayer, useAudioRecorder, RecordingPresets, AudioModule } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

const C = {
  forest: '#1C3A1A',
  orange: '#E8651A',
  sage: '#A8D5A2',
  parch: '#FDFAF6',
  ink: '#1A0E05',
  brown: '#9C835F',
  border: '#E8E0D0',
  red: '#C0392B',
};

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_AI = 'https://app.clickpickandcook.com/.netlify/functions/ai';
const GROQ_SPEAK = 'https://app.clickpickandcook.com/.netlify/functions/fern-speak';

function extractReply(data) {
  return (
    data?.content?.[0]?.text ||
    data?.data?.content?.[0]?.text ||
    data?.reply ||
    ''
  );
}

async function arrayBufferToBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return global.btoa(binary);
}

export default function WisperScreen() {
  const [transcription, setTranscription] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer(null);
  const ttsUriRef = useRef(null);

  const cleanupAudio = useCallback(async (uri) => {
    if (!uri) {
      return;
    }

    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!player) {
      return undefined;
    }

    const subscription = player.addListener('playbackStatusUpdate', async (status) => {
      if (status.didJustFinish) {
        setIsSpeaking(false);
        const finishedUri = ttsUriRef.current;
        ttsUriRef.current = null;
        await cleanupAudio(finishedUri);
      }
    });

    return () => subscription?.remove?.();
  }, [cleanupAudio, player]);

  const toggleRecording = async () => {
    try {
      if (isRecording) {
        await recorder.stop();
        setIsRecording(false);

        if (recorder.uri) {
          await sendToGroq(recorder.uri);
        }
      } else {
        const permission = await AudioModule.requestRecordingPermissionsAsync();

        if (!permission.granted) {
          Alert.alert('Permission Required', 'Microphone access is required to record audio.');
          return;
        }

        if (AudioModule.setAudioModeAsync) {
          await AudioModule.setAudioModeAsync({
            allowsRecording: true,
            playsInSilentMode: true,
          });
        }
        
        await recorder.prepareToRecordAsync();
        await recorder.record();
        setIsRecording(true);
        setTranscription('');
        setReply('');
      }
    } catch (error) {
      console.error('[Whisper] Recording error:', error);
      Alert.alert('Recording Error', error.message);
      setIsRecording(false);
    }
  };

  const sendToGroq = async (fileUri) => {
    setLoading(true);

    try {
      console.log('[Wisper] Sending to Groq transcription...');
      const result = await FileSystem.uploadAsync(
        GROQ_URL,
        fileUri,
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

      const data = JSON.parse(result.body);
      const text = (data.text || '').trim() || 'No text detected.';
      console.log('[Wisper] Transcript:', text);
      setTranscription(text);

      const aiResponse = await fetch(GROQ_AI, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system: 'You are Fern, a personal AI food assistant. Be brief and conversational.',
          messages: [
            {
              role: 'user',
              content: text,
            },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const error = await aiResponse.text();
        throw new Error(`AI error ${aiResponse.status}: ${error}`);
      }

      const aiData = await aiResponse.json();
      const fernReply = extractReply(aiData).trim();

      if (!fernReply) {
        throw new Error('No reply returned from Fern.');
      }

      console.log('[Wisper] Reply:', fernReply);
      setReply(fernReply);

      const speechResponse = await fetch(GROQ_SPEAK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: fernReply }),
      });

      if (!speechResponse.ok) {
        const error = await speechResponse.text();
        throw new Error(`Speech error ${speechResponse.status}: ${error}`);
      }

      const base64 = await arrayBufferToBase64(await speechResponse.arrayBuffer());
      const audioPath = `${FileSystem.cacheDirectory}wisper-${Date.now()}.mp3`;

      await FileSystem.writeAsStringAsync(audioPath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      ttsUriRef.current = audioPath;
      setIsSpeaking(true);
      player.replace(audioPath);
      player.seekTo(0);
      player.play();
    } catch (error) {
      console.error('[Wisper] Error:', error.message);
      Alert.alert('Voice Reply Error', error.message);
      setTranscription('Error transcribing audio');
      setReply('');
      setIsSpeaking(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>🎙️ Voice Transcriber</Text>
        <Text style={s.headerSub}>Record and transcribe your voice</Text>
      </View>

      {/* Content */}
      <ScrollView style={s.content} contentContainerStyle={s.contentInner}>
        {/* Recording Button */}
        <TouchableOpacity
          style={[s.recordBtn, isRecording && s.recordBtnActive]}
          onPress={toggleRecording}
          disabled={loading || isSpeaking}
        >
          <Text style={s.recordIcon}>
            {loading || isSpeaking ? '⏳' : isRecording ? '⏹️' : '🎤'}
          </Text>
          <Text style={s.recordText}>
            {loading ? 'Processing...' : isSpeaking ? 'Playing reply...' : isRecording ? 'Stop Recording' : 'Start Recording'}
          </Text>
        </TouchableOpacity>

        {/* Loading indicator */}
        {loading && (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color={C.orange} />
            <Text style={s.loadingText}>Getting Groq reply and speech...</Text>
          </View>
        )}

        {/* Transcription Result */}
        {transcription && !loading && (
          <View style={s.resultBox}>
            <Text style={s.resultLabel}>📝 Transcription:</Text>
            <Text style={s.resultText}>{transcription}</Text>
            {reply ? (
              <>
                <Text style={s.resultLabel}>🗣️ Fern Reply:</Text>
                <Text style={s.resultText}>{reply}</Text>
              </>
            ) : null}
            <TouchableOpacity
              style={s.clearBtn}
              onPress={async () => {
                try {
                  const currentUri = ttsUriRef.current;
                  ttsUriRef.current = null;
                  player.pause();
                  player.seekTo(0);
                  await cleanupAudio(currentUri);
                  setTranscription('');
                  setReply('');
                  setIsSpeaking(false);
                } catch (error) {
                  console.warn('[Wisper] Clear error:', error);
                }
              }}
            >
              <Text style={s.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Info */}
        <View style={s.infoBox}>
          <Text style={s.infoTitle}>💡 Tips:</Text>
          <Text style={s.infoText}>• Tap to start recording</Text>
          <Text style={s.infoText}>• Speak clearly into the microphone</Text>
          <Text style={s.infoText}>• Tap again to stop and transcribe</Text>
          <Text style={s.infoText}>• Results appear below</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.parch,
  },
  header: {
    backgroundColor: C.forest,
    padding: 20,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FDFAF6',
    fontFamily: 'Jost-Bold',
  },
  headerSub: {
    fontSize: 13,
    color: C.sage,
    fontFamily: 'Jost-Regular',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 20,
    gap: 20,
  },
  recordBtn: {
    backgroundColor: C.red,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  recordBtnActive: {
    backgroundColor: '#E74C3C',
    shadowOpacity: 0.6,
  },
  recordIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  recordText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Jost-Bold',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 14,
    color: C.brown,
    fontFamily: 'Jost-Regular',
    marginTop: 12,
  },
  resultBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 12,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
    fontFamily: 'Jost-Bold',
  },
  resultText: {
    fontSize: 15,
    color: C.ink,
    fontFamily: 'Jost-Regular',
    lineHeight: 22,
  },
  clearBtn: {
    backgroundColor: C.forest,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  clearBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Jost-Bold',
  },
  infoBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
    fontFamily: 'Jost-Bold',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: C.brown,
    fontFamily: 'Jost-Regular',
    marginVertical: 4,
  },
});
