/**
 * Safety Equipment Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { safetyEquipmentStorage } from '../lib/storage.js';

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
  title.textContent = 'Safety Equipment';
  
  header.appendChild(backLink);
  header.appendChild(title);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.innerHTML = `${renderIcon('plus')} Add Equipment`;
  addBtn.onclick = () => showSafetyForm();

  const listContainer = document.createElement('div');
  listContainer.id = 'safety-list';

  container.appendChild(header);
  container.appendChild(addBtn);
  container.appendChild(listContainer);

  return container;
}

function onMount() {
  window.navigate = navigate;
  loadSafetyEquipment();
}

function loadSafetyEquipment() {
  const listContainer = document.getElementById('safety-list');
  const items = safetyEquipmentStorage.getAll();

  if (items.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${renderIcon('shield')}</div>
        <p>No safety equipment added yet</p>
      </div>
    `;
    return;
  }

  const now = new Date();
  listContainer.innerHTML = items.map(item => {
    const expiryDate = item.expiry_date ? new Date(item.expiry_date) : null;
    const isExpired = expiryDate && expiryDate < now;
    const isExpiringSoon = expiryDate && expiryDate > now && expiryDate < new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    return `
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">${item.name || 'Unnamed'}</h3>
          <p class="text-muted">${item.type || 'Equipment'}</p>
        </div>
        <div>
          ${expiryDate ? `<span class="badge ${isExpired ? 'badge-error' : isExpiringSoon ? 'badge-warning' : 'badge-success'}">
            ${isExpired ? 'Expired' : isExpiringSoon ? 'Expiring Soon' : 'Valid'}
          </span>` : ''}
          <button class="btn-link" onclick="safetyPageEdit('${item.id}')">${renderIcon('edit')}</button>
          <button class="btn-link btn-danger" onclick="safetyPageDelete('${item.id}')">${renderIcon('trash')}</button>
        </div>
      </div>
      <div>
        ${item.serial_number ? `<p><strong>Serial Number:</strong> ${item.serial_number}</p>` : ''}
        ${expiryDate ? `<p><strong>Expiry Date:</strong> ${expiryDate.toLocaleDateString()}</p>` : ''}
        ${item.service_interval ? `<p><strong>Service Interval:</strong> ${item.service_interval}</p>` : ''}
        ${item.notes ? `<p><strong>Notes:</strong> ${item.notes}</p>` : ''}
      </div>
    </div>
  `;
  }).join('');

  attachHandlers();
}

function attachHandlers() {
  window.safetyPageEdit = (id) => {
    editingId = id;
    showSafetyForm();
  };

  window.safetyPageDelete = (id) => {
    if (confirm('Delete this equipment?')) {
      safetyEquipmentStorage.delete(id);
      loadSafetyEquipment();
    }
  };
}

function showSafetyForm() {
  const item = editingId ? safetyEquipmentStorage.get(editingId) : null;
  const types = ['Liferaft', 'EPIRB', 'Fire Extinguisher', 'Flares', 'First Aid Kit', 'Life Jacket', 'Other'];

  const formHtml = `
    <div class="card" id="safety-form-card">
      <h3>${editingId ? 'Edit Equipment' : 'Add Equipment'}</h3>
      <form id="safety-form">
        <div class="form-group">
          <label for="safety_name">Name *</label>
          <input type="text" id="safety_name" required value="${item?.name || ''}">
        </div>
        <div class="form-group">
          <label for="safety_type">Type</label>
          <select id="safety_type">
            <option value="">Select...</option>
            ${types.map(t => `<option value="${t}" ${item?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
          <input type="text" id="safety_type_custom" placeholder="Or enter custom type" value="${item?.type && !types.includes(item.type) ? item.type : ''}" style="margin-top: 0.5rem;">
        </div>
        <div class="form-group">
          <label for="safety_serial">Serial Number</label>
          <input type="text" id="safety_serial" value="${item?.serial_number || ''}">
        </div>
        <div class="form-group">
          <label for="safety_expiry">Expiry Date</label>
          <input type="date" id="safety_expiry" value="${item?.expiry_date || ''}">
        </div>
        <div class="form-group">
          <label for="safety_service_interval">Service Interval (e.g., "Annually", "Every 2 years")</label>
          <input type="text" id="safety_service_interval" value="${item?.service_interval || ''}">
        </div>
        <div class="form-group">
          <label for="safety_notes">Notes</label>
          <textarea id="safety_notes" rows="4">${item?.notes || ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="safetyPageCancelForm()">Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  const listContainer = document.getElementById('safety-list');
  listContainer.insertAdjacentHTML('afterbegin', formHtml);

  const form = document.getElementById('safety-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSafetyEquipment();
  });

  // Handle custom type
  document.getElementById('safety_type').addEventListener('change', (e) => {
    if (e.target.value) {
      document.getElementById('safety_type_custom').value = '';
    }
  });

  document.getElementById('safety_type_custom').addEventListener('input', (e) => {
    if (e.target.value) {
      document.getElementById('safety_type').value = '';
    }
  });

  window.safetyPageCancelForm = () => {
    document.getElementById('safety-form-card').remove();
    editingId = null;
  };
}

function saveSafetyEquipment() {
  const safetyType = document.getElementById('safety_type').value || document.getElementById('safety_type_custom').value;
  
  const item = {
    id: editingId,
    name: document.getElementById('safety_name').value,
    type: safetyType,
    serial_number: document.getElementById('safety_serial').value,
    expiry_date: document.getElementById('safety_expiry').value || null,
    service_interval: document.getElementById('safety_service_interval').value,
    notes: document.getElementById('safety_notes').value
  };

  safetyEquipmentStorage.save(item);
  document.getElementById('safety-form-card').remove();
  editingId = null;
  loadSafetyEquipment();
}

export default {
  render,
  onMount
};
