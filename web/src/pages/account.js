/**
 * Account Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader } from '../components/header.js';
import {
  getSubscriptionStatus,
  hasActiveSubscription,
  purchaseSubscription,
  restoreSubscription
} from '../lib/subscription.js';
import { boatStorage, enginesStorage, serviceHistoryStorage, uploadsStorage } from '../lib/storage.js';
import { supabase } from '../lib/supabaseClient.js';

function render() {
  const wrapper = document.createElement('div');

  // Yacht header with back arrow using browser history
  const yachtHeader = createYachtHeader('Account', true, () => window.history.back());
  wrapper.appendChild(yachtHeader);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-account';

  const container = document.createElement('div');
  container.className = 'container';

  const status = getSubscriptionStatus();
  const isActive = hasActiveSubscription();

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="card">
      <h3>BoatMatey Account</h3>
      <p>Sign in to sync your boats and logs to the cloud, or continue using BoatMatey locally on this device.</p>
      <div style="display:flex; flex-wrap:wrap; gap: 0.5rem; margin-top: 0.75rem;">
        <button class="btn-primary" id="account-auth-btn">
          ${renderIcon('user')} Sign in or create account
        </button>
        <button class="btn-secondary" id="account-local-btn">
          Continue without account
        </button>
      </div>
    </div>

    <div class="card">
      <h3>Subscription</h3>
      <div style="margin-bottom: 1rem;">
        <p><strong>Status:</strong> 
          <span class="badge ${isActive ? 'badge-success' : 'badge-warning'}">
            ${isActive ? 'Active' : 'Not Active'}
          </span>
        </p>
        <p><strong>Plan:</strong> ${status.plan}</p>
        ${status.price ? `<p><strong>Price:</strong> ${status.price}</p>` : ''}
        ${
          status.expires_at
            ? `<p><strong>Renews:</strong> ${new Date(status.expires_at).toLocaleDateString()}</p>`
            : ''
        }
      </div>
      <p class="text-muted">BoatMatey subscription includes unlimited boats, engines, service entries, and uploads.</p>
      <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.75rem;">
        <button class="btn-primary" id="subscribe-btn" style="width: 100%;">
          ${renderIcon('star')} Subscribe for £24.99/year
        </button>
        <button class="btn-secondary" id="restore-purchases-btn" style="width: 100%;">
          Restore Purchases
        </button>
      </div>
    </div>

    <div class="card">
      <h3>Usage</h3>
      <div>
        <p><strong>Boats:</strong> ${boatStorage.get() ? 1 : 0}</p>
        <p><strong>Engines:</strong> ${enginesStorage.getAll().length}</p>
        <p><strong>Service Entries:</strong> ${serviceHistoryStorage.getAll().length}</p>
        <p><strong>Uploads:</strong> ${uploadsStorage.count()}</p>
      </div>
    </div>

    <div class="card">
      <h3>App Information</h3>
      <div>
        <p><strong>Version:</strong> 1.0.0</p>
        <p><strong>Build:</strong> ${import.meta.env.MODE === 'development' ? 'Development' : 'Production'}</p>
      </div>
    </div>

    <div class="card">
      <h3>Actions</h3>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <a href="https://boatmatey.com/privacy.html" target="_blank" rel="noopener" class="btn-link" style="width: 100%; text-align: left; text-decoration: none; color: inherit;">
          Privacy Policy
        </a>
        <button class="btn-link btn-danger" id="sign-out-btn" style="width: 100%; text-align: left;">
          Sign Out
        </button>
      </div>
    </div>
  `;

  container.appendChild(content);

  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);

  return wrapper;
}

function onMount() {
  window.navigate = navigate;

  // Auth buttons
  const authBtn = document.getElementById('account-auth-btn');
  if (authBtn) {
    authBtn.addEventListener('click', () => {
      navigate('/auth');
    });
  }

  const localBtn = document.getElementById('account-local-btn');
  if (localBtn) {
    localBtn.addEventListener('click', () => {
      alert('You are using BoatMatey in local-only mode. Data is stored on this device only.');
    });
  }

  // Subscribe
  const subscribeBtn = document.getElementById('subscribe-btn');
  if (subscribeBtn) {
    subscribeBtn.addEventListener('click', async () => {
      const originalLabel = subscribeBtn.textContent;
      subscribeBtn.disabled = true;
      subscribeBtn.textContent = 'Processing subscription...';

      try {
        await purchaseSubscription();
        // Reload the page content to reflect updated status
        navigate('/account');
      } finally {
        subscribeBtn.disabled = false;
        subscribeBtn.textContent = originalLabel;
      }
    });
  }

  // Restore purchases
  const restoreBtn = document.getElementById('restore-purchases-btn');
  if (restoreBtn) {
    restoreBtn.addEventListener('click', async () => {
      const originalLabel = restoreBtn.textContent;
      restoreBtn.disabled = true;
      restoreBtn.textContent = 'Restoring...';

      try {
        await restoreSubscription();
        // Reload subscription state
        navigate('/account');
      } finally {
        restoreBtn.disabled = false;
        restoreBtn.textContent = originalLabel;
      }
    });
  }

  // Sign out
  const signOutBtn = document.getElementById('sign-out-btn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      if (!confirm('Sign out of your BoatMatey cloud account?')) {
        return;
      }

      try {
        if (supabase) {
          await supabase.auth.signOut();
        }
      } catch (error) {
        console.error('Error signing out of Supabase:', error);
      } finally {
        navigate('/auth');
      }
    });
  }
}

export default {
  render,
  onMount
};
