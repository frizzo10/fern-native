// The green leaf inside the recipe viewer. The viewer is a full-screen Modal that covers the app's own leaf,
// so Fern lives here too: she knows this recipe and can scale it, add it to the list, plan it, or start Cook Mode.
// Plain Views on purpose (a second Modal over the recipe viewer is dropped by iOS).
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Keyboard, Platform, StyleSheet,
} from 'react-native';
import useLanguage from '../hooks/useLanguage';
import { useSync } from '../hooks/useSync';
import { askAboutRecipe } from '../services/recipeAskService';
import { executeAgentActions, emitAgentChange } from '../services/fernAgent';

export default function RecipeFernHelper({ recipe, user, servings, ingredients, hidden, bottom = 110, onScale, onAddToList, onCook }) {
  const { t, locale } = useLanguage();
  const { pushChangedFromStorage } = useSync(user);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState([]); // [{ q, a }]
  const scrollRef = useRef(null);

  // Every recipe starts a fresh conversation.
  useEffect(() => { setOpen(false); setTurns([]); setText(''); }, [recipe?.id, recipe?.title]);

  if (!recipe || hidden) return null;

  const doAction = async (action) => {
    if (!action) return;
    if (action.type === 'scale') { setOpen(false); onScale?.(action.servings); return; }
    if (action.type === 'add_to_list') { setOpen(false); onAddToList?.(); return; }
    if (action.type === 'cook') { setOpen(false); onCook?.(); return; }
    if (action.type === 'plan') {
      try {
        const res = await executeAgentActions(
          [{ type: 'plan_meal', day_offset: action.day_offset, slot: action.slot, title: recipe?.title, emoji: recipe?.emoji || '🍽️' }],
          { pushChangedFromStorage, token: user?.token, canSaveUnlimited: true },
        );
        emitAgentChange();
        const line = res?.lines?.length ? `✓ ${res.lines.join(' ')}` : t('plan_family_failed');
        setTurns((cur) => {
          const next = [...cur];
          if (next.length) next[next.length - 1] = { ...next[next.length - 1], done: line };
          return next;
        });
      } catch (e) {
        setTurns((cur) => {
          const next = [...cur];
          if (next.length) next[next.length - 1] = { ...next[next.length - 1], done: t('plan_family_failed') };
          return next;
        });
      }
    }
  };

  const send = async () => {
    const q = text.trim();
    if (!q || busy) return;
    Keyboard.dismiss();
    setBusy(true);
    setText('');
    setTurns((cur) => [...cur, { q, a: '' }]);
    try {
      const { answer, action } = await askAboutRecipe({
        recipe, servings, ingredients, question: q, history: turns.filter((x) => x.a), locale,
      });
      setTurns((cur) => {
        const next = [...cur];
        next[next.length - 1] = { q, a: answer };
        return next;
      });
      await doAction(action);
    } catch (e) {
      setTurns((cur) => {
        const next = [...cur];
        next[next.length - 1] = { q, a: t('cook_ask_failed') };
        return next;
      });
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 80);
    }
  };

  if (!open) {
    return (
      <TouchableOpacity
        style={[styles.fab, { bottom }]}
        activeOpacity={0.85}
        onPress={() => setOpen(true)}
        accessibilityLabel={t('recipe_fern_title')}
      >
        <Text style={styles.fabText}>🌿</Text>
      </TouchableOpacity>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.title} numberOfLines={1}>🌿 {t('recipe_fern_title')}</Text>
          <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.x}>×</Text>
          </TouchableOpacity>
        </View>
        <ScrollView ref={scrollRef} style={styles.list} keyboardShouldPersistTaps="handled">
          {!turns.length ? <Text style={styles.hint}>{t('recipe_fern_hint')}</Text> : null}
          {turns.map((x, i) => (
            <View key={i} style={{ marginBottom: 10 }}>
              <Text style={styles.q}>{x.q}</Text>
              {x.a ? <Text style={styles.a}>{x.a}</Text> : <ActivityIndicator color="#ECF2E6" style={{ alignSelf: 'flex-start', marginTop: 6 }} />}
              {x.done ? <Text style={styles.done}>{x.done}</Text> : null}
            </View>
          ))}
        </ScrollView>
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={t('recipe_fern_placeholder')}
            placeholderTextColor="rgba(236,242,230,0.55)"
            maxLength={300}
            returnKeyType="send"
            onSubmitEditing={send}
          />
          <TouchableOpacity style={styles.send} onPress={send} disabled={busy} activeOpacity={0.85}>
            <Text style={styles.sendText}>{t('cook_ask_send')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 18, width: 56, height: 56, borderRadius: 28, backgroundColor: '#4E7A54', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, zIndex: 8 },
  fabText: { fontSize: 26 },
  wrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end', zIndex: 9 },
  card: { margin: 12, marginBottom: 24, padding: 14, borderRadius: 18, backgroundColor: 'rgba(30,50,36,0.97)', maxHeight: '60%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { color: '#ECF2E6', fontWeight: '800', fontSize: 16, flex: 1, marginRight: 10 },
  x: { color: '#ECF2E6', fontSize: 26, lineHeight: 28 },
  list: { flexGrow: 0, maxHeight: 300 },
  hint: { color: 'rgba(236,242,230,0.8)', fontSize: 14, lineHeight: 20, marginVertical: 6 },
  q: { color: 'rgba(236,242,230,0.75)', fontSize: 14, fontStyle: 'italic' },
  a: { color: '#FFFFFF', fontSize: 16, lineHeight: 22, marginTop: 4 },
  done: { color: '#BFE3C0', fontSize: 14, fontWeight: '700', marginTop: 4 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  input: { flex: 1, height: 44, borderRadius: 12, paddingHorizontal: 12, color: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.14)', fontSize: 16 },
  send: { paddingHorizontal: 16, height: 44, borderRadius: 12, backgroundColor: '#4E7A54', alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
