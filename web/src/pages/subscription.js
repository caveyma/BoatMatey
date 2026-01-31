/**
 * Subscription Paywall Page
 * 
 * Displays subscription options with 1-month free trial
 * Must be completed before account creation (GDPR compliance)
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
import { Capacitor } from '@capacitor/core';

function render() {
  const wrapper = document.createElement('div');
  wrapper.className = 'page-content';

  const container = document.createElement('div');
  container.className = 'container';

  const card = document.createElement('div');
  card.className = 'card';
  card.style.maxWidth = '560px';
  card.style.margin = '0 auto';

  const isNative = Capacitor.isNativePlatform?.() ?? false;

  card.innerHTML = `
    <div class="text-center mb-md">
      <div style="display:flex; justify-content:center; margin-bottom: 1rem;">
        ${renderLogoFull(140)}
      </div>
      <h2>Welcome to BoatMatey</h2>
      <p class="text-muted">Your digital boat management companion</p>
    </div>

    <div class="subscription-plan" style="
      background: linear-gradient(135deg, var(--color-primary) 0%, #1e5a8e 100%);
      color: white;
      padding: 2rem;
      border-radius: 12px;
      margin-bottom: 1.5rem;
      text-align: center;
    ">
      <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 0.5rem;">
        £24.99/year
      </div>
      <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 1.5rem;">
        Including VAT
      </div>
      
      <div style="
        background: rgba(255,255,255,0.15);
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1.5rem;
        border: 2px solid rgba(255,255,255,0.3);
      ">
        <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.25rem;">
          🎉 1 Month Free Trial
        </div>
        <div style="font-size: 0.85rem; opacity: 0.9;">
          For new subscribers
        </div>
      </div>

      <div style="text-align: left; margin-bottom: 1rem;">
        <div style="margin-bottom: 0.75rem; display: flex; align-items: start;">
          <span style="margin-right: 0.5rem;">✓</span>
          <span>Unlimited boats and equipment</span>
        </div>
        <div style="margin-bottom: 0.75rem; display: flex; align-items: start;">
          <span style="margin-right: 0.5rem;">✓</span>
          <span>Complete service history tracking</span>
        </div>
        <div style="margin-bottom: 0.75rem; display: flex; align-items: start;">
          <span style="margin-right: 0.5rem;">✓</span>
          <span>Haul-out & maintenance records</span>
        </div>
        <div style="margin-bottom: 0.75rem; display: flex; align-items: start;">
          <span style="margin-right: 0.5rem;">✓</span>
          <span>Digital logbook & calendar</span>
        </div>
        <div style="margin-bottom: 0.75rem; display: flex; align-items: start;">
          <span style="margin-right: 0.5rem;">✓</span>
          <span>Cloud sync across all devices</span>
        </div>
        <div style="display: flex; align-items: start;">
          <span style="margin-right: 0.5rem;">✓</span>
          <span>Photo attachments & documentation</span>
        </div>
      </div>
    </div>

    ${isNative ? `
      <button type="button" class="btn-primary" id="subscribe-btn" style="width: 100%; margin-bottom: 1rem; padding: 1rem; font-size: 1.1rem;">
        Start Free Trial
      </button>
      
      <button type="button" class="btn-secondary" id="restore-btn" style="width: 100%; margin-bottom: 1rem;">
        Restore Purchase
      </button>
    ` : `
      <div class="info-box" style="background: #f0f8ff; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
        <p style="margin: 0; color: #1e5a8e;">
          <strong>Note:</strong> Subscriptions can only be purchased from the Android or iOS app.
          Download BoatMatey from the App Store or Google Play to get started.
        </p>
      </div>
    `}

    <div id="subscription-message" class="mt-md" style="display:none;">
      <p class="text-muted"></p>
    </div>

    <div class="text-center mt-md">
      <p class="text-muted" style="font-size: 0.85rem;">
        Cancel anytime. Auto-renews yearly.
      </p>
    </div>
  `;

  container.appendChild(card);
  wrapper.appendChild(container);

  return wrapper;
}

function showMessage(text, isError = false) {
  const messageContainer = document.getElementById('subscription-message');
  if (!messageContainer) return;
  const p = messageContainer.querySelector('p');
  if (!p) return;

  p.textContent = text;
  p.style.color = isError ? 'var(--color-error)' : 'var(--color-text-light)';
  messageContainer.style.display = text ? 'block' : 'none';
}

function setLoading(loading) {
  const subscribeBtn = document.getElementById('subscribe-btn');
  const restoreBtn = document.getElementById('restore-btn');
  
  if (subscribeBtn) {
    subscribeBtn.disabled = loading;
    subscribeBtn.textContent = loading ? 'Processing...' : 'Start Free Trial';
  }
  
  if (restoreBtn) {
    restoreBtn.disabled = loading;
  }
}

async function onMount() {
  window.navigate = navigate;

  const isNative = Capacitor.isNativePlatform?.() ?? false;

  // Check if user already has active subscription
  const hasActive = hasActiveSubscription();
  if (hasActive) {
    // Already subscribed, proceed to auth
    navigate('/auth');
    return;
  }

  if (!isNative) {
    // Web: show message that subscriptions are only available in app
    return;
  }

  const subscribeBtn = document.getElementById('subscribe-btn');
  const restoreBtn = document.getElementById('restore-btn');

  if (subscribeBtn) {
    subscribeBtn.addEventListener('click', async () => {
      showMessage('');
      setLoading(true);

      try {
        const status = await purchaseSubscription();
        
        if (status.active) {
          showMessage('Subscription activated! Proceeding to account creation...', false);
          setTimeout(() => {
            navigate('/auth');
          }, 1500);
        } else {
          showMessage('Purchase was cancelled or failed. Please try again.', true);
        }
      } catch (error) {
        console.error('Purchase error:', error);
        showMessage('Something went wrong. Please try again.', true);
      } finally {
        setLoading(false);
      }
    });
  }

  if (restoreBtn) {
    restoreBtn.addEventListener('click', async () => {
      showMessage('');
      setLoading(true);

      try {
        const status = await restoreSubscription();
        
        if (status.active) {
          showMessage('Subscription restored! Proceeding to account creation...', false);
          setTimeout(() => {
            navigate('/auth');
          }, 1500);
        } else {
          showMessage('No active subscription found. Please subscribe to continue.', true);
        }
      } catch (error) {
        console.error('Restore error:', error);
        showMessage('Failed to restore subscription. Please try again.', true);
      } finally {
        setLoading(false);
      }
    });
  }
}

export default {
  render,
  onMount
};
