import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'fern-activity-';
const LEAD_MIN = 20;
const MAX_SCHEDULED = 40;   // iOS keeps at most 64 pending local notifications in total
const DAYS_AHEAD = 14;

function parseClock(s) {
  const m = String(s || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return { h, min: parseInt(m[2], 10) };
}

function startOf(a) {
  const dk = a?.dateKey;
  if (!dk || !/^\d{4}-\d{2}-\d{2}$/.test(dk)) return null;
  const clock = parseClock(a.startTime || String(a.time || '').split(' - ')[0]);
  if (!clock) return null; // all-day or untimed: nothing to warn about
  const [y, mo, d] = dk.split('-').map(Number);
  return new Date(y, mo - 1, d, clock.h, clock.min, 0, 0);
}

// Replaces every pending activity reminder with the current list. Household activities are shared,
// so each member's phone schedules its own warning from the same synced list.
export async function scheduleActivityReminders(activities, copy) {
  try {
    // A phone registered for server push (with its time zone) is warned by the server, so also scheduling
    // local ones would show every warning twice. Only phones without push (older builds) use the local path.
    let serverCovers = false;
    try { const sent = await AsyncStorage.getItem('fern_push_sent'); serverCovers = !!sent && sent.split('|').length >= 3 && !!sent.split('|')[2]; } catch (e) { /* assume not */ }
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') return false; // never prompts here; the location-setup screen asks
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    for (const p of pending) {
      if (String(p.identifier || '').startsWith(PREFIX)) {
        try { await Notifications.cancelScheduledNotificationAsync(p.identifier); } catch (e) { /* gone */ }
      }
    }
    if (serverCovers) return true;
    const now = Date.now();
    const limit = now + DAYS_AHEAD * 86400000;
    const items = (Array.isArray(activities) ? activities : [])
      .map((a) => ({ a, start: startOf(a) }))
      .filter((x) => x.start && x.start.getTime() - LEAD_MIN * 60000 > now && x.start.getTime() < limit)
      .sort((x, y) => x.start - y.start)
      .slice(0, MAX_SCHEDULED);
    const seen = {};
    for (const { a, start } of items) {
      const when = new Date(start.getTime() - LEAD_MIN * 60000);
      const id = PREFIX + when.getTime() + '-' + String(a.label || '').slice(0, 24);
      if (seen[id]) continue;
      seen[id] = true;
      const timeText = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title: `${a.emoji ? a.emoji + ' ' : ''}${a.label || ''}`.trim(),
          body: (copy?.body || 'Starts in 20 minutes ({time})').replace('{time}', timeText),
          data: { type: 'activity_reminder' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes?.DATE || 'date', date: when },
      });
    }
    return true;
  } catch (e) {
    console.warn('[activityReminders] could not schedule', e?.message || e);
    return false;
  }
}
