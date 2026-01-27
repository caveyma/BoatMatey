/**
 * Engines Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader } from '../components/header.js';
import { enginesStorage } from '../lib/storage.js';
import { checkLimit } from '../lib/subscription.js';

let editingId = null;
let currentBoatId = null;

function render(params = {}) {
  // Get boat ID from route params
  currentBoatId = params?.id || window.routeParams?.id;
  if (!currentBoatId) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapper;
  }

  const wrapper = document.createElement('div');
  
  // Yacht header
  const header = createYachtHeader('Engines', true, () => navigate(`/boat/${currentBoatId}`));
  wrapper.appendChild(header);
  
  // Page content with engines color theme
  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-engines';
  
  const container = document.createElement('div');
  container.className = 'container';

  const listContainer = document.createElement('div');
  listContainer.id = 'engines-list';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.innerHTML = `${renderIcon('plus')} Add Engine`;
  addBtn.onclick = () => showEngineForm();
  addBtn.style.marginBottom = 'var(--spacing-lg)';

  container.appendChild(addBtn);
  container.appendChild(listContainer);
  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);

  return wrapper;
}

function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  if (boatId) {
    currentBoatId = boatId;
  }
  loadEngines();
  // Make navigate available globally for back button
  window.navigate = navigate;
}

function loadEngines() {
  const listContainer = document.getElementById('engines-list');
  const engines = enginesStorage.getAll(currentBoatId);

  if (engines.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${renderIcon('engine')}</div>
        <p>No engines added yet</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = engines.map(engine => `
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">${engine.label || 'Unnamed Engine'}</h3>
          <p class="text-muted">${engine.manufacturer || ''} ${engine.model || ''}</p>
        </div>
        <div>
          <button class="btn-link" onclick="enginesPageEdit('${engine.id}')">${renderIcon('edit')}</button>
          <button class="btn-link btn-danger" onclick="enginesPageDelete('${engine.id}')">${renderIcon('trash')}</button>
        </div>
      </div>
      <div>
        <p><strong>Serial Number:</strong> ${engine.serial_number || 'N/A'}</p>
        <p><strong>Horsepower:</strong> ${engine.horsepower || 'N/A'}</p>
        <p><strong>Fuel Type:</strong> ${engine.fuel_type || 'N/A'}</p>
        ${engine.install_date ? `<p><strong>Install Date:</strong> ${new Date(engine.install_date).toLocaleDateString()}</p>` : ''}
        ${engine.warranty_expiry_date ? `<p><strong>Warranty Expiry:</strong> ${new Date(engine.warranty_expiry_date).toLocaleDateString()}</p>` : ''}
      </div>
    </div>
  `).join('');

  // Attach event handlers
  attachHandlers();
}

function attachHandlers() {
  // These will be set up via inline handlers for simplicity
  window.enginesPageEdit = (id) => {
    editingId = id;
    showEngineForm();
  };

  window.enginesPageDelete = (id) => {
    if (confirm('Delete this engine?')) {
      enginesStorage.delete(id);
      loadEngines();
    }
  };
}

function showEngineForm() {
  const engine = editingId ? enginesStorage.get(editingId) : null;
  const limit = checkLimit('ENGINES', enginesStorage.getAll(currentBoatId).length);
  
  if (!limit.allowed && !editingId) {
    alert(`Free plan limit: ${limit.limit} engine(s). Upgrade to add more.`);
    return;
  }

  const formHtml = `
    <div class="card" id="engine-form-card">
      <h3>${editingId ? 'Edit Engine' : 'Add Engine'}</h3>
      <form id="engine-form">
        <div class="form-group">
          <label for="engine_label">Label * (e.g., Port, Starboard, Generator)</label>
          <input type="text" id="engine_label" required value="${engine?.label || ''}">
        </div>
        <div class="form-group">
          <label for="engine_manufacturer">Manufacturer</label>
          <input type="text" id="engine_manufacturer" value="${engine?.manufacturer || ''}">
        </div>
        <div class="form-group">
          <label for="engine_model">Model</label>
          <input type="text" id="engine_model" value="${engine?.model || ''}">
        </div>
        <div class="form-group">
          <label for="engine_serial">Serial Number</label>
          <input type="text" id="engine_serial" value="${engine?.serial_number || ''}">
        </div>
        <div class="form-group">
          <label for="engine_hp">Horsepower</label>
          <input type="number" id="engine_hp" value="${engine?.horsepower || ''}">
        </div>
        <div class="form-group">
          <label for="engine_fuel_type">Fuel Type</label>
          <select id="engine_fuel_type">
            <option value="">Select...</option>
            <option value="diesel" ${engine?.fuel_type === 'diesel' ? 'selected' : ''}>Diesel</option>
            <option value="petrol" ${engine?.fuel_type === 'petrol' ? 'selected' : ''}>Petrol</option>
            <option value="electric" ${engine?.fuel_type === 'electric' ? 'selected' : ''}>Electric</option>
          </select>
        </div>
        <div class="form-group">
          <label for="engine_install_date">Install Date</label>
          <input type="date" id="engine_install_date" value="${engine?.install_date || ''}">
        </div>
        <div class="form-group">
          <label for="engine_warranty_expiry">Warranty Expiry Date</label>
          <input type="date" id="engine_warranty_expiry" value="${engine?.warranty_expiry_date || ''}">
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="enginesPageCancelForm()">Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  const listContainer = document.getElementById('engines-list');
  listContainer.insertAdjacentHTML('afterbegin', formHtml);

  const form = document.getElementById('engine-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveEngine();
  });

  window.enginesPageCancelForm = () => {
    document.getElementById('engine-form-card').remove();
    editingId = null;
  };
}

function saveEngine() {
  const engine = {
    id: editingId,
    label: document.getElementById('engine_label').value,
    manufacturer: document.getElementById('engine_manufacturer').value,
    model: document.getElementById('engine_model').value,
    serial_number: document.getElementById('engine_serial').value,
    horsepower: document.getElementById('engine_hp').value ? parseInt(document.getElementById('engine_hp').value) : null,
    fuel_type: document.getElementById('engine_fuel_type').value,
    install_date: document.getElementById('engine_install_date').value || null,
    warranty_expiry_date: document.getElementById('engine_warranty_expiry').value || null
  };

  enginesStorage.save(engine, currentBoatId);
  document.getElementById('engine-form-card').remove();
  editingId = null;
  loadEngines();
}

export default {
  render,
  onMount
};
