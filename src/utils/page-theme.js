/**
 * Page Theme Utilities
 * Apply card colors to pages based on their section
 */

export const PAGE_THEMES = {
  'boat': 'card-color-boat',
  'engines': 'card-color-engines',
  'service': 'card-color-service',
  'navigation': 'card-color-navigation',
  'safety': 'card-color-safety',
  'log': 'card-color-log',
  'links': 'card-color-links',
  'account': 'card-color-account'
};

export function getPageTheme(route) {
  // Extract section from route
  if (route.includes('/details')) return PAGE_THEMES.boat;
  if (route.includes('/engines')) return PAGE_THEMES.engines;
  if (route.includes('/service')) return PAGE_THEMES.service;
  if (route.includes('/navigation')) return PAGE_THEMES.navigation;
  if (route.includes('/safety')) return PAGE_THEMES.safety;
  if (route.includes('/log')) return PAGE_THEMES.log;
  if (route.includes('/links')) return PAGE_THEMES.links;
  if (route.includes('/account')) return PAGE_THEMES.account;
  return '';
}
