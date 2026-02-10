/**
 * Subscription Paywall Page
 * 
 * Displays subscription options with 1-month free trial
 * User arrives here after entering email/password on auth page
 * After payment, account is created in Supabase (GDPR compliance)
 * 
 * Pricing: £24.99/year including VAT
 * Trial: 1 month free for new subscribers
 */

import { navigate } from '../router.js';
import { renderLogoFull } from '../components/logo.js';
import { 
  purchaseSubscription, 
  restoreSubscription,
  hasActiveSubscription,
  refreshSubscriptionStatus 
} from '../lib/subscription.js';
import { hasPendingSignup, getPendingSignupEmail, completeAccountCreation } from './auth.js';
import { logInWithAppUserId } from '../services/revenuecat.js';
import { Capacitor } from '@capacitor/core';
import { PRIVACY_URL, TERMS_URL, EULA_URL, openExternalUrl } from '../lib/constants.js';

function render() {
  const wrapper = document.createElement('div');
  wrapper.className = 'page-fullscreen';

  const container = document.createElement('div');
  container.className = 'container';

  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = '1.5rem';

  const isNative = Capacitor.isNativePlatform?.() ?? false;

  card.innerHTML = `
    <div class="text-center" style="margin-bottom: 1.25rem;">
      <div style="display:flex; justify-content:center; margin-bottom: 0.75rem;">
        ${renderLogoFull(220)}
      </div>
      <h2 style="font-size: 1.5rem; margin-bottom: 0.5rem;">Choose Your Plan</h2>
      <p class="text-muted" style="font-size: 0.95rem;">New subscribers get <strong>1 month free</strong>—no charge until your trial ends. Then £24.99/year.</p>
    </div>

    <div class="subscription-plan" style="
      background: linear-gradient(135deg, var(--bm-teal) 0%, var(--bm-teal-2) 100%);
      color: white;
      padding: 1.5rem;
      border-radius: 12px;
      margin-bottom: 1.25rem;
      text-align: center;
    ">
      <div style="font-size: 2rem; font-weight: bold; margin-bottom: 0.25rem;">
        £24.99/year
      </div>
      <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 1rem;">
        Including VAT
      </div>
      
      <div style="
        background: rgba(255,255,255,0.15);
        padding: 0.75rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        border: 2px solid rgba(255,255,255,0.3);
      ">
        <div style="font-size: 1rem; font-weight: 600;">
          1 Month Free Trial
        </div>
        <div style="font-size: 0.8rem; opacity: 0.9;">
          For new subscribers
        </div>
      </div>

      <div style="text-align: left; font-size: 0.9rem;">
        <div style="margin-bottom: 0.5rem; display: flex; align-items: center;">
          <span style="margin-right: 0.5rem;">✓</span>
          <span>2 active boats + 5 archived boats</span>
        </div>
        <div style="margin-bottom: 0.5rem; display: flex; align-items: center;">
          <span style="margin-right: 0.5rem;">✓</span>
          <span>Unlimited engines & equipment</span>
        </div>
        <div style="margin-bottom: 0.5rem; display: flex; align-items: center;">
          <span style="margin-right: 0.5rem;">✓</span>
          <span>Complete service history</span>
        </div>
        <div style="margin-bottom: 0.5rem; display: flex; align-items: center;">
          <span style="margin-right: 0.5rem;">✓</span>
          <span>Digital logbook & calendar</span>
        </div>
        <div style="display: flex; align-items: center;">
          <span style="margin-right: 0.5rem;">✓</span>
          <span>Cloud sync across devices</span>
        </div>
      </div>
    </div>

    ${isNative ? `
      <button type="button" class="btn-primary" id="subscribe-btn" style="width: 100%; padding: 0.875rem; font-size: 1rem; margin-bottom: 0.75rem;">
        Start Free Trial
      </button>
      
      <button type="button" class="btn-secondary" id="restore-btn" style="width: 100%; padding: 0.75rem; margin-bottom: 0.75rem;">
        Restore Purchases
      </button>

      <button type="button" class="btn-secondary" id="check-status-btn" style="width: 100%; padding: 0.75rem; margin-bottom: 0.75rem; background: #f0f8ff; border-color: var(--bm-teal); color: var(--bm-teal);">
        ✓ Check Purchase Status
      </button>

      <p class="text-muted" style="font-size: 0.75rem; margin: 0.5rem 0 0.25rem; line-height: 1.3;">By subscribing you agree to our:</p>
      <div class="paywall-legal-links" style="display: flex; flex-wrap: wrap; gap: 0.35rem 0.75rem; margin-bottom: 0.5rem; font-size: 0.8rem;">
        <button type="button" class="btn-link legal-link" data-url="${PRIVACY_URL}" style="padding: 0.25rem 0; font-size: inherit; color: var(--bm-teal); text-decoration: underline; background: none; border: none; cursor: pointer;">Privacy Policy</button>
        <span style="color: var(--color-text-light);">·</span>
        <button type="button" class="btn-link legal-link" data-url="${TERMS_URL}" style="padding: 0.25rem 0; font-size: inherit; color: var(--bm-teal); text-decoration: underline; background: none; border: none; cursor: pointer;">Terms of Use</button>
        <span style="color: var(--color-text-light);">·</span>
        <button type="button" class="btn-link legal-link" data-url="${EULA_URL}" style="padding: 0.25rem 0; font-size: inherit; color: var(--bm-teal); text-decoration: underline; background: none; border: none; cursor: pointer;">Apple EULA</button>
      </div>

      <button type="button" class="btn-link page-body-back-btn" id="cancel-btn" style="width: 100%; padding: 0.75rem; color: var(--color-text-light); font-size: 0.8rem;">
        Back
      </button>
    ` : `
      <p class="text-muted" style="font-size: 0.75rem; margin: 0.5rem 0 0.25rem;">By subscribing you agree to our:</p>
      <div class="paywall-legal-links" style="display: flex; flex-wrap: wrap; gap: 0.35rem 0.75rem; margin-bottom: 0.75rem; font-size: 0.8rem;">
        <button type="button" class="btn-link legal-link" data-url="${PRIVACY_URL}" style="padding: 0.25rem 0; font-size: inherit; color: var(--bm-teal); text-decoration: underline; background: none; border: none; cursor: pointer;">Privacy Policy</button>
        <span style="color: var(--color-text-light);">·</span>
        <button type="button" class="btn-link legal-link" data-url="${TERMS_URL}" style="padding: 0.25rem 0; font-size: inherit; color: var(--bm-teal); text-decoration: underline; background: none; border: none; cursor: pointer;">Terms of Use</button>
        <span style="color: var(--color-text-light);">·</span>
        <button type="button" class="btn-link legal-link" data-url="${EULA_URL}" style="padding: 0.25rem 0; font-size: inherit; color: var(--bm-teal); text-decoration: underline; background: none; border: none; cursor: pointer;">Apple EULA</button>
      </div>
      <div style="background: #f0f8ff; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
        <p style="margin: 0; color: #1e5a8e; font-size: 0.9rem; text-align: center;">
          <strong>Note:</strong> Subscriptions can only be purchased from the Android or iOS app.
        </p>
      </div>
      
      <button type="button" class="btn-secondary" id="cancel-btn" style="width: 100%; padding: 0.75rem;">
        ← Back
      </button>
    `}

    <div id="subscription-message" style="display:none; margin-top: 1rem; padding: 0.75rem; border-radius: 8px;">
      <p style="margin: 0; font-size: 0.95rem;"></p>
    </div>

    <div class="text-center" style="margin-top: 1rem;">
      <p class="text-muted" style="font-size: 0.8rem;">
        Cancel anytime. Auto-renews yearly.<br>
        Payment will be charged to your ${isNative ? (Capacitor.getPlatform() === 'ios' ? 'App Store' : 'Google Play') : 'store'} account.
      </p>
    </div>
  `;

  container.appendChild(card);
  wrapper.appendChild(container);

  return wrapper;
}

