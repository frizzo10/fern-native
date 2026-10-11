import { registerRootComponent } from 'expo';

import App from './App';
// Defines the store-arrival background task. Must run at startup in the global scope
// (not inside a component) so iOS/Android can launch it while the app is closed.
import './src/services/storeGeofencing';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
