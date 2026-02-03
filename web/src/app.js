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
import { syncOsNotifications } from './lib/notifications.js';
import { supabase } from './lib/supabaseClient.js';
import { Capacitor } from '@capacitor/core';
import boatsPage from './pages/boats.js';
import boatDashboardPage from './pages/boat-dashboard.js';
import boatDetailsPage from './pages/boat.js';
import enginesPage from './pages/engines.js';
import engineEditPage from './pages/engine-edit.js';
import servicePage from './pages/service.js';
import navigationPage from './pages/navigation.js';
import navigationEditPage from './pages/navigation-edit.js';
import safetyPage from './pages/safety.js';
import safetyEditPage from './pages/safety-edit.js';
import logPage from './pages/log.js';
import logEditPage from './pages/log-edit.js';
import linksPage from './pages/links.js';
import linkEditPage from './pages/link-edit.js';
import accountPage from './pages/account.js';
import authPage from './pages/auth.js';
import subscriptionPage from './pages/subscription.js';
import welcomePage from './pages/welcome.js';
import hauloutPage from './pages/haulout.js';
import calendarPage from './pages/calendar.js';
import guidePage from './pages/guide.js';
import sailsRiggingPage from './pages/sails-rigging.js';
import watermakerPage from './pages/watermaker.js';

/**
 * Initialize the app
 */
export async function init() {
  try {
    // Register routes
    route('/welcome', welcomePage); // Welcome/onboarding page
    route('/subscription', subscriptionPage); // Subscription paywall
    route('/auth', authPage); // Auth page (sign in / create account)
    route('/', boatsPage); // Boats list (home)
    route('/guide', guidePage); // User guide (no boat – from home)
    route('/calendar', calendarPage); // App-wide calendar
    route('/boat/:id', boatDashboardPage); // Boat dashboard
    route('/boat/:id/details', boatDetailsPage); // Boat details
    route('/boat/:id/engines', enginesPage);
    route('/boat/:id/engines/:engineId', engineEditPage);
    route('/boat/:id/service', servicePage);
    route('/boat/:id/service/:entryId', servicePage);
    route('/boat/:id/haulout', hauloutPage);
    route('/boat/:id/haulout/:entryId', hauloutPage);
    route('/boat/:id/sails-rigging', sailsRiggingPage);
    route('/boat/:id/watermaker', watermakerPage);
    route('/boat/:id/watermaker/:entryId', watermakerPage);
    route('/boat/:id/guide', guidePage);
    route('/boat/:id/navigation', navigationPage);
    route('/boat/:id/navigation/:itemId', navigationEditPage);
    route('/boat/:id/safety', safetyPage);
    route('/boat/:id/safety/:itemId', safetyEditPage);
    route('/boat/:id/log', logPage);
    route('/boat/:id/log/:entryId', logEditPage);
    route('/boat/:id/links', linksPage);
    route('/boat/:id/links/:linkId', linkEditPage);
    route('/account', accountPage);

    try {
      await initRevenueCat();
    } catch (e) {
      console.warn('BoatMatey: RevenueCat init failed (ok on web):', e?.message || e);
    }
    try {
      await initSubscription();
    } catch (e) {
      console.warn('BoatMatey: Subscription init failed:', e?.message || e);
    }

    try {
      await checkAccessAndRedirect();
    } catch (e) {
      console.warn('BoatMatey: Access check failed, continuing:', e?.message || e);
    }

    initRouter();

    // Reschedule OS notifications when app comes to foreground
    try {
      const App = Capacitor?.Plugins?.App;
      if (App?.addListener) {
        App.addListener('appStateChange', async (state) => {
          if (state?.isActive && Array.isArray(window.boatmateyRemindersForOs) && window.boatmateyRemindersForOs.length) {
            await syncOsNotifications(window.boatmateyRemindersForOs);
          }
        });
      }
    } catch (e) {}

  } catch (error) {
    console.error('BoatMatey: Error initializing app:', error);
    const app = document.querySelector('#app');
    if (app) {
      app.innerHTML = `
        <div class="container" style="padding: 2rem;">
          <h1>Error Loading App</h1>
          <p>${error.message}</p>
          <pre style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow: auto;">${error.stack}</pre>
          <p style="margin-top: 1rem;"><a href="#/">Try opening the app home</a></p>
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
  let isNative = false;
  try {
    isNative = Capacitor?.isNativePlatform?.() ?? false;
  } catch (e) {}
  const currentHash = window.location.hash.substring(1) || '/';

  // Web mode: no restrictions (dev/testing)
  if (!isNative) return;

  // Public routes that don't require authentication
  const publicRoutes = ['/welcome', '/auth', '/subscription'];
  const isOnPublicPage = publicRoutes.includes(currentHash);

  // Check authentication
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session && !isOnPublicPage) {
      navigate('/welcome');
      return;
    }
    if (session) await refreshSubscriptionStatus();
  }
}
