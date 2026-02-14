/**
 * Watermaker Page
 * Boat-level unit details + multiple service entries.
 * Next service due is added to the calendar with a 1-day reminder.
 * Only shown when "Watermaker installed" is enabled in Boat Details.
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { confirmAction } from '../components/confirmModal.js';
import { setSaveButtonLoading } from '../utils/saveButton.js';
import {
  getBoat,
  updateBoat,
  isBoatArchived,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent
} from '../lib/dataService.js';
import { boatsStorage } from '../lib/storage.js';

const REMINDER_ONE_DAY_MINUTES = 1440;

let currentBoatId = null;
let currentBoat = null;

function normalizeWatermakerData(raw) {
  const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const unit = {
    make_model: data.unit?.make_model ?? data.wm_make_model ?? '',
    location: data.unit?.location ?? data.wm_location ?? '',
    capacity: data.unit?.capacity ?? data.wm_capacity ?? '',
    serial_number: data.unit?.serial_number ?? data.wm_serial_number ?? ''
  };
  let services = Array.isArray(data.services) ? data.services : [];
  // Migrate legacy single "service" into first entry
  if (services.length === 0 && (data.wm_last_service_date || data.wm_notes || data.wm_task_pre_filters_changed)) {
    services = [{
      id: `wm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date: data.wm_last_service_date || new Date().toISOString().split('T')[0],
      task_pre_filters: !!data.wm_task_pre_filters_changed,
      task_carbon_filter: !!data.wm_task_carbon_filter_changed,
      task_membrane_flushed: !!data.wm_task_membrane_flushed,
      task_pump_oil_checked: !!data.wm_task_pump_oil_checked,
      notes: data.wm_notes ?? '',
      hours_since_service: data.wm_hours_since_service ?? '',
      next_service_due: data.wm_next_service_due || '',
      calendar_event_id: data.wm_calendar_event_id || null
    }];
  }
  services.forEach(s => {
    if (!s.id) s.id = `wm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  });
  const next_service_due = data.next_service_due || (services.length ? (services.find(s => s.next_service_due)?.next_service_due) : null) || null;
  return { unit, services, next_service_due };
}

function getWatermakerData(boat) {
  return normalizeWatermakerData(boat?.watermaker_data);
}

function render(params = {}) {
  currentBoatId = params?.id || window.routeParams?.id;
  const entryId = params?.entryId || window.routeParams?.entryId;
  const isEditPage = !!entryId;

  if (!currentBoatId) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapper;
  }

  currentBoat = boatsStorage.get(currentBoatId);

  const wrapper = document.createElement('div');
  const header = createYachtHeader(isEditPage ? (entryId === 'new' ? 'Add watermaker service' : 'Edit watermaker service') : 'Watermaker Service');
  wrapper.appendChild(header);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-watermaker';
  pageContent.appendChild(createBackButton());

  const container = document.createElement('div');
  container.className = 'container';
  container.id = 'watermaker-container';

  if (isEditPage) {
    container.innerHTML = '<div id="watermaker-form-wrap"></div>';
  } else {
    container.innerHTML = `
      <div id="watermaker-unit-card" class="card"></div>
      <div class="page-actions" style="margin-top: 1rem;">
        <button type="button" class="btn-primary" id="watermaker-add-btn">${renderIcon('plus')} Add service</button>
      </div>
      <div id="watermaker-list"></div>
    `;
  }

  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);
  return wrapper;
}

function renderUnitCard(unit, archived) {
  const wrap = document.getElementById('watermaker-unit-card');
  if (!wrap) return;
  const editBtn = archived ? '' : `<button type="button" class="btn-link" id="watermaker-edit-unit-btn">Edit</button>`;
  wrap.innerHTML = `
    <div class="card-header">
      <h3>Watermaker details</h3>
      <div>${editBtn}</div>
    </div>
    <div id="watermaker-unit-display">
      <p><strong>Make &amp; model:</strong> ${(unit.make_model || '—')}</p>
      <p><strong>Location:</strong> ${(unit.location || '—')}</p>
      <p><strong>Rated output:</strong> ${(unit.capacity || '—')}</p>
      <p><strong>Serial number:</strong> ${(unit.serial_number || '—')}</p>
    </div>
    <div id="watermaker-unit-form" style="display: none;">
      <div class="form-group">
        <label for="wm_unit_make_model">Make &amp; model</label>
        <input id="wm_unit_make_model" type="text" value="${(unit.make_model || '').replace(/"/g, '&quot;')}">
      </div>
      <div class="form-group">
        <label for="wm_unit_location">Location on board</label>
        <input id="wm_unit_location" type="text" value="${(unit.location || '').replace(/"/g, '&quot;')}">
      </div>
      <div class="form-group">
        <label for="wm_unit_capacity">Rated output</label>
        <input id="wm_unit_capacity" type="text" value="${(unit.capacity || '').replace(/"/g, '&quot;')}">
      </div>
      <div class="form-group">
        <label for="wm_unit_serial">Serial number</label>
        <input id="wm_unit_serial" type="text" value="${(unit.serial_number || '').replace(/"/g, '&quot;')}">
      </div>
      <button type="button" class="btn-secondary" id="watermaker-unit-save-btn">Save</button>
      <button type="button" class="btn-link" id="watermaker-unit-cancel-btn">Cancel</button>
    </div>
  `;
  const editBtnEl = document.getElementById('watermaker-edit-unit-btn');
  if (editBtnEl) {
    editBtnEl.addEventListener('click', () => {
      document.getElementById('watermaker-unit-display').style.display = 'none';
      document.getElementById('watermaker-unit-form').style.display = 'block';
    });
  }
  const cancelBtn = document.getElementById('watermaker-unit-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      document.getElementById('watermaker-unit-display').style.display = 'block';
      document.getElementById('watermaker-unit-form').style.display = 'none';
    });
  }
  const saveBtn = document.getElementById('watermaker-unit-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => saveUnitDetails());
  }
}

async function saveUnitDetails() {
  const boat = boatsStorage.get(currentBoatId) || { id: currentBoatId };
  const wm = getWatermakerData(boat);
  wm.unit = {
    make_model: document.getElementById('wm_unit_make_model')?.value?.trim() ?? '',
    location: document.getElementById('wm_unit_location')?.value?.trim() ?? '',
    capacity: document.getElementById('wm_unit_capacity')?.value?.trim() ?? '',
    serial_number: document.getElementById('wm_unit_serial')?.value?.trim() ?? ''
  };
  boat.watermaker_data = { unit: wm.unit, services: wm.services, next_service_due: wm.next_service_due };
  boat.watermaker_installed = true;
  boatsStorage.save(boat);
  await updateBoat(currentBoatId, { watermaker_data: boat.watermaker_data, watermaker_installed: true });
  document.getElementById('watermaker-unit-display').style.display = 'block';
  document.getElementById('watermaker-unit-form').style.display = 'none';
  renderUnitCard(wm.unit, false);
}

function renderServiceList(services, boatId, archived) {
  const listEl = document.getElementById('watermaker-list');
  if (!listEl) return;

  if (!services.length) {
    const addBtn = archived ? '' : `<div class="empty-state-actions"><button type="button" class="btn-primary" onclick="event.preventDefault(); window.navigate('/boat/${boatId}/watermaker/new')">${renderIcon('plus')} Add Service Entry</button></div>`;
    listEl.innerHTML = `<div class="empty-state"><p>No service entries yet.</p>${addBtn}</div>`;
    return;
  }

  const sorted = [...services].sort((a, b) => new Date(b.date) - new Date(a.date));
  listEl.innerHTML = sorted.map(s => {
    const tasks = [];
    if (s.task_pre_filters) tasks.push('Pre-filters');
    if (s.task_carbon_filter) tasks.push('Carbon filter');
    if (s.task_membrane_flushed) tasks.push('Membrane flush');
    if (s.task_pump_oil_checked) tasks.push('Pump oil');
    const taskStr = tasks.length ? tasks.join(', ') : '—';
    const notesSnippet = (s.notes || '').slice(0, 80);
    const nextDue = s.next_service_due ? `<p class="text-muted"><strong>Next service due:</strong> ${new Date(s.next_service_due).toLocaleDateString()}</p>` : '';
    const actions = archived ? '' : `
      <a href="#/boat/${boatId}/watermaker/${s.id}" class="btn-link">${renderIcon('edit')}</a>
      <button type="button" class="btn-link btn-danger" data-delete-id="${s.id}">${renderIcon('trash')}</button>
    `;
    return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">${new Date(s.date).toLocaleDateString()}</h3>
            <p class="text-muted">${taskStr}</p>
            ${s.hours_since_service ? `<p class="text-muted">Hours since service: ${s.hours_since_service}</p>` : ''}
            ${nextDue}
            ${notesSnippet ? `<p>${notesSnippet}${(s.notes || '').length > 80 ? '…' : ''}</p>` : ''}
          </div>
          <div>${actions}</div>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', () => deleteService(btn.dataset.deleteId));
  });
}

function buildFormHtml(entry, unit) {
  return `
    <div class="card" id="watermaker-form-card">
      <form id="watermaker-form">
        <div class="form-group">
          <label for="wm_date">Service date *</label>
          <input id="wm_date" name="wm_date" type="date" required value="${entry?.date || new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label for="wm_hours_since_service">Hours run since last service</label>
          <input id="wm_hours_since_service" name="wm_hours_since_service" type="number" step="0.1" value="${entry?.hours_since_service ?? ''}">
        </div>
        <div class="form-group">
          <label>Tasks completed</label>
          <label class="checkbox-row">
            <input type="checkbox" id="wm_task_pre_filters" name="wm_task_pre_filters" ${entry?.task_pre_filters ? 'checked' : ''}>
            <span>Pre‑filters changed</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" id="wm_task_carbon_filter" name="wm_task_carbon_filter" ${entry?.task_carbon_filter ? 'checked' : ''}>
            <span>Carbon / post‑filter changed</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" id="wm_task_membrane_flushed" name="wm_task_membrane_flushed" ${entry?.task_membrane_flushed ? 'checked' : ''}>
            <span>Membrane flushed / pickled</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" id="wm_task_pump_oil_checked" name="wm_task_pump_oil_checked" ${entry?.task_pump_oil_checked ? 'checked' : ''}>
            <span>High‑pressure pump oil checked / changed</span>
          </label>
        </div>
        <div class="form-group">
          <label for="wm_notes">Notes</label>
          <textarea id="wm_notes" name="wm_notes" rows="4" placeholder="Parts used, pressures, TDS, winterisation...">${entry?.notes ?? ''}</textarea>
        </div>
        <div class="form-group">
          <label for="wm_next_service_due">Next service due date</label>
          <input id="wm_next_service_due" name="wm_next_service_due" type="date" value="${entry?.next_service_due || ''}">
          <p class="text-muted" style="margin-top: 0.25rem; font-size: 0.875rem;">A calendar reminder will be added for 1 day before this date.</p>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" id="wm-cancel-btn">Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;
}

async function deleteService(serviceId) {
  const ok = await confirmAction({
    title: 'Delete this service entry?',
    message: 'Any linked calendar reminder will be removed.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    danger: true
  });
  if (!ok) return;
  const boat = boatsStorage.get(currentBoatId) || { id: currentBoatId };
  const wm = getWatermakerData(boat);
  const entry = wm.services.find(s => s.id === serviceId);
  if (entry?.calendar_event_id) {
    await deleteCalendarEvent(entry.calendar_event_id);
  }
  wm.services = wm.services.filter(s => s.id !== serviceId);
  wm.next_service_due = wm.services.find(s => s.next_service_due)?.next_service_due || null;
  boat.watermaker_data = { unit: wm.unit, services: wm.services, next_service_due: wm.next_service_due };
  boat.watermaker_installed = true;
  boatsStorage.save(boat);
  await updateBoat(currentBoatId, { watermaker_data: boat.watermaker_data, watermaker_installed: true });
  renderUnitCard(wm.unit, false);
  renderServiceList(wm.services, currentBoatId, false);
}

async function saveWatermakerForm(entryId, isNew) {
  const form = document.getElementById('watermaker-form');
  setSaveButtonLoading(form, true);
  const date = document.getElementById('wm_date')?.value;
  if (!date) {
    showToast('Please enter the service date.', 'error');
    setSaveButtonLoading(form, false);
    return;
  }
  try {
  const next_service_due = document.getElementById('wm_next_service_due')?.value || null;

  const boat = boatsStorage.get(currentBoatId) || { id: currentBoatId };
  const wm = getWatermakerData(boat);

  let calendar_event_id = null;
  const existingEntry = wm.services.find(s => s.id === entryId);

  if (next_service_due) {
    const title = 'Watermaker service due';
    const notes = 'Scheduled from Watermaker Service';
    if (existingEntry?.calendar_event_id) {
      await updateCalendarEvent(existingEntry.calendar_event_id, {
        date: next_service_due,
        title,
        notes,
        reminder_minutes: REMINDER_ONE_DAY_MINUTES
      });
      calendar_event_id = existingEntry.calendar_event_id;
    } else {
      const created = await createCalendarEvent(currentBoatId, {
        date: next_service_due,
        title,
        notes,
        reminder_minutes: REMINDER_ONE_DAY_MINUTES
      });
      calendar_event_id = created?.id || null;
    }
  } else if (existingEntry?.calendar_event_id) {
    await deleteCalendarEvent(existingEntry.calendar_event_id);
  }

  const entry = {
    id: isNew ? `wm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : entryId,
    date,
    hours_since_service: document.getElementById('wm_hours_since_service')?.value ?? '',
    task_pre_filters: !!document.getElementById('wm_task_pre_filters')?.checked,
    task_carbon_filter: !!document.getElementById('wm_task_carbon_filter')?.checked,
    task_membrane_flushed: !!document.getElementById('wm_task_membrane_flushed')?.checked,
    task_pump_oil_checked: !!document.getElementById('wm_task_pump_oil_checked')?.checked,
    notes: document.getElementById('wm_notes')?.value?.trim() ?? '',
    next_service_due: next_service_due || null,
    calendar_event_id
  };

  if (isNew) {
    wm.services.push(entry);
  } else {
    const idx = wm.services.findIndex(s => s.id === entryId);
    if (idx >= 0) wm.services[idx] = entry;
    else wm.services.push(entry);
  }
  wm.next_service_due = wm.services.reduce((next, s) => (s.next_service_due && (!next || new Date(s.next_service_due) > new Date(next)) ? s.next_service_due : next), null);

  boat.watermaker_data = { unit: wm.unit, services: wm.services, next_service_due: wm.next_service_due };
  boat.watermaker_installed = true;
  boatsStorage.save(boat);
  await updateBoat(currentBoatId, { watermaker_data: boat.watermaker_data, watermaker_installed: true });

  showToast('Watermaker service saved.' + (next_service_due ? ' A reminder was added to the calendar (1 day before).' : ''), 'success');
  navigate(`/boat/${currentBoatId}/watermaker`);
  } finally {
    setSaveButtonLoading(form, false);
  }
}

async function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  const entryId = params?.entryId || window.routeParams?.entryId;
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
      console.error('Error loading boat for watermaker:', e);
      currentBoat = boatsStorage.get(boatId);
    }
  }

  const archived = currentBoatId ? await isBoatArchived(currentBoatId) : false;
  const wm = getWatermakerData(currentBoat);

  if (entryId) {
    const wrap = document.getElementById('watermaker-form-wrap');
    if (wrap) {
      const entry = entryId === 'new' ? null : wm.services.find(s => s.id === entryId);
      wrap.innerHTML = buildFormHtml(entry, wm.unit);

      const form = document.getElementById('watermaker-form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          saveWatermakerForm(entryId === 'new' ? null : entryId, entryId === 'new');
        });
      }
      const cancelBtn = document.getElementById('wm-cancel-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => navigate(`/boat/${currentBoatId}/watermaker`));
      }
      if (archived) {
        wrap.querySelectorAll('input, textarea, button[type="submit"]').forEach(el => { el.disabled = true; });
        const cancelBtn = document.getElementById('wm-cancel-btn');
        if (cancelBtn) cancelBtn.style.display = 'none';
      }
    }
    return;
  }

  renderUnitCard(wm.unit, archived);
  const addBtn = document.getElementById('watermaker-add-btn');
  if (addBtn) {
    addBtn.onclick = () => navigate(`/boat/${currentBoatId}/watermaker/new`);
    if (archived) addBtn.style.display = 'none';
  }
  renderServiceList(wm.services, currentBoatId, archived);
}

export default {
  render,
  onMount
};
