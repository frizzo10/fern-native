import * as SecureStore from 'expo-secure-store';

// Quiet engagement counting for the admin Brand report: recipe views, coupon views / adds / uses.
// Fire-and-forget: events are batched, sent to the `track` Netlify function with the signed-in token,
// and silently dropped on any failure. Never throws, never blocks the UI, never shows anything.
const TRACK_URL = 'https://app.clickpickandcook.com/.netlify/functions/track';
const MAX_QUEUE = 40;
let queue = [];
let timer = null;

async function flush() {
  timer = null;
  if (!queue.length) return;
  const batch = queue.splice(0, 20);
  try {
    const raw = await SecureStore.getItemAsync('fern_user');
    const token = raw ? JSON.parse(raw)?.token : null;
    if (!token) return;
    await fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
      body: JSON.stringify({ token, events: batch }),
    });
  } catch (e) { /* best effort */ }
  if (queue.length && !timer) timer = setTimeout(flush, 4000);
}

// event: 'recipe_view' | 'coupon_view' | 'coupon_add' | 'coupon_used'
// ref: recipe title, or coupon id. meta (coupons): { title, store, category, discount }
export function trackEvent(event, ref, meta) {
  try {
    if (!event || !ref) return;
    if (queue.length >= MAX_QUEUE) queue.shift();
    queue.push({ event, ref: String(ref).slice(0, 200), meta: meta || undefined });
    if (!timer) timer = setTimeout(flush, 4000);
  } catch (e) { /* ignore */ }
}

export function couponMeta(c) {
  return { title: c?.title, store: c?.store, category: c?.category, discount: c?.discountLabel || c?.discount };
}
