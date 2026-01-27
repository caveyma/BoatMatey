/**
 * Service History Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { serviceHistoryStorage, enginesStorage } from '../lib/storage.js';
import { checkLimit } from '../lib/subscription.js';

let editingId = null;
let filterEngineId = null;

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
  title.textContent = 'Service History';
  
  header.appendChild(backLink);
  header.appendChild(title);

  const filterContainer = document.createElement('div');
  filterContainer.className = 'page-actions';
  filterContainer.id = 'service-filter';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.innerHTML = `${renderIcon('plus')} Add Service Entry`;
  addBtn.onclick = () => showServiceForm();

  const listContainer = document.createElement('div');
  listContainer.id = 'service-list';

  container.appendChild(header);
  container.appendChild(filterContainer);
  container.appendChild(addBtn);
  container.appendChild(listContainer);

  return container;
}

function onMount() {
  window.navigate = navigate;
  loadFilters();
  loadServices();
}

function loadFilters() {
  const filterContainer = document.getElementById('service-filter');
  const engines = enginesStorage.getAll();
  
  filterContainer.innerHTML = `
    <select id="engine-filter" class="form-control" style="max-width: 300px;">
      <option value="">All Engines</option>
      ${engines.map(e => `<option value="${e.id}">${e.label || 'Unnamed'}</option>`).join('')}
    </select>
  `;

  document.getElementById('engine-filter').addEventListener('change', (e) => {
    filterEngineId = e.target.value || null;
    loadServices();
  });
}

function loadServices() {
  const listContainer = document.getElementById('service-list');
  let services = serviceHistoryStorage.getAll();

  if (filterEngineId) {
    services = services.filter(s => s.engine_id === filterEngineId);
  }

  if (services.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${renderIcon('wrench')}</div>
        <p>No service entries yet</p>
      </div>
    `;
    return;
  }

  const engines = enginesStorage.getAll();
  const getEngineLabel = (id) => {
    const engine = engines.find(e => e.id === id);
    return engine ? engine.label : 'Unknown Engine';
  };

  listContainer.innerHTML = services.map(service => `
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">${new Date(service.date).toLocaleDateString()}</h3>
          <p class="text-muted">${getEngineLabel(service.engine_id)} • ${service.service_type || 'Service'}</p>
        </div>
        <div>
          <button class="btn-link" onclick="servicePageEdit('${service.id}')">${renderIcon('edit')}</button>
          <button class="btn-link btn-danger" onclick="servicePageDelete('${service.id}')">${renderIcon('trash')}</button>
        </div>
      </div>
      <div>
        <p><strong>Engine Hours:</strong> ${service.engine_hours || 'N/A'}</p>
        ${service.notes ? `<p><strong>Notes:</strong> ${service.notes}</p>` : ''}
      </div>
    </div>
  `).join('');

  attachHandlers();
}

function attachHandlers() {
  window.servicePageEdit = (id) => {
    editingId = id;
    showServiceForm();
  };

  window.servicePageDelete = (id) => {
    if (confirm('Delete this service entry?')) {
      serviceHistoryStorage.delete(id);
      loadServices();
    }
  };
}

function showServiceForm() {
  const entry = editingId ? serviceHistoryStorage.get(editingId) : null;
  const limit = checkLimit('SERVICE_ENTRIES', serviceHistoryStorage.getAll().length);
  
  if (!limit.allowed && !editingId) {
    alert(`Free plan limit: ${limit.limit} entries. Upgrade to add more.`);
    return;
  }

  const engines = enginesStorage.getAll();
  const serviceTypes = ['Oil Change', 'Filter Change', 'Annual Service', 'Winterization', 'Repair', 'Other'];

  const formHtml = `
    <div class="card" id="service-form-card">
      <h3>${editingId ? 'Edit Service Entry' : 'Add Service Entry'}</h3>
      <form id="service-form">
        <div class="form-group">
          <label for="service_date">Date *</label>
          <input type="date" id="service_date" required value="${entry?.date || new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label for="service_engine">Engine *</label>
          <select id="service_engine" required>
            <option value="">Select engine...</option>
            ${engines.map(e => `<option value="${e.id}" ${entry?.engine_id === e.id ? 'selected' : ''}>${e.label || 'Unnamed'}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="service_type">Service Type</label>
          <select id="service_type">
            <option value="">Select...</option>
            ${serviceTypes.map(t => `<option value="${t}" ${entry?.service_type === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
          <input type="text" id="service_type_custom" placeholder="Or enter custom type" value="${entry?.service_type && !serviceTypes.includes(entry.service_type) ? entry.service_type : ''}" style="margin-top: 0.5rem;">
        </div>
        <div class="form-group">
          <label for="service_hours">Engine Hours</label>
          <input type="number" id="service_hours" step="0.1" value="${entry?.engine_hours || ''}">
        </div>
        <div class="form-group">
          <label for="service_notes">Notes</label>
          <textarea id="service_notes" rows="4">${entry?.notes || ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="servicePageCancelForm()">Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  const listContainer = document.getElementById('service-list');
  listContainer.insertAdjacentHTML('afterbegin', formHtml);

  const form = document.getElementById('service-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveService();
  });

  // Handle custom service type
  document.getElementById('service_type').addEventListener('change', (e) => {
    if (e.target.value) {
      document.getElementById('service_type_custom').value = '';
    }
  });

  document.getElementById('service_type_custom').addEventListener('input', (e) => {
    if (e.target.value) {
      document.getElementById('service_type').value = '';
    }
  });

  window.servicePageCancelForm = () => {
    document.getElementById('service-form-card').remove();
    editingId = null;
  };
}

function saveService() {
  const serviceType = document.getElementById('service_type').value || document.getElementById('service_type_custom').value;
  
  const entry = {
    id: editingId,
    date: document.getElementById('service_date').value,
    engine_id: document.getElementById('service_engine').value,
    service_type: serviceType,
    engine_hours: document.getElementById('service_hours').value ? parseFloat(document.getElementById('service_hours').value) : null,
    notes: document.getElementById('service_notes').value
  };

  serviceHistoryStorage.save(entry);
  document.getElementById('service-form-card').remove();
  editingId = null;
  loadServices();
}

export default {
  render,
  onMount
};
