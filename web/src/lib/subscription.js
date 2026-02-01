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

    // Android is configured in services/revenuecat.js at launch. Only configure iOS here if key is set.
    if (platform === 'ios') {
      const apiKey = import.meta.env.VITE_REVENUECAT_API_KEY_IOS;
      if (apiKey) {
        await Purchases.setLogLevel({ level: LOG_LEVEL.INFO });
        await Purchases.configure({ apiKey, appUserID: null });
      }
    }

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
 * Returns the updated subscription status with additional metadata.
 */
export async function purchaseSubscription() {
  const isNative = Capacitor.isNativePlatform?.() ?? false;
  if (!isNative) {
    return { ...subscriptionState, cancelled: false, error: 'Web not supported' };
  }

  try {
    console.log('[Subscription] Getting offerings...');
    const offerings = await Purchases.getOfferings();
    console.log('[Subscription] Offerings:', JSON.stringify(offerings, null, 2));

    const current = offerings.current;
    if (!current) {
      console.error('[Subscription] No current offering found');
      return { ...subscriptionState, cancelled: false, error: 'No offering configured' };
    }

    console.log('[Subscription] Current offering:', current.identifier);
    console.log('[Subscription] Available packages:', current.availablePackages?.map(p => p.identifier));

    // Prefer the annual package if available, otherwise any available package.
    const selectedPackage = current.annual || current.availablePackages?.[0];
    if (!selectedPackage) {
      console.error('[Subscription] No package found in offering');
      return { ...subscriptionState, cancelled: false, error: 'No package available' };
    }

    console.log('[Subscription] Selected package:', selectedPackage.identifier);
    console.log('[Subscription] Initiating purchase...');

    try {
      const purchaseResult = await Purchases.purchasePackage({ aPackage: selectedPackage });
      console.log('[Subscription] Purchase completed successfully');
      console.log('[Subscription] Purchase result:', JSON.stringify(purchaseResult, null, 2));
    } catch (purchaseError) {
      // Sometimes purchase succeeds in store but throws error
      // Check if we actually got the entitlement despite the error
      console.warn('[Subscription] Purchase call threw error, checking entitlements...', purchaseError);
    }

    // Always refresh and check entitlements after purchase attempt
    console.log('[Subscription] Refreshing entitlements...');
    await refreshSubscriptionStatus();
    
    const hasActive = hasActiveSubscription();
    console.log('[Subscription] Active subscription after purchase?', hasActive);
    
    if (hasActive) {
      console.log('[Subscription] ✅ Subscription activated successfully');
      return { ...subscriptionState, cancelled: false, error: null };
    } else {
      console.error('[Subscription] ❌ No active subscription found after purchase');
      // Still no entitlement - this was likely cancelled or failed
      return { ...subscriptionState, cancelled: true, error: null };
    }
    
  } catch (error) {
    console.error('[Subscription] Purchase error:', error);
    console.error('[Subscription] Error details:', JSON.stringify(error, null, 2));
    
    // Check if this was a user cancellation
    // RevenueCat error codes: https://www.revenuecat.com/docs/error-codes
    const errorCode = error?.code || error?.errorCode;
    const errorMessage = error?.message || error?.underlyingErrorMessage || '';
    
    // User cancelled the purchase
    if (errorCode === 1 || 
        errorCode === 'PURCHASE_CANCELLED' || 
        errorMessage.toLowerCase().includes('cancel') ||
        errorMessage.toLowerCase().includes('user cancelled')) {
      console.log('[Subscription] User cancelled purchase');
      return { ...subscriptionState, cancelled: true, error: null };
    }
    
    // Before reporting error, check if subscription actually went through
    try {
      await refreshSubscriptionStatus();
      if (hasActiveSubscription()) {
        console.log('[Subscription] Purchase succeeded despite error!');
        return { ...subscriptionState, cancelled: false, error: null };
      }
    } catch (refreshError) {
      console.error('[Subscription] Failed to refresh after error:', refreshError);
    }
    
    // Actual error
    return { 
      ...subscriptionState, 
      cancelled: false, 
      error: errorMessage || 'Purchase failed. Please try again.' 
    };
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
 * Subscription limits for BoatMatey
 * - 2 active boats
 * - 5 archived boats
 * - Unlimited engines, service entries, equipment, etc.
 */
const LIMITS = {
  active_boats: 2,
  archived_boats: 5,
  engines: Infinity,
  service_entries: Infinity,
  equipment: Infinity,
  logbook_entries: Infinity,
  attachments: Infinity
};

/**
 * Check if a resource limit allows adding more items
 * @param {string} resourceType - 'active_boats', 'archived_boats', 'engines', etc.
 * @param {number} currentCount - Current count of the resource
 * @returns {{ allowed: boolean, limit: number, current: number, remaining: number }}
 */
export function checkLimit(resourceType, currentCount) {
  const limit = LIMITS[resourceType] ?? Infinity;
  const remaining = Math.max(0, limit - currentCount);
  
  return {
    allowed: currentCount < limit,
    limit: limit,
    current: currentCount,
    remaining: remaining
  };
}

/**
 * Get limit information for a resource type
 * @param {string} resourceType - 'active_boats', 'archived_boats', 'engines', etc.
 * @returns {{ limit: number, label: string }}
 */
export function getLimitInfo(resourceType) {
  const limit = LIMITS[resourceType] ?? Infinity;
  
  if (limit === Infinity) {
    return { limit: Infinity, label: 'Unlimited' };
  }
  
  return { limit: limit, label: `${limit}` };
}

/**
 * Get all limits for display
 */
export function getAllLimits() {
  return {
    activeBoats: { limit: LIMITS.active_boats, label: `${LIMITS.active_boats} active boats` },
    archivedBoats: { limit: LIMITS.archived_boats, label: `${LIMITS.archived_boats} archived boats` },
    engines: { limit: LIMITS.engines, label: 'Unlimited engines' },
    serviceEntries: { limit: LIMITS.service_entries, label: 'Unlimited service entries' },
    equipment: { limit: LIMITS.equipment, label: 'Unlimited equipment' },
    attachments: { limit: LIMITS.attachments, label: 'Unlimited attachments' }
  };
}

// Placeholder for backwards compatibility – no longer used.
export function simulateSubscription(enabled) {
  return;
}
