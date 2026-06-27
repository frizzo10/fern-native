import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../constants/tokens';
import { useSync } from '../hooks/useSync';
import { useFernVoice } from '../hooks/useFernVoice';
import { useContinuousMic } from '../hooks/useContinuousMic';

export default function FamilyScreen({ user }) {
  const { pull } = useSync(user);
  const STOP_WORDS = ['stop', 'goodbye', 'done', 'exit', 'bye'];


  // Use the continuous mic hook
  const { isListening, isProcessing, start, stop } = useContinuousMic({
    autoSpeakReply: false,
    onTranscript: async (transcript) => {
      console.log('[FindScreen] transcript received:', transcript);

      // Check stop words - stop listening first
      if (STOP_WORDS.some(w => transcript.toLowerCase().includes(w))) {
        stop();
        addMessage('user', transcript, 'spoken');
        addMessage('assistant', 'Goodbye! Tap the mic anytime to chat again.');
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
      Alert.alert('Microphone Error', error);
    }
  });









  const { speakText, getFernReply, isSpeaking, isThinking, lastReply } = useFernVoice({
    onError: message => console.warn('[voice]', message),
  });

  const handleSpeakMealAdded = async () => {
    await speakText('Meal added');
  };

  const handleSpeakBloggerFollowed = async () => {
    await speakText('Blogger followed');
  };

  const handleReplyOnly = async () => {
    await getFernReply('Give me a quick dinner idea', { speak: false });
  };

  const handleReplyAndSpeak = async () => {
    await getFernReply('Give me a quick dinner idea', { speak: true });
  };

  useFocusEffect(
    useMemo(() => () => {
      pull();
    }, [pull])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.text}>🛒 Family List</Text>
      <Text style={styles.sub}>Coming soon</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Voice Hook Tests</Text>

        <Pressable style={styles.button} onPress={handleSpeakMealAdded}>
          <Text style={styles.buttonText}>Speak: Meal Added</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={handleSpeakBloggerFollowed}>
          <Text style={styles.buttonText}>Speak: Blogger Followed</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={handleReplyOnly}>
          <Text style={styles.buttonText}>AI Reply Only</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={handleReplyAndSpeak}>
          <Text style={styles.buttonText}>AI Reply + Speak</Text>
        </Pressable>

        <Text style={styles.status}>Thinking: {isThinking ? 'Yes' : 'No'}</Text>
        <Text style={styles.status}>Speaking: {isSpeaking ? 'Yes' : 'No'}</Text>

        <Text style={styles.replyLabel}>Last Reply:</Text>
        <Text style={styles.replyText}>{lastReply || 'No reply yet.'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.parch,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  text: { fontSize: 24, fontWeight: '800', color: colors.ink, fontFamily: 'serif' },
  sub: { fontSize: 14, color: colors.brown, marginTop: 6 },
  card: {
    width: '100%',
    maxWidth: 360,
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6DCCF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 10,
  },
  button: {
    backgroundColor: colors.ink,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  status: {
    marginTop: 4,
    fontSize: 13,
    color: colors.brown,
  },
  replyLabel: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  replyText: {
    marginTop: 4,
    fontSize: 13,
    color: colors.brown,
    lineHeight: 18,
  },
});
