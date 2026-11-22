// Lets the recipe viewer send the person to "recipes added by X" or a cookbook
// (the navigator lives in App.js).
let listener = null;

export function subscribeRecipeLink(fn) {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}

export function openRecipeLink(link) {
  if (listener) listener(link);
}
