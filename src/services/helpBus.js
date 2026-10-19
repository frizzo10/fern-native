// Tiny bridge so any screen can open the global FAQ / help sheet, which is mounted once in App.js.
let listener = null;

export function subscribeOpenHelp(fn) {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}

export function openHelp() {
  if (listener) listener();
}
