/**
 * Sails & Rigging Page (sailing boats only)
 * Single form to record sails and rigging details for the boat.
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { getBoat, updateBoat, isBoatArchived } from '../lib/dataService.js';
import { boatsStorage } from '../lib/storage.js';

let currentBoatId = null;
let currentBoat = null;

function getSailsData(boat) {
  const raw = boat?.sails_rigging_data;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  return {};
}

function render(params = {}) {
  currentBoatId = params?.id || window.routeParams?.id;
  if (!currentBoatId) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapper;
  }

  currentBoat = boatsStorage.get(currentBoatId);

  const wrapper = document.createElement('div');
  const header = createYachtHeader('Sails & Rigging');
  wrapper.appendChild(header);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-sails-rigging';
  pageContent.appendChild(createBackButton());

  const container = document.createElement('div');
  container.className = 'container';

  const form = document.createElement('form');
  form.className = 'form-container';
  form.id = 'sails-rigging-form';
  form.innerHTML = `
    <div class="form-group">
      <label for="mainsail_details">Mainsail</label>
      <textarea id="mainsail_details" name="mainsail_details" rows="3" placeholder="Make, size, condition, reefing, battens, sail cover..."></textarea>
    </div>
    <div class="form-group">
      <label for="headsails_details">Headsails (genoa, jib, etc.)</label>
      <textarea id="headsails_details" name="headsails_details" rows="3" placeholder="List headsails, sizes, condition..."></textarea>
    </div>
    <div class="form-group">
      <label for="mast_spar_notes">Mast & spar</label>
      <textarea id="mast_spar_notes" name="mast_spar_notes" rows="2" placeholder="Mast, boom, spreaders, fittings..."></textarea>
    </div>
    <div class="form-group">
      <label for="standing_rigging_notes">Standing rigging</label>
      <textarea id="standing_rigging_notes" name="standing_rigging_notes" rows="2" placeholder="Shrouds, forestay, backstay, terminals, turnbuckles..."></textarea>
    </div>
    <div class="form-group">
      <label for="running_rigging_notes">Running rigging</label>
      <textarea id="running_rigging_notes" name="running_rigging_notes" rows="2" placeholder="Halyards, sheets, blocks, clutches..."></textarea>
    </div>
    <div class="form-group">
      <label for="winches_notes">Winches</label>
      <textarea id="winches_notes" name="winches_notes" rows="2" placeholder="Winch types, locations, last service..."></textarea>
    </div>
    <div class="form-group">
      <label for="last_inspection_date">Last sails/rigging inspection (date)</label>
      <input type="date" id="last_inspection_date" name="last_inspection_date">
    </div>
    <div class="form-group">
      <label for="sails_rigging_notes">General notes</label>
      <textarea id="sails_rigging_notes" name="sails_rigging_notes" rows="3" placeholder="Other sails & rigging notes..."></textarea>
    </div>
    <div class="form-actions">
      <button type="button" class="btn-secondary" id="sails-cancel-btn">Cancel</button>
      <button type="submit" class="btn-primary">Save</button>
    </div>
  `;

  container.appendChild(form);
  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);

  return wrapper;
}

function populateForm(data) {
  if (!data) return;
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value ?? '';
  };
  set('mainsail_details', data.mainsail_details);
  set('headsails_details', data.headsails_details);
  set('mast_spar_notes', data.mast_spar_notes);
  set('standing_rigging_notes', data.standing_rigging_notes);
  set('running_rigging_notes', data.running_rigging_notes);
  set('winches_notes', data.winches_notes);
  set('last_inspection_date', data.last_inspection_date);
  set('sails_rigging_notes', data.sails_rigging_notes);
}

async function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  if (boatId) {
    currentBoatId = boatId;
    try {
      const remoteBoat = await getBoat(boatId);
      if (remoteBoat) {
        currentBoat = { ...(boatsStorage.get(boatId) || {}), ...remoteBoat };
        boatsStorage.save({ id: boatId, ...currentBoat });
      } else {
        currentBoat = boatsStorage.get(boatId);
      }
    } catch (e) {
      console.error('Error loading boat for sails/rigging:', e);
      currentBoat = boatsStorage.get(boatId);
    }
    populateForm(getSailsData(currentBoat));

    const archived = await isBoatArchived(boatId);
    if (archived) {
      const form = document.getElementById('sails-rigging-form');
      if (form) {
        form.querySelectorAll('input, textarea, button[type="submit"]').forEach((el) => {
          el.disabled = true;
        });
        const cancelBtn = document.getElementById('sails-cancel-btn');
        if (cancelBtn) cancelBtn.style.display = 'none';
      }
    }
  }

  const form = document.getElementById('sails-rigging-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveSailsRigging();
    });
  }

  const cancelBtn = document.getElementById('sails-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => window.history.back());
  }
}

function saveSailsRigging() {
  const data = {
    mainsail_details: document.getElementById('mainsail_details')?.value?.trim() || '',
    headsails_details: document.getElementById('headsails_details')?.value?.trim() || '',
    mast_spar_notes: document.getElementById('mast_spar_notes')?.value?.trim() || '',
    standing_rigging_notes: document.getElementById('standing_rigging_notes')?.value?.trim() || '',
    running_rigging_notes: document.getElementById('running_rigging_notes')?.value?.trim() || '',
    winches_notes: document.getElementById('winches_notes')?.value?.trim() || '',
    last_inspection_date: document.getElementById('last_inspection_date')?.value || '',
    sails_rigging_notes: document.getElementById('sails_rigging_notes')?.value?.trim() || ''
  };

  const boat = boatsStorage.get(currentBoatId) || { id: currentBoatId };
  boat.sails_rigging_data = data;
  boatsStorage.save(boat);

  updateBoat(currentBoatId, { sails_rigging_data: data }).finally(() => {
    alert('Sails & rigging details saved.');
    navigate(`/boat/${currentBoatId}`);
  });
}

export default {
  render,
  onMount
};
