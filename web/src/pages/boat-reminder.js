/**
 * Free tier: view the single maintenance reminder from the boat's service entry (next due).
 * Premium users are redirected to the full Calendar.
 */

import { navigate } from '../router.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { getServiceEntries } from '../lib/dataService.js';
import { hasActiveSubscription } from '../lib/subscription.js';
import { serviceHistoryStorage } from '../lib/storage.js';

function reminderLeadLabel(minutes) {
  const m = Number(minutes);
  if (!m) return '';
  if (m === 5) return '5 minutes before';
  if (m === 15) return '15 minutes before';
  if (m === 30) return '30 minutes before';
  if (m === 60) return '1 hour before';
  if (m === 120) return '2 hours before';
  if (m === 1440) return '1 day before';
  if (m === 2880) return '2 days before';
  if (m === 10080) return '1 week before';
  return `${m} minutes before`;
}

function render(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  const wrapper = document.createElement('div');
  if (!boatId) {
    wrapper.innerHTML = '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapper;
  }

  const header = createYachtHeader('Your reminder');
  wrapper.appendChild(header);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-calendar';
  pageContent.appendChild(createBackButton(`/boat/${boatId}`));

  const container = document.createElement('div');
  container.className = 'container';
  container.id = 'boat-reminder-root';
  container.dataset.boatId = boatId;
  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);
  return wrapper;
}

async function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id || document.getElementById('boat-reminder-root')?.dataset?.boatId;
  if (!boatId) return;

  if (hasActiveSubscription()) {
    navigate('/calendar');
    return;
  }

  const root = document.getElementById('boat-reminder-root');
  if (!root) return;

  await getServiceEntries(boatId);
  const services = serviceHistoryStorage.getAll(boatId);
  const withDue = services.filter((s) => s.next_service_due);

  if (withDue.length === 0) {
    root.innerHTML = `
      <div class="card">
        <p class="text-muted">You do not have a next service due date set yet.</p>
        <p style="margin-top: 0.75rem;"><a href="#/boat/${boatId}/service" class="btn-link">Open Service History</a></p>
        <p class="text-muted" style="margin-top: 1rem; font-size: 0.9rem;">The full Calendar &amp; Alerts module is included with Premium.</p>
      </div>
    `;
    return;
  }

  const s = withDue[0];
  const dueStr = new Date(s.next_service_due + 'T12:00:00').toLocaleDateString();
  const lead = s.next_service_reminder_minutes ? reminderLeadLabel(s.next_service_reminder_minutes) : '';
  const title = (s.service_type || s.title || 'Service').replace(/</g, '&lt;');

  root.innerHTML = `
    <div class="card">
      <h3 class="card-title">Linked to your service entry</h3>
      <p><strong>${title}</strong></p>
      <p><strong>Due:</strong> ${dueStr}</p>
      ${lead ? `<p class="text-muted"><strong>Reminder:</strong> ${lead}</p>` : '<p class="text-muted">No lead time selected — you will still see this due date in Service History.</p>'}
      <p class="text-muted" style="margin-top: 1rem; font-size: 0.9rem;">
        This is the only calendar-style reminder on the free plan. Upgrade for a full calendar, more services, and more reminders.
      </p>
      <div style="margin-top: 1rem;">
        <a href="#/boat/${boatId}/service/${s.id}" class="btn-secondary">Edit service entry</a>
      </div>
    </div>
  `;
}

export default { render, onMount };
