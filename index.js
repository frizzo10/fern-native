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

registerRootComponent(App);
