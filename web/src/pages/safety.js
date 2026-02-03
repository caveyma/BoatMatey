/**
 * Safety Equipment Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { isBoatArchived, getEquipment, deleteEquipment } from '../lib/dataService.js';
import { getUploads, saveUpload, deleteUpload, openUpload, formatFileSize, getUpload, LIMITED_UPLOAD_SIZE_BYTES, LIMITED_UPLOADS_PER_ENTITY, saveLinkAttachment } from '../lib/uploads.js';

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

  const yachtHeader = createYachtHeader('Safety Equipment');
  wrapper.appendChild(yachtHeader);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-safety';
  pageContent.appendChild(createBackButton());

  const container = document.createElement('div');
  container.className = 'container';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.id = 'safety-add-btn';
  addBtn.innerHTML = `${renderIcon('plus')} Add Equipment`;
  addBtn.onclick = () => navigate(`/boat/${currentBoatId}/safety/new`);

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
          ${!safetyArchived ? `<a href="#/boat/${currentBoatId}/safety/${item.id}" class="btn-link" onclick="event.preventDefault(); window.navigate('/boat/${currentBoatId}/safety/${item.id}')">${renderIcon('edit')}</a>
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
  window.navigate = navigate;
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

export default {
  render,
  onMount
};
