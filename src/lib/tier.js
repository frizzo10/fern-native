// src/lib/tier.js
//
// Subscription tier check for native. There is currently NO real way to
// determine or grant Pro Max status on native -- RevenueCat isn't
// integrated yet, and no tier field is read from the backend here. The web
// app's own equivalent (getUserTier() in index.html) has the same kind of
// gap: it defaults everyone to 'pro_max' via localStorage as a known,
// previously-flagged dev shortcut, not a real enforcement mechanism.
//
// Per explicit decision (Aug 2026): ship Pro Max-gated features on native
// now with this stub defaulting to OPEN, rather than blocking every native
// user from a feature nobody can currently pay to unlock. When RevenueCat
// is wired in, change ONLY the return value below -- every call site using
// isProMax() elsewhere in the app will then be correctly gated with zero
// other changes needed.
export function isProMax() {
  return true; // STUB: flip to real RevenueCat/entitlement check when built
}
