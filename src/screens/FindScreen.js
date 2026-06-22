// FindScreen.js — Fern Native
// Voice mic loop: VAD → AI → TTS → play → restart
// This is the core feature of the app

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  SafeAreaView, TextInput, Animated, Easing, AppState,
  Platform, Alert, ActivityIndicator
} from 'react-native';
import { useAudioRecorder, RecordingPresets, useAudioPlayer } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';

const C = {
  forest: '#1C3A1A',
  orange: '#E8651A',
  sage:   '#A8D5A2',
  parch:  '#FDFAF6',
  ink:    '#1A0E05',
  brown:  '#9C835F',
  border: '#E8E0D0',
  red:    '#C0392B',
};

const AI_URL       = 'https://app.clickpickandcook.com/.netlify/functions/ai';
const TTS_URL      = 'https://app.clickpickandcook.com/.netlify/functions/fern-speak';
const WHISPER_KEY  = process.env.WHISPER_KEY;

const STOP_WORDS = ['stop', 'goodbye', 'done', 'exit', 'bye'];

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleFern]}>
      {!isUser && <Text style={s.fernLabel}>🌿 Fern</Text>}
      <Text style={[s.bubbleText, isUser && s.bubbleTextUser]}>{msg.content}</Text>
    </View>
  );
}

