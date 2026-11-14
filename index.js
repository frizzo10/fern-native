import { registerRootComponent } from 'expo';

import App from './App';
// Defines the store-arrival background task. Must run at startup in the global scope
// (not inside a component) so iOS/Android can launch it while the app is closed.
import './src/services/storeGeofencing';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
// A JavaScript error outside rendering (a tap handler, a timer, a request) would otherwise close the app with no explanation.
// Remember it and show what it was so it can be fixed; the app keeps running.
try {
  const { Alert } = require('react-native');
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  const previous = global.ErrorUtils?.getGlobalHandler?.();
  global.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
    try {
      const text = `${new Date().toISOString()} ${isFatal ? 'fatal' : 'error'}\n${String(error?.message || error)}\n${String(error?.stack || '').split('\n').slice(0, 8).join('\n')}`;
      AsyncStorage.setItem('fern_last_crash', text).catch(() => {});
      Alert.alert('Fern hit a problem', String(error?.message || error).slice(0, 400));
    } catch (e) {
      if (previous) previous(error, isFatal);
    }
  });
} catch (e) { /* never block startup */ }

// Security (2026-11-13): every request to our own server carries the signed-in person's access token in an
// `x-fern-token` header, so the server can tell an account from a stranger (per-account limits, and it can require
// sign-in for the functions that cost money). One wrapper here covers every call site; requests to any other host
// are passed through untouched, and any problem inside the wrapper falls back to the plain request.
try {
  const { getAuthToken } = require('./src/services/authToken');
  const FERN_FN = 'https://app.clickpickandcook.com/.netlify/functions/';
  const plainFetch = global.fetch;
  if (typeof plainFetch === 'function') {
    global.fetch = function fernFetch(input, init) {
      try {
        if (typeof input === 'string' && input.indexOf(FERN_FN) === 0) {
          const token = getAuthToken();
          if (token) {
            const src = (init && init.headers) || {};
            let headers;
            if (typeof Headers !== 'undefined' && src instanceof Headers) {
              headers = new Headers(src);
              if (!headers.has('x-fern-token')) headers.set('x-fern-token', token);
            } else if (Array.isArray(src)) {
              headers = src.concat([['x-fern-token', token]]);
            } else {
              headers = { ...src };
              if (!Object.keys(headers).some((k) => String(k).toLowerCase() === 'x-fern-token')) headers['x-fern-token'] = token;
            }
            return plainFetch.call(this, input, { ...(init || {}), headers });
          }
        }
      } catch (e) { /* fall through to the plain request */ }
      return plainFetch.apply(this, arguments);
    };
  }
} catch (e) { /* never block startup */ }

// People with iPhone "Larger Text" / accessibility sizes on saw the layout break (text overflowing circles, headers
// overlapping). Let text grow a little for readability, but never past 1.3x. In React Native 0.85 Text is a plain
// function component (no .render, defaultProps ignored), so add the limit when every <Text>/<TextInput> element
// is created, by wrapping React's element factories (guarded: never block startup).
try {
  const RN = require('react-native');
  const MAX_FONT_SCALE = 1.3;
  const targets = new Set([RN.Text, RN.TextInput].filter(Boolean));
  const wrap = (mod, names) => {
    names.forEach((name) => {
      const orig = mod && mod[name];
      if (typeof orig !== 'function') return;
      try {
        mod[name] = function patched(type, props, ...rest) {
          if (targets.has(type) && props && props.maxFontSizeMultiplier == null) {
            props = { ...props, maxFontSizeMultiplier: MAX_FONT_SCALE };
          }
          return orig.call(this, type, props, ...rest);
        };
      } catch (e) { /* read-only export: skip */ }
    });
  };
  wrap(require('react'), ['createElement']);
  wrap(require('react/jsx-runtime'), ['jsx', 'jsxs']);
  try { wrap(require('react/jsx-dev-runtime'), ['jsxDEV']); } catch (e) { /* not bundled in release */ }
} catch (e) { /* never block startup */ }

registerRootComponent(App);
