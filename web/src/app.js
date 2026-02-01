/**
 * App Bootstrap
 */

import './styles/theme.css';
import './styles/card-colors.css';
import './styles/global.css';
import './styles/components.css';
import { init as initRouter, route, navigate } from './router.js';
import { initRevenueCat } from './services/revenuecat.js';
import { initSubscription, refreshSubscriptionStatus } from './lib/subscription.js';
import { supabase } from './lib/supabaseClient.js';
import { Capacitor } from '@capacitor/core';
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
import subscriptionPage from './pages/subscription.js';
import welcomePage from './pages/welcome.js';
import hauloutPage from './pages/haulout.js';
import calendarPage from './pages/calendar.js';
import guidePage from './pages/guide.js';

/**
 * Initialize the app
 */
export async function init() {
  try {
    console.log('BoatMatey: Initializing app...');
    
    // Register routes
    route('/welcome', welcomePage); // Welcome/onboarding page
    route('/subscription', subscriptionPage); // Subscription paywall
    route('/auth', authPage); // Auth page (sign in / create account)
    route('/', boatsPage); // Boats list (home)
    route('/boat/:id', boatDashboardPage); // Boat dashboard
    route('/boat/:id/details', boatDetailsPage); // Boat details
    route('/boat/:id/engines', enginesPage);
    route('/boat/:id/service', servicePage);
    route('/boat/:id/haulout', hauloutPage);
    route('/boat/:id/calendar', calendarPage);
    route('/boat/:id/guide', guidePage);
    route('/boat/:id/navigation', navigationPage);
    route('/boat/:id/safety', safetyPage);
    route('/boat/:id/log', logPage);
    route('/boat/:id/links', linksPage);
    route('/account', accountPage);

    console.log('BoatMatey: Routes registered, initializing router...');
    
    // Initialize RevenueCat on native only (enables Play Billing / App Store detection)
    await initRevenueCat();
    // Then refresh subscription state (no-op on web)
    await initSubscription();

    // Check subscription and authentication status
    await checkAccessAndRedirect();
    
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

/**
 * Check access requirements and redirect if needed
 * Flow: Welcome → Auth → (Subscription for new users) → Home
 */
async function checkAccessAndRedirect() {
  const isNative = Capacitor.isNativePlatform?.() ?? false;
  const currentHash = window.location.hash.substring(1) || '/';
  
  // Web mode: no restrictions (dev/testing)
  if (!isNative) {
    console.log('BoatMatey: Web mode - no restrictions');
    return;
  }

  // Public routes that don't require authentication
  const publicRoutes = ['/welcome', '/auth', '/subscription'];
  const isOnPublicPage = publicRoutes.includes(currentHash);

  // Check authentication
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session && !isOnPublicPage) {
      // Not authenticated - redirect to welcome page
      console.log('BoatMatey: Not authenticated - redirecting to welcome page');
      navigate('/welcome');
      return;
    }
    
    if (session) {
      // User is authenticated - sync subscription status
      await refreshSubscriptionStatus();
      console.log('BoatMatey: User authenticated, access granted');
    }
  }
  
  console.log('BoatMatey: Access check passed');
}
