// Diagnostic only: a tiny always-on readout that shows whether the app's JavaScript is running
// (the counter keeps ticking), how long the longest pause was, and how late a 400 ms timer fires.
// If the counter stops while the screen looks stuck, JS is blocked; if it keeps ticking, the
// screen is simply not redrawing. Remove once the "frozen until reopened" problem is solved.
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';

export default function JsHeartbeat() {
  const [n, setN] = useState(0);
  const [maxGap, setMaxGap] = useState(0);
  const [timerMs, setTimerMs] = useState(0);
  const [appState, setAppState] = useState(AppState.currentState);
  const last = useRef(Date.now());
  const gapRef = useRef(0);

  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();
      gapRef.current = Math.max(gapRef.current, now - last.current);
      last.current = now;
      setN((v) => v + 1);
      setMaxGap(gapRef.current);
    }, 500);
    const probe = setInterval(() => {
      const start = Date.now();
      setTimeout(() => setTimerMs(Date.now() - start), 400);
    }, 3000);
    const sub = AppState.addEventListener('change', setAppState);
    const reset = setInterval(() => { gapRef.current = 0; }, 30000);
    return () => { clearInterval(tick); clearInterval(probe); clearInterval(reset); sub.remove(); };
  }, []);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 6, bottom: 96, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, zIndex: 9999 }}>
      <Text style={{ color: '#9f9', fontSize: 10 }}>{`TEST d6ae198 · JS ${n} · pause ${(maxGap / 1000).toFixed(1)}s · 400ms timer took ${timerMs}ms · ${appState}`}</Text>
    </View>
  );
}
