/**
 * Blocks persisting premium-module data for free users; sends them to the subscription flow.
 * Preview UI remains usable until Save.
 */

import { navigate } from '../router.js';
import { hasActiveSubscription } from './subscription.js';

/**
 * @returns {boolean} true if save should be aborted (free user — already redirected)
 */
export function blockPremiumSaveIfNeeded() {
  if (hasActiveSubscription()) return false;
  navigate('/subscription');
  return true;
}
