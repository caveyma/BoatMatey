/**
 * Engines Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader } from '../components/header.js';
import { enginesStorage } from '../lib/storage.js';
import { getUploads, saveUpload, deleteUpload, openUpload, formatFileSize, getUpload, MAX_UPLOAD_SIZE_BYTES, MAX_UPLOADS_PER_ENTITY } from '../lib/uploads.js';

let editingId = null;
let currentBoatId = null;
let enginesFileInput = null;

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

  // Attachments card for Engines section
  const attachmentsCard = document.createElement('div');
  attachmentsCard.className = 'card';
  attachmentsCard.innerHTML = `
    <h3>Attachments</h3>
    <p class="text-muted">Add engine manuals, service PDFs, or related documents for this boat's engines.</p>
    <div class="attachment-list" id="engines-attachments-list"></div>
    <input type="file" id="engines-file-input" multiple accept=".pdf,.jpg,.jpeg,.png" style="display: none;">
    <button type="button" class="btn-secondary" id="engines-add-attachment-btn">
      ${renderIcon('plus')} Add Attachment
    </button>
  `;

  const listContainer = document.createElement('div');
  listContainer.id = 'engines-list';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.innerHTML = `${renderIcon('plus')} Add Engine`;
  addBtn.onclick = () => showEngineForm();
  addBtn.style.marginBottom = 'var(--spacing-lg)';

  container.appendChild(attachmentsCard);
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
  enginesFileInput = document.getElementById('engines-file-input');

  // Load attachments for Engines card
  loadEnginesAttachments();

  // File input handler with limits
  if (enginesFileInput) {
    enginesFileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length || !currentBoatId) return;

      const existing = getUploads('engines', currentBoatId, currentBoatId);
      const remainingSlots = MAX_UPLOADS_PER_ENTITY - existing.length;

      if (remainingSlots <= 0) {
        alert(`You can only upload up to ${MAX_UPLOADS_PER_ENTITY} files for Engines.`);
        enginesFileInput.value = '';
        return;
      }

      const validFiles = [];
      let oversizedCount = 0;

      files.forEach(file => {
        if (file.size > MAX_UPLOAD_SIZE_BYTES) {
          oversizedCount++;
        } else {
          validFiles.push(file);
        }
      });

      if (oversizedCount > 0) {
        alert('Some files were larger than 5 MB and were skipped.');
      }

      if (!validFiles.length) {
        enginesFileInput.value = '';
        return;
      }

      const filesToUpload = validFiles.slice(0, remainingSlots);
      if (validFiles.length > remainingSlots) {
        alert(`Only ${remainingSlots} more file(s) can be uploaded for Engines (max ${MAX_UPLOADS_PER_ENTITY}).`);
      }

      for (const file of filesToUpload) {
        await saveUpload(file, 'engines', currentBoatId, currentBoatId);
      }

      enginesFileInput.value = '';
      loadEnginesAttachments();
      attachEnginesAttachmentHandlers();
    });

    const addAttachmentBtn = document.getElementById('engines-add-attachment-btn');
    if (addAttachmentBtn) {
      addAttachmentBtn.addEventListener('click', () => {
        enginesFileInput.click();
      });
    }
  }

  loadEngines();
  // Make navigate available globally for back button
  window.navigate = navigate;
}

function loadEnginesAttachments() {
  const attachmentsList = document.getElementById('engines-attachments-list');
  if (!attachmentsList || !currentBoatId) return;

  const attachments = getUploads('engines', currentBoatId, currentBoatId);
  attachmentsList.innerHTML = '';

  if (attachments.length === 0) {
    attachmentsList.innerHTML = `<p class="text-muted">No attachments (max ${MAX_UPLOADS_PER_ENTITY} files, 5 MB each).</p>`;
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
        <button type="button" class="btn-link engines-open-attachment-btn" data-upload-id="${upload.id}">
          Open
        </button>
        <button type="button" class="btn-link btn-danger engines-delete-attachment-btn" data-upload-id="${upload.id}">
          ${renderIcon('trash')}
        </button>
      </div>
    `;
    attachmentsList.appendChild(item);
  });

  attachEnginesAttachmentHandlers();
}

function attachEnginesAttachmentHandlers() {
  // Remove old handlers by cloning
  document.querySelectorAll('.engines-open-attachment-btn').forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });
  document.querySelectorAll('.engines-delete-attachment-btn').forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });

  document.querySelectorAll('.engines-open-attachment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.uploadId;
      const upload = getUpload(uploadId);
      if (upload) {
        openUpload(upload);
      }
    });
  });

  document.querySelectorAll('.engines-delete-attachment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.uploadId;
      if (confirm('Delete this attachment?')) {
        deleteUpload(uploadId);
        loadEnginesAttachments();
        attachEnginesAttachmentHandlers();
      }
    });
  });
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
        <div class="card-subsection">
          <h4>Gearbox</h4>
          <p><strong>Manufacturer:</strong> ${engine.gearbox_manufacturer || 'N/A'}</p>
          <p><strong>Model:</strong> ${engine.gearbox_model || 'N/A'}</p>
          <p><strong>Serial Number:</strong> ${engine.gearbox_serial_number || 'N/A'}</p>
          ${engine.gearbox_ratio ? `<p><strong>Ratio:</strong> ${engine.gearbox_ratio}</p>` : ''}
          ${engine.gearbox_type ? `<p><strong>Type:</strong> ${engine.gearbox_type}</p>` : ''}
          ${engine.gearbox_notes ? `<p><strong>Notes:</strong> ${engine.gearbox_notes}</p>` : ''}
        </div>
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
        <hr />
        <h4>Gearbox</h4>
        <p class="text-muted">Capture gearbox details linked to this engine.</p>
        <div class="form-group">
          <label for="gearbox_manufacturer">Gearbox Manufacturer</label>
          <input type="text" id="gearbox_manufacturer" value="${engine?.gearbox_manufacturer || ''}">
        </div>
        <div class="form-group">
          <label for="gearbox_model">Gearbox Model</label>
          <input type="text" id="gearbox_model" value="${engine?.gearbox_model || ''}">
        </div>
        <div class="form-group">
          <label for="gearbox_serial_number">Gearbox Serial Number</label>
          <input type="text" id="gearbox_serial_number" value="${engine?.gearbox_serial_number || ''}">
        </div>
        <div class="form-group">
          <label for="gearbox_ratio">Gearbox Ratio</label>
          <input type="text" id="gearbox_ratio" value="${engine?.gearbox_ratio || ''}">
        </div>
        <div class="form-group">
          <label for="gearbox_type">Gearbox Type</label>
          <input type="text" id="gearbox_type" value="${engine?.gearbox_type || ''}">
        </div>
        <div class="form-group">
          <label for="gearbox_notes">Gearbox Notes</label>
          <textarea id="gearbox_notes" rows="3">${engine?.gearbox_notes || ''}</textarea>
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
    warranty_expiry_date: document.getElementById('engine_warranty_expiry').value || null,
    gearbox_manufacturer: document.getElementById('gearbox_manufacturer').value,
    gearbox_model: document.getElementById('gearbox_model').value,
    gearbox_serial_number: document.getElementById('gearbox_serial_number').value,
    gearbox_ratio: document.getElementById('gearbox_ratio').value,
    gearbox_type: document.getElementById('gearbox_type').value,
    gearbox_notes: document.getElementById('gearbox_notes').value
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
