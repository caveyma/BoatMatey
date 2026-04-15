/**
 * Yacht Header Component
 * Premium navy header bar for all pages
 * Back button is rendered in the main body via createBackButton()
 */

import { navigate } from '../router.js';
import { supabase } from '../lib/supabaseClient.js';
import { resetFirstRunOnboardingClientState } from '../lib/firstRunOnboarding.js';
import { hasActiveSubscription } from '../lib/subscription.js';

let planPillSyncListenerAttached = false;

function attachPlanPillSyncListener() {
  if (planPillSyncListenerAttached) return;
  planPillSyncListenerAttached = true;
  window.addEventListener('boatmatey:subscription-updated', () => {
    document.querySelectorAll('.header-plan-pill').forEach((el) => syncPlanPillElement(el));
  });
}

/**
 * @param {HTMLButtonElement} btn
 */
function syncPlanPillElement(btn) {
  if (!btn) return;
  const active = hasActiveSubscription();
  btn.classList.toggle('header-plan-pill--premium', active);
  btn.classList.toggle('header-plan-pill--free', !active);
  const label = btn.querySelector('.header-plan-pill-label');
  const chev = btn.querySelector('.header-plan-pill-chevron');
  if (label) label.textContent = active ? 'Premium' : 'Free Plan';
  if (chev) chev.hidden = active;
  btn.setAttribute(
    'aria-label',
    active ? 'Premium — open subscription details in Settings' : 'Free Plan — view upgrade options'
  );
}

function createPlanPillButton() {
  attachPlanPillSyncListener();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'header-plan-pill';
  btn.innerHTML =
    '<span class="header-plan-pill-label">Free Plan</span><span class="header-plan-pill-chevron" aria-hidden="true">›</span>';
  syncPlanPillElement(btn);
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (hasActiveSubscription()) {
      navigate('/account');
    } else {
      navigate('/subscription');
    }
  });
  return btn;
}

/**
 * Back button for the top-left of the main body.
 * @param {string} [backRoute] - If provided, Back navigates here instead of history.back()
 */
export function createBackButton(backRoute) {
  const row = document.createElement('div');
  row.className = 'page-body-back';
  const backBtn = document.createElement('button');
  backBtn.className = 'btn-link page-body-back-btn';
  backBtn.type = 'button';
  backBtn.textContent = 'Back';
  backBtn.setAttribute('aria-label', 'Go back');
  backBtn.onclick = (e) => {
    e.preventDefault();
    if (backRoute) {
      navigate(backRoute);
    } else {
      window.history.back();
    }
  };
  row.appendChild(backBtn);
  return row;
}

/**
 * @param {string} title - Page/boat name
 * @param {{ showSettings?: boolean, showHome?: boolean, showSignOut?: boolean, breadcrumb?: string }} [options] - showSettings: add Settings link; showHome: show Home nav (false on home page); showSignOut: show Sign out (e.g. on home screen); breadcrumb: optional subtitle
 */
export function createYachtHeader(title, options = {}) {
  const { showSettings = false, showHome = true, showSignOut = false, breadcrumb = '' } = options;
  const header = document.createElement('header');
  header.className = 'yacht-header compass-watermark';
  header.setAttribute('role', 'banner');

  const logoSection = document.createElement('div');
  logoSection.className = 'yacht-header-logo';

  const logoWrap = document.createElement('div');
  logoWrap.className = 'header-logo-wrap';
  const logoImg = document.createElement('img');
  logoImg.className = 'header-logo-img';
  logoImg.src = new URL('./BoatMatey_Logo_Header.png', import.meta.url).href;
  logoImg.alt = 'BoatMatey';
  logoWrap.appendChild(logoImg);
  logoSection.appendChild(logoWrap);

  const centerSection = document.createElement('div');
  centerSection.className = 'yacht-header-center';
  if (title) {
    const titleWrap = document.createElement('div');
    titleWrap.className = 'yacht-header-title-wrap';
    const titleEl = document.createElement('h1');
    titleEl.className = 'yacht-header-title';
    titleEl.id = 'page-title';
    titleEl.textContent = title;
    titleWrap.appendChild(titleEl);
    if (breadcrumb) {
      const sub = document.createElement('span');
      sub.className = 'yacht-header-breadcrumb';
      sub.textContent = breadcrumb;
      titleWrap.appendChild(sub);
    }
    centerSection.appendChild(titleWrap);
  }
  header.appendChild(logoSection);
  header.appendChild(centerSection);

  const actionsSection = document.createElement('nav');
  actionsSection.className = 'yacht-header-actions';
  actionsSection.setAttribute('aria-label', 'Main navigation');

  actionsSection.appendChild(createPlanPillButton());

  const baseButtonStyles = (btn) => {
    btn.className = 'btn-link header-action-btn';
    btn.style.background = 'transparent';
    btn.style.border = 'none';
    btn.style.color = '#0B3C5D';
    btn.style.fontSize = '0.8rem';
    btn.style.padding = '0.25rem 0';
    btn.style.minHeight = '44px';
  };

  if (showHome) {
    const homeBtn = document.createElement('button');
    homeBtn.textContent = 'Home';
    homeBtn.setAttribute('aria-label', 'Go to home');
    baseButtonStyles(homeBtn);
    homeBtn.onclick = (e) => {
      e.preventDefault();
      const hashPath = (window.location.hash || '').replace(/^#/, '') || '/';
      const pathOnly = hashPath.split('?')[0] || '/';
      const boatMatch = pathOnly.match(/^\/boat\/([^\/]+)(?:\/(.*))?$/);
      if (!boatMatch) {
        navigate('/');
        return;
      }
      const boatId = boatMatch[1];
      const subPath = (boatMatch[2] || '').trim();
      // Home behavior:
      // - on boat dashboard (/boat/:id) => app home
      // - inside a boat card/section (/boat/:id/...) => boat dashboard
      if (!subPath) {
        navigate('/');
      } else {
        navigate(`/boat/${boatId}`);
      }
    };
    actionsSection.appendChild(homeBtn);
  }

  if (showSignOut) {
    const signOutBtn = document.createElement('button');
    signOutBtn.textContent = 'Sign out';
    signOutBtn.setAttribute('aria-label', 'Sign out');
    baseButtonStyles(signOutBtn);
    signOutBtn.onclick = async (e) => {
      e.preventDefault();
      if (supabase) await supabase.auth.signOut();
      resetFirstRunOnboardingClientState();
      navigate('/welcome');
    };
    actionsSection.appendChild(signOutBtn);
  }

  if (showSettings) {
    const settingsBtn = document.createElement('button');
    settingsBtn.textContent = 'Settings';
    settingsBtn.setAttribute('aria-label', 'Open settings');
    baseButtonStyles(settingsBtn);
    settingsBtn.onclick = (e) => {
      e.preventDefault();
      navigate('/account');
    };
    actionsSection.appendChild(settingsBtn);
  }

  header.appendChild(actionsSection);
  return header;
}

