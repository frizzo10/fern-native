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

// People with iPhone "Larger Text" / accessibility sizes on saw the layout break (text overflowing circles, headers
// overlapping). Let text grow a little for readability, but never past 1.3x. React 19 ignores defaultProps on
// function components, so wrap the components' render function as well (guarded: never block startup).
try {
  const RN = require('react-native');
  const MAX_FONT_SCALE = 1.3;
  [RN.Text, RN.TextInput].forEach((Comp) => {
    if (!Comp) return;
    try { Comp.defaultProps = { ...(Comp.defaultProps || {}), maxFontSizeMultiplier: MAX_FONT_SCALE }; } catch (e) { /* ignore */ }
    if (typeof Comp.render === 'function') {
      const origRender = Comp.render;
      Comp.render = function patchedRender(props, ref) {
        const next = props && props.maxFontSizeMultiplier == null ? { ...props, maxFontSizeMultiplier: MAX_FONT_SCALE } : props;
        return origRender.call(this, next, ref);
      };
    }
  });
} catch (e) { /* never block startup */ }

registerRootComponent(App);
