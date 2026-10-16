// Lets a tour step point at a real element on screen. A screen registers the element's ref under a name
// (`tourTargetRef('profile')` on the view), a tour step names it (`target: 'profile'` in tourContent.js), and
// TourModal asks `measureTourTarget` for its window rectangle to draw the spotlight.
// Elements that are not a View (the bottom tab bar) register a static size instead: `setTourStaticRect('tabs', { height })`
// means "full width, `height` tall, glued to the bottom of the window".
const refs = {};
const statics = {};
const refCallbacks = {};

// Stable callback per name, so React doesn't detach/re-attach the ref on every render.
export function tourTargetRef(name) {
  if (!refCallbacks[name]) refCallbacks[name] = (r) => { refs[name] = r || null; };
  return refCallbacks[name];
}

export function setTourStaticRect(name, rect) {
  statics[name] = rect;
}

// Resolves { x, y, width, height } in window coordinates, or null if the element isn't there / can't be measured.
export function measureTourTarget(name, windowSize) {
  return new Promise((resolve) => {
    const s = statics[name];
    if (s && windowSize) {
      const height = s.height;
      resolve({ x: 0, y: windowSize.height - height, width: windowSize.width, height });
      return;
    }
    const r = refs[name];
    if (!r || typeof r.measureInWindow !== 'function') { resolve(null); return; }
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve(null); } }, 800);
    try {
      r.measureInWindow((x, y, width, height) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
      });
    } catch (e) {
      done = true;
      clearTimeout(timer);
      resolve(null);
    }
  });
}
