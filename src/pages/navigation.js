/**
 * Navigation Equipment Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { navEquipmentStorage } from '../lib/storage.js';

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
  title.textContent = 'Navigation Equipment';
  
  header.appendChild(backLink);
  header.appendChild(title);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.innerHTML = `${renderIcon('plus')} Add Equipment`;
  addBtn.onclick = () => showNavForm();

  const listContainer = document.createElement('div');
  listContainer.id = 'nav-list';

  container.appendChild(header);
  container.appendChild(addBtn);
  container.appendChild(listContainer);

  return container;
}

function onMount() {
  window.navigate = navigate;
  loadNavEquipment();
}

function loadNavEquipment() {
  const listContainer = document.getElementById('nav-list');
  const items = navEquipmentStorage.getAll();

  if (items.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${renderIcon('compass')}</div>
        <p>No navigation equipment added yet</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = items.map(item => `
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">${item.name || 'Unnamed'}</h3>
          <p class="text-muted">${item.manufacturer || ''} ${item.model || ''}</p>
        </div>
        <div>
          <button class="btn-link" onclick="navPageEdit('${item.id}')">${renderIcon('edit')}</button>
          <button class="btn-link btn-danger" onclick="navPageDelete('${item.id}')">${renderIcon('trash')}</button>
        </div>
      </div>
      <div>
        ${item.serial_number ? `<p><strong>Serial Number:</strong> ${item.serial_number}</p>` : ''}
        ${item.install_date ? `<p><strong>Install Date:</strong> ${new Date(item.install_date).toLocaleDateString()}</p>` : ''}
        ${item.warranty_expiry_date ? `<p><strong>Warranty Expiry:</strong> ${new Date(item.warranty_expiry_date).toLocaleDateString()}</p>` : ''}
      </div>
    </div>
  `).join('');

  attachHandlers();
}

function attachHandlers() {
  window.navPageEdit = (id) => {
    editingId = id;
    showNavForm();
  };

  window.navPageDelete = (id) => {
    if (confirm('Delete this equipment?')) {
      navEquipmentStorage.delete(id);
      loadNavEquipment();
    }
  };
}

function showNavForm() {
  const item = editingId ? navEquipmentStorage.get(editingId) : null;

  const formHtml = `
    <div class="card" id="nav-form-card">
      <h3>${editingId ? 'Edit Equipment' : 'Add Equipment'}</h3>
      <form id="nav-form">
        <div class="form-group">
          <label for="nav_name">Name *</label>
          <input type="text" id="nav_name" required value="${item?.name || ''}">
        </div>
        <div class="form-group">
          <label for="nav_manufacturer">Manufacturer</label>
          <input type="text" id="nav_manufacturer" value="${item?.manufacturer || ''}">
        </div>
        <div class="form-group">
          <label for="nav_model">Model</label>
          <input type="text" id="nav_model" value="${item?.model || ''}">
        </div>
        <div class="form-group">
          <label for="nav_serial">Serial Number</label>
          <input type="text" id="nav_serial" value="${item?.serial_number || ''}">
        </div>
        <div class="form-group">
          <label for="nav_install_date">Install Date</label>
          <input type="date" id="nav_install_date" value="${item?.install_date || ''}">
        </div>
        <div class="form-group">
          <label for="nav_warranty_expiry">Warranty Expiry Date</label>
          <input type="date" id="nav_warranty_expiry" value="${item?.warranty_expiry_date || ''}">
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="navPageCancelForm()">Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  const listContainer = document.getElementById('nav-list');
  listContainer.insertAdjacentHTML('afterbegin', formHtml);

  const form = document.getElementById('nav-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveNavEquipment();
  });

  window.navPageCancelForm = () => {
    document.getElementById('nav-form-card').remove();
    editingId = null;
  };
}

function saveNavEquipment() {
  const item = {
    id: editingId,
    name: document.getElementById('nav_name').value,
    manufacturer: document.getElementById('nav_manufacturer').value,
    model: document.getElementById('nav_model').value,
    serial_number: document.getElementById('nav_serial').value,
    install_date: document.getElementById('nav_install_date').value || null,
    warranty_expiry_date: document.getElementById('nav_warranty_expiry').value || null
  };

  navEquipmentStorage.save(item);
  document.getElementById('nav-form-card').remove();
  editingId = null;
  loadNavEquipment();
}

export default {
  render,
  onMount
};
