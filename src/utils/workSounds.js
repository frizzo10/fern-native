// Small mechanical sounds for "Fern is working" screens: a click while she thinks, a bell when a step finishes, a chime at the end.
// Respects the Account voice switch (fern_voice_enabled off = silent). Any failure is swallowed.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const FILES = {
  tick: require('../../assets/sounds/tick.mp3'),
  bell: require('../../assets/sounds/bell.mp3'),
  start: require('../../assets/sounds/start.mp3'),
  done: require('../../assets/sounds/done.mp3'),
};
let modeSet = false;
let tickTimer = null;

async function soundOn() {
  try {
    const v = String((await AsyncStorage.getItem('fern_voice_enabled')) || '').toLowerCase();
    return !['0', 'false', 'off', 'disabled'].includes(v);
  } catch (e) { return true; }
}

export async function playWorkSound(name) {
  try {
    if (!FILES[name] || !(await soundOn())) return;
    if (!modeSet) { modeSet = true; await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: 'mixWithOthers' }); }
    const p = createAudioPlayer(FILES[name]);
    p.play();
    setTimeout(() => { try { p.remove(); } catch (e) { /* ignore */ } }, 2200);
  } catch (e) { /* sound is a nicety, never an error */ }
}

// Mechanical ticking while a long wait runs.
export function startTicking(everyMs = 650) {
  stopTicking();
  tickTimer = setInterval(() => { playWorkSound('tick'); }, everyMs);
}
export function stopTicking() { if (tickTimer) { clearInterval(tickTimer); tickTimer = null; } }
