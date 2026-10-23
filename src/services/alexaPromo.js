// Shared bits for the Alexa nudges (Home card, shopping-list line, recipe hint).
// Everything here is device-only: nothing is synced.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ALEXA_PHRASE = 'Alexa, open Fern recipes';
export const ALEXA_DONE_KEY = 'fern_alexa_done'; // 'done' once the person opened setup
export const ALEXA_CARD_LATER_KEY = 'fern_alexa_card_later'; // ms timestamp of the last "Not now" on the Home card
export const ALEXA_FIRST_SEEN_KEY = 'fern_alexa_first_seen'; // ms timestamp of the first time the Home card was evaluated
export const ALEXA_HINT_OFF_KEY = 'fern_alexa_hint_off'; // 'off' once the inline hints were closed

export async function copyAlexaPhrase() {
  try {
    const Clipboard = require('expo-clipboard'); // guarded: an older binary without it just skips copying
    await Clipboard.setStringAsync(ALEXA_PHRASE);
    return true;
  } catch (e) {
    return false;
  }
}

export async function readFlag(key) {
  try { return await AsyncStorage.getItem(key); } catch (e) { return null; }
}

export async function writeFlag(key, value) {
  try { await AsyncStorage.setItem(key, value); } catch (e) { /* ignore */ }
}
