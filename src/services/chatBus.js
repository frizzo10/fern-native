// Tiny bridge so any screen can open the global "Ask Fern" chat sheet, which is
// mounted once in App.js (state lives there, not in a context). App.js calls
// subscribeOpenChat() on mount; screens call openChat().
let listener = null;

export function subscribeOpenChat(fn) {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}

export function openChat() {
  if (listener) listener();
}