function showMessage(text, isError = false, isSuccess = false) {
  const messageContainer = document.getElementById('subscription-message');
  if (!messageContainer) return;
  const p = messageContainer.querySelector('p');
  if (!p) return;

  p.textContent = text;
  
  if (isError) {
    messageContainer.style.background = '#fee2e2';
    messageContainer.style.border = '1px solid #f87171';
    p.style.color = '#dc2626';
  } else if (isSuccess) {
    messageContainer.style.background = '#dcfce7';
    messageContainer.style.border = '1px solid #4ade80';
    p.style.color = '#16a34a';
  } else {
    messageContainer.style.background = '#f0f8ff';
    messageContainer.style.border = '1px solid var(--color-primary)';
    p.style.color = 'var(--color-text)';
  }
  
  messageContainer.style.display = text ? 'block' : 'none';
  if (text && messageContainer.scrollIntoView) {
    messageContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function setLoading(loading, buttonText = 'Processing...') {
  const subscribeBtn = document.getElementById('subscribe-btn');
  const restoreBtn = document.getElementById('restore-btn');
  const checkStatusBtn = document.getElementById('check-status-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  
  if (subscribeBtn) {
    subscribeBtn.disabled = loading;
    subscribeBtn.textContent = loading ? buttonText : 'Start Free Trial';
  }
  
  if (restoreBtn) {
    restoreBtn.disabled = loading;
  }

  if (checkStatusBtn) {
    checkStatusBtn.disabled = loading;
  }

  if (cancelBtn) {
    cancelBtn.disabled = loading;
  }
}

async function onMount() {
  window.navigate = navigate;

  const isNative = Capacitor.isNativePlatform?.() ?? false;
  const isPendingSignup = hasPendingSignup();

  // Check if user already has active subscription
  if (isNative) {
    await refreshSubscriptionStatus();
    const hasActive = hasActiveSubscription();
    
    if (hasActive) {
      // Already subscribed - if there's a pending signup, complete it
      if (isPendingSignup) {
        await handleAccountCreation();
      } else {
        // Existing subscriber, go to auth
        navigate('/auth');
      }
      return;
    }
  }

  const subscribeBtn = document.getElementById('subscribe-btn');
  const restoreBtn = document.getElementById('restore-btn');
  const checkStatusBtn = document.getElementById('check-status-btn');
  const cancelBtn = document.getElementById('cancel-btn');

  // Subscribe button
  if (subscribeBtn) {
    subscribeBtn.addEventListener('click', async () => {
      showMessage('');
      setLoading(true, 'Processing...');

      try {
        // Like PetHub+: identify RevenueCat with user before purchase so purchase is tied to them
        const pendingEmail = getPendingSignupEmail();
        if (pendingEmail) {
          try {
            await logInWithAppUserId(`pending_${pendingEmail}`);
            console.log('[Subscription Page] RevenueCat logged in as pending_', pendingEmail);
          } catch (rcErr) {
            console.warn('[Subscription Page] RevenueCat logIn before purchase failed (continuing):', rcErr);
          }
        }

        const status = await purchaseSubscription();
        
        console.log('[Subscription Page] Purchase result:', status);
        
        if (status.active) {
          showMessage('Subscription activated!', false, true);
          
          // If there's pending signup data, create the account
          if (isPendingSignup) {
            setLoading(true, 'Creating account...');
            await handleAccountCreation();
          } else {
            // No pending signup - just go to auth
            setTimeout(() => navigate('/auth'), 1000);
          }
        } else if (status.cancelled) {
          // User cancelled - just hide the loading, don't show error
          showMessage('');
          console.log('[Subscription Page] User cancelled purchase');
        } else if (status.error) {
          const notConfigured = /must be configured|not configured/i.test(status.error);
          const invalidKey = /invalid api key|credentials issue|code.*11/i.test(status.error);
          let message = status.error;
          if (notConfigured) {
            const isSimulator = typeof navigator !== 'undefined' && /Simulator|iPhone Simulator/i.test(navigator.userAgent);
            message = isSimulator
              ? "In-app purchases aren't available in the Simulator. Run the app on a real device to subscribe."
              : 'Subscriptions are not set up for this build. Please install the app from the App Store, or contact support if the problem continues.';
          } else if (invalidKey) {
            message = "Subscription setup error. Rebuild the app (npm run build, then sync and run in Xcode) so the correct key is included.";
          }
          showMessage(message, true);
        } else {
          // Unknown state
          showMessage('Purchase was not completed. Please try again.', true);
        }
      } catch (error) {
        console.error('Purchase error:', error);
        showMessage('Something went wrong. Please try again.', true);
      } finally {
        setLoading(false);
      }
    });
  }

  // Restore button
  if (restoreBtn) {
    restoreBtn.addEventListener('click', async () => {
      const restoreLabel = restoreBtn.textContent;
      showMessage('');
      setLoading(true, 'Restoring...');
      restoreBtn.textContent = 'Restoring...';

      try {
        const status = await restoreSubscription();
        
        if (status.active) {
          showMessage('Subscription restored!', false, true);
          setTimeout(() => navigate('/auth'), 1000);
        } else if (status.error && status.error.includes('Restore is only available')) {
          showMessage(status.error, false);
        } else if (status.error) {
          showMessage(status.error || 'Failed to restore. Please try again.', true);
        } else {
          showMessage('No purchases to restore.', false);
        }
      } catch (error) {
        console.error('Restore error:', error);
        showMessage('Failed to restore subscription. Please try again.', true);
      } finally {
        setLoading(false);
        restoreBtn.textContent = restoreLabel;
      }
    });
  }

  // Legal links (paywall) – open in system browser / new tab
  document.querySelectorAll('.paywall-legal-links .legal-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      if (url) openExternalUrl(url);
    });
  });

  // Check Status button - manually check if purchase went through
  if (checkStatusBtn) {
    checkStatusBtn.addEventListener('click', async () => {
      showMessage('');
      setLoading(true, 'Checking subscription status...');

      try {
        console.log('[Subscription Page] Manually checking subscription status...');
        await refreshSubscriptionStatus();
        const hasActive = hasActiveSubscription();
        
        console.log('[Subscription Page] Has active subscription?', hasActive);
        
        if (hasActive) {
          showMessage('✓ Active subscription found!', false, true);
          
          // If there's pending signup data, create the account
          if (isPendingSignup) {
            setLoading(true, 'Creating account...');
            await handleAccountCreation();
          } else {
            // No pending signup - just go to auth
            setTimeout(() => navigate('/auth'), 1500);
          }
        } else {
          showMessage('No active subscription found. If you just purchased, please wait a moment and try again.', false);
        }
      } catch (error) {
        console.error('Check status error:', error);
        showMessage('Failed to check subscription status.', true);
      } finally {
        setLoading(false);
      }
    });
  }

  // Back button - go back one screen (e.g. to auth)
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      window.history.back();
    });
  }
}

/**
 * Create account after successful payment
 */
async function handleAccountCreation() {
  try {
    const result = await completeAccountCreation();
    
    if (result.success) {
      if (result.needsVerification) {
        showMessage('Account created! Check your email to verify, then sign in.', false, true);
        setTimeout(() => navigate('/auth'), 2000);
      } else {
        showMessage('Account created successfully!', false, true);
        setTimeout(() => navigate('/'), 1500);
      }
    } else {
      showMessage(result.error || 'Failed to create account. Please try signing up again.', true);
      setTimeout(() => navigate('/auth'), 3000);
    }
  } catch (err) {
    console.error('Account creation error:', err);
    showMessage('Error creating account. Please try again.', true);
    setTimeout(() => navigate('/auth'), 3000);
  }
}

export default {
  render,
  onMount
};
