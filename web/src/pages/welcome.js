/**
 * Welcome Page
 * 
 * First screen users see - explains the app
 * Then proceeds to auth page for sign in or account creation
 */

import { navigate } from '../router.js';
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

  card.innerHTML = `
    <div style="margin-bottom: 2rem;">
      ${renderLogoFull(220)}
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

    <button type="button" class="btn-primary" id="get-started-btn" style="width: 100%; padding: 1rem; font-size: 1.1rem;">
      Get Started
    </button>
  `;

  container.appendChild(card);
  wrapper.appendChild(container);

  return wrapper;
}

function onMount() {
  const getStartedBtn = document.getElementById('get-started-btn');
  
  if (getStartedBtn) {
    getStartedBtn.addEventListener('click', () => {
      navigate('/auth');
    });
  }
}

export default {
  render,
  onMount
};
