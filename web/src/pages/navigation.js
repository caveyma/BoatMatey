/**
 * Navigation Equipment Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader } from '../components/header.js';
import { isBoatArchived, getEquipment, createEquipment, updateEquipment, deleteEquipment } from '../lib/dataService.js';
import { getUploads, saveUpload, deleteUpload, openUpload, formatFileSize, getUpload, LIMITED_UPLOAD_SIZE_BYTES, LIMITED_UPLOADS_PER_ENTITY, saveLinkAttachment } from '../lib/uploads.js';

let editingId = null;
let currentBoatId = null;
let navFileInput = null;
let currentNavItemIdForUpload = null;
let navArchived = false;

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
  const yachtHeader = createYachtHeader('Navigation Equipment', true, () => window.history.back());
  wrapper.appendChild(yachtHeader);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-navigation';

  const container = document.createElement('div');
  container.className = 'container';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.innerHTML = `${renderIcon('plus')} Add Equipment`;
  addBtn.onclick = () => showNavForm();

  const listContainer = document.createElement('div');
  listContainer.id = 'nav-list';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = 'nav-file-input';
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

  navArchived = currentBoatId ? await isBoatArchived(currentBoatId) : false;
  const addBtn = document.getElementById('nav-add-btn');
  if (addBtn && navArchived) addBtn.style.display = 'none';

  window.navigate = navigate;

  navFileInput = document.getElementById('nav-file-input');

  if (navFileInput) {
    navFileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length || !currentBoatId || !currentNavItemIdForUpload) return;

      const existing = getUploads('navigation', currentNavItemIdForUpload, currentBoatId);
      const remainingSlots = LIMITED_UPLOADS_PER_ENTITY - existing.length;

      if (remainingSlots <= 0) {
        alert(`You can only upload up to ${LIMITED_UPLOADS_PER_ENTITY} files for this navigation item.`);
        navFileInput.value = '';
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
        navFileInput.value = '';
        return;
      }

      const filesToUpload = validFiles.slice(0, remainingSlots);
      if (validFiles.length > remainingSlots) {
        alert(`Only ${remainingSlots} more file(s) can be uploaded for this navigation item (max ${LIMITED_UPLOADS_PER_ENTITY}).`);
      }

      for (const file of filesToUpload) {
        await saveUpload(file, 'navigation', currentNavItemIdForUpload, currentBoatId);
      }

      navFileInput.value = '';
      loadNavEquipment();
    });
  }

  loadNavEquipment();
}

async function loadNavEquipment() {
  const listContainer = document.getElementById('nav-list');
  const items = currentBoatId ? await getEquipment(currentBoatId, 'navigation') : [];

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
          ${!navArchived ? `<button class="btn-link" onclick="navPageEdit('${item.id}')">${renderIcon('edit')}</button>
          <button class="btn-link btn-danger" onclick="navPageDelete('${item.id}')">${renderIcon('trash')}</button>` : ''}
        </div>
      </div>
      <div>
        ${item.serial_number ? `<p><strong>Serial Number:</strong> ${item.serial_number}</p>` : ''}
        ${item.install_date ? `<p><strong>Install Date:</strong> ${new Date(item.install_date).toLocaleDateString()}</p>` : ''}
        ${item.warranty_expiry_date ? `<p><strong>Warranty Expiry:</strong> ${new Date(item.warranty_expiry_date).toLocaleDateString()}</p>` : ''}
        <div class="nav-attachments" data-nav-id="${item.id}">
          <h4 style="margin-top: 0.75rem; margin-bottom: 0.25rem;">Attachments</h4>
          <div class="attachment-list" id="nav-attachments-list-${item.id}"></div>
          ${!navArchived ? `<button type="button" class="btn-link" onclick="navPageAddAttachment('${item.id}')">
            ${renderIcon('plus')} Add Attachment (max ${LIMITED_UPLOADS_PER_ENTITY}, 2 MB each)
          </button>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  attachHandlers();
  loadNavAttachments(items);
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

  window.navPageAddAttachment = (id) => {
    currentNavItemIdForUpload = id;
    if (navFileInput) {
      navFileInput.click();
    }
  };
}

function loadNavAttachments(items) {
  if (!currentBoatId) return;

  items.forEach(item => {
    const attachmentsList = document.getElementById(`nav-attachments-list-${item.id}`);
    if (!attachmentsList) return;

    const attachments = getUploads('navigation', item.id, currentBoatId);
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
          <button type="button" class="btn-link nav-open-attachment-btn" data-upload-id="${upload.id}">
            Open
          </button>
          <button type="button" class="btn-link btn-danger nav-delete-attachment-btn" data-upload-id="${upload.id}">
            ${renderIcon('trash')}
          </button>
        </div>
      `;
      attachmentsList.appendChild(attachmentItem);
    });
  });

  attachNavAttachmentHandlers();
}

function attachNavAttachmentHandlers() {
  document.querySelectorAll('.nav-open-attachment-btn').forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });
  document.querySelectorAll('.nav-delete-attachment-btn').forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });

  document.querySelectorAll('.nav-open-attachment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.uploadId;
      const upload = getUpload(uploadId);
      if (upload) {
        openUpload(upload);
      }
    });
  });

  document.querySelectorAll('.nav-delete-attachment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.uploadId;
      if (confirm('Delete this attachment?')) {
        deleteUpload(uploadId);
        loadNavEquipment();
      }
    });
  });
}

async function showNavForm() {
  const items = currentBoatId ? await getEquipment(currentBoatId, 'navigation') : [];
  const existingItem = editingId ? items.find((i) => i.id === editingId) : null;
  if (!editingId) {
    editingId = `nav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  const item = existingItem;

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

  initNavFormAttachments(editingId);
}

async function saveNavEquipment() {
  const item = {
    id: editingId,
    name: document.getElementById('nav_name').value,
    manufacturer: document.getElementById('nav_manufacturer').value,
    model: document.getElementById('nav_model').value,
    serial_number: document.getElementById('nav_serial').value,
    install_date: document.getElementById('nav_install_date').value || null,
    warranty_expiry_date: document.getElementById('nav_warranty_expiry').value || null
  };

  if (editingId && !editingId.startsWith('nav_')) {
    await updateEquipment(editingId, 'navigation', item);
  } else {
    await createEquipment(currentBoatId, 'navigation', item);
  }

  document.getElementById('nav-form-card').remove();
  editingId = null;
  loadNavEquipment();
}

function initNavFormAttachments(navId) {
  const fileInput = document.getElementById('nav-file-input-form');
  const addFileBtn = document.getElementById('nav-add-file-btn');
  const addLinkBtn = document.getElementById('nav-add-link-btn');

  if (addFileBtn && fileInput) {
    addFileBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length || !currentBoatId) return;

      const existing = getUploads('navigation', navId, currentBoatId);
      const remainingSlots = LIMITED_UPLOADS_PER_ENTITY - existing.length;

      if (remainingSlots <= 0) {
        alert(`You can only upload up to ${LIMITED_UPLOADS_PER_ENTITY} files for this navigation item.`);
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
        alert(`Only ${remainingSlots} more file(s) can be uploaded for this navigation item (max ${LIMITED_UPLOADS_PER_ENTITY}).`);
      }

      for (const file of filesToUpload) {
        await saveUpload(file, 'navigation', navId, currentBoatId);
      }

      fileInput.value = '';
      loadNavFormAttachments(navId);
    });
  }

  if (addLinkBtn) {
    addLinkBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('nav-link-name');
      const urlInput = document.getElementById('nav-link-url');
      const name = nameInput?.value.trim() || '';
      const url = urlInput?.value.trim();

      if (!url) {
        alert('Please enter a URL.');
        return;
      }

      saveLinkAttachment(name, url, 'navigation', navId, currentBoatId);
      if (nameInput) nameInput.value = '';
      if (urlInput) urlInput.value = '';
      loadNavFormAttachments(navId);
    });
  }

  loadNavFormAttachments(navId);
}

function loadNavFormAttachments(navId) {
  const attachmentsList = document.getElementById('nav-attachments-list-form');
  if (!attachmentsList || !currentBoatId) return;

  const attachments = getUploads('navigation', navId, currentBoatId);
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
        <button type="button" class="btn-link nav-open-attachment-btn" data-upload-id="${upload.id}">
          Open
        </button>
        <button type="button" class="btn-link btn-danger nav-delete-attachment-btn" data-upload-id="${upload.id}">
          ${renderIcon('trash')}
        </button>
      </div>
    `;
    attachmentsList.appendChild(item);
  });

  attachNavAttachmentHandlers();
}

export default {
  render,
  onMount
};
