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
  restoreSubscription,
  refreshSubscriptionStatus
} from '../lib/subscription.js';
import { boatStorage, enginesStorage, serviceHistoryStorage, uploadsStorage } from '../lib/storage.js';
import { supabase } from '../lib/supabaseClient.js';
import { getSession } from '../lib/dataService.js';
import { Capacitor } from '@capacitor/core';

function render() {
  const wrapper = document.createElement('div');

  // Yacht header with back arrow using browser history
  const yachtHeader = createYachtHeader('Settings', true, () => window.history.back());
  wrapper.appendChild(yachtHeader);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-account';

  const container = document.createElement('div');
  container.className = 'container';

  const status = getSubscriptionStatus();
  const isActive = hasActiveSubscription();

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="card" id="account-signin-card">
      <h3>BoatMatey Account</h3>
      <p id="account-signin-message">Sign in to sync your boats and logs to the cloud, or continue using BoatMatey locally on this device.</p>
      <div id="account-signin-actions" style="display:flex; flex-wrap:wrap; gap: 0.5rem; margin-top: 0.75rem;">
        <button class="btn-primary" id="account-auth-btn">
          ${renderIcon('user')} Sign in or create account
        </button>
        <button class="btn-secondary" id="account-local-btn">
          Continue without account
        </button>
      </div>
    </div>

    <div class="card" id="account-signin-details-card" style="display: none;">
      <h3>Sign-in details</h3>
      <p class="text-muted">Update your email or password. Email changes may require you to confirm the new address.</p>
      <p><strong>Current email:</strong> <span id="account-current-email"></span></p>
      <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem;">
        <div>
          <label for="account-new-email" style="display: block; margin-bottom: 0.25rem; font-weight: 500;">Change email</label>
          <input type="email" id="account-new-email" class="form-control" placeholder="New email address" style="margin-bottom: 0.25rem;">
          <button type="button" class="btn-secondary" id="account-change-email-btn">Update email</button>
          <span id="account-email-message" class="text-muted" style="display: block; margin-top: 0.25rem; font-size: 0.9rem;"></span>
        </div>
        <div>
          <label for="account-new-password" style="display: block; margin-bottom: 0.25rem; font-weight: 500;">Change password</label>
          <input type="password" id="account-new-password" class="form-control" placeholder="New password" style="margin-bottom: 0.25rem;">
          <input type="password" id="account-confirm-password" class="form-control" placeholder="Confirm new password" style="margin-bottom: 0.25rem;">
          <button type="button" class="btn-secondary" id="account-change-password-btn">Update password</button>
          <span id="account-password-message" class="text-muted" style="display: block; margin-top: 0.25rem; font-size: 0.9rem;"></span>
        </div>
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

  // Refresh subscription status on mount
  const isNative = Capacitor.isNativePlatform?.() ?? false;
  if (isNative) {
    refreshSubscriptionStatus().then(() => {
      // Update subscription display after refresh
      const status = getSubscriptionStatus();
      const isActive = hasActiveSubscription();
      
      const statusBadge = document.querySelector('.badge');
      if (statusBadge) {
        statusBadge.textContent = isActive ? 'Active' : 'Not Active';
        statusBadge.className = `badge ${isActive ? 'badge-success' : 'badge-warning'}`;
      }
    });
  }

  // Show/hide sign-in details and first card based on session
  (async () => {
    const session = await getSession();
    const signinDetailsCard = document.getElementById('account-signin-details-card');
    const signinMessage = document.getElementById('account-signin-message');
    const signinActions = document.getElementById('account-signin-actions');
    const currentEmailEl = document.getElementById('account-current-email');
    const signOutBtn = document.getElementById('sign-out-btn');
    if (session?.user) {
      if (signinDetailsCard) signinDetailsCard.style.display = 'block';
      if (currentEmailEl) currentEmailEl.textContent = session.user.email ?? '';
      if (signinMessage) signinMessage.textContent = `You are signed in as ${session.user.email ?? 'your account'}.`;
      if (signinActions) signinActions.style.display = 'none';
      if (signOutBtn) signOutBtn.style.display = '';
    } else {
      if (signinDetailsCard) signinDetailsCard.style.display = 'none';
      if (signinMessage) signinMessage.textContent = 'Sign in to sync your boats and logs to the cloud, or continue using BoatMatey locally on this device.';
      if (signinActions) signinActions.style.display = 'flex';
      if (signOutBtn) signOutBtn.style.display = 'none';
    }
  })();

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

  // Change email
  const changeEmailBtn = document.getElementById('account-change-email-btn');
  const newEmailInput = document.getElementById('account-new-email');
  const emailMessageEl = document.getElementById('account-email-message');
  if (changeEmailBtn && supabase) {
    changeEmailBtn.addEventListener('click', async () => {
      const newEmail = newEmailInput?.value?.trim();
      if (!newEmail) {
        if (emailMessageEl) { emailMessageEl.textContent = 'Please enter a new email address.'; emailMessageEl.style.color = ''; }
        return;
      }
      changeEmailBtn.disabled = true;
      if (emailMessageEl) emailMessageEl.textContent = 'Updating...';
      try {
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) throw error;
        if (emailMessageEl) { emailMessageEl.textContent = 'Check your new email inbox to confirm the change.'; emailMessageEl.style.color = 'var(--color-success, green)'; }
        if (newEmailInput) newEmailInput.value = '';
      } catch (err) {
        if (emailMessageEl) { emailMessageEl.textContent = err?.message ?? 'Failed to update email.'; emailMessageEl.style.color = 'var(--color-danger, #c00)'; }
      } finally {
        changeEmailBtn.disabled = false;
      }
    });
  }

  // Change password
  const changePasswordBtn = document.getElementById('account-change-password-btn');
  const newPasswordInput = document.getElementById('account-new-password');
  const confirmPasswordInput = document.getElementById('account-confirm-password');
  const passwordMessageEl = document.getElementById('account-password-message');
  if (changePasswordBtn && supabase) {
    changePasswordBtn.addEventListener('click', async () => {
      const newPassword = newPasswordInput?.value ?? '';
      const confirmPassword = confirmPasswordInput?.value ?? '';
      if (!newPassword || newPassword.length < 6) {
        if (passwordMessageEl) { passwordMessageEl.textContent = 'Password must be at least 6 characters.'; passwordMessageEl.style.color = 'var(--color-danger, #c00)'; }
        return;
      }
      if (newPassword !== confirmPassword) {
        if (passwordMessageEl) { passwordMessageEl.textContent = 'Passwords do not match.'; passwordMessageEl.style.color = 'var(--color-danger, #c00)'; }
        return;
      }
      changePasswordBtn.disabled = true;
      if (passwordMessageEl) passwordMessageEl.textContent = 'Updating...';
      try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        if (passwordMessageEl) { passwordMessageEl.textContent = 'Password updated successfully.'; passwordMessageEl.style.color = 'var(--color-success, green)'; }
        if (newPasswordInput) newPasswordInput.value = '';
        if (confirmPasswordInput) confirmPasswordInput.value = '';
      } catch (err) {
        if (passwordMessageEl) { passwordMessageEl.textContent = err?.message ?? 'Failed to update password.'; passwordMessageEl.style.color = 'var(--color-danger, #c00)'; }
      } finally {
        changePasswordBtn.disabled = false;
      }
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
      const isNative = Capacitor.isNativePlatform?.() ?? false;
      
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
        // On native, redirect to subscription page (requires subscription to access app)
        // On web, redirect to auth page
        if (isNative) {
          navigate('/subscription');
        } else {
          navigate('/auth');
        }
      }
    });
  }
}

export default {
  render,
  onMount
};
