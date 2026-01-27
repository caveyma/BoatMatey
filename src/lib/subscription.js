/**
 * Subscription management
 * Placeholder for now - can be extended with RevenueCat/store integration later
 */

const STORAGE_KEY = 'boatmatey_subscription';

// Free mode limits
export const FREE_LIMITS = {
  BOATS: 1,
  ENGINES: 1,
  SERVICE_ENTRIES: 10,
  UPLOADS: 10
};

/**
 * Check if user has active subscription
 */
export function hasActiveSubscription() {
  // In dev mode, allow simulating subscription
  if (import.meta.env.DEV) {
    const simulated = localStorage.getItem('boatmatey_simulate_subscription');
    if (simulated === 'true') {
      return true;
    }
  }

  const sub = localStorage.getItem(STORAGE_KEY);
  if (!sub) return false;

  try {
    const data = JSON.parse(sub);
    // Check if subscription is active and not expired
    if (data.status === 'active' && data.expires_at) {
      return new Date(data.expires_at) > new Date();
    }
    return data.status === 'active';
  } catch (e) {
    return false;
  }
}

/**
 * Get subscription status
 */
export function getSubscriptionStatus() {
  const isActive = hasActiveSubscription();
  return {
    active: isActive,
    plan: isActive ? 'annual' : 'free',
    price: isActive ? '£24.99/year' : null,
    expires_at: null
  };
}

/**
 * Set subscription status (for testing/placeholder)
 */
export function setSubscriptionStatus(status, expiresAt = null) {
  const data = {
    status,
    expires_at: expiresAt,
    updated_at: new Date().toISOString()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Check if a limit is exceeded
 */
export function checkLimit(resourceType, currentCount) {
  if (hasActiveSubscription()) {
    return { allowed: true, limit: Infinity };
  }

  const limit = FREE_LIMITS[resourceType.toUpperCase()] || Infinity;
  return {
    allowed: currentCount < limit,
    limit,
    current: currentCount
  };
}

/**
 * Get limit info for display
 */
export function getLimitInfo(resourceType) {
  if (hasActiveSubscription()) {
    return { limit: Infinity, label: 'Unlimited' };
  }

  const limit = FREE_LIMITS[resourceType.toUpperCase()] || Infinity;
  return { limit, label: limit === Infinity ? 'Unlimited' : limit.toString() };
}

/**
 * Simulate subscription (dev only)
 */
export function simulateSubscription(enabled) {
  if (import.meta.env.DEV) {
    localStorage.setItem('boatmatey_simulate_subscription', enabled ? 'true' : 'false');
    // Also set actual subscription status
    if (enabled) {
      setSubscriptionStatus('active', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString());
    } else {
      setSubscriptionStatus('free');
    }
  }
}
