/**
 * Welcome Page
 * 
 * First screen users see - explains the app
 * Then proceeds to auth page for sign in or account creation
 */

import { renderLogoFull } from '../components/logo.js';

function render() {
  const wrapper = document.createElement('div');
  wrapper.className = 'page-fullscreen';

  const container = document.createElement('div');
  container.className = 'container';

  const card = document.createElement('div');
  card.className = 'card';
  card.style.textAlign = 'center';
  card.style.padding = '2rem 1.5rem';

  // Promo video: use path that works on web (/) and in Capacitor when doc is at /app/index.html (../assets/)
  const pathname = (typeof window !== 'undefined' && window.location?.pathname) || '';
  const isAppEntry = pathname === '/app' || pathname === '/app/' || pathname.endsWith('/app/index.html');
  const promoVideoSrc = isAppEntry ? '../assets/creating-a-new-boat.mp4' : '/assets/creating-a-new-boat.mp4';

  card.innerHTML = `
    <div style="margin-bottom: 2rem;">
      ${renderLogoFull(220)}
    </div>

    <div class="welcome-promo-video" style="margin-bottom: 1.5rem; border-radius: var(--radius, 0.75rem); overflow: hidden; background: #0B2A3F; max-width: 100%;">
      <video
        src="${promoVideoSrc}"
        controls
        playsinline
        muted
        loop
        style="width: 100%; display: block; max-height: 200px; object-fit: cover;"
        title="BoatMatey – Creating a new boat"
      ></video>
      <p style="margin: 0.5rem 0 0; font-size: 0.8rem; color: var(--color-text-light);">Official BoatMatey product demo</p>
    </div>

    <h1 style="font-size: 1.75rem; color: var(--color-text); margin-bottom: 0.75rem;">
      Welcome to BoatMatey
    </h1>
    
    <p style="color: var(--color-text-light); font-size: 1.1rem; margin-bottom: 2rem; line-height: 1.5;">
      Your digital boat management companion
    </p>

    <div style="text-align: left; margin-bottom: 2rem;">
      <div style="display: flex; align-items: start; margin-bottom: 1rem; padding: 0.75rem; background: #f8fbfc; border-radius: 8px;">
        <span style="font-size: 1.5rem; margin-right: 0.75rem;">⛵</span>
        <div>
          <strong style="display: block; margin-bottom: 0.25rem;">Manage Your Fleet</strong>
          <span style="color: var(--color-text-light); font-size: 0.9rem;">Track up to 2 active boats and 5 archived vessels</span>
        </div>
      </div>
      
      <div style="display: flex; align-items: start; margin-bottom: 1rem; padding: 0.75rem; background: #f8fbfc; border-radius: 8px;">
        <span style="font-size: 1.5rem; margin-right: 0.75rem;">🔧</span>
        <div>
          <strong style="display: block; margin-bottom: 0.25rem;">Service History</strong>
          <span style="color: var(--color-text-light); font-size: 0.9rem;">Complete maintenance records for engines and equipment</span>
        </div>
      </div>
      
      <div style="display: flex; align-items: start; margin-bottom: 1rem; padding: 0.75rem; background: #f8fbfc; border-radius: 8px;">
        <span style="font-size: 1.5rem; margin-right: 0.75rem;">📅</span>
        <div>
          <strong style="display: block; margin-bottom: 0.25rem;">Never Miss a Date</strong>
          <span style="color: var(--color-text-light); font-size: 0.9rem;">Haul-out schedules, reminders, and calendar integration</span>
        </div>
      </div>
      
      <div style="display: flex; align-items: start; padding: 0.75rem; background: #f8fbfc; border-radius: 8px;">
        <span style="font-size: 1.5rem; margin-right: 0.75rem;">☁️</span>
        <div>
          <strong style="display: block; margin-bottom: 0.25rem;">Cloud Sync</strong>
          <span style="color: var(--color-text-light); font-size: 0.9rem;">Access your data securely from any device</span>
        </div>
      </div>
    </div>

    <a href="#/auth" class="btn-primary" id="get-started-btn" style="display: block; width: 100%; padding: 1rem; font-size: 1.1rem; text-align: center; text-decoration: none; color: inherit; box-sizing: border-box;">
      Get Started
    </a>
    <p style="margin-top: 1rem; font-size: 0.9rem;">
      <a href="#/auth" id="welcome-sign-in-link" style="color: var(--bm-teal); font-weight: 600;">Already have an account? Sign in</a>
    </p>
  `;

  container.appendChild(card);
  wrapper.appendChild(container);

  return wrapper;
}

function onMount() {
  // Scroll to top so header and video are visible (fixes small screens / restored scroll position).
  const wrapper = document.querySelector('.page-fullscreen');
  if (wrapper) wrapper.scrollTop = 0;
  // Get Started and Sign in are plain <a href="#/auth"> so the WebView navigates via hash change
  // without relying on click handlers (which can fail to fire on some Android WebViews).
}

export default {
  render,
  onMount
};
