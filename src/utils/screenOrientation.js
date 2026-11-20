// Cook Mode rotation is switched OFF until the native build 1.1.12 (which contains expo-screen-orientation) is
// installed. The module is deliberately NOT loaded here, because on a binary without it the load fails and the
// global error handler shows "Fern hit a problem". When 1.1.12 ships, put back:
//   let so = null; try { so = require('expo-screen-orientation'); } catch (e) { so = null; } export default so;
const so = null;

export default so;
