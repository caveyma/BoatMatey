/**
 * Subscription management
 * For BoatMatey everything is subscription-based with no resource limits.
 * This module keeps the API surface but always reports an active, unlimited plan.
 */

// In this simplified model, all users are treated as having
// an active subscription; limits are not enforced in-app.

export function hasActiveSubscription() {
  return true;
}

export function getSubscriptionStatus() {
  return {
    active: true,
    plan: 'subscription',
    price: '£24.99/year',
    expires_at: null
  };
}

// Kept for compatibility with existing calls; always allows.
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

// No-op placeholder; dev-only simulation is no longer needed.
export function simulateSubscription(enabled) {
  return;
}
