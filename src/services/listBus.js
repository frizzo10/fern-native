// Lets the recipe viewer send the person to the Shopping list (the navigator lives in App.js).
let listener = null;

export function subscribeShowList(fn) {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}

export function showShoppingList() {
  if (listener) listener();
}
