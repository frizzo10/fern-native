// Lets App.js ask Home to open one of its tools (e.g. after a feature tour ends) without going through
// navigation params. A request made before Home has mounted is kept until Home subscribes.
let listener = null;
let pending = null;

export function subscribeOpenTool(fn) {
  listener = fn;
  if (pending) { const k = pending; pending = null; setTimeout(() => fn(k), 300); }
  return () => { if (listener === fn) listener = null; };
}

export function requestOpenTool(key) {
  if (listener) listener(key); else pending = key;
}
