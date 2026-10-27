// Home card that introduces the Alexa skill at a useful moment: once the shopping list has
// 5+ items, or the app has been in use for a week. "Set up" opens the Alexa setup sheet and
// hides the card for good; "Not now" hides it for 14 days.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import useLanguage from '../../hooks/useLanguage';
import useEntitlement from '../../hooks/useEntitlement';
import { FEATURE_TIERS } from '../../constants/featureAccess';
import {
  ALEXA_CARD_LATER_KEY, ALEXA_DONE_KEY, ALEXA_FIRST_SEEN_KEY, readFlag, writeFlag,
} from '../../services/alexaPromo';

const DAY = 24 * 60 * 60 * 1000;

export default function AlexaCard({ shopCount, onSetup }) {
  const { t } = useLanguage();
  const { hasAccess } = useEntitlement();
  const allowed = hasAccess(FEATURE_TIERS.alexa_skill);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!allowed) { if (alive) setShow(false); return; }
      const now = Date.now();
      const [done, later, first] = await Promise.all([
        readFlag(ALEXA_DONE_KEY), readFlag(ALEXA_CARD_LATER_KEY), readFlag(ALEXA_FIRST_SEEN_KEY),
      ]);
      if (!first) await writeFlag(ALEXA_FIRST_SEEN_KEY, String(now));
      if (!alive) return;
      if (done) { setShow(false); return; }
      if (later && now - Number(later) < 14 * DAY) { setShow(false); return; }
      const ageDays = first ? (now - Number(first)) / DAY : 0;
      setShow((shopCount || 0) >= 5 || ageDays >= 7);
    })();
    return () => { alive = false; };
  }, [allowed, shopCount]);

  if (!show) return null;

  const setup = () => {
    setShow(false);
    writeFlag(ALEXA_DONE_KEY, 'done');
    onSetup && onSetup();
  };
  const notNow = () => {
    setShow(false);
    writeFlag(ALEXA_CARD_LATER_KEY, String(Date.now()));
  };

  return (
    <View style={s.card}>
      <Text style={s.title}>🔊 {t('alexa_card_title')}</Text>
      <Text style={s.body}>{t('alexa_card_body')}</Text>
      <Text style={s.phrase}>“{t('alexa_phrase')}”</Text>
      <View style={s.row}>
        <TouchableOpacity style={s.primary} activeOpacity={0.85} onPress={setup} accessibilityRole="button">
          <Text style={s.primaryText}>{t('alexa_card_setup')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.later} onPress={notNow} accessibilityRole="button">
          <Text style={s.laterText}>{t('alexa_card_later')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.small}>{t('alexa_card_echo')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#DDE7D5', borderRadius: 14, borderWidth: 1, borderColor: '#C8D6BE', padding: 14, marginBottom: 12 },
  title: { fontSize: 16, fontFamily: 'Jost-Bold', color: '#3F5645' },
  body: { fontSize: 14, fontFamily: 'Jost-Regular', color: '#3F5645', marginTop: 4, lineHeight: 20 },
  phrase: { fontSize: 15, fontFamily: 'Jost-SemiBold', color: '#3F5645', marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  primary: { backgroundColor: '#4E7A54', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  primaryText: { color: '#fff', fontSize: 14, fontFamily: 'Jost-Bold' },
  later: { paddingVertical: 10, paddingHorizontal: 14 },
  laterText: { fontSize: 14, fontFamily: 'Jost-SemiBold', color: '#6B7F66' },
  small: { fontSize: 12, fontFamily: 'Jost-Regular', color: '#6B7F66', marginTop: 2 },
});
