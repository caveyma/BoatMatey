/**
 * Navigation Equipment Edit Page - full-page form for add/edit.
 * Cancel or Save returns to the Navigation list for the boat.
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { isBoatArchived, getEquipment, createEquipment, updateEquipment } from '../lib/dataService.js';
import { getUploads, saveUpload, deleteUpload, openUpload, formatFileSize, getUpload, LIMITED_UPLOAD_SIZE_BYTES, LIMITED_UPLOADS_PER_ENTITY, saveLinkAttachment } from '../lib/uploads.js';

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
  pageContent.className = 'page-content card-color-navigation';
  pageContent.appendChild(createBackButton());
  const container = document.createElement('div');
  container.className = 'container';

  container.innerHTML = `
    <div class="card" id="nav-form-card">
      <h3>${isNew ? 'Add Equipment' : 'Edit Equipment'}</h3>
      <p class="text-muted">${isNew ? 'Add navigation equipment for this boat.' : 'Update equipment details below.'}</p>
      <form id="nav-form">
        <div class="form-group">
          <label for="nav_name">Name *</label>
          <input type="text" id="nav_name" required placeholder="e.g. Chartplotter">
        </div>
        <div class="form-group">
          <label for="nav_manufacturer">Manufacturer</label>
          <input type="text" id="nav_manufacturer" placeholder="Manufacturer">
        </div>
        <div class="form-group">
          <label for="nav_model">Model</label>
          <input type="text" id="nav_model" placeholder="Model">
        </div>
        <div class="form-group">
          <label for="nav_serial">Serial Number</label>
          <input type="text" id="nav_serial" placeholder="Serial number">
        </div>
        <div class="form-group">
          <label for="nav_install_date">Install Date</label>
          <input type="date" id="nav_install_date">
        </div>
        <div class="form-group">
          <label for="nav_warranty_expiry">Warranty Expiry Date</label>
          <input type="date" id="nav_warranty_expiry">
        </div>
        <div class="form-group">
          <label for="nav_warranty_reminder">Warranty reminder</label>
          <select id="nav_warranty_reminder">
            <option value="0">None</option>
            <option value="1440">1 day before</option>
            <option value="2880">2 days before</option>
            <option value="10080" selected>1 week before</option>
          </select>
        </div>
        <div class="card" id="nav-attachments-card" style="margin-top: 1rem;">
          <h4>Attachments & Links</h4>
          <p class="text-muted">Upload up to ${LIMITED_UPLOADS_PER_ENTITY} files (max 2 MB each), or add links for this navigation item.</p>
          <div class="attachment-list" id="nav-attachments-list-form"></div>
          <input type="file" id="nav-file-input-form" multiple accept=".pdf,.jpg,.jpeg,.png" style="display: none;">
          <button type="button" class="btn-secondary" id="nav-add-file-btn" style="margin-top: 0.5rem;">
            ${renderIcon('plus')} Add File
          </button>
          <div class="form-group" style="margin-top: 0.75rem;">
            <label>Links</label>
            <input type="text" id="nav-link-name" placeholder="Link name (optional)">
            <input type="url" id="nav-link-url" placeholder="https://example.com" style="margin-top: 0.5rem;">
            <button type="button" class="btn-secondary" id="nav-add-link-btn" style="margin-top: 0.5rem;">
              ${renderIcon('plus')} Add Link
            </button>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" id="nav-cancel-btn">Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);
  return wrapper;
}

function loadNavFormAttachments(boatId, navId) {
  const attachmentsList = document.getElementById('nav-attachments-list-form');
  if (!attachmentsList || !boatId) return;

  const attachments = getUploads('navigation', navId, boatId);
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
        <button type="button" class="btn-link nav-edit-open-attachment" data-upload-id="${upload.id}">Open</button>
        <button type="button" class="btn-link btn-danger nav-edit-delete-attachment" data-upload-id="${upload.id}">${renderIcon('trash')}</button>
      </div>
    `;
    attachmentsList.appendChild(item);
  });

  document.querySelectorAll('.nav-edit-open-attachment').forEach(btn => {
    btn.addEventListener('click', () => {
      const upload = getUpload(btn.dataset.uploadId);
      if (upload) openUpload(upload);
    });
  });
  document.querySelectorAll('.nav-edit-delete-attachment').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this attachment?')) {
        deleteUpload(btn.dataset.uploadId);
        loadNavFormAttachments(boatId, navId);
      }
    });
  });
}

function initNavFormAttachments(boatId, navId) {
  const fileInput = document.getElementById('nav-file-input-form');
  const addFileBtn = document.getElementById('nav-add-file-btn');
  const addLinkBtn = document.getElementById('nav-add-link-btn');

  if (addFileBtn && fileInput) {
    addFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length || !boatId) return;
      const existing = getUploads('navigation', navId, boatId);
      const remainingSlots = LIMITED_UPLOADS_PER_ENTITY - existing.length;
      if (remainingSlots <= 0) {
        alert(`You can only upload up to ${LIMITED_UPLOADS_PER_ENTITY} files for this navigation item.`);
        fileInput.value = '';
        return;
      }
      const validFiles = files.filter(f => f.size <= LIMITED_UPLOAD_SIZE_BYTES);
      if (files.length !== validFiles.length) alert('Some files were larger than 2 MB and were skipped.');
      for (const file of validFiles.slice(0, remainingSlots)) {
        await saveUpload(file, 'navigation', navId, boatId);
      }
      fileInput.value = '';
      loadNavFormAttachments(boatId, navId);
    });
  }

  if (addLinkBtn) {
    addLinkBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('nav-link-name');
      const urlInput = document.getElementById('nav-link-url');
      const url = urlInput?.value.trim();
      if (!url) { alert('Please enter a URL.'); return; }
      saveLinkAttachment(nameInput?.value.trim() || '', url, 'navigation', navId, boatId);
      if (nameInput) nameInput.value = '';
      if (urlInput) urlInput.value = '';
      loadNavFormAttachments(boatId, navId);
    });
  }

  loadNavFormAttachments(boatId, navId);
}

async function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  const itemId = params?.itemId || window.routeParams?.itemId;
  const isNew = !itemId || itemId === 'new';

  if (!boatId) return;

  const archived = await isBoatArchived(boatId);
  if (archived) {
    document.getElementById('nav-form')?.querySelectorAll('input, button').forEach(el => { el.disabled = true; });
  }

  const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ''; };

  if (!isNew) {
    const items = await getEquipment(boatId, 'navigation');
    const item = items.find((i) => i.id === itemId);
    if (item) {
      set('nav_name', item.name);
      set('nav_manufacturer', item.manufacturer);
      set('nav_model', item.model);
      set('nav_serial', item.serial_number);
      set('nav_install_date', item.install_date);
      set('nav_warranty_expiry', item.warranty_expiry_date);
      const remEl = document.getElementById('nav_warranty_reminder');
      if (remEl) remEl.value = String(item.warranty_reminder_minutes ?? 10080);
    }
  }

  const effectiveId = isNew ? `nav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : itemId;
  initNavFormAttachments(boatId, effectiveId);

  document.getElementById('nav-cancel-btn')?.addEventListener('click', () => {
    navigate(`/boat/${boatId}/navigation`);
  });

  document.getElementById('nav-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (archived) return;

    const item = {
      id: itemId,
      name: document.getElementById('nav_name').value.trim(),
      manufacturer: document.getElementById('nav_manufacturer').value.trim(),
      model: document.getElementById('nav_model').value.trim(),
      serial_number: document.getElementById('nav_serial').value.trim(),
      install_date: document.getElementById('nav_install_date').value || null,
      warranty_expiry_date: document.getElementById('nav_warranty_expiry').value || null,
      warranty_reminder_minutes: parseInt(document.getElementById('nav_warranty_reminder')?.value || '10080', 10) || null
    };

    if (isNew || itemId.startsWith('nav_')) {
      await createEquipment(boatId, 'navigation', item);
    } else {
      await updateEquipment(itemId, 'navigation', item);
    }
    navigate(`/boat/${boatId}/navigation`);
  });
}

export default {
  render,
  onMount
};
