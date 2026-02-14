/**
 * Ship's Log Edit Page - full-page form for add/edit trip.
 * Cancel or Save returns to the Ship's Log list for the boat.
 */

import { navigate } from '../router.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { setSaveButtonLoading } from '../utils/saveButton.js';
import { isBoatArchived, getLogbook, createLogEntry, updateLogEntry } from '../lib/dataService.js';

function render(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  const entryId = params?.entryId || window.routeParams?.entryId;
  const isNew = !entryId || entryId === 'new';

  if (!boatId) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapper;
  }

  const wrapper = document.createElement('div');
  const header = createYachtHeader(isNew ? 'Add Trip' : 'Edit Trip');
  wrapper.appendChild(header);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-log';
  pageContent.appendChild(createBackButton());
  const container = document.createElement('div');
  container.className = 'container';

  container.innerHTML = `
    <div class="card" id="log-form-card">
      <h3>${isNew ? 'Add Trip' : 'Edit Trip'}</h3>
      <p class="text-muted">${isNew ? 'Record a trip for this boat.' : 'Update trip details below.'}</p>
      <form id="log-form">
        <div class="form-group">
          <label for="log_date">Date *</label>
          <input type="date" id="log_date" required>
        </div>
        <div class="form-group">
          <label for="log_departure">Departure Location</label>
          <input type="text" id="log_departure" placeholder="e.g. Marina">
        </div>
        <div class="form-group">
          <label for="log_arrival">Arrival Location</label>
          <input type="text" id="log_arrival" placeholder="e.g. Harbour">
        </div>
        <div class="form-group">
          <label for="log_hours_start">Engine Hours (Start)</label>
          <input type="number" id="log_hours_start" step="0.1" placeholder="Hours">
        </div>
        <div class="form-group">
          <label for="log_hours_end">Engine Hours (End)</label>
          <input type="number" id="log_hours_end" step="0.1" placeholder="Hours">
        </div>
        <div class="form-group">
          <label for="log_distance">Distance (nautical miles)</label>
          <input type="number" id="log_distance" step="0.1" placeholder="nm">
        </div>
        <div class="form-group">
          <label for="log_notes">Notes</label>
          <textarea id="log_notes" rows="4" placeholder="Notes"></textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" id="log-cancel-btn">Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);
  return wrapper;
}

async function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  const entryId = params?.entryId || window.routeParams?.entryId;
  const isNew = !entryId || entryId === 'new';

  if (!boatId) return;

  const archived = await isBoatArchived(boatId);
  if (archived) {
    document.getElementById('log-form')?.querySelectorAll('input, textarea, button').forEach(el => { el.disabled = true; });
  }

  const today = new Date().toISOString().split('T')[0];
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ''; };

  if (!isNew) {
    const entries = await getLogbook(boatId);
    const entry = entries.find((e) => e.id === entryId);
    if (entry) {
      set('log_date', entry.date);
      set('log_departure', entry.departure);
      set('log_arrival', entry.arrival);
      set('log_hours_start', entry.engine_hours_start);
      set('log_hours_end', entry.engine_hours_end);
      set('log_distance', entry.distance_nm);
      set('log_notes', entry.notes);
    }
  } else {
    set('log_date', today);
  }

  document.getElementById('log-cancel-btn')?.addEventListener('click', () => {
    navigate(`/boat/${boatId}/log`);
  });

  document.getElementById('log-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (archived) return;
    const form = e.target;
    setSaveButtonLoading(form, true);
    try {
    const date = document.getElementById('log_date').value;
    const departure = document.getElementById('log_departure').value.trim();
    const arrival = document.getElementById('log_arrival').value.trim();
    const hoursStart = document.getElementById('log_hours_start').value ? parseFloat(document.getElementById('log_hours_start').value) : null;
    const hoursEnd = document.getElementById('log_hours_end').value ? parseFloat(document.getElementById('log_hours_end').value) : null;
    const distanceNm = document.getElementById('log_distance').value ? parseFloat(document.getElementById('log_distance').value) : null;
    const notes = document.getElementById('log_notes').value.trim();

    const notesPayload = { raw: notes };
    if (hoursStart != null || hoursEnd != null) notesPayload.engine_hours_start = hoursStart;
    if (hoursEnd != null) notesPayload.engine_hours_end = hoursEnd;
    if (distanceNm != null) notesPayload.distance_nm = distanceNm;

    const payload = {
      date,
      title: 'Trip',
      from_location: departure,
      to_location: arrival,
      hours: hoursEnd ?? hoursStart,
      notes: (Object.keys(notesPayload).length > 1 || notesPayload.raw) ? JSON.stringify(notesPayload) : null
    };

    if (isNew) {
      await createLogEntry(boatId, payload);
    } else {
      await updateLogEntry(entryId, payload);
    }
    navigate(`/boat/${boatId}/log`);
    } finally {
      setSaveButtonLoading(form, false);
    }
  });
}

export default {
  render,
  onMount
};
