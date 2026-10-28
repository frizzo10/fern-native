// What Fern knows about the person's tastes and routines ("we hate mushrooms", "Thursday is soccer night").
// Device-only (fern_notes: array of short strings). Fern adds/removes them in chat; the person can see, add and delete
// every one on Account. Food tastes and household routines only.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const NOTES_KEY = 'fern_notes';
export const MAX_NOTES = 30;
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 100);

export async function getNotes() {
  try {
    const raw = JSON.parse((await AsyncStorage.getItem(NOTES_KEY)) || '[]');
    return Array.isArray(raw) ? raw.map(clean).filter(Boolean) : [];
  } catch (e) { return []; }
}

async function save(list) {
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(list.slice(0, MAX_NOTES)));
  return list;
}

export async function addNote(text) {
  const n = clean(text);
  if (!n) return { ok: false, reason: 'empty' };
  const list = await getNotes();
  if (list.some((x) => x.toLowerCase() === n.toLowerCase())) return { ok: true, dup: true, note: n };
  if (list.length >= MAX_NOTES) return { ok: false, reason: 'full' };
  await save([...list, n]);
  return { ok: true, note: n };
}

// Removes the note that matches (exact, else the one containing / contained by the text).
export async function removeNote(text) {
  const n = clean(text).toLowerCase();
  if (!n) return { ok: false };
  const list = await getNotes();
  let i = list.findIndex((x) => x.toLowerCase() === n);
  if (i < 0) i = list.findIndex((x) => x.toLowerCase().includes(n) || n.includes(x.toLowerCase()));
  if (i < 0) return { ok: false };
  const removed = list[i];
  await save(list.filter((_, k) => k !== i));
  return { ok: true, note: removed };
}
