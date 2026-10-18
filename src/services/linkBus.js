// Opens the app from a fern:// share link (fern://cookbook?id=... or fern://recipe?id=...) and hands it to
// whoever is listening. A link that arrives before the signed-in app has mounted (cold start, or still on the
// login screen) is kept and delivered when the listener subscribes. fern://auth (sign-in) is not handled here.
import { Linking } from 'react-native';

const SITE = 'https://app.clickpickandcook.com';
let pending = null;
let listener = null;
let started = false;

export function parseFernUrl(url) {
  const m = String(url || '').match(/^fern:\/\/(cookbook|recipe)\/?\?(?:[^#]*&)?id=([a-z0-9]{1,16})/i);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  const id = m[2];
  return { kind, id, link: kind === 'cookbook' ? `${SITE}/cookbook-share.html?id=${id}` : `${SITE}/share.html?id=${id}` };
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
