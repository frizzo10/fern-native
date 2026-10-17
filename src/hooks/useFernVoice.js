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



import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useLanguage from '../hooks/useLanguage';

import useEntitlement from './useEntitlement';
import { TIERS } from '../constants/tiers';

const GROQ_AI = 'https://app.clickpickandcook.com/.netlify/functions/ai';
const GROQ_SPEAK = 'https://app.clickpickandcook.com/.netlify/functions/fern-speak';
const FERN_VOICE_ENABLED_KEY = 'fern_voice_enabled';

// The line playing right now anywhere in the app (hooks in the tour, Shopping, the greeting card...). A new line ends it.
let activeLine = null;
function stopActiveLine() { try { activeLine?.end?.(); } catch { /* ignore */ } }

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function isFernVoiceEnabledValue(raw) {
    if (raw == null) return true;
    const normalized = String(raw).trim().toLowerCase();
    return !['0', 'false', 'off', 'disabled'].includes(normalized);
}

export function useFernVoice({ onError, token, enabled = true, allowFree = false } = {}) {
    const { t, locale } = useLanguage();
    // Spoken replies cost money per character, so they are a Pro feature. The intro tour passes
    // allowFree so every new user still hears it.
    const { hasAccess } = useEntitlement();
    const allowed = enabled && (allowFree || hasAccess(TIERS.PRO));
    const [lineSpeaking, setIsSpeaking] = useState(false);
    const [seqActive, setSeqActive] = useState(false); // a multi-part reply is in progress (stays true between its parts)
    const seqTokenRef = useRef(0);
    const isSpeaking = lineSpeaking || seqActive;
    const [isThinking, setIsThinking] = useState(false);
    const [lastReply, setLastReply] = useState('');

    const isMountedRef = useRef(true);
    const enabledRef = useRef(allowed);
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;
    const endLineRef = useRef(null); // ends whatever line THIS hook is playing

    // One line = one fresh player. (The hook-owned player that swapped its source made later lines silent or stuck,
    // especially when the Home tour's player and Shopping's player took turns.) Only one line plays app-wide.
    const stopSpeaking = useCallback(() => {
        seqTokenRef.current += 1; // cancels any multi-part reply
        try { endLineRef.current?.(); } finally { if (isMountedRef.current) { setIsSpeaking(false); setSeqActive(false); } }
    }, []);

    const playLine = useCallback((uri, onEnd) => {
        stopActiveLine();
        const p = createAudioPlayer({ uri });
        let finished = false;
        let sub = null;
        let timer = null;
        const end = () => {
            if (finished) return;
            finished = true;
            if (timer) clearTimeout(timer);
            try { sub?.remove?.(); } catch { /* ignore */ }
            try { p.pause?.(); } catch { /* ignore */ }
            try { p.remove?.(); } catch { /* ignore */ }
            if (activeLine && activeLine.end === end) activeLine = null;
            if (endLineRef.current === end) endLineRef.current = null;
            if (isMountedRef.current) setIsSpeaking(false);
            try { onEnd?.(); } catch { /* ignore */ }
        };
        sub = p.addListener('playbackStatusUpdate', (status) => { if (status?.didJustFinish) end(); });
        timer = setTimeout(end, 90000); // safety: never stay "speaking" forever
        activeLine = { end };
        endLineRef.current = end;
        if (isMountedRef.current) setIsSpeaking(true);
        // Set the audio mode right before playing too: the mic hook resets it (without "play in silent mode") when a recording ends,
        // which can land between fetching the line and playing it and leave the line silent.
        Promise.resolve()
            .then(() => setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }))
            .catch(() => { /* ignore */ })
            .then(() => {
                if (finished) return;
                try {
                    p.play();
                } catch (error) {
                    end();
                    onErrorRef.current?.(error?.message ?? 'Unable to play audio');
                }
            });
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            try { endLineRef.current?.(); } catch { /* ignore */ }
        };
    }, []);

    useEffect(() => {
        enabledRef.current = allowed;
        if (!allowed) stopSpeaking();
    }, [allowed, stopSpeaking]);

    const isVoiceEnabled = useCallback(async () => {
        try {
            const raw = await AsyncStorage.getItem(FERN_VOICE_ENABLED_KEY);
            return isFernVoiceEnabledValue(raw);
        } catch {
            return true;
        }
    }, []);

    // Fetch + save a spoken line WITHOUT playing it, so the next line can be ready before the current one ends
    // (the walkthrough prepares every segment up front; otherwise each hand-off waited on a fresh network round trip).
    const prepareSpeech = useCallback(async (text) => {
        const cleanText = text?.trim?.();
        if (!cleanText) return null;
        if (!enabledRef.current) { onError?.('voice not allowed here (plan or screen)'); return null; }
        const voiceOn = await isVoiceEnabled();
        if (!voiceOn) { onError?.('voice is turned off in Account'); return null; }

        try {
            // A stalled connection (weak signal in a store) must not hang the caller forever: give up after 25 s.
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const abortTimer = controller ? setTimeout(() => controller.abort(), 25000) : null;
            let response;
            try {
                response = await fetch(GROQ_SPEAK, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ text: cleanText, locale, token }),
                    ...(controller ? { signal: controller.signal } : {}),
                });
            } finally {
                if (abortTimer) clearTimeout(abortTimer);
            }

            if (!response.ok) {
                throw new Error(`Speech request failed: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            const base64Audio = bytesToBase64(bytes);
            const nextAudioUri = `${FileSystem.cacheDirectory}fern-speak-${Date.now()}-${Math.floor(Math.random() * 1e6)}.mp3`;

            await FileSystem.writeAsStringAsync(nextAudioUri, base64Audio, {
                encoding: FileSystem.EncodingType.Base64,
            });

            // iOS mutes expo-audio on the silent switch and after mic use unless the audio mode says otherwise.
            try {
                await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
            } catch (modeError) {
                onError?.(`audio mode: ${modeError?.message ?? modeError}`);
            }
            return nextAudioUri;
        } catch (error) {
            onError?.(error?.message ?? 'Unable to generate speech');
            return null;
        }
    }, [onError, locale, token, isVoiceEnabled]);

    // Play a line made by prepareSpeech (ends whatever is playing, anywhere in the app).
    const playPrepared = useCallback((uri) => {
        if (!uri || !isMountedRef.current || !enabledRef.current) return null;
        playLine(uri);
        return uri;
    }, [playLine]);

    const speakText = useCallback(async (text) => {
        if (!text?.trim?.() || !enabledRef.current) return null;
        // If something is already speaking, stop it before starting new playback.
        stopSpeaking();
        const uri = await prepareSpeech(text);
        return uri ? playPrepared(uri) : null;
    }, [stopSpeaking, prepareSpeech, playPrepared]);

    // Speak a reply in two parts so she starts talking sooner: the first sentence and the rest are fetched at the same
    // time, the first plays the moment it is ready, the rest follows without a gap. Resolves with the first part's uri
    // as soon as it starts playing (null if it could not), while the second part keeps going in the background.
    const speakChunks = useCallback(async (text) => {
        const clean = text?.trim?.();
        if (!clean || !enabledRef.current) return null;
        const m = clean.match(/^([\s\S]{25,}?[.!?])\s+([\s\S]+)$/);
        if (!m) return speakText(clean);
        stopSpeaking();
        const token = seqTokenRef.current;
        if (isMountedRef.current) setSeqActive(true);
        const first = prepareSpeech(m[1]);
        const second = prepareSpeech(m[2]);
        const firstUri = await first;
        if (token !== seqTokenRef.current || !isMountedRef.current) return null;
        if (!firstUri) { setSeqActive(false); return null; }
        playLine(firstUri, async () => {
            if (token !== seqTokenRef.current) return;
            const secondUri = await second;
            if (token !== seqTokenRef.current || !isMountedRef.current) return;
            if (secondUri) playLine(secondUri, () => { if (token === seqTokenRef.current && isMountedRef.current) setSeqActive(false); });
            else setSeqActive(false);
        });
        return firstUri;
    }, [speakText, stopSpeaking, prepareSpeech, playLine]);

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
                    locale,
                    token,
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
                if (!enabledRef.current) return reply;
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
    }, [onError, speakText, locale, token]);

    return {
        isThinking,
        isSpeaking,
        lastReply,
        speakText,
        speakChunks,
        prepareSpeech,
        playPrepared,
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