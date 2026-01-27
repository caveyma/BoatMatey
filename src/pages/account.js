/**
 * Account Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { getSubscriptionStatus, simulateSubscription, hasActiveSubscription } from '../lib/subscription.js';
import { checkLimit, FREE_LIMITS } from '../lib/subscription.js';
import { boatStorage, enginesStorage, serviceHistoryStorage, uploadsStorage } from '../lib/storage.js';

function render() {
  const container = document.createElement('div');
  container.className = 'container';

  const header = document.createElement('div');
  header.className = 'page-header';
  
  const backLink = document.createElement('a');
  backLink.href = '#';
  backLink.className = 'back-button';
  backLink.innerHTML = `${renderIcon('arrowLeft')} Back`;
  backLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });
  
  const title = document.createElement('h1');
  title.textContent = 'Account';
  
  header.appendChild(backLink);
  header.appendChild(title);

  const status = getSubscriptionStatus();
  const isActive = hasActiveSubscription();
  const isDev = import.meta.env.DEV;

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="card">
      <h3>Subscription</h3>
      <div style="margin-bottom: 1rem;">
        <p><strong>Status:</strong> 
          <span class="badge ${isActive ? 'badge-success' : 'badge-warning'}">
            ${isActive ? 'Active' : 'Free Plan'}
          </span>
        </p>
        ${isActive ? `<p><strong>Plan:</strong> ${status.plan}</p>` : ''}
        ${status.price ? `<p><strong>Price:</strong> ${status.price}</p>` : ''}
      </div>
      ${!isActive ? `
        <div style="padding: 1rem; background: var(--color-light-bg); border-radius: var(--radius); margin-bottom: 1rem;">
          <p><strong>Upgrade to unlock:</strong></p>
          <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
            <li>Unlimited boats</li>
            <li>Unlimited engines</li>
            <li>Unlimited service entries</li>
            <li>Unlimited file uploads</li>
          </ul>
          <p style="margin-top: 0.5rem; font-size: 0.875rem; color: var(--color-text-light);">
            Subscribe via Google Play or Apple App Store (coming soon)
          </p>
        </div>
      ` : ''}
      ${isDev ? `
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-gray-light);">
          <p style="font-size: 0.875rem; color: var(--color-text-light); margin-bottom: 0.5rem;">Development Mode:</p>
          <button class="btn-secondary" id="simulate-sub-btn" style="width: 100%;">
            ${isActive ? 'Disable' : 'Enable'} Simulated Subscription
          </button>
        </div>
      ` : ''}
    </div>

    <div class="card">
      <h3>Usage</h3>
      <div>
        <p><strong>Boats:</strong> ${boatStorage.get() ? 1 : 0} / ${isActive ? '∞' : FREE_LIMITS.BOATS}</p>
        <p><strong>Engines:</strong> ${enginesStorage.getAll().length} / ${isActive ? '∞' : FREE_LIMITS.ENGINES}</p>
        <p><strong>Service Entries:</strong> ${serviceHistoryStorage.getAll().length} / ${isActive ? '∞' : FREE_LIMITS.SERVICE_ENTRIES}</p>
        <p><strong>Uploads:</strong> ${uploadsStorage.count()} / ${isActive ? '∞' : FREE_LIMITS.UPLOADS}</p>
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
        <button class="btn-secondary" id="restore-purchases-btn" style="width: 100%;">
          Restore Purchases
        </button>
        <button class="btn-link btn-danger" id="sign-out-btn" style="width: 100%; text-align: left;">
          Sign Out (Placeholder)
        </button>
      </div>
    </div>
  `;

  container.appendChild(header);
  container.appendChild(content);

  return container;
}

function onMount() {
  window.navigate = navigate;

  // Simulate subscription button (dev only)
  const simBtn = document.getElementById('simulate-sub-btn');
  if (simBtn) {
    simBtn.addEventListener('click', () => {
      const isActive = hasActiveSubscription();
      simulateSubscription(!isActive);
      // Reload page to update status
      window.location.reload();
    });
  }

  // Restore purchases
  const restoreBtn = document.getElementById('restore-purchases-btn');
  if (restoreBtn) {
    restoreBtn.addEventListener('click', () => {
      alert('Restore purchases functionality will be available when store integration is added.');
    });
  }

  // Sign out
  const signOutBtn = document.getElementById('sign-out-btn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      if (confirm('Sign out? (This is a placeholder - no action will be taken)')) {
        alert('Sign out functionality will be available when authentication is added.');
      }
    });
  }
}

export default {
  render,
  onMount
};
