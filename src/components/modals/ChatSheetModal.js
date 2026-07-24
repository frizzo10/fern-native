// A full-screen "Ask Fern" chat sheet, reachable from every screen via a
// floating button mounted once in App.js. The existing inline Ask Fern
// mic on HomeScreen stays as-is for a single quick question -- this is
// the complementary piece for an actual back-and-forth conversation,
// the same way Siri / ChatGPT's app take over the screen once a
// conversation becomes a conversation.
//
// Keeps the full message history and sends all of it on every turn --
// HomeScreen's inline mic only ever sends the single latest message
// (see HomeScreen.js's onTranscript), so a follow-up like "what about
// tomorrow?" has nothing to refer back to there. That gap is why this
// sheet exists as a separate surface rather than just widening the
// inline reply line.

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, radius, shadow } from '../../constants/tokens';
import { useContinuousMic } from '../../hooks/useContinuousMic';
import { useFernVoice } from '../../hooks/useFernVoice';
import { useSync } from '../../hooks/useSync';
import useLanguage from '../../hooks/useLanguage';
import { addRecipeIngredientsToShoppingList } from '../../utils/shoppingListSync';

const AI_URL = 'https://app.clickpickandcook.com/.netlify/functions/ai';
// Was free-text conversation only — Fern would happily reply "I've added
// bananas, butter... to your shopping list!" without anything actually
// being written anywhere, since this modal never called any shopping-list
// code. Asking for structured JSON (same technique NutritionTrackerModal
// already uses) lets the app decide what "add to shopping list" means and
// actually do it, instead of trusting the model's claim.
const SYSTEM_PROMPT = `You are Fern, a warm and decisive AI family assistant helping with meal planning, recipes, and the weekly schedule. Keep replies short — 2-4 sentences unless the person clearly wants more detail. When the person clearly asks to add ingredients or groceries to their shopping list, list the exact items in add_to_shopping_list — but do not name those items in your reply text, since the app confirms that separately; just acknowledge you're on it. Otherwise leave add_to_shopping_list empty. Respond ONLY with valid JSON, no markdown: {"reply":"...","add_to_shopping_list":["item1","item2"]}`;

// Sent once, silently, the first time the sheet opens with no history yet —
// never shown as a bubble itself, only Fern's reply to it is. Makes Fern
// look like it opens the conversation instead of the person facing an empty
// sheet with nothing on it.
const AUTO_OPENER_PROMPT = 'Greet me warmly in one short sentence, then briefly ask what I need help with today — dinner, a recipe, or my shopping list.';

function parseChatResponse(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

// What tapping the mic does while Fern is mid-reply:
//   true  — barge-in: stop playback immediately and start listening.
//   false — mic stays disabled (greyed out) until playback finishes.
// Flip this one flag to switch behavior app-wide.
const BARGE_IN_ON_MIC_PRESS = true;

function Bubble({ role, text }) {
  const isUser = role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowFern]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleFern, shadow.card]}>
        <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextFern}>{text}</Text>
      </View>
    </View>
  );
}

