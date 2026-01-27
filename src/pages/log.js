/**
 * Ship's Log Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { shipsLogStorage } from '../lib/storage.js';

let editingId = null;

function render() {
  const container = document.createElement('div');
  container.className = 'container';

  const header = document.createElement('div');
  header.className = 'page-header';
  
  const backLink = document.createElement('a');
  backLink.href = '#';
  backLink.className = 'back-button';
  backLink.innerHTML = `${renderIcon('arrowLeft')} Back`;
  backLink.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });
  
  const title = document.createElement('h1');
  title.textContent = "Ship's Log";
  
  header.appendChild(backLink);
  header.appendChild(title);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.innerHTML = `${renderIcon('plus')} Add Trip`;
  addBtn.onclick = () => showLogForm();

  const listContainer = document.createElement('div');
  listContainer.id = 'log-list';

  container.appendChild(header);
  container.appendChild(addBtn);
  container.appendChild(listContainer);

  return container;
}

function onMount() {
  window.navigate = navigate;
  loadLogs();
}

function loadLogs() {
  const listContainer = document.getElementById('log-list');
  const entries = shipsLogStorage.getAll();

  if (entries.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${renderIcon('book')}</div>
        <p>No trips logged yet</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = entries.map(entry => {
    const hoursStart = entry.engine_hours_start || 'N/A';
    const hoursEnd = entry.engine_hours_end || 'N/A';
    const hoursUsed = (entry.engine_hours_start && entry.engine_hours_end) 
      ? (parseFloat(entry.engine_hours_end) - parseFloat(entry.engine_hours_start)).toFixed(1)
      : null;

    return `
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">${new Date(entry.date).toLocaleDateString()}</h3>
          <p class="text-muted">${entry.departure || 'N/A'} → ${entry.arrival || 'N/A'}</p>
        </div>
        <div>
          <button class="btn-link" onclick="logPageEdit('${entry.id}')">${renderIcon('edit')}</button>
          <button class="btn-link btn-danger" onclick="logPageDelete('${entry.id}')">${renderIcon('trash')}</button>
        </div>
      </div>
      <div>
        <p><strong>Engine Hours:</strong> ${hoursStart} → ${hoursEnd}${hoursUsed ? ` (${hoursUsed} hrs used)` : ''}</p>
        ${entry.distance_nm ? `<p><strong>Distance:</strong> ${entry.distance_nm} nm</p>` : ''}
        ${entry.notes ? `<p><strong>Notes:</strong> ${entry.notes}</p>` : ''}
      </div>
    </div>
  `;
  }).join('');

  attachHandlers();
}

function attachHandlers() {
  window.logPageEdit = (id) => {
    editingId = id;
    showLogForm();
  };

  window.logPageDelete = (id) => {
    if (confirm('Delete this trip entry?')) {
      shipsLogStorage.delete(id);
      loadLogs();
    }
  };
}

function showLogForm() {
  const entry = editingId ? shipsLogStorage.get(editingId) : null;

  const formHtml = `
    <div class="card" id="log-form-card">
      <h3>${editingId ? 'Edit Trip' : 'Add Trip'}</h3>
      <form id="log-form">
        <div class="form-group">
          <label for="log_date">Date *</label>
          <input type="date" id="log_date" required value="${entry?.date || new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label for="log_departure">Departure Location</label>
          <input type="text" id="log_departure" value="${entry?.departure || ''}">
        </div>
        <div class="form-group">
          <label for="log_arrival">Arrival Location</label>
          <input type="text" id="log_arrival" value="${entry?.arrival || ''}">
        </div>
        <div class="form-group">
          <label for="log_hours_start">Engine Hours (Start)</label>
          <input type="number" id="log_hours_start" step="0.1" value="${entry?.engine_hours_start || ''}">
        </div>
        <div class="form-group">
          <label for="log_hours_end">Engine Hours (End)</label>
          <input type="number" id="log_hours_end" step="0.1" value="${entry?.engine_hours_end || ''}">
        </div>
        <div class="form-group">
          <label for="log_distance">Distance (nautical miles)</label>
          <input type="number" id="log_distance" step="0.1" value="${entry?.distance_nm || ''}">
        </div>
        <div class="form-group">
          <label for="log_notes">Notes</label>
          <textarea id="log_notes" rows="4">${entry?.notes || ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="logPageCancelForm()">Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  const listContainer = document.getElementById('log-list');
  listContainer.insertAdjacentHTML('afterbegin', formHtml);

  const form = document.getElementById('log-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveLog();
  });

  window.logPageCancelForm = () => {
    document.getElementById('log-form-card').remove();
    editingId = null;
  };
}

function saveLog() {
  const entry = {
    id: editingId,
    date: document.getElementById('log_date').value,
    departure: document.getElementById('log_departure').value,
    arrival: document.getElementById('log_arrival').value,
    engine_hours_start: document.getElementById('log_hours_start').value ? parseFloat(document.getElementById('log_hours_start').value) : null,
    engine_hours_end: document.getElementById('log_hours_end').value ? parseFloat(document.getElementById('log_hours_end').value) : null,
    distance_nm: document.getElementById('log_distance').value ? parseFloat(document.getElementById('log_distance').value) : null,
    notes: document.getElementById('log_notes').value
  };

  shipsLogStorage.save(entry);
  document.getElementById('log-form-card').remove();
  editingId = null;
  loadLogs();
}

export default {
  render,
  onMount
};
