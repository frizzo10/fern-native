// Lets the "review before adding" step open as its own full screen on top of the Shopping screen
// (not inline between the lists, and not a Modal — iOS drops a Modal presented while another is closing).
// ListAddPreview posts its props here; ShoppingScreen subscribes and draws the overlay.
let listener = null;

export function subscribeReview(fn) {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}

export function showReview(props) {
  if (listener) listener(props);
}

export function hideReview() {
  if (listener) listener(null);
}

export function hasReviewHost() {
  return Boolean(listener);
}
