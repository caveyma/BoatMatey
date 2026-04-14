/**
 * Blocks persisting premium-module data for free users; sends them to the subscription flow.
 * Preview UI remains usable until Save.
 * Basic-plan modules use {@link blockFreePlanRecordLimitIfNeeded} instead.
 */

import { navigate } from '../router.js';
import { hasActiveSubscription } from './subscription.js';
import { showSubscriptionUpsellModal } from '../components/subscriptionUpsellModal.js';
import { BASIC_PLAN_RECORD_LIMITS } from './access.js';

/**
 * @returns {boolean} true if save should be aborted (free user — already redirected)
 */
export function blockPremiumSaveIfNeeded() {
  if (hasActiveSubscription()) return false;
  navigate('/subscription');
  return true;
}

const LIMIT_COPY = {
  projects: 'projects and issues',
  inventory: 'inventory items',
  navigation: 'navigation equipment items',
  safety: 'safety equipment items',
  log: 'passage logs'
};

/**
 * Blocks save when Basic plan record count is already at the limit (premium: never blocks here).
 * @param {keyof typeof BASIC_PLAN_RECORD_LIMITS} limitType
 * @param {number} currentCount - rows already saved for this boat (before this save)
 * @returns {boolean} true if save should abort (modal shown)
 */
export function blockFreePlanRecordLimitIfNeeded(limitType, currentCount) {
  if (hasActiveSubscription()) return false;
  const limit = BASIC_PLAN_RECORD_LIMITS[limitType];
  if (limit == null) return false;
  if (limit > 0 && currentCount < limit) return false;
  const label = LIMIT_COPY[limitType] || 'records';
  showSubscriptionUpsellModal({
    title: 'Premium feature',
    message:
      limit > 0
        ? `Your free plan includes up to ${limit} ${label} per boat. Upgrade for unlimited records.`
        : `Free plan preview only. Upgrade to save ${label}.`
  });
  return true;
}
