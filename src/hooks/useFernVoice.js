// Example usage:

/// Add this to import statements in your component file

// import { useFernVoice } from '../hooks/useFernVoice';

/// Then, inside your component:
// const { speakText, getFernReply, isSpeaking, isThinking, lastReply } = useFernVoice({
//     onError: message => console.warn('[voice]', message),
// });

// const handleSpeakMealAdded = async () => {
//     await speakText('Meal added');
// };

// const handleSpeakBloggerFollowed = async () => {
//     await speakText('Blogger followed');
// };

// const handleReplyOnly = async () => {
//     await getFernReply('Give me a quick dinner idea', { speak: false });
// };

// const handleReplyAndSpeak = async () => {
//     await getFernReply('Give me a quick dinner idea', { speak: true });
// };



import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import useLanguage from '../hooks/useLanguage';

const GROQ_AI = 'https://app.clickpickandcook.com/.netlify/functions/ai';
const GROQ_SPEAK = 'https://app.clickpickandcook.com/.netlify/functions/fern-speak';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function useFernVoice({ onError } = {}) {
    const { t, locale } = useLanguage();
    const [audioUri, setAudioUri] = useState(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [lastReply, setLastReply] = useState('');

    const isMountedRef = useRef(true);
    const lastPlayedUriRef = useRef(null);
    const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!audioUri || !player) return;

        // Guard against replaying the same file when player identity changes on re-render.
        if (lastPlayedUriRef.current === audioUri) return;
        lastPlayedUriRef.current = audioUri;

        try {
            player.seekTo(0);
            player.play();
            if (isMountedRef.current) {
                setIsSpeaking(true);
            }
        } catch (error) {
            if (isMountedRef.current) {
                setIsSpeaking(false);
            }
            onError?.(error?.message ?? 'Unable to play audio');
        }
    }, [audioUri, player, onError]);

    useEffect(() => {
        if (!player) return;

        const sub = player.addListener('playbackStatusUpdate', status => {
            if (status.didJustFinish && isMountedRef.current) {
                setIsSpeaking(false);
            }
        });

        return () => sub?.remove?.();
    }, [player]);

    const stopSpeaking = useCallback(() => {
        try {
            if (!player) return;
            player.pause();
            player.seekTo(0);
        } finally {
            if (isMountedRef.current) {
                setIsSpeaking(false);
            }
        }
    }, [player]);

    const speakText = useCallback(async (text) => {
        const cleanText = text?.trim?.();
        if (!cleanText) return null;

        // If something is already speaking, stop it before starting new playback.
        stopSpeaking();

        try {
            const response = await fetch(GROQ_SPEAK, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: cleanText, lang: locale }),
            });

            if (!response.ok) {
                throw new Error(`Speech request failed: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            const base64Audio = bytesToBase64(bytes);
            const nextAudioUri = `${FileSystem.cacheDirectory}fern-speak-${Date.now()}.mp3`;

            await FileSystem.writeAsStringAsync(nextAudioUri, base64Audio, {
                encoding: FileSystem.EncodingType.Base64,
            });

            if (isMountedRef.current) {
                lastPlayedUriRef.current = null;
                setAudioUri(nextAudioUri);
            }

            return nextAudioUri;
        } catch (error) {
            onError?.(error?.message ?? 'Unable to generate speech');
            return null;
        }
    }, [onError, stopSpeaking]);

    const getFernReply = useCallback(async (input, { speak = false } = {}) => {
        const message = input?.trim?.();
        if (!message) return '';

        if (isMountedRef.current) {
            setIsThinking(true);
        }

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
                            content: message,
                        },
                    ],
                    system: 'You are Fern, a personal AI food assistant. Be brief and conversational.',
                    lang: locale
                }),
            });

            if (!aiResponse.ok) {
                throw new Error(`AI request failed: ${aiResponse.status}`);
            }

            const aiData = await aiResponse.json();
            const reply = aiData?.content?.[0]?.text ?? aiData?.data?.content?.[0]?.text ?? '';

            if (isMountedRef.current) {
                setLastReply(reply);
            }

            if (reply && speak) {
                await speakText(reply);
            }

            return reply;
        } catch (error) {
            onError?.(error?.message ?? 'Unable to get AI reply');
            return '';
        } finally {
            if (isMountedRef.current) {
                setIsThinking(false);
            }
        }
    }, [onError, speakText]);

    return {
        isThinking,
        isSpeaking,
        lastReply,
        speakText,
        getFernReply,
        stopSpeaking,
    };
}

function bytesToBase64(bytes) {
    let output = '';

    for (let i = 0; i < bytes.length; i += 3) {
        const a = bytes[i];
        const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
        const c = i + 2 < bytes.length ? bytes[i + 2] : 0;

        const triple = (a << 16) | (b << 8) | c;

        output += BASE64_ALPHABET[(triple >> 18) & 63];
        output += BASE64_ALPHABET[(triple >> 12) & 63];
        output += i + 1 < bytes.length ? BASE64_ALPHABET[(triple >> 6) & 63] : '=';
        output += i + 2 < bytes.length ? BASE64_ALPHABET[triple & 63] : '=';
    }

    return output;
}