/**
 * Navigation Equipment Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { confirmAction } from '../components/confirmModal.js';
import { isBoatArchived, getEquipment, deleteEquipment } from '../lib/dataService.js';
import { getUploads, saveUpload, deleteUpload, openUpload, formatFileSize, getUpload, LIMITED_UPLOAD_SIZE_BYTES, LIMITED_UPLOADS_PER_ENTITY, saveLinkAttachment } from '../lib/uploads.js';

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

  const yachtHeader = createYachtHeader('Navigation Equipment');
  wrapper.appendChild(yachtHeader);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-navigation';
  pageContent.appendChild(createBackButton());

  const container = document.createElement('div');
  container.className = 'container';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.innerHTML = `${renderIcon('plus')} Add Equipment`;
  addBtn.onclick = () => navigate(`/boat/${currentBoatId}/navigation/new`);

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
        showToast(`You can only upload up to ${LIMITED_UPLOADS_PER_ENTITY} files for this navigation item.`, 'error');
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
        showToast('Some files were larger than 2 MB and were skipped.', 'info');
      }

      if (!validFiles.length) {
        navFileInput.value = '';
        return;
      }

      const filesToUpload = validFiles.slice(0, remainingSlots);
      if (validFiles.length > remainingSlots) {
        showToast(`Only ${remainingSlots} more file(s) can be uploaded for this navigation item (max ${LIMITED_UPLOADS_PER_ENTITY}).`, 'info');
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
        ${!navArchived ? `<div class="empty-state-actions"><button type="button" class="btn-primary" onclick="event.preventDefault(); window.navigate('/boat/${currentBoatId}/navigation/new')">${renderIcon('plus')} Add Equipment</button></div>` : ''}
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
          ${!navArchived ? `<a href="#/boat/${currentBoatId}/navigation/${item.id}" class="btn-link" onclick="event.preventDefault(); window.navigate('/boat/${currentBoatId}/navigation/${item.id}')">${renderIcon('edit')}</a>
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
  window.navigate = navigate;
  window.navPageDelete = async (id) => {
    const ok = await confirmAction({ title: 'Delete this equipment?', message: 'This cannot be undone.', confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true });
    if (!ok) return;
    navEquipmentStorage.delete(id);
    loadNavEquipment();
    showToast('Equipment removed', 'info');
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
    btn.addEventListener('click', async () => {
      const uploadId = btn.dataset.uploadId;
      const ok = await confirmAction({ title: 'Delete this attachment?', message: 'This cannot be undone.', confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true });
      if (!ok) return;
      deleteUpload(uploadId);
      loadNavEquipment();
      showToast('Attachment removed', 'info');
    });
  });
}

export default {
  render,
  onMount
};
