import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../constants/tokens';
import { useSync } from '../hooks/useSync';
import { useFernVoice } from '../hooks/useFernVoice';
import { useContinuousMic } from '../hooks/useContinuousMic';

const STOP_WORDS = ['stop', 'goodbye', 'done', 'exit', 'bye'];

function hasStopWord(text) {
    const words = String(text || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
    return words.some(word => STOP_WORDS.includes(word));
}

export default function FamilyScreen({ user }) {
    const { pull } = useSync(user);
    const [lastTranscript, setLastTranscript] = useState('');
    const [loopStatus, setLoopStatus] = useState('idle');
    const restartAfterPlaybackRef = useRef(false);
    const restartTimeoutRef = useRef(null);
    const wasSpeakingRef = useRef(false);

    const { speakText, getFernReply, isSpeaking, isThinking, lastReply, stopSpeaking } = useFernVoice({
        onError: message => {
            console.warn('[FamilyScreen] voice error:', message);
            Alert.alert('Voice Error', message);
        },
    });

    const { isListening, isProcessing, start, stop } = useContinuousMic({
        autoSpeakReply: false,
        onTranscript: async (transcript) => {
            const cleanTranscript = transcript?.trim?.() || '';
            console.log('[FamilyScreen] transcript received:', cleanTranscript);
            setLastTranscript(cleanTranscript);

            if (hasStopWord(cleanTranscript)) {
                restartAfterPlaybackRef.current = false;
                stopSpeaking();
                setLoopStatus('stopped');
                return;
            }

            restartAfterPlaybackRef.current = true;
            setLoopStatus('thinking');
            const reply = await getFernReply(cleanTranscript, { speak: true });

            if (!reply) {
                restartAfterPlaybackRef.current = false;
                setLoopStatus('idle');
            }
        },
        onError: (error) => {
            console.warn('[FamilyScreen] mic error:', error);
            Alert.alert('Microphone Error', error);
        },
    });

    const handleListenPress = useCallback(() => {
        if (isListening) {
            restartAfterPlaybackRef.current = false;
            if (restartTimeoutRef.current) {
                clearTimeout(restartTimeoutRef.current);
                restartTimeoutRef.current = null;
            }
            setLoopStatus('idle');
            stop();
            return;
        }

        if (isSpeaking) {
            return;
        }

        setLoopStatus('listening');
        start();
    }, [isListening, isSpeaking, start, stop]);

    const stopLoopForManualAction = useCallback(() => {
        restartAfterPlaybackRef.current = false;
        if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
            restartTimeoutRef.current = null;
        }
        if (isListening) {
            stop();
        }
        setLoopStatus('idle');
    }, [isListening, stop]);

    const handleSpeakMealAdded = useCallback(async () => {
        stopLoopForManualAction();
        await speakText('Meal added');
    }, [speakText, stopLoopForManualAction]);

    const handleSpeakBloggerFollowed = useCallback(async () => {
        stopLoopForManualAction();
        await speakText('Blogger followed');
    }, [speakText, stopLoopForManualAction]);

    const handleReplyOnly = useCallback(async () => {
        stopLoopForManualAction();
        await getFernReply('Give me a quick dinner idea', { speak: false });
    }, [getFernReply, stopLoopForManualAction]);

    const handleReplyAndSpeak = useCallback(async () => {
        stopLoopForManualAction();
        await getFernReply('Give me a quick dinner idea', { speak: true });
    }, [getFernReply, stopLoopForManualAction]);

    useEffect(() => {
        if (isListening) {
            setLoopStatus('listening');
        } else if (isProcessing) {
            setLoopStatus('processing');
        } else if (isThinking) {
            setLoopStatus('thinking');
        } else if (isSpeaking) {
            setLoopStatus('speaking');
        }
    }, [isListening, isProcessing, isThinking, isSpeaking]);

    useEffect(() => {
        if (isSpeaking) {
            wasSpeakingRef.current = true;
            return;
        }

        if (!wasSpeakingRef.current) return;

        wasSpeakingRef.current = false;

        if (restartAfterPlaybackRef.current) {
            restartAfterPlaybackRef.current = false;
            setLoopStatus('listening');
            restartTimeoutRef.current = setTimeout(() => {
                restartTimeoutRef.current = null;
                start();
            }, 300);
        } else {
            setLoopStatus('idle');
        }
    }, [isSpeaking, start]);

    useEffect(() => {
        return () => {
            restartAfterPlaybackRef.current = false;

            if (restartTimeoutRef.current) {
                clearTimeout(restartTimeoutRef.current);
                restartTimeoutRef.current = null;
            }
        };
    }, []);

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
                <Text style={styles.sectionTitle}>Continuous Mic Test</Text>

                <Pressable
                    style={[
                        styles.listenButton,
                        isListening && styles.listenButtonActive,
                        (isProcessing || isThinking || isSpeaking) && styles.listenButtonDisabled,
                    ]}
                    onPress={handleListenPress}
                    disabled={isProcessing || isThinking || isSpeaking}
                >
                    <Text style={styles.buttonText}>
                        {isListening ? 'Listening...' : 'Start Listening'}
                    </Text>
                </Pressable>

                <Text style={styles.status}>Status: {loopStatus}</Text>
                <Text style={styles.status}>Say "stop" to end the loop.</Text>

                <Text style={styles.replyLabel}>Last Transcript:</Text>
                <Text style={styles.replyText}>{lastTranscript || 'No transcript yet.'}</Text>
                <Text style={styles.replyLabel}>Last Reply:</Text>
                <Text style={styles.replyText}>{lastReply || 'No reply yet.'}</Text>

                <Text style={styles.sectionTitle}>Voice Hook Tests</Text>

                <Pressable
                    style={[styles.actionButton, isThinking && styles.listenButtonDisabled]}
                    onPress={handleSpeakMealAdded}
                    disabled={isThinking}
                >
                    <Text style={styles.buttonText}>Speak: Meal Added</Text>
                </Pressable>

                <Pressable
                    style={[styles.actionButton, isThinking && styles.listenButtonDisabled]}
                    onPress={handleSpeakBloggerFollowed}
                    disabled={isThinking}
                >
                    <Text style={styles.buttonText}>Speak: Blogger Followed</Text>
                </Pressable>

                <Pressable
                    style={[styles.actionButton, isThinking && styles.listenButtonDisabled]}
                    onPress={handleReplyOnly}
                    disabled={isThinking}
                >
                    <Text style={styles.buttonText}>AI Reply Only</Text>
                </Pressable>

                <Pressable
                    style={[styles.actionButton, isThinking && styles.listenButtonDisabled]}
                    onPress={handleReplyAndSpeak}
                    disabled={isThinking}
                >
                    <Text style={styles.buttonText}>AI Reply + Speak</Text>
                </Pressable>
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
    listenButton: {
        backgroundColor: colors.ink,
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 12,
        marginBottom: 8,
        alignItems: 'center',
    },
    listenButtonActive: {
        backgroundColor: colors.orange,
    },
    listenButtonDisabled: {
        opacity: 0.7,
    },
    actionButton: {
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
