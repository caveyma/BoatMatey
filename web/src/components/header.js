/**
 * Yacht Header Component
 * Premium navy header bar for all pages
 */

import { navigate } from '../router.js';

export function createYachtHeader(title, showBack = false, backAction = null) {
  const header = document.createElement('div');
  header.className = 'yacht-header compass-watermark';

  const logoSection = document.createElement('div');
  logoSection.className = 'yacht-header-logo';

  if (showBack && backAction) {
    const backBtn = document.createElement('button');
    backBtn.className = 'btn-link';
    backBtn.style.color = '#0B3C5D';
    backBtn.style.padding = 'var(--spacing-xs)';
    backBtn.innerHTML = `←`;
    backBtn.onclick = (e) => { e.preventDefault(); backAction(); };
    logoSection.appendChild(backBtn);
  }

    // Header-safe logo image
    const logoWrap = document.createElement('div');
    logoWrap.className = 'header-logo-wrap';

    const logoImg = document.createElement('img');
    logoImg.className = 'header-logo-img';
    logoImg.src = new URL('./BoatMatey_Logo_Header.png', import.meta.url).href;
    logoImg.alt = 'BoatMatey';

    logoWrap.appendChild(logoImg);
    logoSection.appendChild(logoWrap);


  // Centre title section (boat name / page name)
  const centerSection = document.createElement('div');
  centerSection.className = 'yacht-header-center';

  if (title) {
    const titleEl = document.createElement('h1');
    titleEl.className = 'yacht-header-title';
    titleEl.textContent = title;
    centerSection.appendChild(titleEl);
  }

  header.appendChild(logoSection);
  header.appendChild(centerSection);

  // Right-hand side actions: Settings + Home (Sign out is under Settings page)
  const actionsSection = document.createElement('div');
  actionsSection.className = 'yacht-header-actions';
  actionsSection.style.marginLeft = 'auto';
  actionsSection.style.display = 'flex';
  actionsSection.style.flexDirection = 'column';
  actionsSection.style.alignItems = 'center';
  actionsSection.style.gap = '0.15rem';

  const baseButtonStyles = (btn) => {
    btn.className = 'btn-link';
    btn.style.background = 'transparent';
    btn.style.border = 'none';
    btn.style.color = '#0B3C5D';
    btn.style.fontSize = '0.8rem';
    btn.style.padding = '0';
  };

  const settingsBtn = document.createElement('button');
  settingsBtn.textContent = 'Settings';
  baseButtonStyles(settingsBtn);
  settingsBtn.onclick = (e) => {
    e.preventDefault();
    navigate('/account');
  };

  const homeBtn = document.createElement('button');
  homeBtn.textContent = 'Home';
  baseButtonStyles(homeBtn);
  homeBtn.onclick = (e) => {
    e.preventDefault();
    navigate('/');
  };

  actionsSection.appendChild(settingsBtn);
  actionsSection.appendChild(homeBtn);

  header.appendChild(actionsSection);

  return header;
}

