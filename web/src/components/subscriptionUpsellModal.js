/**
 * Reusable paywall-style modal (store badges + link to subscription page).
 */

import { navigate } from '../router.js';
import { APP_STORE_URL, GOOGLE_PLAY_URL, APP_STORE_BADGE_URL, GOOGLE_PLAY_BADGE_URL } from '../lib/constants.js';

function ensureModalRoot() {
  let root = document.getElementById('modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    root.className = 'modal-root';
    document.body.appendChild(root);
  }
  return root;
}

/**
 * @param {{ title: string, message: string }} options
 */
export function showSubscriptionUpsellModal({ title, message }) {
  const root = ensureModalRoot();
  const overlay = document.createElement('div');
  overlay.className = 'confirm-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'subscription-upsell-title');

  overlay.innerHTML = `
    <div class="confirm-modal" style="max-width: 380px;">
      <h2 id="subscription-upsell-title" class="confirm-modal-title">${title}</h2>
      <p class="confirm-modal-message" style="margin-bottom: 1rem;">${message}</p>
      <p class="text-muted" style="font-size: 0.9rem; margin-bottom: 1rem;">
        <strong>£29.99/year</strong> including VAT · 1 month free trial
      </p>
      <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-bottom: 1rem;">
        <a href="${APP_STORE_URL}" target="_blank" rel="noopener" style="display: flex; align-items: center; justify-content: center;">
          <img src="${APP_STORE_BADGE_URL}" alt="Download on the App Store" style="height: 40px; width: auto;">
        </a>
        <a href="${GOOGLE_PLAY_URL}" target="_blank" rel="noopener" style="display: flex; align-items: center; justify-content: center;">
          <img src="${GOOGLE_PLAY_BADGE_URL}" alt="Get it on Google Play" style="height: 54px; width: auto;">
        </a>
      </div>
      <div class="confirm-modal-actions" style="flex-direction: column; gap: 0.5rem;">
        <button type="button" class="btn-primary subscription-upsell-view">View subscription details</button>
        <button type="button" class="btn-secondary subscription-upsell-close">Close</button>
      </div>
    </div>
  `;

  function close() {
    overlay.classList.add('confirm-modal-exit');
    setTimeout(() => overlay.remove(), 200);
  }

  overlay.querySelector('.subscription-upsell-close').onclick = close;
  overlay.querySelector('.subscription-upsell-view').onclick = () => {
    close();
    navigate('/subscription');
  };
  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  root.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('confirm-modal-visible'));
}

export function showServiceHistoryLimitModal() {
  showSubscriptionUpsellModal({
    title: "You've reached your free limit",
    message: 'Upgrade to continue tracking your boat maintenance.'
  });
}
