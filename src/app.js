/**
 * App Bootstrap
 */

import './styles/theme.css';
import './styles/card-colors.css';
import './styles/global.css';
import './styles/components.css';
import { init as initRouter, route, navigate } from './router.js';
import boatsPage from './pages/boats.js';
import boatDashboardPage from './pages/boat-dashboard.js';
import boatDetailsPage from './pages/boat.js';
import enginesPage from './pages/engines.js';
import servicePage from './pages/service.js';
import navigationPage from './pages/navigation.js';
import safetyPage from './pages/safety.js';
import logPage from './pages/log.js';
import linksPage from './pages/links.js';
import accountPage from './pages/account.js';
import authPage from './pages/auth.js';

/**
 * Initialize the app
 */
export function init() {
  try {
    console.log('BoatMatey: Initializing app...');
    
    // Register routes
    route('/', boatsPage); // Boats list (home)
    route('/boat/:id', boatDashboardPage); // Boat dashboard
    route('/boat/:id/details', boatDetailsPage); // Boat details
    route('/boat/:id/engines', enginesPage);
    route('/boat/:id/service', servicePage);
    route('/boat/:id/navigation', navigationPage);
    route('/boat/:id/safety', safetyPage);
    route('/boat/:id/log', logPage);
    route('/boat/:id/links', linksPage);
    route('/account', accountPage);
    route('/auth', authPage);

    console.log('BoatMatey: Routes registered, initializing router...');
    
    // Initialize router
    initRouter();
    
    console.log('BoatMatey: App initialized successfully');
  } catch (error) {
    console.error('BoatMatey: Error initializing app:', error);
    const app = document.querySelector('#app');
    if (app) {
      app.innerHTML = `
        <div class="container" style="padding: 2rem;">
          <h1>Error Loading App</h1>
          <p>${error.message}</p>
          <pre style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow: auto;">${error.stack}</pre>
        </div>
      `;
    }
  }
}
