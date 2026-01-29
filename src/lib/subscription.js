/**
 * Subscription management (Android + iOS via RevenueCat)
 *
 * - Native (Capacitor Android/iOS): uses RevenueCat to check entitlements
 * - Web (browser / dev): keeps the previous behaviour (always-active subscription)
 *
 * Pricing: £24.99/year including VAT
 *
 * Expected RevenueCat configuration:
 * - Entitlement ID: "boatmatey_premium"
 * - One yearly product in each store mapped to that entitlement
 *   - Suggested product ID: "boatmatey_yearly"
 *
 * Native API keys are provided via Vite env:
 * - VITE_REVENUECAT_API_KEY_ANDROID
 * - VITE_REVENUECAT_API_KEY_IOS
 */

import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';

const ENTITLEMENT_ID = 'boatmatey_premium';
const DISPLAY_PRICE = '£24.99/year';

let initialized = false;

// Internal cache of the current subscription state
let subscriptionState = {
  active: true,
  // Keep previous behaviour for web: always-on, unlimited
  plan: 'BoatMatey Yearly',
  price: DISPLAY_PRICE,
  expires_at: null
};

/**
 * Initialize RevenueCat on native platforms.
 * Safe to call multiple times; it will no-op after the first call.
 */
export async function initSubscription() {
  if (initialized) return;

  const isNative = Capacitor.isNativePlatform?.() ?? false;

  // For web / dev server we keep the previous "always-active" behaviour.
  if (!isNative) {
    initialized = true;
    console.log('[Subscription] Web/dev mode – treating subscription as always active.');
    return;
  }

  try {
    const platform = Capacitor.getPlatform();

    const apiKey =
      platform === 'ios'
        ? import.meta.env.VITE_REVENUECAT_API_KEY_IOS
        : import.meta.env.VITE_REVENUECAT_API_KEY_ANDROID;

    if (!apiKey) {
      console.warn(
        '[Subscription] RevenueCat API key is missing. Set VITE_REVENUECAT_API_KEY_ANDROID / VITE_REVENUECAT_API_KEY_IOS.'
      );
      initialized = true;
      return;
    }

    await Purchases.setLogLevel({ level: LOG_LEVEL.INFO });

    await Purchases.configure({
      apiKey,
      appUserID: null
    });

    await refreshSubscriptionStatus();
    initialized = true;
    console.log('[Subscription] RevenueCat initialized.');
  } catch (error) {
    console.error('[Subscription] Error initializing RevenueCat:', error);
    initialized = true;
  }
}

/**
 * Refresh subscription status from RevenueCat (native only).
 * On web, this keeps the cached "always active" state.
 */
export async function refreshSubscriptionStatus() {
  const isNative = Capacitor.isNativePlatform?.() ?? false;
  if (!isNative) {
    // Web: nothing to refresh – we already report active.
    return subscriptionState;
  }

  try {
    const { customerInfo } = await Purchases.getCustomerInfo();

    const entitlement = customerInfo.entitlements?.active?.[ENTITLEMENT_ID] ?? null;
    const active = !!entitlement;

    subscriptionState = {
      active,
      plan: active ? 'BoatMatey Yearly' : 'None',
      price: DISPLAY_PRICE,
      expires_at: entitlement?.expirationDate ?? null
    };
  } catch (error) {
    console.error('[Subscription] Failed to refresh customer info from RevenueCat:', error);
  }

  return subscriptionState;
}

/**
 * Purchase the yearly subscription (native only).
 * Returns the updated subscription status.
 */
export async function purchaseSubscription() {
  const isNative = Capacitor.isNativePlatform?.() ?? false;
  if (!isNative) {
    alert('Subscriptions can only be purchased from the Android or iOS app.');
    return subscriptionState;
  }

  try {
    const offerings = await Purchases.getOfferings();

    const current = offerings.current;
    if (!current) {
      throw new Error('No current offering configured in RevenueCat.');
    }

    // Prefer the annual package if available, otherwise any available package.
    const selectedPackage = current.annual || current.availablePackages?.[0];
    if (!selectedPackage) {
      throw new Error('No purchasable package found in the current offering.');
    }

    await Purchases.purchasePackage({ aPackage: selectedPackage });

    // After a successful purchase, refresh entitlements.
    return await refreshSubscriptionStatus();
  } catch (error) {
    // User cancellations are expected; RevenueCat exposes a flag for that in TS,
    // but here we just log and surface a friendly message.
    console.error('[Subscription] Purchase failed:', error);
    alert(
      error?.message ||
        'Something went wrong while processing your subscription. Please try again.'
    );
    return subscriptionState;
  }
}

/**
 * Restore purchases (native).
 * Useful when reinstalling or switching devices.
 */
export async function restoreSubscription() {
  const isNative = Capacitor.isNativePlatform?.() ?? false;
  if (!isNative) {
    alert('Restore purchases is only needed in the Android or iOS app.');
    return subscriptionState;
  }

  try {
    await Purchases.restorePurchases();
    const status = await refreshSubscriptionStatus();
    alert(status.active ? 'Your subscription has been restored.' : 'No active subscription found.');
    return status;
  } catch (error) {
    console.error('[Subscription] Restore purchases failed:', error);
    alert(
      error?.message ||
        'Something went wrong while restoring your purchases. Please try again later.'
    );
    return subscriptionState;
  }
}

/**
 * Whether the user currently has an active subscription.
 */
export function hasActiveSubscription() {
  return !!subscriptionState.active;
}

/**
 * Get a human-friendly subscription status object for UI.
 */
export function getSubscriptionStatus() {
  return { ...subscriptionState };
}

/**
 * Limit helpers – currently keep everything unlimited.
 * These functions are still here to preserve the existing API surface.
 */
export function checkLimit(resourceType, currentCount) {
  return {
    allowed: true,
    limit: Infinity,
    current: currentCount
  };
}

export function getLimitInfo(resourceType) {
  return { limit: Infinity, label: 'Unlimited' };
}

// Placeholder for backwards compatibility – no longer used.
export function simulateSubscription(enabled) {
  return;
}
