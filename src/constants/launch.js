// Launch-period switch. While true, EVERY user gets Pro Max features (no purchase
// needed). Flip to false (and ship an OTA) to go back to Free / Pro / Pro Max.
// Purchases still work; RevenueCat and the tier pushed to the server are untouched,
// so real subscribers are never confused with launch-period users.
export const LAUNCH_ALL_FREE = true;
