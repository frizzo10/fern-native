import AsyncStorage from '@react-native-async-storage/async-storage';
import { zipsByStoreName } from '../utils/storeZip';

const URL = 'https://app.clickpickandcook.com/.netlify/functions/price-compare';

// Asks the server for the lowest scanned SALE price of an item. Returns the server answer or null.
export async function fetchPriceCompare({ token, item, store }) {
  let zip = '';
  try {
    const raw = await AsyncStorage.getItem('cpc_user_stores');
    zip = Object.values(zipsByStoreName(raw ? JSON.parse(raw) : []))[0] || '';
  } catch (e) { /* no ZIP: the server searches all regions */ }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ token, item, store: store || undefined, zip: zip || undefined }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; } finally { clearTimeout(timer); }
}

const unitLabel = (b) => (b === 'lb' ? '/lb' : b === 'floz' ? '/fl oz' : b === 'ea' ? ' each' : '');
const money = (n) => `$${Number(n).toFixed(2)}`;
const short = (name) => String(name || '').split(/ - |#/)[0].trim();

// One report line per store, built in code so the numbers never come from the model.
export function priceLines(item, r) {
  if (!r) return [{ ok: false, text: 'I could not reach the price data right now.' }];
  if (!r.found || !r.stores?.length) return [{ ok: false, text: r.note || `I have no scanned sale prices for ${item} yet.` }];
  const lines = r.stores.slice(0, 3).map((s, i) => {
    const e = s.now || s.best;
    const p = e.unitPrice != null ? `${money(e.unitPrice)}${unitLabel(e.basis)}` : e.price;
    const when = s.now ? 'on sale now' : `sale seen ${e.date}`;
    return { ok: true, text: `${i === 0 ? 'Lowest: ' : ''}${short(s.store)} ${p}${e.price && e.unitPrice != null && e.basis === 'ea' ? ` (${e.price})` : ''} — ${e.item}, ${when}` };
  });
  lines.push({ ok: true, text: 'Sale prices from scanned circulars, not everyday shelf prices.' });
  return lines;
}
