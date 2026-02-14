/**
 * Fuel & Performance Page
 * Fresh fetch from Supabase on every mount/navigation.
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { confirmAction } from '../components/confirmModal.js';
import { setSaveButtonLoading } from '../utils/saveButton.js';
import {
  isBoatArchived,
  getFuelPerformance,
  getFuelLogs,
  upsertFuelPerformance,
  createFuelLog,
  updateFuelLog,
  deleteFuelLog
} from '../lib/dataService.js';

let currentBoatId = null;
let fuelArchived = false;
let editingLogId = null;

function render(params = {}) {
  currentBoatId = params?.id || window.routeParams?.id;
  if (!currentBoatId) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapper;
  }

  const wrapper = document.createElement('div');
  const header = createYachtHeader('Fuel & Performance');
  wrapper.appendChild(header);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-fuel';
  pageContent.appendChild(createBackButton());

  const container = document.createElement('div');
  container.className = 'container';

  container.innerHTML = `
    <div class="card" id="fuel-performance-card">
      <h3>Performance / Tank</h3>
      <p class="text-muted">Set your typical cruise and tank capacity (optional).</p>
      <form id="fuel-performance-form">
        <div class="form-group">
          <label for="fuel_preferred_units">Preferred units</label>
          <select id="fuel_preferred_units">
            <option value="litres">Litres</option>
            <option value="us_gallons">US Gallons</option>
            <option value="uk_gallons">UK Gallons</option>
          </select>
        </div>
        <div class="form-group">
          <label for="fuel_typical_cruise_rpm">Typical cruise RPM</label>
          <input type="number" id="fuel_typical_cruise_rpm" min="0" step="1" placeholder="e.g. 2800">
        </div>
        <div class="form-group">
          <label for="fuel_typical_cruise_speed_kn">Typical cruise speed (kn)</label>
          <input type="number" id="fuel_typical_cruise_speed_kn" min="0" step="0.1" placeholder="e.g. 6.5">
        </div>
        <div class="form-group">
          <label for="fuel_typical_burn_lph">Typical burn (L/h)</label>
          <input type="number" id="fuel_typical_burn_lph" min="0" step="0.1" placeholder="e.g. 3.2">
        </div>
        <div class="form-group">
          <label for="fuel_tank_capacity_litres">Fuel tank capacity (L)</label>
          <input type="number" id="fuel_tank_capacity_litres" min="0" step="0.1" placeholder="e.g. 200">
        </div>
        <div class="form-group">
          <label for="fuel_usable_litres">Usable fuel (L)</label>
          <input type="number" id="fuel_usable_litres" min="0" step="0.1" placeholder="e.g. 190">
        </div>
        <div class="form-group">
          <label for="fuel_perf_notes">Notes</label>
          <textarea id="fuel_perf_notes" rows="2"></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary" id="fuel-perf-save-btn">Save</button>
        </div>
      </form>
    </div>

    <div class="card" id="fuel-log-card">
      <h3>Fuel Log</h3>
      <div id="fuel-log-form-wrap" style="display: none;">
        <form id="fuel-log-form">
          <div class="form-group">
            <label for="fuel_log_date">Date *</label>
            <input type="date" id="fuel_log_date" required>
          </div>
          <div class="form-group">
            <label for="fuel_engine_hours">Engine hours</label>
            <input type="number" id="fuel_engine_hours" min="0" step="0.1">
          </div>
          <div class="form-group">
            <label for="fuel_added_litres">Fuel added (L)</label>
            <input type="number" id="fuel_added_litres" min="0" step="0.1">
          </div>
          <div class="form-group">
            <label for="fuel_cost">Fuel cost</label>
            <input type="number" id="fuel_cost" min="0" step="0.01">
          </div>
          <div class="form-group">
            <label for="fuel_distance_nm">Distance (NM)</label>
            <input type="number" id="fuel_distance_nm" min="0" step="0.1">
          </div>
          <div class="form-group">
            <label for="fuel_avg_speed_kn">Avg speed (kn)</label>
            <input type="number" id="fuel_avg_speed_kn" min="0" step="0.1">
          </div>
          <div class="form-group">
            <label for="fuel_log_notes">Notes</label>
            <textarea id="fuel_log_notes" rows="2"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" id="fuel-log-cancel-btn">Cancel</button>
            <button type="submit" class="btn-primary">Save entry</button>
          </div>
        </form>
      </div>
      <div id="fuel-log-add-wrap">
        <button type="button" class="btn-primary" id="fuel-log-add-btn">${renderIcon('plus')} Add entry</button>
      </div>
      <div id="fuel-log-list"></div>
    </div>
  `;

  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);
  return wrapper;
}

async function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  if (boatId) currentBoatId = boatId;

  fuelArchived = currentBoatId ? await isBoatArchived(currentBoatId) : false;
  const addBtn = document.getElementById('fuel-log-add-btn');
  const perfSaveBtn = document.getElementById('fuel-perf-save-btn');
  if (fuelArchived && addBtn) addBtn.style.display = 'none';
  if (fuelArchived && perfSaveBtn) perfSaveBtn.style.display = 'none';

  // Fresh fetch on every enter (no cached state)
  await loadFuelPerformance();
  await loadFuelLogs();

  const perfForm = document.getElementById('fuel-performance-form');
  if (perfForm) {
    perfForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveFuelPerformance();
    });
  }

  const logForm = document.getElementById('fuel-log-form');
  const logFormWrap = document.getElementById('fuel-log-form-wrap');
  const logAddBtn = document.getElementById('fuel-log-add-btn');
  const logCancelBtn = document.getElementById('fuel-log-cancel-btn');

  if (logAddBtn) {
    logAddBtn.addEventListener('click', () => {
      editingLogId = null;
      if (logForm) {
        logForm.reset();
        document.getElementById('fuel_log_date').value = new Date().toISOString().split('T')[0];
      }
      if (logFormWrap) logFormWrap.style.display = 'block';
      if (logAddBtn) logAddBtn.style.display = 'none';
    });
  }
  if (logCancelBtn) {
    logCancelBtn.addEventListener('click', () => {
      editingLogId = null;
      if (logFormWrap) logFormWrap.style.display = 'none';
      if (logAddBtn) logAddBtn.style.display = fuelArchived ? 'none' : 'block';
    });
  }
  if (logForm) {
    logForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveFuelLogEntry();
    });
  }

  window.navigate = navigate;
}

async function loadFuelPerformance() {
  if (!currentBoatId) return;
  const perf = await getFuelPerformance(currentBoatId);
  const preferredUnits = document.getElementById('fuel_preferred_units');
  const typicalRpm = document.getElementById('fuel_typical_cruise_rpm');
  const typicalSpeed = document.getElementById('fuel_typical_cruise_speed_kn');
  const typicalBurn = document.getElementById('fuel_typical_burn_lph');
  const tankCap = document.getElementById('fuel_tank_capacity_litres');
  const usable = document.getElementById('fuel_usable_litres');
  const notes = document.getElementById('fuel_perf_notes');
  if (preferredUnits) preferredUnits.value = perf?.preferred_units || 'litres';
  if (typicalRpm) typicalRpm.value = perf?.typical_cruise_rpm ?? '';
  if (typicalSpeed) typicalSpeed.value = perf?.typical_cruise_speed_kn ?? '';
  if (typicalBurn) typicalBurn.value = perf?.typical_burn_lph ?? '';
  if (tankCap) tankCap.value = perf?.fuel_tank_capacity_litres ?? '';
  if (usable) usable.value = perf?.usable_fuel_litres ?? '';
  if (notes) notes.value = perf?.notes || '';
}

async function saveFuelPerformance() {
  if (!currentBoatId) return;
  const form = document.getElementById('fuel-performance-form');
  setSaveButtonLoading(form, true);
  try {
  const payload = {
    preferred_units: document.getElementById('fuel_preferred_units')?.value || 'litres',
    typical_cruise_rpm: document.getElementById('fuel_typical_cruise_rpm')?.value ? parseInt(document.getElementById('fuel_typical_cruise_rpm').value, 10) : null,
    typical_cruise_speed_kn: document.getElementById('fuel_typical_cruise_speed_kn')?.value ? parseFloat(document.getElementById('fuel_typical_cruise_speed_kn').value) : null,
    typical_burn_lph: document.getElementById('fuel_typical_burn_lph')?.value ? parseFloat(document.getElementById('fuel_typical_burn_lph').value) : null,
    fuel_tank_capacity_litres: document.getElementById('fuel_tank_capacity_litres')?.value ? parseFloat(document.getElementById('fuel_tank_capacity_litres').value) : null,
    usable_fuel_litres: document.getElementById('fuel_usable_litres')?.value ? parseFloat(document.getElementById('fuel_usable_litres').value) : null,
    notes: document.getElementById('fuel_perf_notes')?.value || null
  };
  await upsertFuelPerformance(currentBoatId, payload);
  await loadFuelPerformance();
  showToast('Performance settings saved.', 'success');
  } finally {
    setSaveButtonLoading(form, false);
  }
}

function openEditLog(log) {
  editingLogId = log.id;
  document.getElementById('fuel_log_date').value = log.log_date || '';
  document.getElementById('fuel_engine_hours').value = log.engine_hours ?? '';
  document.getElementById('fuel_added_litres').value = log.fuel_added_litres ?? '';
  document.getElementById('fuel_cost').value = log.fuel_cost ?? '';
  document.getElementById('fuel_distance_nm').value = log.distance_nm ?? '';
  document.getElementById('fuel_avg_speed_kn').value = log.avg_speed_kn ?? '';
  document.getElementById('fuel_log_notes').value = log.notes || '';
  const wrap = document.getElementById('fuel-log-form-wrap');
  const addBtn = document.getElementById('fuel-log-add-btn');
  if (wrap) wrap.style.display = 'block';
  if (addBtn) addBtn.style.display = 'none';
}

async function saveFuelLogEntry() {
  const form = document.getElementById('fuel-log-form');
  setSaveButtonLoading(form, true);
  const dateEl = document.getElementById('fuel_log_date');
  if (!dateEl?.value?.trim()) {
    showToast('Date is required.', 'error');
    setSaveButtonLoading(form, false);
    return;
  }
  try {
  const payload = {
    log_date: dateEl.value,
    engine_hours: document.getElementById('fuel_engine_hours')?.value ? parseFloat(document.getElementById('fuel_engine_hours').value) : null,
    fuel_added_litres: document.getElementById('fuel_added_litres')?.value ? parseFloat(document.getElementById('fuel_added_litres').value) : null,
    fuel_cost: document.getElementById('fuel_cost')?.value ? parseFloat(document.getElementById('fuel_cost').value) : null,
    distance_nm: document.getElementById('fuel_distance_nm')?.value ? parseFloat(document.getElementById('fuel_distance_nm').value) : null,
    avg_speed_kn: document.getElementById('fuel_avg_speed_kn')?.value ? parseFloat(document.getElementById('fuel_avg_speed_kn').value) : null,
    notes: document.getElementById('fuel_log_notes')?.value || null
  };
  if (editingLogId) {
    await updateFuelLog(editingLogId, payload);
  } else {
    await createFuelLog(currentBoatId, payload);
  }
  editingLogId = null;
  document.getElementById('fuel-log-form-wrap').style.display = 'none';
  document.getElementById('fuel-log-add-btn').style.display = fuelArchived ? 'none' : 'block';
  await loadFuelLogs();
  } finally {
    setSaveButtonLoading(form, false);
  }
}

async function loadFuelLogs() {
  const listEl = document.getElementById('fuel-log-list');
  if (!listEl || !currentBoatId) return;

  const logs = await getFuelLogs(currentBoatId);

  if (logs.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${renderIcon('fuel')}</div>
        <p>No fuel log entries yet</p>
        ${!fuelArchived ? `<div class="empty-state-actions"><button type="button" class="btn-primary" onclick="event.preventDefault(); document.getElementById('fuel-log-add-btn')?.click()">${renderIcon('plus')} Add Log Entry</button></div>` : ''}
      </div>
    `;
    attachLogHandlers();
    return;
  }

  listEl.innerHTML = logs.map((log) => {
    const pricePerLitre = log.fuel_price_per_litre != null ? Number(log.fuel_price_per_litre).toFixed(3) : '—';
    const litresPerNm = (log.fuel_added_litres > 0 && log.distance_nm > 0)
      ? (log.fuel_added_litres / log.distance_nm).toFixed(2) + ' L/NM'
      : '';
    return `
      <div class="card fuel-log-item" data-log-id="${log.id}">
        <div class="card-header">
          <div>
            <h3 class="card-title">${new Date(log.log_date).toLocaleDateString()}</h3>
            <p class="text-muted">
              ${log.engine_hours != null ? log.engine_hours + ' h' : ''}
              ${log.fuel_added_litres != null ? ' • ' + log.fuel_added_litres + ' L' : ''}
              ${log.fuel_cost != null ? ' • £' + Number(log.fuel_cost).toFixed(2) : ''}
              ${pricePerLitre !== '—' ? ' • ' + pricePerLitre + ' £/L' : ''}
              ${litresPerNm ? ' • ' + litresPerNm : ''}
            </p>
          </div>
          <div>
            ${!fuelArchived ? `
              <a href="#" class="btn-link fuel-log-edit-btn" data-log-id="${log.id}">${renderIcon('edit')}</a>
              <button type="button" class="btn-link btn-danger fuel-log-delete-btn" data-log-id="${log.id}">${renderIcon('trash')}</button>
            ` : ''}
          </div>
        </div>
        ${log.notes ? `<p><strong>Notes:</strong> ${log.notes}</p>` : ''}
      </div>
    `;
  }).join('');

  attachLogHandlers();
}

function attachLogHandlers() {
  const editBtns = document.querySelectorAll('.fuel-log-edit-btn');
  const deleteBtns = document.querySelectorAll('.fuel-log-delete-btn');
  editBtns.forEach((btn) => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });
  deleteBtns.forEach((btn) => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });

  document.querySelectorAll('.fuel-log-edit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const logId = btn.dataset.logId;
      getFuelLogs(currentBoatId).then((logsFull) => {
        const found = logsFull.find((l) => l.id === logId);
        if (found) openEditLog(found);
      });
    });
  });

  document.querySelectorAll('.fuel-log-delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmAction({
        title: 'Delete this fuel log entry?',
        message: 'This cannot be undone.',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        danger: true
      });
      if (!ok) return;
      await deleteFuelLog(btn.dataset.logId);
      await loadFuelLogs();
      showToast('Fuel log entry removed', 'info');
    });
  });
}

export default {
  render,
  onMount
};