export default function ChatSheetModal({ visible, onClose, user }) {
  const { t, locale } = useLanguage();
  const [messages, setMessages] = useState([]); // [{role: 'user'|'fern', text}]
  const [inputText, setInputText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState(false);
  const scrollRef = useRef(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const { speakText, stopSpeaking, isSpeaking } = useFernVoice({
    onError: (message) => console.warn('[ChatSheetModal] voice error:', message),
    token: user?.token,
  });
  const { data, pull, pushAllFromStorage } = useSync(user);
  const shoppingRef = useRef(data.shopping);
  shoppingRef.current = data.shopping;

  const askFern = useCallback(async (text, { silent = false } = {}) => {
    if (!text || !text.trim()) return;
    const userMsg = { role: 'user', text: text.trim() };
    // Full history, not just the latest message — the actual gap in
    // HomeScreen's inline Ask Fern (and in useContinuousMic's own
    // internal processFernReply), which only ever sends one message.
    // In silent mode (the auto-opener) this user turn is sent to the AI
    // for context but never added to `messages`, so no bubble for it ever
    // renders — only Fern's reply below does.
    const requestMessages = [...messagesRef.current, userMsg];
    if (!silent) {
      setMessages(requestMessages);
      setInputText('');
    }
    setError(false);
    setThinking(true);

    try {
      const res = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: SYSTEM_PROMPT,
          messages: requestMessages.map(m => ({ role: m.role === 'fern' ? 'assistant' : 'user', content: m.text })),
          locale,
          userId: user?.id,
          token: user?.token,
        }),
      });
      if (!res.ok) {
        throw new Error(`ai request failed: ${res.status}`);
      }
      const d = await res.json();
      const rawText = d?.content?.[0]?.text ?? d?.data?.content?.[0]?.text ?? '';
      if (!rawText) throw new Error('ai response had no content');

      const parsed = parseChatResponse(rawText);
      const reply = parsed?.reply || rawText;
      const itemsToAdd = Array.isArray(parsed?.add_to_shopping_list)
        ? parsed.add_to_shopping_list.map(item => String(item || '').trim()).filter(Boolean)
        : [];

      setMessages(prev => [...prev, { role: 'fern', text: reply }]);
      speakText(reply);

      if (itemsToAdd.length) {
        const { addedCount, checkedCount } = await addRecipeIngredientsToShoppingList(
          { id: 'ask-fern', title: 'Ask Fern', ingredients: itemsToAdd },
          shoppingRef.current
        );
        await pushAllFromStorage();
        await pull();
        if (addedCount > 0 || checkedCount > 0) {
          const confirmText = t('chat_shopping_list_confirm', { items: itemsToAdd.join(', ') });
          setMessages(prev => [...prev, { role: 'fern', text: confirmText }]);
        }
      }
    } catch (e) {
      console.warn('[ChatSheetModal] Ask Fern failed:', e.message);
      setError(true);
    } finally {
      setThinking(false);
    }
  }, [locale, user, speakText, pull, pushAllFromStorage, t]);

  const { isListening, start, stop } = useContinuousMic({
    locale,
    token: user?.token,
    autoSpeakReply: false, // askFern already speaks the reply itself
    onTranscript: askFern,
    onError: (e) => {
      console.warn('[ChatSheetModal] Mic error:', e);
      setError(true);
    },
  });

  const micDisabled = isSpeaking && !BARGE_IN_ON_MIC_PRESS;

  const handleMicPress = useCallback(() => {
    if (isListening) {
      stop();
      return;
    }
    if (isSpeaking) {
      if (!BARGE_IN_ON_MIC_PRESS) return; // button is disabled in this mode, but guard anyway
      // Stop Fern's speech first — starting the recorder while playback is
      // still holding the audio session is what left mic taps not actually
      // interrupting speech before.
      stopSpeaking();
    }
    start();
  }, [isListening, isSpeaking, start, stop, stopSpeaking]);

  // Stop listening and any playback when the sheet closes.
  useEffect(() => {
    if (!visible) {
      if (isListening) stop();
      stopSpeaking();
    }
  }, [visible]);

  // First time the sheet is opened with no conversation yet, kick things
  // off ourselves instead of leaving the person looking at an empty sheet.
  useEffect(() => {
    if (visible && messagesRef.current.length === 0) {
      askFern(AUTO_OPENER_PROMPT, { silent: true });
    }
  }, [visible]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollToEnd({ animated: true });
  }, [messages, thinking]);

  const handleClose = useCallback(() => {
    if (isListening) stop();
    stopSpeaking();
    onClose();
  }, [isListening, stop, stopSpeaking, onClose]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🌿 {t('ask_fern_btn')}</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.closeX}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} style={styles.messageList} contentContainerStyle={styles.messageListContent}>
          {messages.length === 0 && !thinking && !error && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🌿</Text>
              <Text style={styles.emptyText}>{t('chat_sheet_empty_hint')}</Text>
            </View>
          )}
          {messages.map((m, i) => <Bubble key={i} role={m.role} text={m.text} />)}
          {thinking && (
            <View style={[styles.bubbleRow, styles.bubbleRowFern]}>
              <View style={[styles.bubble, styles.bubbleFern, shadow.card]}>
                <ActivityIndicator size="small" color={colors.forest} />
              </View>
            </View>
          )}
          {error && (
            <View style={[styles.bubbleRow, styles.bubbleRowFern]}>
              <View style={[styles.bubble, styles.bubbleError]}>
                <Text style={styles.bubbleTextError}>{t('generic_error_message')}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputRow}>
          <TouchableOpacity
            style={[styles.micBtn, isListening && styles.micBtnActive, micDisabled && styles.micBtnDisabled]}
            onPress={handleMicPress}
            disabled={micDisabled}
          >
            <Text style={styles.micBtnText}>{isListening ? '⏹' : '🎙'}</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={t('chat_input_placeholder')}
            placeholderTextColor={colors.brown}
            onSubmitEditing={() => askFern(inputText)}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={() => askFern(inputText)} disabled={thinking}>
            <Text style={styles.sendBtnText}>➤</Text>
          </TouchableOpacity>
        </View>
        {isListening && <Text style={styles.listeningHint}>{t('mic_listening')}</Text>}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.parch },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontFamily: 'serif', fontSize: 19, fontWeight: '800', color: colors.ink },
  closeX: { fontSize: 20, color: colors.brown, padding: 4 },

  messageList: { flex: 1 },
  messageListContent: { padding: 16, gap: 10 },

  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: colors.brown, textAlign: 'center', lineHeight: 20 },

  bubbleRow: { flexDirection: 'row', marginBottom: 4 },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowFern: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleUser: { backgroundColor: colors.forest },
  bubbleFern: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  bubbleError: { backgroundColor: '#FBEAE7', borderWidth: 1, borderColor: colors.voiceRed },
  bubbleTextUser: { color: colors.onFern, fontSize: 15, lineHeight: 21 },
  bubbleTextFern: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  bubbleTextError: { color: colors.voiceRed, fontSize: 14 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  micBtn: {
    width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.paper,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: colors.voiceRed, borderColor: colors.voiceRed },
  micBtnDisabled: { opacity: 0.4 },
  micBtnText: { fontSize: 16 },
  textInput: {
    flex: 1, backgroundColor: colors.paper, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: colors.ink,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },

  listeningHint: { textAlign: 'center', fontSize: 12, color: colors.brown, paddingBottom: 10, fontStyle: 'italic' },
});
