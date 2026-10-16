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
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, shadow } from '../../constants/tokens';
import useEntitlement from '../../hooks/useEntitlement';
import { TIERS } from '../../constants/tiers';
import UpgradeGateModal from '../UpgradeGateModal';
import { useContinuousMic } from '../../hooks/useContinuousMic';
import { useFernVoice } from '../../hooks/useFernVoice';
import { useSync } from '../../hooks/useSync';
import useLanguage from '../../hooks/useLanguage';
import { addRecipeIngredientsToShoppingList } from '../../utils/shoppingListSync';
import { LAUNCH_ALL_FREE } from '../../constants/launch';
import { spokenSummary } from '../../utils/spokenSummary';
import { buildAgentContext, buildAgentPrompt, executeAgentActions, emitAgentChange } from '../../services/fernAgent';

// Free plan: a small number of Ask Fern questions per local day (device-only counter). Pro and up
// are unlimited. The auto-opener (silent) turn never counts.
const FREE_CHAT_KEY = 'fern_free_chat_count';
const FREE_CHAT_PER_DAY = 5;
// Launch period (constants/launch.js): everyone is Pro Max, but chat is capped per day to keep AI cost bounded.
const LAUNCH_CHAT_PER_DAY = 25;
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
async function freeChatUsedToday() {
  try {
    const raw = await AsyncStorage.getItem(FREE_CHAT_KEY);
    const rec = raw ? JSON.parse(raw) : null;
    return rec && rec.day === todayKey() ? Number(rec.count) || 0 : 0;
  } catch (e) { return 0; }
}
async function bumpFreeChat() {
  try {
    const used = await freeChatUsedToday();
    await AsyncStorage.setItem(FREE_CHAT_KEY, JSON.stringify({ day: todayKey(), count: used + 1 }));
  } catch (e) { /* best effort */ }
}

// How many times Fern has introduced herself in the general chat (she does it the first two times).
const AGENT_INTRO_KEY = 'fern_agent_intro_count';

const AI_URL = 'https://app.clickpickandcook.com/.netlify/functions/ai';
// Was free-text conversation only — Fern would happily reply "I've added
// bananas, butter... to your shopping list!" without anything actually
// being written anywhere, since this modal never called any shopping-list
// code. Asking for structured JSON (same technique NutritionTrackerModal
// already uses) lets the app decide what "add to shopping list" means and
// actually do it, instead of trusting the model's claim.
const DEFAULT_SYSTEM_PROMPT = `You are Fern, a warm and decisive AI family assistant helping with meal planning, recipes, and the weekly schedule. Keep replies short — 2-4 sentences unless the person clearly wants more detail. When the person clearly asks to add ingredients or groceries to their shopping list, list the exact items in add_to_shopping_list — but do not name those items in your reply text, since the app confirms that separately; just acknowledge you're on it. Otherwise leave add_to_shopping_list empty. Respond ONLY with valid JSON, no markdown: {"reply":"...","add_to_shopping_list":["item1","item2"]}`;

// Sent once, silently, the first time the sheet opens with no history yet —
// never shown as a bubble itself, only Fern's reply to it is. Makes Fern
// look like it opens the conversation instead of the person facing an empty
// sheet with nothing on it.
const DEFAULT_AUTO_OPENER_PROMPT = 'Greet me warmly in one short sentence, then briefly ask what I need help with today — dinner, a recipe, or my shopping list.';

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

