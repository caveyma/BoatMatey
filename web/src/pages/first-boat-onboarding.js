/**
 * First-run onboarding: signed-in user with no boats yet.
 * Source of truth is boat count from the API (via getBoats); this page is only routed when count is zero.
 */

import { navigate } from '../router.js';
import { renderLogoFull } from '../components/logo.js';
import { createYachtHeader } from '../components/header.js';
import { getBoats } from '../lib/dataService.js';
import {
  setSkipZeroBoatOnboardingThisLoad,
  requestOpenAddBoatOnHome
} from '../lib/firstRunOnboarding.js';

function render() {
  const wrapper = document.createElement('div');
  wrapper.className = 'page-fullscreen';

  const header = createYachtHeader('', { showHome: false, showSignOut: true });
  wrapper.appendChild(header);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content';

  const container = document.createElement('div');
  container.className = 'container';

  const card = document.createElement('div');
  card.className = 'card';
  card.style.textAlign = 'center';
  card.style.padding = '2rem 1.5rem';
  card.style.maxWidth = '520px';
  card.style.margin = '0 auto';

  card.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      ${renderLogoFull(180)}
    </div>
    <h1 style="font-size: 1.65rem; color: var(--color-text); margin-bottom: 0.5rem;">
      Welcome to BoatMatey
    </h1>
    <p style="color: var(--color-text); font-size: 1.05rem; margin-bottom: 0.35rem; font-weight: 600;">
      Let's set up your first boat
    </p>
    <p style="color: var(--color-text-light); font-size: 1rem; margin-bottom: 1.75rem; line-height: 1.5;">
      Add your boat details to get started. You can always add more later from your fleet home.
    </p>
    <button type="button" class="btn-primary" id="first-boat-onboarding-add" style="display: block; width: 100%; padding: 1rem; font-size: 1.05rem; margin-bottom: 0.75rem;">
      Add My First Boat
    </button>
    <button type="button" class="btn-secondary" id="first-boat-onboarding-skip" style="display: block; width: 100%; padding: 0.85rem; font-size: 1rem; font-weight: 600;">
      Skip for now
    </button>
  `;

  container.appendChild(card);
  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);

  const addBtn = card.querySelector('#first-boat-onboarding-add');
  const skipBtn = card.querySelector('#first-boat-onboarding-skip');

  addBtn?.addEventListener('click', () => {
    requestOpenAddBoatOnHome();
    navigate('/');
  });

  skipBtn?.addEventListener('click', () => {
    setSkipZeroBoatOnboardingThisLoad(true);
    navigate('/');
  });

  return wrapper;
}

async function onMount() {
  try {
    const boats = await getBoats();
    if (boats.length > 0) {
      navigate('/');
    }
  } catch (e) {
    console.warn('[FirstBoatOnboarding] boat check failed:', e?.message || e);
  }
}

export default {
  render,
  onMount
};
