// Tiny bridge so any screen can open the global FAQ / help sheet, which is mounted once in App.js.
let listener = null;

export function subscribeOpenHelp(fn) {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}

export function openHelp() {
  if (listener) listener();
}

// Help now lives in Account -> Tours; this flag tells AccountScreen to scroll there when it opens.
let wantTours = false;
export function requestToursScroll() { wantTours = true; }
export function consumeToursScroll() { const v = wantTours; wantTours = false; return v; }
