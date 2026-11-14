// The signed-in person's current access token, kept in memory so the one request wrapper in index.js can attach
// it to every call to our own server (header `x-fern-token`). Set by useAuth whenever the user changes
// (sign-in, restore, refresh, sign-out). Never stored anywhere from here and never logged.
let current = '';

export function setAuthToken(token) {
  current = typeof token === 'string' ? token : '';
}

export function getAuthToken() {
  return current;
}
