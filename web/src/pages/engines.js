/**
 * Engines Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { isBoatArchived, getEngines, deleteEngine } from '../lib/dataService.js';
import { getUploads, saveUpload, deleteUpload, openUpload, formatFileSize, getUpload, MAX_UPLOAD_SIZE_BYTES, MAX_UPLOADS_PER_ENTITY } from '../lib/uploads.js';

let currentBoatId = null;
let enginesFileInput = null;
let enginesArchived = false;

function render(params = {}) {
  // Get boat ID from route params
  currentBoatId = params?.id || window.routeParams?.id;
  if (!currentBoatId) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapper;
  }

  const wrapper = document.createElement('div');
  
  const header = createYachtHeader('Engines');
  wrapper.appendChild(header);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-engines';
  pageContent.appendChild(createBackButton());

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
  addBtn.id = 'engines-add-btn';
  addBtn.className = 'btn-primary';
  addBtn.innerHTML = `${renderIcon('plus')} Add Engine`;
  addBtn.onclick = () => navigate(`/boat/${currentBoatId}/engines/new`);
  addBtn.style.marginBottom = 'var(--spacing-lg)';

  container.appendChild(attachmentsCard);
  container.appendChild(addBtn);
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
  enginesFileInput = document.getElementById('engines-file-input');

  enginesArchived = currentBoatId ? await isBoatArchived(currentBoatId) : false;
  const addBtn = document.getElementById('engines-add-btn');
  const addAttachmentBtn = document.getElementById('engines-add-attachment-btn');
  if (enginesArchived && addBtn) addBtn.style.display = 'none';
  if (enginesArchived && addAttachmentBtn) addAttachmentBtn.style.display = 'none';

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
  window.navigate = navigate;
}

async function loadEngines() {
  const listContainer = document.getElementById('engines-list');
  const engines = currentBoatId ? await getEngines(currentBoatId) : [];

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
          ${!enginesArchived ? `<a href="#/boat/${currentBoatId}/engines/${engine.id}" class="btn-link" onclick="event.preventDefault(); window.navigate('/boat/${currentBoatId}/engines/${engine.id}')">${renderIcon('edit')}</a>
          <button class="btn-link btn-danger" onclick="enginesPageDelete('${engine.id}')">${renderIcon('trash')}</button>` : ''}
        </div>
      </div>
      <div>
        <p><strong>Serial Number:</strong> ${engine.serial_number || 'N/A'}</p>
        <p><strong>Horsepower:</strong> ${engine.horsepower || 'N/A'}</p>
        <p><strong>Fuel Type:</strong> ${engine.fuel_type || 'N/A'}</p>
        <p><strong>Drive Type:</strong> ${engine.drive_type ? formatDriveType(engine.drive_type) : 'N/A'}</p>
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
  attachHandlers();
  window.navigate = navigate;
}

function formatDriveType(value) {
  switch (value) {
    case 'shaft':
      return 'Shaft Drive';
    case 'saildrive':
      return 'Saildrive';
    case 'sterndrive':
      return 'Sterndrive';
    case 'ips_pod':
      return 'IPS Pod / Pod Drive';
    case 'jet':
      return 'Jet Drive';
    case 'other':
      return 'Other';
    default:
      return value;
  }
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

function attachHandlers() {
  window.enginesPageDelete = async (id) => {
    if (confirm('Delete this engine?')) {
      await deleteEngine(id);
      loadEngines();
    }
  };
}

export default {
  render,
  onMount
};
