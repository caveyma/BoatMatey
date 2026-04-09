import { Capacitor } from '@capacitor/core';

const SIGNUP_CONVERSION_SESSION_KEY = 'boatmatey_gads_signup_conversion_uid';

const SIGNUP_SEND_TO = 'AW-18047351146/h6IRCLS1m5EcEOry0p1D';

/**
 * Fire Google Ads "signup" conversion for a brand-new Supabase account (web only).
 *
 * - No-ops on native, without gtag, without a fresh identity on the user, or if already fired for this user id in this tab.
 * - Call only from the success path immediately after signUp + profile bootstrap succeeds.
 */
export function fireGoogleAdsSignupConversionIfEligible(user) {
  if (Capacitor.isNativePlatform()) return;
  if (!user?.id) return;
  if (!user.identities?.length) return;

  let alreadySentForUser = false;
  try {
    alreadySentForUser = sessionStorage.getItem(SIGNUP_CONVERSION_SESSION_KEY) === user.id;
  } catch {
    // sessionStorage unavailable — still attempt conversion once this load
  }
  if (alreadySentForUser) return;

  if (typeof window.gtag !== 'function') return;

  window.gtag('event', 'conversion', {
    send_to: SIGNUP_SEND_TO,
    value: 1.0,
    currency: 'GBP',
  });

  try {
    sessionStorage.setItem(SIGNUP_CONVERSION_SESSION_KEY, user.id);
  } catch {
    // ignore quota / privacy mode
  }

  if (import.meta.env.DEV) {
    console.log('[Google Ads] Signup conversion fired', { userId: user.id, send_to: SIGNUP_SEND_TO });
  }
}
