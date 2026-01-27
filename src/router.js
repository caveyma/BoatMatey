/**
 * Simple hash-based router
 */

let routes = {};
let currentRoute = null;
let currentPage = null;

const PAGE_COLOR_CLASSES = [
  'page-color-boat',
  'page-color-engines',
  'page-color-service',
  'page-color-navigation',
  'page-color-safety',
  'page-color-log',
  'page-color-links',
  'page-color-account'
];

function applyPageColor(path) {
  document.body.classList.remove(...PAGE_COLOR_CLASSES);

  let key = null;
  if (path.includes('/details')) key = 'boat';
  else if (path.includes('/engines')) key = 'engines';
  else if (path.includes('/service')) key = 'service';
  else if (path.includes('/navigation')) key = 'navigation';
  else if (path.includes('/safety')) key = 'safety';
  else if (path.includes('/log')) key = 'log';
  else if (path.includes('/links')) key = 'links';
  else if (path.includes('/account')) key = 'account';

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

  console.log('Router: Loading route:', path);
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

  currentRoute = path;
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
 * Initialize router
 */
export function init() {
  console.log('Router: Initializing...');
  console.log('Router: Available routes:', Object.keys(routes));
  
  // Handle initial load
  const hash = window.location.hash.substring(1) || '/';
  console.log('Router: Loading initial route:', hash);
  loadRoute(hash);

  // Handle hash changes
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.substring(1) || '/';
    console.log('Router: Hash changed to:', hash);
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
