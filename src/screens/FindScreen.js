// FindScreen.js — Fern Native
// Voice mic loop: VAD → AI → TTS → play → restart
// This is the core feature of the app

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Animated, Easing, AppState,
  KeyboardAvoidingView,
  Platform, Alert, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { useAudioPlayer } from 'expo-audio';
import { useContinuousMic } from '../hooks/useContinuousMic';
import useLanguage from '../hooks/useLanguage';

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

const AI_URL = 'https://app.clickpickandcook.com/.netlify/functions/ai';
const TTS_URL = 'https://app.clickpickandcook.com/.netlify/functions/fern-speak';
const STOP_WORDS = ['stop', 'goodbye', 'done', 'exit', 'bye'];

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const { t } = useLanguage();
  const isUser = msg.role === 'user';
  return (
    <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleFern]}>
      {!isUser && <Text style={s.fernLabel}>{t('fern_label')}</Text>}
      {isUser ? <Text style={s.userLabel}>{msg.source === 'typed' ? t('msg_source_typed') : t('msg_source_spoken')}</Text> : null}
      <Text style={[s.bubbleText, isUser && s.bubbleTextUser]}>{msg.content}</Text>
    </View>
  );
}

// ── Pulsing Mic Button ────────────────────────────────────────────────────────
function MicButton({ isListening, onPress, disabled }) {
  const { t } = useLanguage();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.18, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [isListening]);

  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8}>
      <Animated.View style={[
        s.micBtn,
        isListening && s.micBtnActive,
        { transform: [{ scale: pulse }] }
      ]}>
        <Text style={s.micIcon}>{isListening ? '🎙' : '🎤'}</Text>
      </Animated.View>
      <Text style={s.micLabel}>{isListening ? t('mic_listening') : t('mic_tap_to_talk')}</Text>
    </TouchableOpacity>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FindScreen({ user }) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: t('welcome_message') }
  ]);
  const [textInput, setTextInput] = useState('');
  const [profile, setProfile] = useState({});
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [loopState, setLoopState] = useState(null);

  const scrollRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const ttsPlayer = useAudioPlayer(null);
  const restartAfterPlaybackRef = useRef(false);

  // Use the continuous mic hook
  const { isListening, isProcessing, start, stop } = useContinuousMic({
    autoSpeakReply: false,
    onTranscript: async (transcript) => {
      console.log('[FindScreen] transcript received:', transcript);

      // Check stop words - stop listening first
      if (STOP_WORDS.some(w => transcript.toLowerCase().includes(w))) {
        stop();
        addMessage('user', transcript, 'spoken');
        addMessage('assistant', t('goodbye_message'));
        setLoopState(null);
        restartAfterPlaybackRef.current = false;
        return;
      }

      stop();
      restartAfterPlaybackRef.current = true;

      // Add user message
      addMessage('user', transcript, 'spoken');
      // Get AI response and speak it
      await talkToFern(transcript);
    },
    onError: (error) => {
      console.warn('[FindScreen] mic error:', error);
      Alert.alert(t('mic_error_title'), error);
    }
  });

  // Load profile for system prompt context
  useEffect(() => {
    AsyncStorage.getItem('remi_explicit').then(v => {
      if (v) setProfile(JSON.parse(v));
    });

    // Stop mic when app backgrounds
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' && isListening) stop();
    });
    return () => sub.remove();
  }, [isListening, stop]);

  // Scroll to bottom on new message
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  function addMessage(role, content, source = 'spoken') {
    setMessages(prev => [...prev, { role, content, source }]);
  }

  // ── Send text → AI → TTS ────────────────────────────────────────────────────
  async function talkToFern(userText) {
    setIsThinking(true);
    setLoopState('thinking');

    try {
      // Build system prompt with user context
      const system = [
        'You are Fern, a friendly personal AI food and grocery assistant.',
        'Be warm, concise, and conversational. Keep responses under 3 sentences when possible.',
        profile.userName ? `The user's name is ${profile.userName}.` : '',
        profile.dietary ? `Their dietary preference is ${profile.dietary}.` : '',
        profile.skill ? `Their cooking skill is ${profile.skill}.` : '',
      ].filter(Boolean).join(' ');

      // Step 1: Get AI response
      const aiRes = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system,
          messages: [
            ...messages.slice(-6).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
            { role: 'user', content: userText }
          ]
        })
      });
      const aiData = await aiRes.json();
      const reply = aiData.content?.[0]?.text || t('ai_reply_fallback');
      console.log('AI reply:', reply);
      addMessage('assistant', reply);
      setIsThinking(false);

      // Step 2: TTS
      await speakReply(reply);

    } catch (e) {
      console.warn('talkToFern error:', e.message);
      addMessage('assistant', t('generic_error_message'));
      setIsThinking(false);
      setLoopState(null);
      restartAfterPlaybackRef.current = false;
    }
  }

  // ── TTS ──────────────────────────────────────────────────────────────────────
  async function speakReply(text) {
    setIsSpeaking(true);
    setLoopState('speaking');
    try {
      if (ttsPlayer) {
        ttsPlayer.pause();
        ttsPlayer.seekTo(0);
      }

      console.log('TTS Request:', { TTS_URL, text });

      // Match the payload format from useContinuousMic hook
      const payload = { text };
      console.log('TTS Payload:', JSON.stringify(payload));

      const ttsRes = await fetch(TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log('TTS Response status:', ttsRes.status, ttsRes.statusText);

      if (!ttsRes.ok) {
        const errorBody = await ttsRes.text();
        console.error(`TTS request failed: ${ttsRes.status}`, errorBody);
        throw new Error(`TTS error ${ttsRes.status}: ${errorBody || 'Unknown error'}`);
      }

      // Read response as arrayBuffer (like the hook does)
      const arrayBuffer = await ttsRes.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }

      const base64 = global.btoa(binary);
      console.log('Base64 length:', base64.length);

      // Save to temp file
      const tempUri = `${FileSystem.cacheDirectory}tts_${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(
        tempUri,
        base64,
        { encoding: FileSystem.EncodingType.Base64 }
      );

      console.log('TTS saved to:', tempUri);

      // Load and play
      ttsPlayer.replace(tempUri);

      // Subscribe to completion
      const unsubscribe = ttsPlayer.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          setIsSpeaking(false);
          setLoopState(null);
          unsubscribe?.remove?.();
          // Clean up temp file
          FileSystem.deleteAsync(tempUri).catch(() => { });
          if (restartAfterPlaybackRef.current) {
            restartAfterPlaybackRef.current = false;
            setTimeout(() => start(), 300);
          }
        }
      });

      ttsPlayer.play();
    } catch (e) {
      console.warn('TTS error:', e.message);
      Alert.alert(t('tts_error_title'), e.message);
      setIsSpeaking(false);
      setLoopState(null);
      restartAfterPlaybackRef.current = false;
    }
  }

  // ── Toggle mic ──────────────────────────────────────────────────────────────
  async function toggleMic() {
    if (isListening) {
      stop();
      setLoopState(null);
      restartAfterPlaybackRef.current = false;
    } else {
      if (isSpeaking) {
        return;
      }
      setLoopState('listening');
      start();
    }
  }

  // ── Send text manually ───────────────────────────────────────────────────────
  async function sendText() {
    const text = textInput.trim();
    if (!text) return;
    setTextInput('');
    addMessage('user', text, 'typed');
    await talkToFern(text);
  }

  const statusText = isThinking ? t('mic_thinking_status') : isSpeaking ? t('mic_speaking_status') : loopState === 'listening' ? t('mic_listening') : '';

  return (
    <KeyboardAvoidingView
      style={s.kav}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 108 : 0}
    >
      <View style={s.safe}>
        {statusText ? (
          <View style={s.statusBarWrap}>
            <Text style={s.statusText}>{statusText}</Text>
          </View>
        ) : null}

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={s.messages}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentContainerStyle={s.messagesContent}
        >
          {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
          {isThinking && (
            <View style={s.thinking}>
              <ActivityIndicator size="small" color={C.orange} />
              <Text style={s.thinkingText}>{t('fern_thinking')}</Text>
            </View>
          )}
        </ScrollView>

        {/* Mic button */}
        <View style={s.micArea}>
          <MicButton
            isListening={isListening}
            onPress={toggleMic}
            disabled={isThinking || isSpeaking || loopState === 'speaking'}
          />
        </View>

        {/* Text input fallback */}
        <View style={s.inputRow}>
          <TextInput
            style={s.textInput}
            placeholder={t('type_to_fern')}
            placeholderTextColor={C.brown}
            value={textInput}
            onChangeText={setTextInput}
            onSubmitEditing={sendText}
            returnKeyType="send"
            editable={!isThinking && !isSpeaking && loopState !== 'speaking'}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!textInput.trim() || isThinking) && s.sendBtnDisabled]}
            onPress={sendText}
            disabled={!textInput.trim() || isThinking || isSpeaking}
          >
            <Text style={s.sendBtnText}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  kav: { flex: 1 },
  safe: { flex: 1, backgroundColor: C.parch },
  statusBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  statusText: { fontSize: 12, color: C.forest, fontFamily: 'Jost-Regular' },

  // Messages
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 12 },
  bubble: { maxWidth: '82%', borderRadius: 16, padding: 12 },
  bubbleFern: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, alignSelf: 'flex-start' },
  bubbleUser: { backgroundColor: C.forest, alignSelf: 'flex-end' },
  fernLabel: { fontSize: 11, color: C.brown, fontFamily: 'Jost-SemiBold', marginBottom: 4 },
  userLabel: { fontSize: 11, color: C.sage, fontFamily: 'Jost-SemiBold', marginBottom: 4 },
  bubbleText: { fontSize: 15, color: C.ink, fontFamily: 'Jost-Regular', lineHeight: 22 },
  bubbleTextUser: { color: '#FDFAF6' },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  thinkingText: { fontSize: 13, color: C.brown, fontFamily: 'Jost-Regular' },

  // Mic
  micArea: { alignItems: 'center', paddingVertical: 20, backgroundColor: C.parch },
  micBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: C.red,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.red, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8
  },
  micBtnActive: { backgroundColor: '#E74C3C', shadowOpacity: 0.6 },
  micIcon: { fontSize: 28 },
  micLabel: {
    marginTop: 8, fontSize: 12, color: C.brown,
    fontFamily: 'Jost-Regular', textAlign: 'center'
  },

  // Text input
  inputRow: {
    flexDirection: 'row', padding: 12, gap: 8,
    borderTopWidth: 1, borderColor: C.border, backgroundColor: '#fff'
  },
  textInput: {
    flex: 1, backgroundColor: C.parch, borderRadius: 10, borderWidth: 1,
    borderColor: C.border, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: C.ink, fontFamily: 'Jost-Regular'
  },
  sendBtn: {
    backgroundColor: C.forest, borderRadius: 10, width: 44,
    alignItems: 'center', justifyContent: 'center'
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontSize: 20, color: '#fff', fontFamily: 'Jost-Bold' },
});
