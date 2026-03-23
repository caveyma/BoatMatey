/**
 * Shown at the top of premium modules for free users (preview-before-paywall).
 */

import { hasActiveSubscription } from '../lib/subscription.js';

/**
 * @param {HTMLElement | null} pageContentEl - Usually `.page-content`
 * @param {{ headline: string, detail: string }} copy
 */
export function insertPremiumPreviewBanner(pageContentEl, { headline, detail }) {
  if (!pageContentEl || hasActiveSubscription()) return;

  const div = document.createElement('div');
  div.className = 'premium-preview-banner card';
  div.setAttribute('role', 'note');
  div.innerHTML = `
    <p class="premium-preview-banner-headline">${headline}</p>
    <p class="text-muted premium-preview-banner-detail">${detail}</p>
  `;

  const backRow = pageContentEl.querySelector('.page-body-back');
  if (backRow && backRow.nextSibling) {
    pageContentEl.insertBefore(div, backRow.nextSibling);
  } else {
    pageContentEl.insertBefore(div, pageContentEl.firstChild);
  }
}
