import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { TIERS } from '../constants/tiers';
import { tierFromCustomerInfo } from '../constants/revenuecat';
import {
  addCustomerInfoListener,
  configurePurchases,
  fetchCustomerInfo,
  fetchOfferings,
  isPurchasesConfigured,
  loginPurchaser,
  logoutPurchaser,
  presentCustomerCenter as presentCustomerCenterSdk,
  presentPaywall as presentPaywallSdk,
  presentPaywallIfNeeded as presentPaywallIfNeededSdk,
  purchasePackage as purchasePackageSdk,
  removeCustomerInfoListener,
  restorePurchases as restorePurchasesSdk,
} from './purchasesService';

const RevenueCatContext = createContext(null);

// Single source of truth for "what plan is this device on," backed by
// RevenueCat. Mounted once in App.js above the auth gate; every gated feature
// in the app reads through `useEntitlement()` (src/hooks/useEntitlement.js),
// which is just a thin wrapper over this context — nothing else should import
// this file directly except App.js (to log the RevenueCat purchaser in/out
// alongside auth) and screens that need real purchase actions (PlansScreen,
// UpgradeGateModal, AccountScreen's "Manage Subscription").
export function RevenueCatProvider({ children }) {
  const [customerInfo, setCustomerInfo] = useState(null);
  // Starts true so gated features don't briefly flash "unlocked" before the
  // first customer-info fetch resolves — see tier derivation below.
  const [loading, setLoading] = useState(true);
  const [offerings, setOfferings] = useState(null);
  const listenerRef = useRef(null);

  useEffect(() => {
    configurePurchases();

    const listener = (info) => setCustomerInfo(info);
    listenerRef.current = listener;
    addCustomerInfoListener(listener);

    let cancelled = false;
    (async () => {
      try {
        const [info, offeringsResult] = await Promise.all([
          fetchCustomerInfo(),
          fetchOfferings().catch((err) => {
            console.warn('⚠️ RevenueCat: failed to fetch offerings', err.message);
            return null;
          }),
        ]);
        if (cancelled) return;
        setCustomerInfo(info);
        setOfferings(offeringsResult);
      } catch (err) {
        console.warn('⚠️ RevenueCat: failed to fetch initial customer info', err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (listenerRef.current) removeCustomerInfoListener(listenerRef.current);
    };
  }, []);

  // Call after login/signup resolves with a real user id, so purchases (and
  // any entitlement already on that account from another device) attach
  // correctly. Refreshes local state with the result.
  const loginPurchaserWithId = useCallback(async (appUserID) => {
    if (!isPurchasesConfigured() || !appUserID) return;
    try {
      const info = await loginPurchaser(appUserID);
      if (info) setCustomerInfo(info);
    } catch (err) {
      console.warn('⚠️ RevenueCat: loginPurchaser failed', err.message);
    }
  }, []);

  // Call on sign-out.
  const logoutPurchaserForSignOut = useCallback(async () => {
    if (!isPurchasesConfigured()) return;
    try {
      const info = await logoutPurchaser();
      if (info) setCustomerInfo(info);
    } catch (err) {
      console.warn('⚠️ RevenueCat: logoutPurchaser failed', err.message);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!isPurchasesConfigured()) return null;
    const info = await fetchCustomerInfo();
    setCustomerInfo(info);
    return info;
  }, []);

  const restore = useCallback(async () => {
    const info = await restorePurchasesSdk();
    setCustomerInfo(info);
    return info;
  }, []);

  const purchase = useCallback(async (pkg) => {
    const info = await purchasePackageSdk(pkg);
    setCustomerInfo(info);
    return info;
  }, []);

  const presentPaywall = useCallback((options) => presentPaywallSdk(options), []);
  const presentPaywallIfNeeded = useCallback((entitlementId) => presentPaywallIfNeededSdk(entitlementId), []);
  const presentCustomerCenter = useCallback(() => presentCustomerCenterSdk(), []);

  // Before the first fetch resolves, treat the customer as FREE rather than
  // guessing — gated features fail closed instead of flashing unlocked.
  const tier = loading ? TIERS.FREE : tierFromCustomerInfo(customerInfo);

  const value = useMemo(() => ({
    tier,
    loading,
    customerInfo,
    offerings,
    refresh,
    restore,
    purchase,
    loginPurchaser: loginPurchaserWithId,
    logoutPurchaser: logoutPurchaserForSignOut,
    presentPaywall,
    presentPaywallIfNeeded,
    presentCustomerCenter,
  }), [
    tier,
    loading,
    customerInfo,
    offerings,
    refresh,
    restore,
    purchase,
    loginPurchaserWithId,
    logoutPurchaserForSignOut,
    presentPaywall,
    presentPaywallIfNeeded,
    presentCustomerCenter,
  ]);

  return (
    <RevenueCatContext.Provider value={value}>
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat() {
  const ctx = useContext(RevenueCatContext);
  if (!ctx) throw new Error('useRevenueCat must be used within a RevenueCatProvider');
  return ctx;
}

export default RevenueCatContext;
