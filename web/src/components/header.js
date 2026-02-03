/**
 * Yacht Header Component
 * Premium navy header bar for all pages
 * Back button is rendered in the main body via createBackButton()
 */

import { navigate } from '../router.js';

/**
 * Back button for the top-left of the main body. Always goes back one screen (history.back()).
 * Use same font size as Home/Settings (0.8rem). No arrow.
 */
export function createBackButton() {
  const row = document.createElement('div');
  row.className = 'page-body-back';
  const backBtn = document.createElement('button');
  backBtn.className = 'btn-link page-body-back-btn';
  backBtn.type = 'button';
  backBtn.textContent = 'Back';
  backBtn.onclick = (e) => {
    e.preventDefault();
    window.history.back();
  };
  row.appendChild(backBtn);
  return row;
}

export function createYachtHeader(title) {
  const header = document.createElement('div');
  header.className = 'yacht-header compass-watermark';

  const logoSection = document.createElement('div');
  logoSection.className = 'yacht-header-logo';

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

  // Right-hand side actions: Home
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

  const homeBtn = document.createElement('button');
  homeBtn.textContent = 'Home';
  baseButtonStyles(homeBtn);
  homeBtn.onclick = (e) => {
    e.preventDefault();
    navigate('/');
  };

  actionsSection.appendChild(homeBtn);

  header.appendChild(actionsSection);

  return header;
}

