/**
 * App-wide constants for support and legal URLs.
 * Use these in Paywall and Settings so links stay consistent.
 */

import { Capacitor } from '@capacitor/core';

export const PRIVACY_URL = 'https://boatmatey.com/privacy';
export const TERMS_URL = 'https://boatmatey.com/terms';
export const EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/**
 * Open a URL in the system browser (native) or new tab (web).
 * Use for Privacy, Terms, EULA and other external links.
 */
export function openExternalUrl(url) {
  const isNative = Capacitor.isNativePlatform?.() ?? false;
  window.open(url, isNative ? '_system' : '_blank', 'noopener,noreferrer');
}
