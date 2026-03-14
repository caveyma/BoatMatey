/**
 * BoatMatey free vs premium access rules.
 * Single source of truth for card access, boat limits, and premium badges.
 * Uses existing subscription state from subscription.js (profile + RevenueCat).
 */

import { hasActiveSubscription } from './subscription.js';

// ---------------------------------------------------------------------------
// Free plan: cards accessible without subscription (boat dashboard card ids)
// Boat Details, Engines, Mayday / Distress Call, Web Links, Settings, User Guide
// On boat dashboard: boat (Boat Details), engines, mayday, links
// Settings = /account, User Guide = /guide (handled by route, not dashboard card)
// ---------------------------------------------------------------------------
export const FREE_DASHBOARD_CARD_IDS = ['boat', 'engines', 'mayday', 'links'];

// Route path segments for boat routes: /boat/:id/:segment
// Free segments: details (Boat Details), engines, mayday, links
export const FREE_BOAT_ROUTE_SEGMENTS = ['details', 'engines', 'mayday', 'links'];

// Top-level routes always allowed (no subscription required)
const FREE_TOP_LEVEL_ROUTES = ['/account', '/guide', '/'];

/**
 * Whether the user can access this boat dashboard card.
 * @param {string} cardId - e.g. 'boat', 'engines', 'service', 'mayday', 'links'
 * @returns {boolean}
 */
export function canAccessCard(cardId) {
  if (hasActiveSubscription()) return true;
  return FREE_DASHBOARD_CARD_IDS.includes(cardId);
}

/**
 * Whether to show a Premium badge/lock on this card (free user + premium card).
 * Subscribed users never see premium badges.
 * @param {string} cardId - boat dashboard card id
 * @returns {boolean}
 */
export function shouldShowPremiumBadge(cardId) {
  if (hasActiveSubscription()) return false;
  return !FREE_DASHBOARD_CARD_IDS.includes(cardId);
}

/**
 * Whether the user can use premium-only features (e.g. Export Boat Report).
 * Reuses the same subscription state as card/route access.
 * @returns {boolean}
 */
export function canAccessPremiumFeature() {
  return hasActiveSubscription();
}

/**
 * Whether the user can access this route. Used by router and home-screen cards.
 * @param {string} path - e.g. '/', '/account', '/guide', '/calendar', '/boat/xyz/service'
 * @returns {boolean}
 */
export function canAccessRoute(path) {
  if (hasActiveSubscription()) return true;
  const norm = (path || '/').replace(/^#?\/?/, '/').split('?')[0];
  if (FREE_TOP_LEVEL_ROUTES.includes(norm)) return true;
  if (norm === '/calendar') return false;
  // /boat/:id/:segment
  const boatMatch = norm.match(/^\/boat\/[^/]+\/([^/]+)/);
  if (boatMatch) {
    const segment = boatMatch[1];
    return FREE_BOAT_ROUTE_SEGMENTS.includes(segment);
  }
  // /boat/:id only (dashboard) - allow, dashboard will show locked cards
  if (/^\/boat\/[^/]+$/.test(norm)) return true;
  return true;
}