// systemPrompt/autoOpenerPrompt/title/emptyHintKey let a caller repurpose this
// same voice+chat surface for a scoped conversation (e.g. Family Hub's "Plan
// with Fern") instead of the general Ask Fern assistant, without duplicating
// all of the mic/voice/JSON-parsing plumbing. onAction receives the full
// parsed JSON reply after the built-in add_to_shopping_list handling runs —
// a caller can add extra keys to its own systemPrompt's JSON contract (e.g.
// add_meals/add_activities) and handle them here; returning a string from
// onAction appends it as an extra Fern bubble (text-only, not re-spoken —
// same convention the shopping-list confirmation below already uses).
export default function ChatSheetModal({
  visible, onClose, user,
  systemPrompt: customSystemPrompt,
  agent, // true = Fern the food agent (knows the list, recipes, week, circular, coupons and acts on them). Default: on unless a custom systemPrompt is given
  agentExtra = '', // page-specific instructions appended to the agent prompt
  autoOpenerPrompt: customAutoOpener,
  title,
  emptyHintKey = 'chat_sheet_empty_hint',
  onAction,
  onSpeechDone, // (parsed) => void, called once Fern has finished speaking a reply whose action asked to close the card / open something
  compact = false, // true = a bottom card that leaves the page above it visible, instead of a full-screen sheet
  mode, // 'voice' = Fern speaks and the mic re-arms after every reply (hands-free); 'text' = typing only, no speech
}) {
  const { t, locale } = useLanguage();
  const agentOn = agent ?? !customSystemPrompt;
  const autoOpenerPrompt = customAutoOpener || DEFAULT_AUTO_OPENER_PROMPT;
  const systemPrompt = customSystemPrompt || DEFAULT_SYSTEM_PROMPT;
  const { hasAccess } = useEntitlement();
  const isFreeRef = useRef(false);
  isFreeRef.current = !hasAccess(TIERS.PRO);
  const [limitGate, setLimitGate] = useState(false);
  const [messages, setMessages] = useState([]); // [{role: 'user'|'fern', text}]
  const [inputText, setInputText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState(false);
  // Fern's voice reply is on its way (being fetched) or playing: the mic must not open until it has finished.
  const [speechPending, setSpeechPending] = useState(false);
  const heardSpeech = useRef(false);
  const finishAction = useRef(null); // the parsed reply to hand to onSpeechDone when her voice ends
  const emptyHeard = useRef(0); // consecutive recordings that came back with no words
  const scrollRef = useRef(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const [voiceErr, setVoiceErr] = useState('');
  const { speakText, stopSpeaking, isSpeaking, isThinking: voiceThinking } = useFernVoice({
    onError: (message) => { console.warn('[ChatSheetModal] voice error:', message); setVoiceErr(String(message || '').slice(0, 140)); },
    token: user?.token,
    enabled: visible && mode !== 'text',
  });
  const { data, pull, pushAllFromStorage, pushChangedFromStorage } = useSync(user);
  const shoppingRef = useRef(data.shopping);
  shoppingRef.current = data.shopping;

  const onSpeechDoneRef = useRef(onSpeechDone);
  onSpeechDoneRef.current = onSpeechDone;
  const runFinishAction = () => {
    const p = finishAction.current;
    finishAction.current = null;
    if (p) onSpeechDoneRef.current?.(p);
  };

  const askFern = useCallback(async (text, { silent = false } = {}) => {
    if (!text || !text.trim()) return;
    if (!silent && LAUNCH_ALL_FREE) {
      if ((await freeChatUsedToday()) >= LAUNCH_CHAT_PER_DAY) {
        Alert.alert(t('launch_chat_limit_title'), t('launch_chat_limit_desc'));
        return;
      }
      await bumpFreeChat();
    } else if (!silent && isFreeRef.current) {
      if ((await freeChatUsedToday()) >= FREE_CHAT_PER_DAY) { setLimitGate(true); return; }
      await bumpFreeChat();
    }
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
    setVoiceErr('');
    setThinking(true);

    try {
      // The agent sees fresh state on every turn (list, recipes, week, circular, coupons), so what she says is current.
      const system = agentOn
        ? buildAgentPrompt(await buildAgentContext(), { extra: agentExtra, voice: mode === 'voice' })
        : systemPrompt;
      const res = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system,
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
      if (mode === 'voice') {
        // The audio takes a moment to arrive; until it has played, the mic stays closed (opening it early made the
        // recording go silent when playback switched the phone out of recording mode).
        heardSpeech.current = false;
        setSpeechPending(true);
        setTimeout(() => setSpeechPending(false), 25000); // safety: never leave the mic closed for good
        speakText(spokenSummary(reply)).then((uri) => { if (!uri) { setSpeechPending(false); runFinishAction(); } }).catch(() => { setSpeechPending(false); runFinishAction(); });
      } else {
        speakText(spokenSummary(reply));
      }

      if (itemsToAdd.length) {
        const { addedCount, checkedCount } = await addRecipeIngredientsToShoppingList(
          { id: 'ask-fern', title: 'Ask Fern', ingredients: itemsToAdd },
          shoppingRef.current
        );
        await pushAllFromStorage();
        await pull();
        emitAgentChange();
        if (addedCount > 0 || checkedCount > 0) {
          const confirmText = t('chat_shopping_list_confirm', { items: itemsToAdd.join(', ') });
          setMessages(prev => [...prev, { role: 'fern', text: confirmText }]);
        }
      }

      if (agentOn && Array.isArray(parsed?.actions) && parsed.actions.length) {
        const done = await executeAgentActions(parsed.actions, { pushChangedFromStorage, token: user?.token, canSaveUnlimited: !isFreeRef.current });
        if (done.lines.length) {
          setMessages(prev => [...prev, { role: 'fern', text: done.lines.join('\n') }]);
          await pull();
          emitAgentChange();
        }
        // Hand the "open / go / close" part to the caller once her voice has finished.
        parsed.show_recipes_for = done.showRecipesFor || parsed.show_recipes_for || '';
        parsed.go_to = done.goTo || '';
        if (done.close) parsed.close_chat = true;
      }

      if (onAction) {
        const confirmText = onAction(parsed);
        if (confirmText) setMessages(prev => [...prev, { role: 'fern', text: confirmText }]);
      }
      if (onSpeechDone && (parsed?.close_chat === true || String(parsed?.show_recipes_for || '').trim() || String(parsed?.go_to || '').trim())) {
        finishAction.current = parsed;
        // No voice to wait for (text mode): act right away.
        if (mode !== 'voice') { const p = finishAction.current; finishAction.current = null; onSpeechDone(p); }
      }
    } catch (e) {
      console.warn('[ChatSheetModal] Ask Fern failed:', e.message);
      setError(true);
    } finally {
      setThinking(false);
    }
  }, [locale, user, speakText, pull, pushAllFromStorage, pushChangedFromStorage, t, systemPrompt, agentOn, agentExtra, onAction, onSpeechDone, mode]);

  const { isListening, start, stop } = useContinuousMic({
    locale,
    token: user?.token,
    autoSpeakReply: false, // askFern already speaks the reply itself
    onTranscript: (text) => {
      // Silence or background noise comes back as "." or similar: not a question, so don't send it (Fern used to answer it by repeating herself).
      if (!/[A-Za-z0-9\u00C0-\u024F]/.test(String(text || ''))) { emptyHeard.current += 1; return; }
      emptyHeard.current = 0;
      askFern(text);
    },
    onError: (e) => {
      console.warn('[ChatSheetModal] Mic error:', e);
      setError(true);
    },
  });

  // Hands-free: once Fern has finished a reply (and finished speaking it), listen for the next answer.
  // Voice-activity detection ends the recording on its own, so the conversation just flows.
  useEffect(() => {
    if (mode !== 'voice' || !visible || thinking || voiceThinking || isSpeaking || speechPending || isListening || error) return undefined;
    if (finishAction.current) return undefined; // she is about to close / open something: don't reopen the mic
    if (emptyHeard.current >= 3) return undefined; // heard nothing three times in a row: stop re-opening the mic, the person can tap it
    if (messages.length === 0 || messages[messages.length - 1].role !== 'fern') return undefined;
    const timer = setTimeout(() => { start(); }, 900);
    return () => clearTimeout(timer);
  }, [mode, visible, thinking, voiceThinking, isSpeaking, speechPending, isListening, error, messages, start]);

  // Playback of Fern's reply finished: the mic may open now.
  useEffect(() => {
    if (isSpeaking) { heardSpeech.current = true; return; }
    if (heardSpeech.current) { heardSpeech.current = false; setSpeechPending(false); runFinishAction(); }
  }, [isSpeaking]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [visible, isListening, stop, stopSpeaking]);

  // First time the sheet is opened with no conversation yet, kick things
  // off ourselves instead of leaving the person looking at an empty sheet.
  useEffect(() => {
    if (!visible || messagesRef.current.length !== 0) return;
    // The first two times the general Ask Fern opens, she introduces herself: always here, tap the leaf, what she can do.
    if (agentOn && !customAutoOpener) {
      (async () => {
        let n = 0;
        try { n = Number(await AsyncStorage.getItem(AGENT_INTRO_KEY)) || 0; } catch (e) { /* ignore */ }
        if (n < 3) {
          try { await AsyncStorage.setItem(AGENT_INTRO_KEY, String(n + 1)); } catch (e) { /* ignore */ }
          const k = n === 0 ? 'agent_intro_1' : 'agent_intro_2';  // opens 1 and 2 get the full welcome, the 3rd a short reminder
          setMessages([{ role: 'fern', text: t(`${k}_text`) }]);
          if (mode !== 'text') {
            heardSpeech.current = false;
            setSpeechPending(true);
            setTimeout(() => setSpeechPending(false), 25000);
            speakText(t(`${k}_say`)).then((uri) => { if (!uri) setSpeechPending(false); }).catch(() => setSpeechPending(false));
          }
        } else {
          askFern(autoOpenerPrompt, { silent: true });
        }
      })();
      return;
    }
    askFern(autoOpenerPrompt, { silent: true });
  }, [visible, autoOpenerPrompt]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollToEnd({ animated: true });
  }, [messages, thinking]);

  const handleClose = useCallback(() => {
    if (isListening) stop();
    stopSpeaking();
    onClose();
  }, [isListening, stop, stopSpeaking, onClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent={compact} onRequestClose={handleClose}>
      <View style={compact ? styles.compactBackdrop : styles.fullBackdrop}>
      <KeyboardAvoidingView style={compact ? styles.compactSheet : styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, compact ? styles.headerCompact : null]}>
          <Text style={styles.headerTitle}>{title || `🌿 ${t('ask_fern_btn')}`}</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.closeX}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} style={styles.messageList} contentContainerStyle={styles.messageListContent}>
          {messages.length === 0 && !thinking && !error && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🌿</Text>
              <Text style={styles.emptyText}>{t(emptyHintKey)}</Text>
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
          {!!voiceErr && (
            <Text style={{ color: '#B3261E', fontSize: 12, marginHorizontal: 16, marginTop: 6 }}>Voice problem: {voiceErr}</Text>
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
      </View>
      <UpgradeGateModal visible={limitGate} onClose={() => setLimitGate(false)} tier={TIERS.PRO} title={t('chat_limit_title')} desc={t('chat_limit_desc')} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.parch },
  fullBackdrop: { flex: 1 },
  compactBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' },
  compactSheet: { height: '48%', backgroundColor: colors.parch, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  headerCompact: { paddingTop: 16 },
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
