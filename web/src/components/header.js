/**
 * Yacht Header Component
 * Premium navy header bar for all pages
 * Back button is rendered in the main body via createBackButton()
 */

import { navigate } from '../router.js';

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
 * @param {{ showSettings?: boolean, breadcrumb?: string }} [options] - showSettings: add Settings link; breadcrumb: optional subtitle
 */
export function createYachtHeader(title, options = {}) {
  const { showSettings = false, breadcrumb = '' } = options;
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
  actionsSection.style.marginLeft = 'auto';
  actionsSection.style.display = 'flex';
  actionsSection.style.flexDirection = 'row';
  actionsSection.style.alignItems = 'center';
  actionsSection.style.gap = 'var(--spacing-md)';

  const baseButtonStyles = (btn) => {
    btn.className = 'btn-link header-action-btn';
    btn.style.background = 'transparent';
    btn.style.border = 'none';
    btn.style.color = '#0B3C5D';
    btn.style.fontSize = '0.8rem';
    btn.style.padding = '0.25rem 0';
    btn.style.minHeight = '44px';
  };

  const homeBtn = document.createElement('button');
  homeBtn.textContent = 'Home';
  homeBtn.setAttribute('aria-label', 'Go to home');
  baseButtonStyles(homeBtn);
  homeBtn.onclick = (e) => {
    e.preventDefault();
    navigate('/');
  };
  actionsSection.appendChild(homeBtn);

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

