/**
 * Boat Details Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader } from '../components/header.js';
import { boatsStorage } from '../lib/storage.js';
import { getUploads, saveUpload, deleteUpload, openUpload, formatFileSize, getUpload } from '../lib/uploads.js';

let currentBoat = null;
let currentBoatId = null;
let fileInput = null;

function render(params = {}) {
  // Get boat ID from route params
  currentBoatId = params?.id || window.routeParams?.id;
  if (!currentBoatId) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapper;
  }

  currentBoat = boatsStorage.get(currentBoatId);
  
  const wrapper = document.createElement('div');
  
  // Yacht header
  const header = createYachtHeader('Boat Details', true, () => navigate(`/boat/${currentBoatId}`));
  wrapper.appendChild(header);
  
  // Page content with boat color theme
  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-boat';
  
  const container = document.createElement('div');
  container.className = 'container';

  const form = document.createElement('form');
  form.className = 'form-container';
  form.innerHTML = `
    <div class="form-group">
      <label for="boat_name">Boat Name *</label>
      <input type="text" id="boat_name" name="boat_name" required value="${currentBoat?.boat_name || ''}">
    </div>

    <div class="form-group">
      <label for="make_model">Make & Model</label>
      <input type="text" id="make_model" name="make_model" value="${currentBoat?.make_model || ''}">
    </div>

    <div class="form-group">
      <label for="year">Year</label>
      <input type="number" id="year" name="year" min="1900" max="2100" value="${currentBoat?.year || ''}">
    </div>

    <div class="form-group">
      <label for="hull_id">Hull ID / CIN</label>
      <input type="text" id="hull_id" name="hull_id" value="${currentBoat?.hull_id || ''}">
    </div>

    <div class="form-group">
      <label for="length">Length (m)</label>
      <input type="number" id="length" name="length" step="0.1" value="${currentBoat?.length || ''}">
    </div>

    <div class="form-group">
      <label for="beam">Beam (m)</label>
      <input type="number" id="beam" name="beam" step="0.1" value="${currentBoat?.beam || ''}">
    </div>

    <div class="form-group">
      <label for="draft">Draft (m)</label>
      <input type="number" id="draft" name="draft" step="0.1" value="${currentBoat?.draft || ''}">
    </div>

    <div class="form-group">
      <label for="fuel_type">Fuel Type</label>
      <select id="fuel_type" name="fuel_type">
        <option value="">Select...</option>
        <option value="diesel" ${currentBoat?.fuel_type === 'diesel' ? 'selected' : ''}>Diesel</option>
        <option value="petrol" ${currentBoat?.fuel_type === 'petrol' ? 'selected' : ''}>Petrol</option>
        <option value="electric" ${currentBoat?.fuel_type === 'electric' ? 'selected' : ''}>Electric</option>
      </select>
    </div>

    <div class="form-group">
      <label for="home_marina">Home Marina</label>
      <input type="text" id="home_marina" name="home_marina" value="${currentBoat?.home_marina || ''}">
    </div>

    <div class="form-group">
      <label for="registration_no">Registration Number</label>
      <input type="text" id="registration_no" name="registration_no" value="${currentBoat?.registration_no || ''}">
    </div>

    <div class="form-group">
      <label for="insurance_provider">Insurance Provider</label>
      <input type="text" id="insurance_provider" name="insurance_provider" value="${currentBoat?.insurance_provider || ''}">
    </div>

    <div class="form-group">
      <label for="insurance_policy_no">Insurance Policy Number</label>
      <input type="text" id="insurance_policy_no" name="insurance_policy_no" value="${currentBoat?.insurance_policy_no || ''}">
    </div>

    <div class="form-group">
      <label for="purchase_date">Purchase Date</label>
      <input type="date" id="purchase_date" name="purchase_date" value="${currentBoat?.purchase_date || ''}">
    </div>

    <div class="card">
      <h3>Attachments</h3>
      <div class="attachment-list" id="attachments-list"></div>
      <input type="file" id="file-input" multiple accept=".pdf,.jpg,.jpeg,.png" style="display: none;">
      <button type="button" class="btn-secondary" id="add-attachment-btn">
        ${renderIcon('plus')} Add Attachment
      </button>
    </div>

    <div class="form-actions">
      <button type="button" class="btn-secondary" id="cancel-btn">Cancel</button>
      <button type="submit" class="btn-primary">Save</button>
    </div>
  `;

  container.appendChild(form);
  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);

  return wrapper;
}

function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  if (boatId) {
    currentBoatId = boatId;
    currentBoat = boatsStorage.get(boatId);
  }
  fileInput = document.getElementById('file-input');
  const addBtn = document.getElementById('add-attachment-btn');
  const attachmentsList = document.getElementById('attachments-list');

  // Load attachments
  loadAttachments();

  // File input handler
  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      await saveUpload(file, 'boat', currentBoatId, currentBoatId);
    }
    fileInput.value = '';
    loadAttachments();
    attachEventHandlers();
  });

  addBtn.addEventListener('click', () => {
    fileInput.click();
  });

  // Form submit handler
  const form = document.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveBoat();
  });

  // Cancel button
  const cancelBtn = document.getElementById('cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      window.history.back();
    });
  }

  attachEventHandlers();
}

function attachEventHandlers() {
  // Remove old handlers
  document.querySelectorAll('.open-attachment-btn').forEach(btn => {
    btn.replaceWith(btn.cloneNode(true));
  });
  document.querySelectorAll('.delete-attachment-btn').forEach(btn => {
    btn.replaceWith(btn.cloneNode(true));
  });

  // Add new handlers
  document.querySelectorAll('.open-attachment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.uploadId;
      const upload = getUpload(uploadId);
      if (upload) {
        openUpload(upload);
      }
    });
  });

  document.querySelectorAll('.delete-attachment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.uploadId;
      if (confirm('Delete this attachment?')) {
        deleteUpload(uploadId);
        loadAttachments();
        attachEventHandlers();
      }
    });
  });
}

function loadAttachments() {
  const attachmentsList = document.getElementById('attachments-list');
  if (!attachmentsList || !currentBoatId) return;

  const attachments = getUploads('boat', currentBoatId, currentBoatId);
  attachmentsList.innerHTML = '';

  if (attachments.length === 0) {
    attachmentsList.innerHTML = '<p class="text-muted">No attachments</p>';
    return;
  }

  attachments.forEach(upload => {
    const item = document.createElement('div');
    item.className = 'attachment-item';
    item.innerHTML = `
      <div class="attachment-info">
        <div class="attachment-icon">${renderIcon('file')}</div>
        <div class="attachment-details">
          <div class="attachment-name">${upload.filename}</div>
          <div class="attachment-meta">${formatFileSize(upload.size)} • ${upload.mime_type}</div>
        </div>
      </div>
      <div>
        <button type="button" class="btn-link open-attachment-btn" data-upload-id="${upload.id}">
          Open
        </button>
        <button type="button" class="btn-link btn-danger delete-attachment-btn" data-upload-id="${upload.id}">
          ${renderIcon('trash')}
        </button>
      </div>
    `;
    attachmentsList.appendChild(item);
  });
}

function saveBoat() {
  const form = document.querySelector('form');
  const formData = new FormData(form);
  
  const boat = {
    boat_name: formData.get('boat_name'),
    make_model: formData.get('make_model'),
    year: formData.get('year') || null,
    hull_id: formData.get('hull_id'),
    length: formData.get('length') ? parseFloat(formData.get('length')) : null,
    beam: formData.get('beam') ? parseFloat(formData.get('beam')) : null,
    draft: formData.get('draft') ? parseFloat(formData.get('draft')) : null,
    fuel_type: formData.get('fuel_type'),
    home_marina: formData.get('home_marina'),
    registration_no: formData.get('registration_no'),
    insurance_provider: formData.get('insurance_provider'),
    insurance_policy_no: formData.get('insurance_policy_no'),
    purchase_date: formData.get('purchase_date') || null,
    updated_at: new Date().toISOString()
  };

  if (currentBoat) {
    boat.created_at = currentBoat.created_at;
  } else {
    boat.created_at = new Date().toISOString();
  }

  boatsStorage.save(boat);
  alert('Boat details saved!');
  navigate(`/boat/${currentBoatId}`);
}


export default {
  render,
  onMount
};
