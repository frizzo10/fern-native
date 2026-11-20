// Loads expo-screen-orientation once, at app start. On a binary built before that native module existed, loading it
// fails; at startup the failure is thrown normally and caught here. Requiring it later (inside an effect) does NOT
// work: Metro hands a late module failure to the global error handler, which shows the "Fern hit a problem" alert.
let so = null;
try { so = require('expo-screen-orientation'); } catch (e) { so = null; }

export default so;
