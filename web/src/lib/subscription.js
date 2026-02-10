/**
 * Subscription management (Android + iOS via RevenueCat)
 *
 * - Native (Capacitor Android/iOS): uses RevenueCat to check entitlements
 * - Web (browser / dev): keeps the previous behaviour (always-active subscription)
 *
 * Pricing: £24.99/year including VAT
 *
 * Expected RevenueCat configuration:
 * - Entitlement identifier in dashboard (check RevenueCat project - may be "BoatMatey Premium" or "boatmatey_premium")
 * - One yearly product in each store mapped to that entitlement
 *   - Google Play product ID: "boatmatey_premium_yearly:yearly"
 *
 * Native API keys are provided via Vite env:
 * - VITE_REVENUECAT_API_KEY_ANDROID
 * - VITE_REVENUECAT_API_KEY_IOS
 */

import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { supabase } from './supabaseClient.js';
import { getSession } from './dataService.js';
import { initRevenueCat } from '../services/revenuecat.js';

// RevenueCat dashboard may use "BoatMatey Premium" (with space) - check your project's Entitlements
const ENTITLEMENT_IDS = ['BoatMatey Premium', 'boatmatey_premium'];
const DISPLAY_PRICE = '£24.99/year';

function getActiveEntitlement(customerInfo) {
  const active = customerInfo?.entitlements?.active;
  if (!active || typeof active !== 'object') return null;
  for (const id of ENTITLEMENT_IDS) {
    if (active[id]) return active[id];
  }
  // Fallback: use first active entitlement if only one
  const keys = Object.keys(active);
  if (keys.length > 0) return active[keys[0]];
  return null;
}

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
 * Fetch subscription status from the user's Supabase profile (source of truth when signed in).
 * Returns null if no session or no profile; otherwise { active, plan, expires_at }.
 */
async function getSubscriptionFromProfile() {
  if (!supabase) return null;
  const session = await getSession();
  if (!session?.user?.id) return null;
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('subscription_status, subscription_plan, subscription_expires_at')
      .eq('id', session.user.id)
      .maybeSingle();
    if (error || !profile) return null;
    const expiresAt = profile.subscription_expires_at ? new Date(profile.subscription_expires_at) : null;
    const active = profile.subscription_status === 'active' && (!expiresAt || expiresAt > new Date());
    return {
      active,
      plan: profile.subscription_plan || (active ? 'BoatMatey Yearly' : 'None'),
      expires_at: profile.subscription_expires_at ?? null
    };
  } catch (e) {
    console.warn('[Subscription] Failed to get profile subscription:', e);
    return null;
  }
}

/**
 * Refresh subscription status from RevenueCat (native) and optionally from Supabase profile.
 * When the user is signed in, profile is used as fallback/source of truth so Settings shows
 * correct status even if RevenueCat app user ID is out of sync (e.g. after Google sign-in).
 */
export async function refreshSubscriptionStatus() {
  const isNative = Capacitor.isNativePlatform?.() ?? false;
  if (!isNative) {
    // Web: no RevenueCat; keep always-active but load renewal date from profile when signed in
    const profileSub = await getSubscriptionFromProfile();
    if (profileSub?.expires_at) {
      subscriptionState = {
        ...subscriptionState,
        expires_at: profileSub.expires_at
      };
    }
    return subscriptionState;
  }

  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    console.log('[Subscription] Raw customerInfo.entitlements:', JSON.stringify(customerInfo?.entitlements, null, 2));

    const entitlement = getActiveEntitlement(customerInfo);
    const rcActive = !!entitlement;
    console.log('[Subscription] Active entitlement:', entitlement ? 'yes' : 'no', entitlement ? '(expires: ' + (entitlement.expirationDate || 'n/a') + ')' : '');

    subscriptionState = {
      active: rcActive,
      plan: rcActive ? 'BoatMatey Yearly' : 'None',
      price: DISPLAY_PRICE,
      expires_at: entitlement?.expirationDate ?? null
    };

    // When signed in, use Supabase profile as fallback: if profile says active and not expired, trust it
    const profileSub = await getSubscriptionFromProfile();
    if (profileSub && (profileSub.active || subscriptionState.active)) {
      const useProfile = profileSub.active;
      if (useProfile) {
        subscriptionState = {
          active: true,
          plan: profileSub.plan || 'BoatMatey Yearly',
          price: DISPLAY_PRICE,
          expires_at: profileSub.expires_at ?? subscriptionState.expires_at
        };
        console.log('[Subscription] Using profile subscription (active, expires:', subscriptionState.expires_at, ')');
      }
    }
  } catch (error) {
    console.error('[Subscription] Failed to refresh customer info from RevenueCat:', error);
    // Still try profile as fallback when RevenueCat fails
    const profileSub = await getSubscriptionFromProfile();
    if (profileSub?.active) {
      subscriptionState = {
        active: true,
        plan: profileSub.plan || 'BoatMatey Yearly',
        price: DISPLAY_PRICE,
        expires_at: profileSub.expires_at ?? null
      };
      console.log('[Subscription] Using profile subscription after RevenueCat failure');
    }
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

const RESTORE_TIMEOUT_MS = 20000;

/**
 * Restore purchases (native).
 * Useful when reinstalling or switching devices.
 * Returns { active, error } so the UI can show success / "No purchases to restore" / error without alerts.
 */
export async function restoreSubscription() {
  const isNative = Capacitor.isNativePlatform?.() ?? false;
  if (!isNative) {
    return { ...subscriptionState, active: subscriptionState.active, error: 'Restore is only available in the app.' };
  }

  try {
    // Ensure RevenueCat is configured (e.g. Android uses revenuecat.js at launch; may not be ready yet)
    await initRevenueCat();

    const restorePromise = Purchases.restorePurchases();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Restore is taking longer than usual. Please check your connection and try again.')), RESTORE_TIMEOUT_MS);
    });
    await Promise.race([restorePromise, timeoutPromise]);

    const status = await refreshSubscriptionStatus();
    return { ...status, active: status.active, error: null };
  } catch (error) {
    console.error('[Subscription] Restore purchases failed:', error);
    const message = error?.message || 'Something went wrong while restoring your purchases. Please try again later.';
    return { ...subscriptionState, active: false, error: message };
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
