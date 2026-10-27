// One-line Alexa hint with a close (x). Used on the shopping list and in the recipe viewer.
// `onPress` decides what a tap does (open setup, or copy the phrase); the x hides every hint.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import useEntitlement from '../hooks/useEntitlement';
import { FEATURE_TIERS } from '../constants/featureAccess';
import { ALEXA_HINT_OFF_KEY, readFlag, writeFlag } from '../services/alexaPromo';

export default function AlexaHint({ text, onPress, style }) {
  const { hasAccess } = useEntitlement();
  const allowed = hasAccess(FEATURE_TIERS.alexa_skill);
  const [off, setOff] = useState(true);

  useEffect(() => {
    let alive = true;
    readFlag(ALEXA_HINT_OFF_KEY).then((v) => { if (alive) setOff(Boolean(v)); });
    return () => { alive = false; };
  }, []);

  if (!allowed || off) return null;

  return (
    <View style={[s.wrap, style]}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.8} onPress={onPress} accessibilityRole="button">
        <Text style={s.text}>🔊 {text}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { setOff(true); writeFlag(ALEXA_HINT_OFF_KEY, 'off'); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Close">
        <Text style={s.x}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DDE7D5', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginTop: 8 },
  text: { fontSize: 13, fontFamily: 'Jost-SemiBold', color: '#3F5645', lineHeight: 18 },
  x: { fontSize: 14, color: '#6B7F69', paddingLeft: 10 },
});
