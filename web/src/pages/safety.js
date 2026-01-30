/**
 * Safety Equipment Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader } from '../components/header.js';
import { isBoatArchived, getEquipment, createEquipment, updateEquipment, deleteEquipment } from '../lib/dataService.js';
import { getUploads, saveUpload, deleteUpload, openUpload, formatFileSize, getUpload, LIMITED_UPLOAD_SIZE_BYTES, LIMITED_UPLOADS_PER_ENTITY, saveLinkAttachment } from '../lib/uploads.js';

let editingId = null;
let currentBoatId = null;
let safetyFileInput = null;
let currentSafetyItemIdForUpload = null;

function render(params = {}) {
  // Get boat ID from route params
  currentBoatId = params?.id || window.routeParams?.id;
  if (!currentBoatId) {
    const wrapperError = document.createElement('div');
    wrapperError.innerHTML = '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapperError;
  }

  const wrapper = document.createElement('div');

  // Yacht header with back arrow using browser history
  const yachtHeader = createYachtHeader('Safety Equipment', true, () => window.history.back());
  wrapper.appendChild(yachtHeader);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-safety';

  const container = document.createElement('div');
  container.className = 'container';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.id = 'safety-add-btn';
  addBtn.innerHTML = `${renderIcon('plus')} Add Equipment`;
  addBtn.onclick = () => showSafetyForm();

  const listContainer = document.createElement('div');
  listContainer.id = 'safety-list';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = 'safety-file-input';
  fileInput.multiple = true;
  fileInput.accept = '.pdf,.jpg,.jpeg,.png';
  fileInput.style.display = 'none';

  container.appendChild(addBtn);
  container.appendChild(fileInput);
  container.appendChild(listContainer);

  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);

  return wrapper;
}

async function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  if (boatId) {
    currentBoatId = boatId;
  }

  safetyArchived = currentBoatId ? await isBoatArchived(currentBoatId) : false;
  const addBtn = document.getElementById('safety-add-btn');
  if (addBtn && safetyArchived) addBtn.style.display = 'none';

  window.navigate = navigate;

  safetyFileInput = document.getElementById('safety-file-input');

  if (safetyFileInput) {
    safetyFileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length || !currentBoatId || !currentSafetyItemIdForUpload) return;

      const existing = getUploads('safety', currentSafetyItemIdForUpload, currentBoatId);
      const remainingSlots = LIMITED_UPLOADS_PER_ENTITY - existing.length;

      if (remainingSlots <= 0) {
        alert(`You can only upload up to ${LIMITED_UPLOADS_PER_ENTITY} files for this safety item.`);
        safetyFileInput.value = '';
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
        safetyFileInput.value = '';
        return;
      }

      const filesToUpload = validFiles.slice(0, remainingSlots);
      if (validFiles.length > remainingSlots) {
        alert(`Only ${remainingSlots} more file(s) can be uploaded for this safety item (max ${LIMITED_UPLOADS_PER_ENTITY}).`);
      }

      for (const file of filesToUpload) {
        await saveUpload(file, 'safety', currentSafetyItemIdForUpload, currentBoatId);
      }

      safetyFileInput.value = '';
      loadSafetyEquipment();
    });
  }

  loadSafetyEquipment();
}

async function loadSafetyEquipment() {
  const listContainer = document.getElementById('safety-list');
  const items = currentBoatId ? await getEquipment(currentBoatId, 'safety') : [];

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
          ${!safetyArchived ? `<button class="btn-link" onclick="safetyPageEdit('${item.id}')">${renderIcon('edit')}</button>
          <button class="btn-link btn-danger" onclick="safetyPageDelete('${item.id}')">${renderIcon('trash')}</button>` : ''}
        </div>
      </div>
      <div>
        ${item.serial_number ? `<p><strong>Serial Number:</strong> ${item.serial_number}</p>` : ''}
        ${expiryDate ? `<p><strong>Expiry Date:</strong> ${expiryDate.toLocaleDateString()}</p>` : ''}
        ${item.service_interval ? `<p><strong>Service Interval:</strong> ${item.service_interval}</p>` : ''}
        ${item.notes ? `<p><strong>Notes:</strong> ${item.notes}</p>` : ''}
        <div class="safety-attachments" data-safety-id="${item.id}">
          <h4 style="margin-top: 0.75rem; margin-bottom: 0.25rem;">Attachments</h4>
          <div class="attachment-list" id="safety-attachments-list-${item.id}"></div>
          ${!safetyArchived ? `<button type="button" class="btn-link" onclick="safetyPageAddAttachment('${item.id}')">
            ${renderIcon('plus')} Add Attachment (max ${LIMITED_UPLOADS_PER_ENTITY}, 2 MB each)
          </button>` : ''}
        </div>
      </div>
    </div>
  `;
  }).join('');

  attachHandlers();
  loadSafetyAttachments(items);
}

function attachHandlers() {
  window.safetyPageEdit = (id) => {
    editingId = id;
    showSafetyForm();
  };

  window.safetyPageDelete = async (id) => {
    if (confirm('Delete this equipment?')) {
      await deleteEquipment(id, 'safety');
      loadSafetyEquipment();
    }
  };

  window.safetyPageAddAttachment = (id) => {
    currentSafetyItemIdForUpload = id;
    if (safetyFileInput) {
      safetyFileInput.click();
    }
  };
}

function loadSafetyAttachments(items) {
  if (!currentBoatId) return;

  items.forEach(item => {
    const attachmentsList = document.getElementById(`safety-attachments-list-${item.id}`);
    if (!attachmentsList) return;

    const attachments = getUploads('safety', item.id, currentBoatId);
    attachmentsList.innerHTML = '';

    if (attachments.length === 0) {
      attachmentsList.innerHTML = `<p class="text-muted">No attachments.</p>`;
      return;
    }

    attachments.forEach(upload => {
      const attachmentItem = document.createElement('div');
      attachmentItem.className = 'attachment-item';
      attachmentItem.innerHTML = `
        <div class="attachment-info">
          <div class="attachment-icon">${renderIcon('file')}</div>
          <div class="attachment-details">
            <div class="attachment-name">${upload.filename}</div>
            <div class="attachment-meta">${formatFileSize(upload.size)} • ${upload.mime_type}</div>
          </div>
        </div>
        <div>
          <button type="button" class="btn-link safety-open-attachment-btn" data-upload-id="${upload.id}">
            Open
          </button>
          <button type="button" class="btn-link btn-danger safety-delete-attachment-btn" data-upload-id="${upload.id}">
            ${renderIcon('trash')}
          </button>
        </div>
      `;
      attachmentsList.appendChild(attachmentItem);
    });
  });

  attachSafetyAttachmentHandlers();
}

function attachSafetyAttachmentHandlers() {
  document.querySelectorAll('.safety-open-attachment-btn').forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });
  document.querySelectorAll('.safety-delete-attachment-btn').forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });

  document.querySelectorAll('.safety-open-attachment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.uploadId;
      const upload = getUpload(uploadId);
      if (upload) {
        openUpload(upload);
      }
    });
  });

  document.querySelectorAll('.safety-delete-attachment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.uploadId;
      if (confirm('Delete this attachment?')) {
        deleteUpload(uploadId);
        loadSafetyEquipment();
      }
    });
  });
}

async function showSafetyForm() {
  const items = currentBoatId ? await getEquipment(currentBoatId, 'safety') : [];
  const existingItem = editingId ? items.find((i) => i.id === editingId) : null;
  if (!editingId) {
    editingId = `safety_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  const item = existingItem;
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
        <div class="card" id="safety-attachments-card" style="margin-top: 1rem;">
          <h4>Attachments & Links</h4>
          <p class="text-muted">Upload up to ${LIMITED_UPLOADS_PER_ENTITY} files (max 2 MB each), or add links for this safety item.</p>
          <div class="attachment-list" id="safety-attachments-list-form"></div>
          <input type="file" id="safety-file-input-form" multiple accept=".pdf,.jpg,.jpeg,.png" style="display: none;">
          <button type="button" class="btn-secondary" id="safety-add-file-btn" style="margin-top: 0.5rem;">
            ${renderIcon('plus')} Add File
          </button>
          <div class="form-group" style="margin-top: 0.75rem;">
            <label>Links</label>
            <input type="text" id="safety-link-name" placeholder="Link name (optional)">
            <input type="url" id="safety-link-url" placeholder="https://example.com" style="margin-top: 0.5rem;">
            <button type="button" class="btn-secondary" id="safety-add-link-btn" style="margin-top: 0.5rem;">
              ${renderIcon('plus')} Add Link
            </button>
          </div>
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

  initSafetyFormAttachments(editingId);

  window.safetyPageCancelForm = () => {
    document.getElementById('safety-form-card').remove();
    editingId = null;
  };
}

function initSafetyFormAttachments(safetyId) {
  const fileInput = document.getElementById('safety-file-input-form');
  const addFileBtn = document.getElementById('safety-add-file-btn');
  const addLinkBtn = document.getElementById('safety-add-link-btn');

  if (addFileBtn && fileInput) {
    addFileBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length || !currentBoatId) return;

      const existing = getUploads('safety', safetyId, currentBoatId);
      const remainingSlots = LIMITED_UPLOADS_PER_ENTITY - existing.length;

      if (remainingSlots <= 0) {
        alert(`You can only upload up to ${LIMITED_UPLOADS_PER_ENTITY} files for this safety item.`);
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
        alert(`Only ${remainingSlots} more file(s) can be uploaded for this safety item (max ${LIMITED_UPLOADS_PER_ENTITY}).`);
      }

      for (const file of filesToUpload) {
        await saveUpload(file, 'safety', safetyId, currentBoatId);
      }

      fileInput.value = '';
      loadSafetyFormAttachments(safetyId);
    });
  }

  if (addLinkBtn) {
    addLinkBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('safety-link-name');
      const urlInput = document.getElementById('safety-link-url');
      const name = nameInput?.value.trim() || '';
      const url = urlInput?.value.trim();

      if (!url) {
        alert('Please enter a URL.');
        return;
      }

      saveLinkAttachment(name, url, 'safety', safetyId, currentBoatId);
      if (nameInput) nameInput.value = '';
      if (urlInput) urlInput.value = '';
      loadSafetyFormAttachments(safetyId);
    });
  }

  loadSafetyFormAttachments(safetyId);
}

function loadSafetyFormAttachments(safetyId) {
  const attachmentsList = document.getElementById('safety-attachments-list-form');
  if (!attachmentsList || !currentBoatId) return;

  const attachments = getUploads('safety', safetyId, currentBoatId);
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
        <button type="button" class="btn-link safety-open-attachment-btn" data-upload-id="${upload.id}">
          Open
        </button>
        <button type="button" class="btn-link btn-danger safety-delete-attachment-btn" data-upload-id="${upload.id}">
          ${renderIcon('trash')}
        </button>
      </div>
    `;
    attachmentsList.appendChild(item);
  });

  attachSafetyAttachmentHandlers();
}

async function saveSafetyEquipment() {
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

  if (editingId && !editingId.startsWith('safety_')) {
    await updateEquipment(editingId, 'safety', item);
  } else {
    await createEquipment(currentBoatId, 'safety', item);
  }

  document.getElementById('safety-form-card').remove();
  editingId = null;
  loadSafetyEquipment();
}

export default {
  render,
  onMount
};
