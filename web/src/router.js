/**
 * Simple hash-based router with subscription gate
 */

import { Capacitor } from '@capacitor/core';
import { supabase } from './lib/supabaseClient.js';
// Note: subscription check moved to auth flow, not route access

let routes = {};
let currentRoute = null;
let currentPage = null;

const PAGE_COLOR_CLASSES = [
  'page-color-boat',
  'page-color-engines',
  'page-color-service',
  'page-color-haulout',
  'page-color-calendar',
  'page-color-navigation',
  'page-color-safety',
  'page-color-log',
  'page-color-links',
  'page-color-account',
  'page-color-guide',
  'page-color-sails-rigging',
  'page-color-watermaker'
];

function applyPageColor(path) {
  document.body.classList.remove(...PAGE_COLOR_CLASSES);

  let key = null;
  if (path.includes('/details')) key = 'boat';
  else if (path.includes('/engines')) key = 'engines';
  else if (path.includes('/service')) key = 'service';
  else if (path.includes('/haulout')) key = 'haulout';
  else if (path.includes('/calendar')) key = 'calendar';
  else if (path.includes('/navigation')) key = 'navigation';
  else if (path.includes('/safety')) key = 'safety';
  else if (path.includes('/log')) key = 'log';
  else if (path.includes('/links')) key = 'links';
  else if (path.includes('/account')) key = 'account';
  else if (path.includes('/guide')) key = 'guide';
  else if (path.includes('/sails-rigging')) key = 'sails-rigging';
  else if (path.includes('/watermaker')) key = 'watermaker';

  if (key) document.body.classList.add(`page-color-${key}`);
}


/**
 * Register a route
 */
export function route(path, pageModule) {
  routes[path] = pageModule;
}

/**
 * Navigate to a route
 */
export function navigate(path) {
  if (path.startsWith('#')) {
    path = path.substring(1);
  }
  if (!path) {
    path = '/';
  }
  
  window.location.hash = path;
  loadRoute(path);
}

/**
 * Load a route
 */
function matchRoute(path) {
  // Try exact match first
  if (routes[path]) {
    return { route: routes[path], params: {} };
  }

  // Try pattern matching for dynamic routes
  for (const routePath in routes) {
    const pattern = routePath.replace(/:[^/]+/g, '([^/]+)');
    const regex = new RegExp(`^${pattern}$`);
    const match = path.match(regex);
    if (match) {
      const paramNames = routePath.match(/:([^/]+)/g) || [];
      const params = {};
      paramNames.forEach((param, index) => {
        const name = param.substring(1);
        params[name] = match[index + 1];
      });
      return { route: routes[routePath], params };
    }
  }

  return null;
}

async function loadRoute(path) {
  // Normalize path
  if (path.startsWith('#')) {
    path = path.substring(1);
  }
  if (!path || path === '/') {
    path = '/';
  }

  if (path === currentRoute) return;
  currentRoute = path;

  // Check access requirements (subscription + auth gate)
  const accessCheck = await checkAccess(path);
  if (!accessCheck.allowed) {
    window.location.hash = accessCheck.redirectTo;
    currentRoute = null;
    return;
  }

  const match = matchRoute(path);
  if (!match) {
    console.error(`Router: Route not found: ${path}`);
    console.error('Router: Available routes:', Object.keys(routes));
    if (path !== '/') {
      navigate('/');
    }
    return;
  }

  const route = match.route;
  const params = match.params;
  applyPageColor(path);

  // Clean up previous page
  if (currentPage && typeof currentPage.cleanup === 'function') {
    currentPage.cleanup();
  }

  // Store params globally for pages to access
  window.routeParams = params;

  // Load new page
  try {
    const pageModule = route;
    currentPage = pageModule;
    
    const app = document.querySelector('#app');
    if (app) {
      app.innerHTML = '';
      
      if (pageModule && typeof pageModule.render === 'function') {
        const element = pageModule.render(params);
        if (element) {
          app.appendChild(element);
        }
      } else if (typeof pageModule === 'function') {
        const element = await pageModule(params);
        if (element) {
          app.appendChild(element);
        }
      } else if (pageModule instanceof HTMLElement) {
        app.appendChild(pageModule);
      } else {
        console.error('Invalid page module format');
        app.innerHTML = '<div class="container"><h1>Error</h1><p>Page could not be loaded</p></div>';
      }
    }

    // Call onMount if available
    if (pageModule && typeof pageModule.onMount === 'function') {
      pageModule.onMount(params);
    }
  } catch (e) {
    console.error(`Error loading route ${path}:`, e);
    const app = document.querySelector('#app');
    if (app) {
      app.innerHTML = `<div class="container"><h1>Error</h1><p>Failed to load page: ${e.message}</p></div>`;
    }
  }
}

/**
 * Check if user has access to the requested route
 * Flow: Welcome → Auth → (Subscription for new users) → Home
 */
async function checkAccess(path) {
  let isNative = false;
  try {
    isNative = Capacitor?.isNativePlatform?.() ?? false;
  } catch (e) {
    // Capacitor not available (e.g. web build) – allow access
  }
  if (!isNative) {
    return { allowed: true };
  }

  // Public routes (no authentication required)
  const publicRoutes = ['/welcome', '/subscription', '/auth'];
  if (publicRoutes.includes(path)) {
    return { allowed: true };
  }

  // Protected routes: check authentication
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // Not authenticated - redirect to welcome
      return { 
        allowed: false, 
        redirectTo: '/welcome' 
      };
    }
  }

  return { allowed: true };
}

/**
 * Initialize router
 */
export function init() {
  const hash = window.location.hash.substring(1) || '/';
  loadRoute(hash);

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.substring(1) || '/';
    if (hash !== currentRoute) {
      loadRoute(hash);
    }
  });
}

/**
 * Get current route
 */
export function getCurrentRoute() {
  return currentRoute || '/';
}
