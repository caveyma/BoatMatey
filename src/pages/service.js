/**
 * Service History Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader } from '../components/header.js';
import { serviceHistoryStorage, enginesStorage } from '../lib/storage.js';
import { getUploads, saveUpload, deleteUpload, openUpload, formatFileSize, getUpload, LIMITED_UPLOAD_SIZE_BYTES, LIMITED_UPLOADS_PER_ENTITY, saveLinkAttachment } from '../lib/uploads.js';

let editingId = null;
let filterEngineId = null;
let currentBoatId = null;
let serviceFileInput = null;
let currentServiceIdForUpload = null;

function render(params = {}) {
  // Get boat ID from route params
  currentBoatId = params?.id || window.routeParams?.id;
  if (!currentBoatId) {
    const wrapperError = document.createElement('div');
    wrapperError.innerHTML = '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapperError;
  }

  const wrapper = document.createElement('div');

  // Yacht header with back arrow that uses browser history
  const yachtHeader = createYachtHeader('Service History', true, () => window.history.back());
  wrapper.appendChild(yachtHeader);

  // Page content with service color theme
  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-service';

  const container = document.createElement('div');
  container.className = 'container';

  const filterContainer = document.createElement('div');
  filterContainer.className = 'page-actions';
  filterContainer.id = 'service-filter';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.innerHTML = `${renderIcon('plus')} Add Service Entry`;
  addBtn.onclick = () => showServiceForm();

  const listContainer = document.createElement('div');
  listContainer.id = 'service-list';

  // Single hidden file input reused for per-entry attachments
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = 'service-file-input';
  fileInput.multiple = true;
  fileInput.accept = '.pdf,.jpg,.jpeg,.png';
  fileInput.style.display = 'none';

  container.appendChild(filterContainer);
  container.appendChild(addBtn);
  container.appendChild(fileInput);
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

  window.navigate = navigate;

  serviceFileInput = document.getElementById('service-file-input');

  loadFilters();

  if (serviceFileInput) {
    serviceFileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length || !currentBoatId || !currentServiceIdForUpload) return;

      const existing = getUploads('service', currentServiceIdForUpload, currentBoatId);
      const remainingSlots = LIMITED_UPLOADS_PER_ENTITY - existing.length;

      if (remainingSlots <= 0) {
        alert(`You can only upload up to ${LIMITED_UPLOADS_PER_ENTITY} files for this service entry.`);
        serviceFileInput.value = '';
        return;
      }

      const validFiles = [];
      let oversizedCount = 0;

      files.forEach(file => {
        if (file.size > LIMITED_UPLOAD_SIZE_BYTES) {
          oversizedCount++;
        } else {
          validFiles.push(file);
        }
      });

      if (oversizedCount > 0) {
        alert('Some files were larger than 2 MB and were skipped.');
      }

      if (!validFiles.length) {
        serviceFileInput.value = '';
        return;
      }

      const filesToUpload = validFiles.slice(0, remainingSlots);
      if (validFiles.length > remainingSlots) {
        alert(`Only ${remainingSlots} more file(s) can be uploaded for this service entry (max ${LIMITED_UPLOADS_PER_ENTITY}).`);
      }

      for (const file of filesToUpload) {
        await saveUpload(file, 'service', currentServiceIdForUpload, currentBoatId);
      }

      serviceFileInput.value = '';
      loadServices();
    });
  }

  loadServices();
}

function loadFilters() {
  const filterContainer = document.getElementById('service-filter');
  const engines = enginesStorage.getAll(currentBoatId);
  
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
  let services = serviceHistoryStorage.getAll(currentBoatId);

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
        <div class="service-attachments" data-service-id="${service.id}">
          <h4 style="margin-top: 0.75rem; margin-bottom: 0.25rem;">Attachments</h4>
          <div class="attachment-list" id="service-attachments-list-${service.id}"></div>
          <button type="button" class="btn-link" onclick="servicePageAddAttachment('${service.id}')">
            ${renderIcon('plus')} Add Attachment (max ${LIMITED_UPLOADS_PER_ENTITY}, 2 MB each)
          </button>
        </div>
      </div>
    </div>
  `).join('');

  attachHandlers();
  loadServiceAttachments(services);
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

  window.servicePageAddAttachment = (serviceId) => {
    currentServiceIdForUpload = serviceId;
    if (serviceFileInput) {
      serviceFileInput.click();
    }
  };
}

function loadServiceAttachments(services) {
  if (!currentBoatId) return;

  services.forEach(service => {
    const attachmentsList = document.getElementById(`service-attachments-list-${service.id}`);
    if (!attachmentsList) return;

    const attachments = getUploads('service', service.id, currentBoatId);
    attachmentsList.innerHTML = '';

    if (attachments.length === 0) {
      attachmentsList.innerHTML = `<p class="text-muted">No attachments.</p>`;
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
          <button type="button" class="btn-link service-open-attachment-btn" data-upload-id="${upload.id}">
            Open
          </button>
          <button type="button" class="btn-link btn-danger service-delete-attachment-btn" data-upload-id="${upload.id}">
            ${renderIcon('trash')}
          </button>
        </div>
      `;
      attachmentsList.appendChild(item);
    });
  });

  attachServiceAttachmentHandlers();
}

function attachServiceAttachmentHandlers() {
  document.querySelectorAll('.service-open-attachment-btn').forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });
  document.querySelectorAll('.service-delete-attachment-btn').forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });

  document.querySelectorAll('.service-open-attachment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.uploadId;
      const upload = getUpload(uploadId);
      if (upload) {
        openUpload(upload);
      }
    });
  });

  document.querySelectorAll('.service-delete-attachment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.uploadId;
      if (confirm('Delete this attachment?')) {
        deleteUpload(uploadId);
        loadServices();
      }
    });
  });
}

function showServiceForm() {
  // Ensure we have an ID even for new entries so uploads can be attached immediately
  const existingEntry = editingId ? serviceHistoryStorage.get(editingId) : null;
  if (!editingId) {
    editingId = `service_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  const entry = existingEntry;

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
        <div class="card" id="service-attachments-card" style="margin-top: 1rem;">
          <h4>Attachments & Links</h4>
          <p class="text-muted">Upload up to ${LIMITED_UPLOADS_PER_ENTITY} files (max 2 MB each), or add helpful links for this service entry.</p>
          <div class="attachment-list" id="service-attachments-list-form"></div>
          <input type="file" id="service-file-input-form" multiple accept=".pdf,.jpg,.jpeg,.png" style="display: none;">
          <button type="button" class="btn-secondary" id="service-add-file-btn" style="margin-top: 0.5rem;">
            ${renderIcon('plus')} Add File
          </button>
          <div class="form-group" style="margin-top: 0.75rem;">
            <label>Links</label>
            <input type="text" id="service-link-name" placeholder="Link name (optional)">
            <input type="url" id="service-link-url" placeholder="https://example.com" style="margin-top: 0.5rem;">
            <button type="button" class="btn-secondary" id="service-add-link-btn" style="margin-top: 0.5rem;">
              ${renderIcon('plus')} Add Link
            </button>
          </div>
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

  // Attach per-entry attachments & links handlers for this entry
  initServiceFormAttachments(editingId);

  window.servicePageCancelForm = () => {
    document.getElementById('service-form-card').remove();
    editingId = null;
  };
}

function initServiceFormAttachments(serviceId) {
  const fileInput = document.getElementById('service-file-input-form');
  const addFileBtn = document.getElementById('service-add-file-btn');
  const addLinkBtn = document.getElementById('service-add-link-btn');

  if (addFileBtn && fileInput) {
    addFileBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length || !currentBoatId) return;

      const existing = getUploads('service', serviceId, currentBoatId);
      const remainingSlots = LIMITED_UPLOADS_PER_ENTITY - existing.length;

      if (remainingSlots <= 0) {
        alert(`You can only upload up to ${LIMITED_UPLOADS_PER_ENTITY} files for this service entry.`);
        fileInput.value = '';
        return;
      }

      const validFiles = [];
      let oversizedCount = 0;

      files.forEach(file => {
        if (file.size > LIMITED_UPLOAD_SIZE_BYTES) {
          oversizedCount++;
        } else {
          validFiles.push(file);
        }
      });

      if (oversizedCount > 0) {
        alert('Some files were larger than 2 MB and were skipped.');
      }

      if (!validFiles.length) {
        fileInput.value = '';
        return;
      }

      const filesToUpload = validFiles.slice(0, remainingSlots);
      if (validFiles.length > remainingSlots) {
        alert(`Only ${remainingSlots} more file(s) can be uploaded for this service entry (max ${LIMITED_UPLOADS_PER_ENTITY}).`);
      }

      for (const file of filesToUpload) {
        await saveUpload(file, 'service', serviceId, currentBoatId);
      }

      fileInput.value = '';
      loadServiceFormAttachments(serviceId);
    });
  }

  if (addLinkBtn) {
    addLinkBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('service-link-name');
      const urlInput = document.getElementById('service-link-url');
      const name = nameInput?.value.trim() || '';
      const url = urlInput?.value.trim();

      if (!url) {
        alert('Please enter a URL.');
        return;
      }

      saveLinkAttachment(name, url, 'service', serviceId, currentBoatId);
      if (nameInput) nameInput.value = '';
      if (urlInput) urlInput.value = '';
      loadServiceFormAttachments(serviceId);
    });
  }

  loadServiceFormAttachments(serviceId);
}

function loadServiceFormAttachments(serviceId) {
  const attachmentsList = document.getElementById('service-attachments-list-form');
  if (!attachmentsList || !currentBoatId) return;

  const attachments = getUploads('service', serviceId, currentBoatId);
  attachmentsList.innerHTML = '';

  if (attachments.length === 0) {
    attachmentsList.innerHTML = `<p class="text-muted">No files or links added yet.</p>`;
    return;
  }

  attachments.forEach(upload => {
    const isLink = upload.storage_type === 'link' || upload.mime_type === 'text/url' || upload.url;
    const item = document.createElement('div');
    item.className = 'attachment-item';
    item.innerHTML = `
      <div class="attachment-info">
        <div class="attachment-icon">${renderIcon(isLink ? 'link' : 'file')}</div>
        <div class="attachment-details">
          <div class="attachment-name">${upload.filename}</div>
          <div class="attachment-meta">
            ${isLink ? (upload.url || '') : `${formatFileSize(upload.size)} • ${upload.mime_type}`}
          </div>
        </div>
      </div>
      <div>
        <button type="button" class="btn-link service-open-attachment-btn" data-upload-id="${upload.id}">
          Open
        </button>
        <button type="button" class="btn-link btn-danger service-delete-attachment-btn" data-upload-id="${upload.id}">
          ${renderIcon('trash')}
        </button>
      </div>
    `;
    attachmentsList.appendChild(item);
  });

  // Reuse existing handlers for open/delete
  attachServiceAttachmentHandlers();
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

  serviceHistoryStorage.save(entry, currentBoatId);
  document.getElementById('service-form-card').remove();
  editingId = null;
  loadServices();
}

export default {
  render,
  onMount
};
