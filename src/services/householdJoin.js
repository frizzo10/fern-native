// One join flow for every way in: typed code (Account card, Home card) or a tapped invite link (App.js).
// preview (plain-words Alert: who, and what this phone adds) -> Join / Not now -> join -> save locally -> re-pull.
import { Alert } from 'react-native';
import { householdCall, saveHouseholdLocally, getCachedHousehold } from './householdService';
import { discardPendingPull } from '../hooks/useSync';

export const JOIN_SITE = 'https://app.clickpickandcook.com/join/';

export async function startJoin({ token, code, t, onJoined }) {
  const c = String(code || '').trim().toUpperCase();
  if (!token || c.length < 4) return;
  try {
    const mine = await getCachedHousehold();
    if (mine && mine.code === c) return;
    if (mine) { Alert.alert(t('hh_err_title'), t('hh_already')); return; }
    const r = await householdCall(token, 'preview', { code: c });
    const n = r.counts || {};
    const parts = [
      n.recipes ? t('hh_n_recipes', { n: n.recipes }) : '',
      n.books ? t('hh_n_books', { n: n.books }) : '',
      n.list ? t('hh_n_list', { n: n.list }) : '',
      n.activities ? t('hh_n_acts', { n: n.activities }) : '',
      n.stores ? t('hh_n_stores', { n: n.stores }) : '',
    ].filter(Boolean);
    const who = (r.with || []).join(', ') || t('hh_someone');
    const body = parts.length ? t('hh_join_confirm_body', { who, adds: parts.join(', ') }) : t('hh_join_confirm_none', { who });
    Alert.alert(t('hh_join_confirm_title'), body, [
      { text: t('hh_not_now'), style: 'cancel' },
      {
        text: t('hh_join_btn'),
        onPress: async () => {
          try {
            const j = await householdCall(token, 'join', { code: c });
            await saveHouseholdLocally(j.household || null);
            discardPendingPull();
            if (onJoined) await onJoined(j.household);
            setTimeout(() => Alert.alert(t('hh_joined_title'), t('hh_joined_body', { who })), 400);
          } catch (e) {
            setTimeout(() => Alert.alert(t('hh_err_title'), String(e?.message || t('hh_err_body'))), 400);
          }
        },
      },
    ]);
  } catch (e) {
    Alert.alert(t('hh_err_title'), String(e?.message || t('hh_err_body')));
  }
}
