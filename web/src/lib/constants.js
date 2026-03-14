/**
 * App-wide constants for support and legal URLs.
 * Use these in Paywall and Settings so links stay consistent.
 */

import { Capacitor } from '@capacitor/core';

export const PRIVACY_URL = 'https://boatmatey.com/privacy';
export const TERMS_URL = 'https://boatmatey.com/terms';
export const EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
export const SUPPORT_URL = 'https://boatmatey.com/support';

/** App store URLs for subscription / upgrade prompts (web). */
export const APP_STORE_URL = 'https://apps.apple.com/app/boatmatey/id6758239609';
export const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.boatmatey.app';
export const APP_STORE_BADGE_URL = 'https://upload.wikimedia.org/wikipedia/commons/0/0f/Available_on_the_App_Store_%28black%29_SVG.svg';
export const GOOGLE_PLAY_BADGE_URL = 'https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png';

/**
 * Open a URL in the system browser (native) or new tab (web).
 * Use for Privacy, Terms, EULA and other external links.
 */
export function openExternalUrl(url) {
  const isNative = Capacitor.isNativePlatform?.() ?? false;
  window.open(url, isNative ? '_system' : '_blank', 'noopener,noreferrer');
}
