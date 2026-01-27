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
    backBtn.onclick = (e) => {
      e.preventDefault();
      backAction();
    };
    logoSection.appendChild(backBtn);
  }
  
  const logo = document.createElement('div');
  logo.innerHTML = renderLogoMono(28);
  logo.style.display = 'flex';
  logo.style.alignItems = 'center';
  
  const titleEl = document.createElement('h1');
  titleEl.className = 'yacht-header-title';
  titleEl.textContent = title;
  
  logoSection.appendChild(logo);
  logoSection.appendChild(titleEl);
  
  header.appendChild(logoSection);
  
  return header;
}
