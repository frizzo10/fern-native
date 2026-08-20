import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { ENTITLEMENT_ID, REVENUECAT_API_KEY } from '../constants/revenuecat';

// Thin wrapper around the RevenueCat SDKs. Every screen/hook in the app should
// go through this file rather than importing `react-native-purchases`/
// `react-native-purchases-ui` directly — keeps the SDK surface (and any future
// SDK-version migration) in one place. src/services/RevenueCatContext.js is
// the stateful layer built on top of these functions.

let configured = false;

// Web has no native RevenueCat module (and this app doesn't ship a web build
// of the paid features), so every function below no-ops there instead of
// throwing. Native platforms only.
const isSupportedPlatform = Platform.OS === 'ios' || Platform.OS === 'android';

export function isPurchasesConfigured() {
  return configured;
}

// Call once, as early as possible (App.js on mount). `appUserID` is optional —
// pass the logged-in user's id when known so purchases attach to that account
// from the start; otherwise RevenueCat assigns an anonymous id and
// `loginPurchaser` below aliases it to the real user id once auth resolves.
export function configurePurchases(appUserID) {
  if (!isSupportedPlatform || configured) return;
  if (!REVENUECAT_API_KEY) {
    console.warn('⚠️ RevenueCat: no API key configured for this platform — subscriptions will not work.');
    return;
  }

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  Purchases.configure({
    apiKey: REVENUECAT_API_KEY,
    appUserID: appUserID || null,
  });
  configured = true;
}

// Attaches the current RevenueCat purchaser (anonymous or otherwise) to a
// real backend user id. Call right after login/signup succeeds. Safe to call
// repeatedly with the same id — RevenueCat treats it as a no-op if already
// logged in as that user.
export async function loginPurchaser(appUserID) {
  if (!isSupportedPlatform || !configured || !appUserID) return null;
  const { customerInfo } = await Purchases.logIn(appUserID);
  return customerInfo;
}

// Detaches the current user, reverting to a new anonymous RevenueCat id. Call
// on sign-out so the next login (possibly a different account, same device)
// doesn't inherit this user's entitlements.
export async function logoutPurchaser() {
  if (!isSupportedPlatform || !configured) return null;
  return Purchases.logOut();
}

export async function fetchCustomerInfo() {
  if (!isSupportedPlatform || !configured) return null;
  return Purchases.getCustomerInfo();
}

export async function fetchOfferings() {
  if (!isSupportedPlatform || !configured) return null;
  return Purchases.getOfferings();
}

export function addCustomerInfoListener(listener) {
  if (!isSupportedPlatform) return;
  Purchases.addCustomerInfoUpdateListener(listener);
}

export function removeCustomerInfoListener(listener) {
  if (!isSupportedPlatform) return;
  Purchases.removeCustomerInfoUpdateListener(listener);
}

// Buys a single package (the Pro or Pro Max monthly package in the default
// Offering — see PACKAGE_IDS in src/constants/revenuecat.js). Throws on
// failure — callers should catch and check
// `error.userCancelled` before surfacing an error to the user (RevenueCat
// flags a user-dismissed purchase sheet as an error, not a resolved promise).
export async function purchasePackage(pkg) {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases() {
  return Purchases.restorePurchases();
}

// Presents RevenueCat's hosted Paywall UI (configured visually in the
// RevenueCat dashboard, no app-side layout code needed). Resolves to a
// PAYWALL_RESULT — PURCHASED/RESTORED mean the entitlement is now active,
// CANCELLED/ERROR/NOT_PRESENTED mean it isn't.
export async function presentPaywall(options = {}) {
  if (!isSupportedPlatform) return PAYWALL_RESULT.NOT_PRESENTED;
  return RevenueCatUI.presentPaywall(options);
}

// Same as presentPaywall, but RevenueCat skips showing it if the customer
// already has the entitlement — use this at feature-gate checkpoints instead
// of presentPaywall + a manual hasAccess check.
export async function presentPaywallIfNeeded(requiredEntitlementIdentifier = ENTITLEMENT_ID) {
  if (!isSupportedPlatform) return PAYWALL_RESULT.NOT_PRESENTED;
  return RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier });
}

// Presents RevenueCat's hosted Customer Center (manage/cancel subscription,
// restore purchases, contact support) — also configured visually in the
// dashboard. Use for "Manage Subscription" entry points instead of building
// custom cancel/refund UI.
export async function presentCustomerCenter() {
  if (!isSupportedPlatform) return;
  return RevenueCatUI.presentCustomerCenter();
}

export { PAYWALL_RESULT };
