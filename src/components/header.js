/**
 * Yacht Header Component
 * Premium navy header bar for all pages
 */

import { renderLogoMono } from './logo.js';

export function createYachtHeader(title, showBack = false, backAction = null) {
  const header = document.createElement('div');
  header.className = 'yacht-header compass-watermark';

  const logoSection = document.createElement('div');
  logoSection.className = 'yacht-header-logo';

  if (showBack && backAction) {
    const backBtn = document.createElement('button');
    backBtn.className = 'btn-link';
    backBtn.style.color = 'white';
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


  // only show title when a page needs it
  if (title) {
    const titleEl = document.createElement('h1');
    titleEl.className = 'yacht-header-title';
    titleEl.textContent = title;
    logoSection.appendChild(titleEl);
  }

  header.appendChild(logoSection);
  return header;
}