// ── Pulsing Mic Button ────────────────────────────────────────────────────────
function MicButton({ isListening, onPress, disabled }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.18, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,    duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
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
      <Text style={s.micLabel}>{isListening ? 'Listening...' : 'Tap to talk to Fern'}</Text>
    </TouchableOpacity>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FindScreen() {
  const [messages, setMessages]       = useState([
    { role: 'assistant', content: 'Hi! Ask me anything about food — recipes, what to make for dinner, substitutions, or scan your store circular for deals.' }
  ]);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking]   = useState(false);
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [textInput, setTextInput]     = useState('');
  const [profile, setProfile]         = useState({});

  const scrollRef       = useRef(null);
  const silenceTimer    = useRef(null);
  const meteringTimer   = useRef(null);
  const maxSilenceTimer = useRef(null);
  const appStateRef     = useRef(AppState.currentState);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Load profile for system prompt context
  useEffect(() => {
    AsyncStorage.getItem('remi_explicit').then(v => {
      if (v) setProfile(JSON.parse(v));
    });

    // Stop mic when app backgrounds
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' && isListening) stopListening();
    });
    return () => sub.remove();
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  function addMessage(role, content) {
    setMessages(prev => [...prev, { role, content }]);
  }

  // ── Start listening ─────────────────────────────────────────────────────────
  async function startListening() {
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsListening(true);

      // Max 3 minutes then stop automatically
      maxSilenceTimer.current = setTimeout(() => stopListening(), 3 * 60 * 1000);

      // VAD — poll metering every 100ms
      meteringTimer.current = setInterval(async () => {
        try {
          const status = await recorder.getStatusAsync();
          const db = status.metering ?? -100;
          if (db < -35) {
            // Silence
            if (!silenceTimer.current) {
              silenceTimer.current = setTimeout(() => {
                sendToFern();
              }, 1500);
            }
          } else {
            // Sound detected — reset silence timer
            if (silenceTimer.current) {
              clearTimeout(silenceTimer.current);
              silenceTimer.current = null;
            }
          }
        } catch (e) {}
      }, 100);

    } catch (e) {
      Alert.alert('Microphone error', e.message);
    }
  }

  // ── Stop listening ──────────────────────────────────────────────────────────
  async function stopListening() {
    clearInterval(meteringTimer.current);
    clearTimeout(silenceTimer.current);
    clearTimeout(maxSilenceTimer.current);
    meteringTimer.current = null;
    silenceTimer.current = null;
    setIsListening(false);
    try {
      await recorder.stopAndUnloadAsync();
    } catch (e) {}
  }

  // ── Toggle mic ──────────────────────────────────────────────────────────────
  async function toggleMic() {
    if (isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  }

  // ── Send voice to Fern ──────────────────────────────────────────────────────
  async function sendToFern() {
    clearInterval(meteringTimer.current);
    clearTimeout(silenceTimer.current);
    setIsListening(false);

    try {
      await recorder.stopAndUnloadAsync();
    } catch (e) {}

    const uri = recorder.uri;
    if (!uri) return;

    setIsThinking(true);

    try {
      // Step 1: Transcribe with Whisper
      const formData = new FormData();
      formData.append('file', { uri, name: 'audio.m4a', type: 'audio/m4a' });
      formData.append('model', 'whisper-1');

      const transcriptRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${WHISPER_KEY}` },
        body: formData
      });
      const { text } = await transcriptRes.json();

      if (!text || text.trim() === '') {
        setIsThinking(false);
        // Nothing detected — restart listening
        setTimeout(() => startListening(), 500);
        return;
      }

      // Check stop words
      if (STOP_WORDS.some(w => text.toLowerCase().includes(w))) {
        addMessage('user', text);
        addMessage('assistant', 'Goodbye! Tap the mic anytime to chat again.');
        setIsThinking(false);
        return;
      }

      addMessage('user', text);
      await talkToFern(text);

    } catch (e) {
      console.warn('sendToFern error:', e.message);
      setIsThinking(false);
    }
  }

  // ── Send text → AI → TTS ────────────────────────────────────────────────────
  async function talkToFern(userText) {
    setIsThinking(true);

    try {
      // Build system prompt with user context
      const system = [
        'You are Fern, a friendly personal AI food and grocery assistant.',
        'Be warm, concise, and conversational. Keep responses under 3 sentences when possible.',
        profile.userName ? `The user's name is ${profile.userName}.` : '',
        profile.dietary  ? `Their dietary preference is ${profile.dietary}.` : '',
        profile.skill    ? `Their cooking skill is ${profile.skill}.` : '',
      ].filter(Boolean).join(' ');

      // Step 2: Get AI response
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
      const reply = aiData.content?.[0]?.text || 'Sorry, I had trouble with that. Try again?';

      addMessage('assistant', reply);
      setIsThinking(false);

      // Step 3: TTS
      await speakReply(reply);

    } catch (e) {
      console.warn('talkToFern error:', e.message);
      addMessage('assistant', 'Sorry, something went wrong. Please try again.');
      setIsThinking(false);
    }
  }

  // ── TTS ──────────────────────────────────────────────────────────────────────
  async function speakReply(text) {
    setIsSpeaking(true);
    try {
      const ttsRes = await fetch(TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'nova' })
      });

      // Save MP3 to temp file and play
      const blob = await ttsRes.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64 = reader.result;
        const player = useAudioPlayer(base64);
        player.play();
        player.addListener('playbackStatusUpdate', status => {
          if (status.didJustFinish) {
            setIsSpeaking(false);
            // Restart mic 300ms after audio ends
            setTimeout(() => startListening(), 300);
          }
        });
      };
    } catch (e) {
      console.warn('TTS error:', e.message);
      setIsSpeaking(false);
      setTimeout(() => startListening(), 300);
    }
  }

  // ── Send text manually ───────────────────────────────────────────────────────
  async function sendText() {
    const text = textInput.trim();
    if (!text) return;
    setTextInput('');
    addMessage('user', text);
    await talkToFern(text);
  }

  const statusText = isThinking ? 'Thinking...' : isSpeaking ? 'Speaking...' : '';

  return (
    <View style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>🔍 Find & Ask Fern</Text>
        {statusText ? <Text style={s.statusText}>{statusText}</Text> : null}
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={s.messages}
        contentContainerStyle={s.messagesContent}
      >
        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        {isThinking && (
          <View style={s.thinking}>
            <ActivityIndicator size="small" color={C.orange} />
            <Text style={s.thinkingText}>Fern is thinking...</Text>
          </View>
        )}
      </ScrollView>

      {/* Mic button */}
      <View style={s.micArea}>
        <MicButton
          isListening={isListening}
          onPress={toggleMic}
          disabled={isThinking || isSpeaking}
        />
      </View>

      {/* Text input fallback */}
      <View style={s.inputRow}>
        <TextInput
          style={s.textInput}
          placeholder="Or type to Fern..."
          placeholderTextColor={C.brown}
          value={textInput}
          onChangeText={setTextInput}
          onSubmitEditing={sendText}
          returnKeyType="send"
          editable={!isThinking && !isSpeaking}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!textInput.trim() || isThinking) && s.sendBtnDisabled]}
          onPress={sendText}
          disabled={!textInput.trim() || isThinking}
        >
          <Text style={s.sendBtnText}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, height: 50, backgroundColor: C.parch},
  header:         { backgroundColor: C.forest, padding: 16,height: 80, flexDirection: 'row',
                    alignItems: 'center', justifyContent: 'space-between' },
  headerTitle:    { fontSize: 17, color: '#FDFAF6', fontFamily: 'Jost-SemiBold', marginTop: 20 },
  statusText:     { fontSize: 12, color: C.sage, fontFamily: 'Jost-Regular' },

  // Messages
  messages:       { flex: 1 },
  messagesContent:{ padding: 16, gap: 12 },
  bubble:         { maxWidth: '82%', borderRadius: 16, padding: 12 },
  bubbleFern:     { backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, alignSelf: 'flex-start' },
  bubbleUser:     { backgroundColor: C.forest, alignSelf: 'flex-end' },
  fernLabel:      { fontSize: 11, color: C.brown, fontFamily: 'Jost-SemiBold', marginBottom: 4 },
  bubbleText:     { fontSize: 15, color: C.ink, fontFamily: 'Jost-Regular', lineHeight: 22 },
  bubbleTextUser: { color: '#FDFAF6' },
  thinking:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  thinkingText:   { fontSize: 13, color: C.brown, fontFamily: 'Jost-Regular' },

  // Mic
  micArea:        { alignItems: 'center', paddingVertical: 20, backgroundColor: C.parch },
  micBtn:         { width: 72, height: 72, borderRadius: 36, backgroundColor: C.red,
                    alignItems: 'center', justifyContent: 'center',
                    shadowColor: C.red, shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  micBtnActive:   { backgroundColor: '#E74C3C', shadowOpacity: 0.6 },
  micIcon:        { fontSize: 28 },
  micLabel:       { marginTop: 8, fontSize: 12, color: C.brown,
                    fontFamily: 'Jost-Regular', textAlign: 'center' },

  // Text input
  inputRow:       { flexDirection: 'row', padding: 12, gap: 8,
                    borderTopWidth: 1, borderColor: C.border, backgroundColor: '#fff' },
  textInput:      { flex: 1, backgroundColor: C.parch, borderRadius: 10, borderWidth: 1,
                    borderColor: C.border, paddingHorizontal: 14, paddingVertical: 10,
                    fontSize: 15, color: C.ink, fontFamily: 'Jost-Regular' },
  sendBtn:        { backgroundColor: C.forest, borderRadius: 10, width: 44,
                    alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:{ opacity: 0.4 },
  sendBtnText:    { fontSize: 20, color: '#fff', fontFamily: 'Jost-Bold' },
});
