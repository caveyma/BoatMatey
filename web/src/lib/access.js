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
// Free: boat details, engines, one service entry per boat (enforced in UI + DB), mayday, links,
// plus limited records on projects, inventory, navigation, safety, passage log (see BASIC_PLAN_RECORD_LIMITS).
export const FREE_DASHBOARD_CARD_IDS = [
  'boat',
  'engines',
  'service',
  'mayday',
  'links',
  'projects',
  'inventory',
  'navigation',
  'safety',
  'log'
];

/** Max records per boat on Basic (free) plan for these modules; premium = unlimited. */
export const BASIC_PLAN_RECORD_LIMITS = {
  projects: 2,
  inventory: 2,
  navigation: 1,
  safety: 1,
  log: 2
};

/** @param {keyof typeof BASIC_PLAN_RECORD_LIMITS} cardId */
export function getBasicPlanRecordLimit(cardId) {
  return BASIC_PLAN_RECORD_LIMITS[cardId] ?? null;
}

// Route path segments for boat routes: /boat/:id/:segment
// Free segments: details (Boat Details), engines, service history, mayday, links, single reminder view
export const FREE_BOAT_ROUTE_SEGMENTS = ['details', 'engines', 'service', 'mayday', 'links', 'reminder'];

/** Max service history entries per boat on the free plan (premium: unlimited). */
export const FREE_PLAN_SERVICE_ENTRIES_PER_BOAT = 1;

// Top-level routes always allowed (no subscription required)
const FREE_TOP_LEVEL_ROUTES = ['/account', '/guide', '/', '/onboarding'];

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

/** Shown at service history limits and in upgrade prompts. */
export const SERVICE_HISTORY_UPGRADE_MESSAGE =
  "You've reached your free limit. Upgrade to continue tracking your boat maintenance.";

/**
 * Whether the user may create another service entry for this boat (free = 1 per boat).
 * @param {number} existingCount - Current number of service entries for the boat
 */
export function canAddAnotherServiceEntry(existingCount) {
  if (hasActiveSubscription()) return true;
  return existingCount < FREE_PLAN_SERVICE_ENTRIES_PER_BOAT;
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
  // /boat/:id/:segment — allow navigation into all boat modules (free users preview; saves are gated in UI)
  if (/^\/boat\/[^/]+\//.test(norm)) return true;
  // /boat/:id only (dashboard)
  if (/^\/boat\/[^/]+$/.test(norm)) return true;
  return true;
}
