/**
 * Passage Log Edit Page - full-page form for add/edit passage.
 * Supports short trips to multi-day passages (hours up to many days); motor and sail.
 * Cancel or Save returns to the Passage Log list for the boat.
 */

import { navigate } from '../router.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { setSaveButtonLoading } from '../utils/saveButton.js';
import { isBoatArchived, getLogbook, createLogEntry, updateLogEntry } from '../lib/dataService.js';
import { blockFreePlanRecordLimitIfNeeded } from '../lib/premiumSaveGate.js';
import { shipsLogStorage } from '../lib/storage.js';
import { insertPremiumPreviewBanner } from '../components/premiumPreviewBanner.js';

const MAX_DAILY_DAYS = 60;

/** Returns array of date strings YYYY-MM-DD from start to end inclusive. Capped at MAX_DAILY_DAYS. */
function getDateRange(startStr, endStr) {
  if (!startStr || !endStr) return [];
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (end < start) return [];
  const out = [];
  const cur = new Date(start);
  while (cur <= end && out.length < MAX_DAILY_DAYS) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Field keys for one day's structured log. */
const DAILY_LOG_FIELDS = [
  { key: 'noon_position', label: 'Noon position', type: 'text', placeholder: 'e.g. 21°15.2N 42°33.7W' },
  { key: 'distance_run_24h', label: 'Distance run (24h) NM', type: 'number', step: '0.1', min: '0' },
  { key: 'distance_to_nm', label: 'Distance to destination NM', type: 'number', step: '0.1', min: '0' },
  { key: 'average_speed_kts', label: 'Average speed kts', type: 'number', step: '0.1', min: '0' },
  { key: 'wind', label: 'Wind', type: 'text', placeholder: 'e.g. ENE 20–22 kts' },
  { key: 'sea', label: 'Sea', type: 'text', placeholder: 'e.g. Moderate' },
  { key: 'swell', label: 'Swell', type: 'text', placeholder: 'e.g. 2m' },
  { key: 'fuel_pct', label: 'Fuel %', type: 'number', min: '0', max: '100' },
  { key: 'water_pct', label: 'Water %', type: 'number', min: '0', max: '100' },
  { key: 'remarks', label: 'Remarks', type: 'textarea', placeholder: 'Running twin headsails. Good progress. Crew all well.' }
];

function getDayData(existingDailyNotes, dateStr) {
  const raw = existingDailyNotes && existingDailyNotes[dateStr];
  if (raw == null) return {};
  if (typeof raw === 'string') return { remarks: raw };
  return typeof raw === 'object' ? raw : {};
}

function renderDailyNotes(container, startStr, endStr, existingDailyNotes = {}) {
  if (!container) return;
  const dates = getDateRange(startStr, endStr);
  if (dates.length === 0) {
    container.innerHTML = '';
    return;
  }
  const formatDayShort = (d) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const formatDayLong = (d) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  container.innerHTML = dates.map((dateStr, i) => {
    const dayNum = i + 1;
    const dayData = getDayData(existingDailyNotes, dateStr);
    const prefix = `log_day_${dateStr}`;
    const fieldsHtml = DAILY_LOG_FIELDS.map((f) => {
      const id = `${prefix}_${f.key}`;
      const val = dayData[f.key];
      const valueStr = val != null && val !== '' ? String(val) : '';
      if (f.type === 'textarea') {
        return `
          <div class="form-group">
            <label for="${id}">${f.label}</label>
            <textarea id="${id}" data-date="${dateStr}" data-field="${f.key}" rows="3" placeholder="${escapeHtml(f.placeholder || '')}">${escapeHtml(valueStr)}</textarea>
          </div>`;
      }
      const attrs = [`id="${id}"`, `data-date="${dateStr}"`, `data-field="${f.key}"`, `type="${f.type}"`, `value="${escapeHtml(valueStr)}"`];
      if (f.placeholder) attrs.push(`placeholder="${escapeHtml(f.placeholder)}"`);
      if (f.step) attrs.push(`step="${f.step}"`);
      if (f.min !== undefined) attrs.push(`min="${f.min}"`);
      if (f.max !== undefined) attrs.push(`max="${f.max}"`);
      return `
          <div class="form-group">
            <label for="${id}">${f.label}</label>
            <input ${attrs.join(' ')}>
          </div>`;
    }).join('');
    return `
      <details class="log-day-block" data-date="${dateStr}">
        <summary>Day ${dayNum} – ${formatDayShort(dateStr)}</summary>
        <div class="log-day-fields">
          ${fieldsHtml}
        </div>
      </details>`;
  }).join('');
}

function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function engineHoursRowHtml(eng = {}) {
  const label = typeof eng.label === 'string' ? eng.label : '';
  const start = eng.start != null && eng.start !== '' ? String(eng.start) : '';
  const end = eng.end != null && eng.end !== '' ? String(eng.end) : '';
  return `
    <div class="log-engine-hours-row">
      <div class="form-group log-engine-label-group">
        <label>Engine name <span class="text-muted">(optional)</span></label>
        <input type="text" class="log-engine-label" placeholder="e.g. Port, starboard, center" value="${escapeHtml(label)}">
      </div>
      <div class="form-row log-engine-start-end-row">
        <div class="form-group">
          <label>Hours (start)</label>
          <input type="number" class="log-engine-start" step="0.1" min="0" placeholder="h" value="${escapeHtml(start)}">
        </div>
        <div class="form-group">
          <label>Hours (end)</label>
          <input type="number" class="log-engine-end" step="0.1" min="0" placeholder="h" value="${escapeHtml(end)}">
        </div>
        <div class="form-group log-engine-remove-wrap">
          <button type="button" class="btn-secondary log-engine-remove">Remove</button>
        </div>
      </div>
    </div>`;
}

function collectEngineHoursFromForm() {
  const container = document.getElementById('log-engine-hours-rows');
  if (!container) return [];
  const engines = [];
  container.querySelectorAll('.log-engine-hours-row').forEach((row) => {
    const label = row.querySelector('.log-engine-label')?.value?.trim() ?? '';
    const startRaw = row.querySelector('.log-engine-start')?.value?.trim();
    const endRaw = row.querySelector('.log-engine-end')?.value?.trim();
    const start = startRaw ? parseFloat(startRaw) : null;
    const end = endRaw ? parseFloat(endRaw) : null;
    const startOk = start != null && Number.isFinite(start);
    const endOk = end != null && Number.isFinite(end);
    if (startOk || endOk || label) {
      engines.push({ label, start: startOk ? start : null, end: endOk ? end : null });
    }
  });
  return engines;
}

function renderEngineHoursRows(entry) {
  const container = document.getElementById('log-engine-hours-rows');
  if (!container) return;
  let initial = [];
  if (entry && Array.isArray(entry.engine_hours_engines) && entry.engine_hours_engines.length > 0) {
    initial = entry.engine_hours_engines.map((e) => ({
      label: typeof e.label === 'string' ? e.label : '',
      start: e.start != null ? e.start : null,
      end: e.end != null ? e.end : null
    }));
  } else if (entry && (entry.engine_hours_start != null || entry.engine_hours_end != null)) {
    initial = [{ label: '', start: entry.engine_hours_start ?? null, end: entry.engine_hours_end ?? null }];
  } else {
    initial = [{ label: '', start: null, end: null }];
  }
  container.innerHTML = initial.map((eng) => engineHoursRowHtml(eng)).join('');
}

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
  const header = createYachtHeader(isNew ? 'Add Passage' : 'Edit Passage');
  wrapper.appendChild(header);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-log';
  pageContent.appendChild(createBackButton());
  const container = document.createElement('div');
  container.className = 'container';

  container.innerHTML = `
    <div class="card" id="log-form-card">
      <h3>${isNew ? 'Add Passage' : 'Edit Passage'}</h3>
      <p class="text-muted">${isNew ? 'Record a passage from a few hours to many days—coastal hop or ocean crossing. Works for motor and sail.' : 'Update passage details below.'}</p>
      <form id="log-form">
        <div class="form-group">
          <label for="log_title">Passage Title *</label>
          <input type="text" id="log_title" placeholder="e.g. Atlantic crossing, Island hop" required>
        </div>
        <div class="form-group">
          <label for="log_date">Start Date *</label>
          <input type="date" id="log_date" required>
        </div>
        <div class="form-group">
          <label for="log_date_end">End Date</label>
          <input type="date" id="log_date_end">
          <span class="form-hint">Leave blank for same-day or short passages. Set for multi-day to add a note per day.</span>
        </div>
        <div id="log-daily-section" class="log-daily-section" style="display: none;">
          <h4>Daily log</h4>
          <p class="text-muted">Record details for each day of the passage.</p>
          <div id="log-daily-notes-container"></div>
        </div>
        <div class="form-group">
          <label for="log_passage_type">Passage Type</label>
          <select id="log_passage_type" aria-label="Passage type">
            <option value="">—</option>
            <option value="motor">Motor</option>
            <option value="sail">Sail</option>
            <option value="both">Motor &amp; Sail</option>
          </select>
        </div>
        <div class="form-group">
          <label for="log_departure">Departure Location</label>
          <input type="text" id="log_departure" placeholder="e.g. Marina, island or port">
        </div>
        <div class="form-group">
          <label for="log_arrival">Arrival Location</label>
          <input type="text" id="log_arrival" placeholder="e.g. Harbour, island or port">
        </div>
        <div class="form-group log-engine-hours-section">
          <div class="log-engine-hours-heading">Engine hours</div>
          <span class="form-hint">Optional for sail-only passages. Add a row per engine (e.g. port / starboard).</span>
          <div id="log-engine-hours-rows" class="log-engine-hours-rows"></div>
          <button type="button" class="btn-secondary" id="log-add-engine-hours">Add engine</button>
        </div>
        <div class="form-group">
          <label for="log_distance">Distance (nautical miles)</label>
          <input type="number" id="log_distance" step="0.1" placeholder="nm" min="0">
        </div>
        <div class="form-group">
          <label for="log_notes">Notes</label>
          <textarea id="log_notes" rows="4" placeholder="Weather, crew, highlights..."></textarea>
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

  let entry = null;
  if (!isNew) {
    const entries = await getLogbook(boatId);
    entry = entries.find((e) => e.id === entryId) || null;
    if (entry) {
      set('log_title', entry.title || 'Passage');
      set('log_date', entry.date);
      set('log_date_end', entry.date_end);
      set('log_passage_type', entry.passage_type || '');
      set('log_departure', entry.departure);
      set('log_arrival', entry.arrival);
      set('log_distance', entry.distance_nm);
      set('log_notes', entry.notes);
    }
  } else {
    set('log_title', 'Passage');
    set('log_date', today);
  }

  renderEngineHoursRows(entry);

  const engineHoursContainer = document.getElementById('log-engine-hours-rows');
  document.getElementById('log-add-engine-hours')?.addEventListener('click', () => {
    engineHoursContainer?.insertAdjacentHTML('beforeend', engineHoursRowHtml({ label: '', start: null, end: null }));
  });
  engineHoursContainer?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.log-engine-remove');
    if (!btn || !engineHoursContainer) return;
    const rows = engineHoursContainer.querySelectorAll('.log-engine-hours-row');
    if (rows.length <= 1) return;
    btn.closest('.log-engine-hours-row')?.remove();
  });

  function collectDailyNotesFromForm() {
    const container = document.getElementById('log-daily-notes-container');
    if (!container) return {};
    const existing = {};
    const numberFields = new Set(['distance_run_24h', 'distance_to_nm', 'average_speed_kts', 'fuel_pct', 'water_pct']);
    container.querySelectorAll('.log-day-block').forEach((block) => {
      const dateStr = block.dataset.date;
      if (!dateStr) return;
      const dayData = {};
      block.querySelectorAll('input[data-date][data-field], textarea[data-date][data-field]').forEach((el) => {
        const v = el.value.trim();
        if (v === '') return;
        const isNum = numberFields.has(el.dataset.field) || el.type === 'number';
        const numVal = parseFloat(v);
        dayData[el.dataset.field] = (isNum && !Number.isNaN(numVal)) ? numVal : v;
      });
      if (Object.keys(dayData).length > 0) existing[dateStr] = dayData;
    });
    return existing;
  }

  function updateDailySection() {
    const startStr = document.getElementById('log_date')?.value || '';
    const endStr = document.getElementById('log_date_end')?.value?.trim() || '';
    const section = document.getElementById('log-daily-section');
    const container = document.getElementById('log-daily-notes-container');
    if (!section || !container) return;
    let existing = (entry && entry.daily_notes && typeof entry.daily_notes === 'object') ? JSON.parse(JSON.stringify(entry.daily_notes)) : {};
    const collected = collectDailyNotesFromForm();
    Object.assign(existing, collected);
    const dates = getDateRange(startStr, endStr);
    if (dates.length > 0) {
      section.style.display = 'block';
      renderDailyNotes(container, startStr, endStr, existing);
    } else {
      section.style.display = 'none';
      container.innerHTML = '';
    }
  }

  updateDailySection();

  document.getElementById('log_date')?.addEventListener('change', updateDailySection);
  document.getElementById('log_date_end')?.addEventListener('change', updateDailySection);

  document.getElementById('log-cancel-btn')?.addEventListener('click', () => {
    navigate(`/boat/${boatId}/log`);
  });

  document.getElementById('log-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (archived) return;
    if (
      isNew &&
      blockFreePlanRecordLimitIfNeeded('log', shipsLogStorage.getAll(boatId).length)
    ) {
      return;
    }
    const form = e.target;
    setSaveButtonLoading(form, true);
    try {
      const title = document.getElementById('log_title').value.trim() || 'Passage';
      const date = document.getElementById('log_date').value;
      const dateEndRaw = document.getElementById('log_date_end').value;
      const dateEnd = dateEndRaw && dateEndRaw.trim() ? dateEndRaw.trim() : null;
      const passageTypeRaw = document.getElementById('log_passage_type').value;
      const passageType = passageTypeRaw && passageTypeRaw.trim() ? passageTypeRaw.trim() : null;
      const departure = document.getElementById('log_departure').value.trim();
      const arrival = document.getElementById('log_arrival').value.trim();
      const engines = collectEngineHoursFromForm();
      const distanceNm = document.getElementById('log_distance').value ? parseFloat(document.getElementById('log_distance').value) : null;
      const notes = document.getElementById('log_notes').value.trim();

      const notesPayload = { raw: notes };
      if (engines.length > 0) {
        notesPayload.engine_hours_engines = engines;
        notesPayload.engine_hours_start = engines[0].start;
        notesPayload.engine_hours_end = engines[0].end;
      }
      if (distanceNm != null) notesPayload.distance_nm = distanceNm;

      let hours = null;
      if (engines.length > 0) {
        const f = engines[0];
        hours = f.end != null ? f.end : f.start;
      }

      const dailyNotes = collectDailyNotesFromForm();

      const payload = {
        date,
        date_end: dateEnd,
        passage_type: passageType,
        title,
        from_location: departure,
        to_location: arrival,
        hours,
        notes: (Object.keys(notesPayload).length > 1 || notesPayload.raw) ? JSON.stringify(notesPayload) : null,
        daily_notes: Object.keys(dailyNotes).length > 0 ? dailyNotes : null
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

  insertPremiumPreviewBanner(document.querySelector('.page-content.card-color-log'), {
    headline: 'Preview: Passage log',
    detail:
      'Basic plan: up to 2 passage logs per boat. Upgrade for an unlimited logbook.'
  });
}

export default {
  render,
  onMount
};
