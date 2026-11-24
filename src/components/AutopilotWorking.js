// "Fern is working" picture: a spinning gear ring around the leaf and a checklist where each step spins, then ticks off.
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';

export default function AutopilotWorking({ title, steps, current, finished }) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true }));
    const b = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 650, useNativeDriver: true }),
    ]));
    a.start(); b.start();
    return () => { a.stop(); b.stop(); };
  }, [spin, pulse]);
  const rot = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  return (
    <View style={s.wrap}>
      <View style={s.orbBox}>
        <Animated.View style={[s.ring, { transform: [{ rotate: rot }] }]}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <View key={i} style={[s.tooth, { transform: [{ rotate: `${i * 45}deg` }, { translateY: -52 }] }]} />)}
        </Animated.View>
        <Animated.View style={[s.orb, { transform: [{ scale }] }]}><Text style={s.leaf}>{finished ? '✅' : '🌿'}</Text></Animated.View>
      </View>
      <Text style={s.title}>{title}</Text>
      <View style={s.list}>
        {steps.map((label, i) => {
          const done = finished || i < current;
          const active = !finished && i === current;
          return (
            <View key={i} style={[s.row, !done && !active && { opacity: 0.4 }]}>
              <View style={s.mark}>
                {done ? <Text style={s.check}>✓</Text> : active ? <ActivityIndicator size="small" color="#3F5645" /> : <View style={s.dot} />}
              </View>
              <Text style={[s.label, active && s.labelOn]}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 20 },
  orbBox: { width: 130, height: 130, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 130, height: 130, alignItems: 'center', justifyContent: 'center' },
  tooth: { position: 'absolute', width: 12, height: 18, borderRadius: 4, backgroundColor: '#B5C7AB' },
  orb: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#ECF2E6', borderWidth: 2, borderColor: '#4E7A54', alignItems: 'center', justifyContent: 'center' },
  leaf: { fontSize: 38 },
  title: { fontSize: 22, fontFamily: 'Jost-Bold', color: '#2F4535', marginTop: 18, textAlign: 'center' },
  list: { alignSelf: 'stretch', marginTop: 20, paddingHorizontal: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  mark: { width: 30, height: 24, alignItems: 'center', justifyContent: 'center' },
  check: { fontSize: 20, color: '#4E7A54', fontFamily: 'Jost-Bold' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C8D6BE' },
  label: { fontSize: 17, fontFamily: 'Jost-Regular', color: '#5C7262', marginLeft: 8, flex: 1 },
  labelOn: { fontFamily: 'Jost-Bold', color: '#2F4535' },
});
