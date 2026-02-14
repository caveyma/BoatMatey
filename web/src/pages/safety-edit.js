/**
 * Safety Equipment Edit Page - full-page form for add/edit.
 * Cancel or Save returns to the Safety list for the boat.
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { confirmAction } from '../components/confirmModal.js';
import { setSaveButtonLoading } from '../utils/saveButton.js';
import { isBoatArchived, getEquipment, createEquipment, updateEquipment } from '../lib/dataService.js';
import { getUploads, saveUpload, deleteUpload, openUpload, formatFileSize, getUpload, LIMITED_UPLOAD_SIZE_BYTES, LIMITED_UPLOADS_PER_ENTITY, saveLinkAttachment } from '../lib/uploads.js';

const SAFETY_TYPES = ['Liferaft', 'EPIRB', 'Fire Extinguisher', 'Flares', 'First Aid Kit', 'Life Jacket', 'Other'];

function render(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  const itemId = params?.itemId || window.routeParams?.itemId;
  const isNew = !itemId || itemId === 'new';

  if (!boatId) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapper;
  }

  const wrapper = document.createElement('div');
  const header = createYachtHeader(isNew ? 'Add Equipment' : 'Edit Equipment');
  wrapper.appendChild(header);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-safety';
  pageContent.appendChild(createBackButton());
  const container = document.createElement('div');
  container.className = 'container';

  container.innerHTML = `
    <div class="card" id="safety-form-card">
      <h3>${isNew ? 'Add Equipment' : 'Edit Equipment'}</h3>
      <p class="text-muted">${isNew ? 'Add safety equipment for this boat.' : 'Update equipment details below.'}</p>
      <form id="safety-form">
        <div class="form-group">
          <label for="safety_name">Name *</label>
          <input type="text" id="safety_name" required placeholder="e.g. Liferaft">
        </div>
        <div class="form-group">
          <label for="safety_type">Type</label>
          <select id="safety_type">
            <option value="">Select...</option>
            ${SAFETY_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
          <input type="text" id="safety_type_custom" placeholder="Or enter custom type" style="margin-top: 0.5rem;">
        </div>
        <div class="form-group">
          <label for="safety_serial">Serial Number</label>
          <input type="text" id="safety_serial" placeholder="Serial number">
        </div>
        <div class="form-group">
          <label for="safety_expiry">Expiry Date</label>
          <input type="date" id="safety_expiry">
        </div>
        <div class="form-group">
          <label for="safety_service_interval">Service Interval (e.g., Annually, Every 2 years)</label>
          <input type="text" id="safety_service_interval" placeholder="Service interval">
        </div>
        <div class="form-group">
          <label for="safety_notes">Notes</label>
          <textarea id="safety_notes" rows="4" placeholder="Notes"></textarea>
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
          <button type="button" class="btn-secondary" id="safety-cancel-btn">Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);
  return wrapper;
}

function loadSafetyFormAttachments(boatId, safetyId) {
  const attachmentsList = document.getElementById('safety-attachments-list-form');
  if (!attachmentsList || !boatId) return;

  const attachments = getUploads('safety', safetyId, boatId);
  attachmentsList.innerHTML = '';

  if (attachments.length === 0) {
    attachmentsList.innerHTML = '<p class="text-muted">No files or links added yet.</p>';
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
          <div class="attachment-meta">${isLink ? (upload.url || '') : `${formatFileSize(upload.size)} • ${upload.mime_type}`}</div>
        </div>
      </div>
      <div>
        <button type="button" class="btn-link safety-edit-open-attachment" data-upload-id="${upload.id}">Open</button>
        <button type="button" class="btn-link btn-danger safety-edit-delete-attachment" data-upload-id="${upload.id}">${renderIcon('trash')}</button>
      </div>
    `;
    attachmentsList.appendChild(item);
  });

  document.querySelectorAll('.safety-edit-open-attachment').forEach(btn => {
    btn.addEventListener('click', () => {
      const upload = getUpload(btn.dataset.uploadId);
      if (upload) openUpload(upload);
    });
  });
  document.querySelectorAll('.safety-edit-delete-attachment').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmAction({ title: 'Delete this attachment?', message: 'This cannot be undone.', confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true });
      if (!ok) return;
      deleteUpload(btn.dataset.uploadId);
      loadSafetyFormAttachments(boatId, safetyId);
      showToast('Attachment removed', 'info');
    });
  });
}

function initSafetyFormAttachments(boatId, safetyId) {
  const fileInput = document.getElementById('safety-file-input-form');
  const addFileBtn = document.getElementById('safety-add-file-btn');
  const addLinkBtn = document.getElementById('safety-add-link-btn');

  if (addFileBtn && fileInput) {
    addFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length || !boatId) return;
      const existing = getUploads('safety', safetyId, boatId);
      const remainingSlots = LIMITED_UPLOADS_PER_ENTITY - existing.length;
      if (remainingSlots <= 0) {
        showToast(`You can only upload up to ${LIMITED_UPLOADS_PER_ENTITY} files for this safety item.`, 'error');
        fileInput.value = '';
        return;
      }
      const validFiles = files.filter(f => f.size <= LIMITED_UPLOAD_SIZE_BYTES);
      if (files.length !== validFiles.length) showToast('Some files were larger than 2 MB and were skipped.', 'info');
      for (const file of validFiles.slice(0, remainingSlots)) {
        await saveUpload(file, 'safety', safetyId, boatId);
      }
      fileInput.value = '';
      loadSafetyFormAttachments(boatId, safetyId);
    });
  }

  if (addLinkBtn) {
    addLinkBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('safety-link-name');
      const urlInput = document.getElementById('safety-link-url');
      const url = urlInput?.value.trim();
      if (!url) { showToast('Please enter a URL.', 'error'); return; }
      saveLinkAttachment(nameInput?.value.trim() || '', url, 'safety', safetyId, boatId);
      if (nameInput) nameInput.value = '';
      if (urlInput) urlInput.value = '';
      loadSafetyFormAttachments(boatId, safetyId);
    });
  }

  document.getElementById('safety_type')?.addEventListener('change', () => {
    document.getElementById('safety_type_custom').value = '';
  });
  document.getElementById('safety_type_custom')?.addEventListener('input', () => {
    document.getElementById('safety_type').value = '';
  });

  loadSafetyFormAttachments(boatId, safetyId);
}

async function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  const itemId = params?.itemId || window.routeParams?.itemId;
  const isNew = !itemId || itemId === 'new';

  if (!boatId) return;

  const archived = await isBoatArchived(boatId);
  if (archived) {
    document.getElementById('safety-form')?.querySelectorAll('input, select, textarea, button').forEach(el => { el.disabled = true; });
  }

  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ''; };

  if (!isNew) {
    const items = await getEquipment(boatId, 'safety');
    const item = items.find((i) => i.id === itemId);
    if (item) {
      set('safety_name', item.name);
      set('safety_serial', item.serial_number);
      set('safety_expiry', item.expiry_date);
      set('safety_service_interval', item.service_interval);
      set('safety_notes', item.notes);
      if (SAFETY_TYPES.includes(item.type)) {
        set('safety_type', item.type);
      } else {
        set('safety_type_custom', item.type);
      }
    }
  }

  const effectiveId = isNew ? `safety_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : itemId;
  initSafetyFormAttachments(boatId, effectiveId);

  document.getElementById('safety-cancel-btn')?.addEventListener('click', () => {
    navigate(`/boat/${boatId}/safety`);
  });

  document.getElementById('safety-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (archived) return;
    const form = e.target;
    setSaveButtonLoading(form, true);
    try {
    const safetyType = document.getElementById('safety_type').value || document.getElementById('safety_type_custom').value;

    const item = {
      id: itemId,
      name: document.getElementById('safety_name').value.trim(),
      type: safetyType,
      serial_number: document.getElementById('safety_serial').value.trim(),
      expiry_date: document.getElementById('safety_expiry').value || null,
      service_interval: document.getElementById('safety_service_interval').value.trim(),
      notes: document.getElementById('safety_notes').value.trim()
    };

    if (isNew || itemId.startsWith('safety_')) {
      await createEquipment(boatId, 'safety', item);
    } else {
      await updateEquipment(itemId, 'safety', item);
    }
    navigate(`/boat/${boatId}/safety`);
    } finally {
      setSaveButtonLoading(form, false);
    }
  });
}

export default {
  render,
  onMount
};
