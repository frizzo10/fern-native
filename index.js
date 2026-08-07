// Must be the very first import -- registers the background geofencing
// task (see geofenceTask.js) before anything else runs. This matters
// specifically for the case where the OS launches the app in a background/
// headless context to deliver a geofence event while the app was fully
// killed -- if the task isn't defined yet when that happens, the event is
// silently dropped.
import './src/lib/geofenceTask';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
