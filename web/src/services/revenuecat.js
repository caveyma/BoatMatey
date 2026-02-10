/**
 * RevenueCat Purchases init – runs at app launch on native platforms only.
 * Configures the SDK so Google Play / App Store can detect billing.
 * Web builds skip this (no-op).
 *
 * Like PetHub+: call logInWithAppUserId(pending_${email}) before purchase so the
 * purchase is tied to the user; after account creation call logInWithAppUserId(user.id).
 */

import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';

let configured = false;

/**
 * Initialize RevenueCat Purchases on native platforms.
 * Safe to call multiple times; no-ops after first successful configure.
 */
export async function initRevenueCat() {
  if (configured) return;

  const isNative = Capacitor.isNativePlatform?.() ?? false;
  if (!isNative) return;

  try {
    const platform = Capacitor.getPlatform();

    const apiKey =
      platform === 'android'
        ? (import.meta.env.VITE_REVENUECAT_API_KEY_ANDROID || null)
        : (import.meta.env.VITE_REVENUECAT_API_KEY_IOS || null);

    if (!apiKey) {
      if (platform === 'ios') {
        console.warn('[RevenueCat] iOS API key not set. Set VITE_REVENUECAT_API_KEY_IOS to enable.');
      } else if (platform === 'android') {
        console.warn('[RevenueCat] Android API key not set. Set VITE_REVENUECAT_API_KEY_ANDROID to enable.');
      }
      return;
    }

    const keyPreview = apiKey.length >= 8 ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : '(empty)';
    console.log('[RevenueCat] Using API key', keyPreview, '(length', apiKey.length + ') – must match RevenueCat Dashboard → API keys → BoatMatey (App Store)');

    await Purchases.setLogLevel({ level: LOG_LEVEL.INFO });
    await Purchases.configure({
      apiKey,
      appUserID: null
    });
    configured = true;
    console.log('[RevenueCat] Purchases configured for', platform);
  } catch (error) {
    console.error('[RevenueCat] Configure failed:', error);
  }
}

/**
 * Log in RevenueCat with an app user ID (like PetHub+).
 * Call before purchase with pending_${email} so the purchase is tied to the user.
 * Call after account creation with user.id to transfer purchases to the real user.
 */
export async function logInWithAppUserId(appUserID) {
  const isNative = Capacitor.isNativePlatform?.() ?? false;
  if (!isNative || !appUserID) return;

  try {
    await initRevenueCat();
    const result = await Purchases.logIn({ appUserID });
    console.log('[RevenueCat] logIn completed for', appUserID, result);
    return result;
  } catch (error) {
    console.error('[RevenueCat] logIn failed:', error);
    throw error;
  }
}
