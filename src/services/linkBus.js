// Opens the app from a fern:// share link (fern://cookbook?id=... or fern://recipe?id=...) and hands it to
// whoever is listening. A link that arrives before the signed-in app has mounted (cold start, or still on the
// login screen) is kept and delivered when the listener subscribes. fern://auth (sign-in) is not handled here.
import { Linking } from 'react-native';

const SITE = 'https://app.clickpickandcook.com';
let pending = null;
let listener = null;
let started = false;

function build(kind, id) {
  return { kind, id, link: kind === 'cookbook' ? `${SITE}/cookbook-share.html?id=${id}` : `${SITE}/share.html?id=${id}` };
}

// Accepts fern://cookbook?id=, https://app.clickpickandcook.com/s/c|r/<id> (Universal Links) and the old
// cookbook-share.html / share.html ?id= pages.
export function parseFernUrl(url) {
  const u = String(url || '');
  let m = u.match(/^fern:\/\/(cookbook|recipe)\/?\?(?:[^#]*&)?id=([a-z0-9]{1,16})/i);
  if (m) return build(m[1].toLowerCase(), m[2]);
  m = u.match(/^https?:\/\/app\.clickpickandcook\.com\/s\/(c|r)\/([a-z0-9]{1,16})/i);
  if (m) return build(m[1].toLowerCase() === 'c' ? 'cookbook' : 'recipe', m[2]);
  m = u.match(/^https?:\/\/app\.clickpickandcook\.com\/(cookbook-share|share)\.html\?(?:[^#]*&)?id=([a-z0-9]{1,16})/i);
  if (m) return build(m[1].toLowerCase() === 'cookbook-share' ? 'cookbook' : 'recipe', m[2]);
  return null;
}

// After a fresh install: the share page copies "fern-share:cookbook:<id>" when "Get the app" is tapped. Once per
// device, the first signed-in launch looks for it (iOS may show its own "Allow Paste" prompt) and imports it.
export async function checkShareClipboardOnce(AsyncStorage) {
  try {
    if (await AsyncStorage.getItem('fern_clip_checked')) return;
    await AsyncStorage.setItem('fern_clip_checked', '1');
    let Clipboard = null;
    try { Clipboard = require('expo-clipboard'); } catch (e) { return; }
    const txt = await Clipboard.getStringAsync();
    const m = String(txt || '').match(/^fern-share:(cookbook|recipe):([a-z0-9]{1,16})$/i);
    if (!m) return;
    try { await Clipboard.setStringAsync(''); } catch (e) { /* ignore */ }
    deliver(build(m[1].toLowerCase(), m[2]));
  } catch (e) { /* never block the app */ }
}

function deliver(p) {
  if (listener) listener(p); else pending = p;
}

export function startLinkListener() {
  if (started) return;
  started = true;
  try {
    Linking.getInitialURL().then((u) => { const p = parseFernUrl(u); if (p) deliver(p); }).catch(() => {});
    Linking.addEventListener('url', ({ url }) => { const p = parseFernUrl(url); if (p) deliver(p); });
  } catch (e) { /* a missing Linking must never stop the app */ }
}

export function subscribeLink(fn) {
  listener = fn;
  if (pending) { const p = pending; pending = null; setTimeout(() => fn(p), 300); }
  return () => { if (listener === fn) listener = null; };
}
