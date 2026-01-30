/**
 * Ship's Log Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader } from '../components/header.js';
import { isBoatArchived, getLogbook, createLogEntry, updateLogEntry, deleteLogEntry } from '../lib/dataService.js';
import { getUploads, saveUpload, deleteUpload, openUpload, formatFileSize, getUpload, MAX_UPLOAD_SIZE_BYTES, MAX_UPLOADS_PER_ENTITY } from '../lib/uploads.js';

let editingId = null;
let currentBoatId = null;
let logFileInput = null;
let logArchived = false;

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
  const yachtHeader = createYachtHeader("Ship's Log", true, () => window.history.back());
  wrapper.appendChild(yachtHeader);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-log';

  const container = document.createElement('div');
  container.className = 'container';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.id = 'log-add-btn';
  addBtn.innerHTML = `${renderIcon('plus')} Add Trip`;
  addBtn.onclick = () => showLogForm();

  const attachmentsCard = document.createElement('div');
  attachmentsCard.className = 'card';
  attachmentsCard.innerHTML = `
    <h3>Attachments</h3>
    <p class="text-muted">Upload photos, logs, or documents for this boat's trips.</p>
    <div class="attachment-list" id="log-attachments-list"></div>
    <input type="file" id="log-file-input" multiple accept=".pdf,.jpg,.jpeg,.png" style="display: none;">
    <button type="button" class="btn-secondary" id="log-add-attachment-btn">
      ${renderIcon('plus')} Add Attachment
    </button>
  `;

  const listContainer = document.createElement('div');
  listContainer.id = 'log-list';

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

  window.navigate = navigate;
  logArchived = currentBoatId ? await isBoatArchived(currentBoatId) : false;
  logFileInput = document.getElementById('log-file-input');

  loadLogAttachments();
  loadLogs();

  if (logFileInput) {
    logFileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length || !currentBoatId) return;

      const existing = getUploads('log', currentBoatId, currentBoatId);
      const remainingSlots = MAX_UPLOADS_PER_ENTITY - existing.length;

      if (remainingSlots <= 0) {
        alert(`You can only upload up to ${MAX_UPLOADS_PER_ENTITY} files for Ship's Log.`);
        logFileInput.value = '';
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
        logFileInput.value = '';
        return;
      }

      const filesToUpload = validFiles.slice(0, remainingSlots);
      if (validFiles.length > remainingSlots) {
        alert(`Only ${remainingSlots} more file(s) can be uploaded for Ship's Log (max ${MAX_UPLOADS_PER_ENTITY}).`);
      }

      for (const file of filesToUpload) {
        await saveUpload(file, 'log', currentBoatId, currentBoatId);
      }

      logFileInput.value = '';
      loadLogAttachments();
      attachLogAttachmentHandlers();
    });

    const addAttachmentBtn = document.getElementById('log-add-attachment-btn');
    if (addAttachmentBtn) {
      addAttachmentBtn.addEventListener('click', () => {
        logFileInput.click();
      });
    }
  }

  loadLogs();
}

function loadLogAttachments() {
  const attachmentsList = document.getElementById('log-attachments-list');
  if (!attachmentsList || !currentBoatId) return;

  const attachments = getUploads('log', currentBoatId, currentBoatId);
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
        <button type="button" class="btn-link log-open-attachment-btn" data-upload-id="${upload.id}">
          Open
        </button>
        <button type="button" class="btn-link btn-danger log-delete-attachment-btn" data-upload-id="${upload.id}">
          ${renderIcon('trash')}
        </button>
      </div>
    `;
    attachmentsList.appendChild(item);
  });

  attachLogAttachmentHandlers();
}

function attachLogAttachmentHandlers() {
  document.querySelectorAll('.log-open-attachment-btn').forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });
  document.querySelectorAll('.log-delete-attachment-btn').forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });

  document.querySelectorAll('.log-open-attachment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.uploadId;
      const upload = getUpload(uploadId);
      if (upload) {
        openUpload(upload);
      }
    });
  });

  document.querySelectorAll('.log-delete-attachment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.uploadId;
      if (confirm('Delete this attachment?')) {
        deleteUpload(uploadId);
        loadLogAttachments();
        attachLogAttachmentHandlers();
      }
    });
  });
}

function loadLogs() {
  const listContainer = document.getElementById('log-list');
  const entries = shipsLogStorage.getAll();

  if (entries.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${renderIcon('book')}</div>
        <p>No trips logged yet</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = entries.map(entry => {
    const hoursStart = entry.engine_hours_start || 'N/A';
    const hoursEnd = entry.engine_hours_end || 'N/A';
    const hoursUsed = (entry.engine_hours_start && entry.engine_hours_end) 
      ? (parseFloat(entry.engine_hours_end) - parseFloat(entry.engine_hours_start)).toFixed(1)
      : null;

    return `
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">${new Date(entry.date).toLocaleDateString()}</h3>
          <p class="text-muted">${entry.departure || 'N/A'} → ${entry.arrival || 'N/A'}</p>
        </div>
        <div>
          ${!logArchived ? `<button class="btn-link" onclick="logPageEdit('${entry.id}')">${renderIcon('edit')}</button>
          <button class="btn-link btn-danger" onclick="logPageDelete('${entry.id}')">${renderIcon('trash')}</button>` : ''}
        </div>
      </div>
      <div>
        <p><strong>Engine Hours:</strong> ${hoursStart} → ${hoursEnd}${hoursUsed ? ` (${hoursUsed} hrs used)` : ''}</p>
        ${entry.distance_nm ? `<p><strong>Distance:</strong> ${entry.distance_nm} nm</p>` : ''}
        ${entry.notes ? `<p><strong>Notes:</strong> ${entry.notes}</p>` : ''}
      </div>
    </div>
  `;
  }).join('');

  attachHandlers();
}

function attachHandlers() {
  window.logPageEdit = (id) => {
    editingId = id;
    showLogForm();
  };

  window.logPageDelete = async (id) => {
    if (confirm('Delete this trip entry?')) {
      await deleteLogEntry(id);
      loadLogs();
    }
  };
}

async function showLogForm() {
  const entries = currentBoatId ? await getLogbook(currentBoatId) : [];
  const entry = editingId ? entries.find((e) => e.id === editingId) : null;

  const formHtml = `
    <div class="card" id="log-form-card">
      <h3>${editingId ? 'Edit Trip' : 'Add Trip'}</h3>
      <form id="log-form">
        <div class="form-group">
          <label for="log_date">Date *</label>
          <input type="date" id="log_date" required value="${entry?.date || new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label for="log_departure">Departure Location</label>
          <input type="text" id="log_departure" value="${entry?.departure || ''}">
        </div>
        <div class="form-group">
          <label for="log_arrival">Arrival Location</label>
          <input type="text" id="log_arrival" value="${entry?.arrival || ''}">
        </div>
        <div class="form-group">
          <label for="log_hours_start">Engine Hours (Start)</label>
          <input type="number" id="log_hours_start" step="0.1" value="${entry?.engine_hours_start || ''}">
        </div>
        <div class="form-group">
          <label for="log_hours_end">Engine Hours (End)</label>
          <input type="number" id="log_hours_end" step="0.1" value="${entry?.engine_hours_end || ''}">
        </div>
        <div class="form-group">
          <label for="log_distance">Distance (nautical miles)</label>
          <input type="number" id="log_distance" step="0.1" value="${entry?.distance_nm || ''}">
        </div>
        <div class="form-group">
          <label for="log_notes">Notes</label>
          <textarea id="log_notes" rows="4">${entry?.notes || ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="logPageCancelForm()">Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  const listContainer = document.getElementById('log-list');
  listContainer.insertAdjacentHTML('afterbegin', formHtml);

  const form = document.getElementById('log-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveLog();
  });

  window.logPageCancelForm = () => {
    document.getElementById('log-form-card').remove();
    editingId = null;
  };
}

async function saveLog() {
  const date = document.getElementById('log_date').value;
  const departure = document.getElementById('log_departure').value;
  const arrival = document.getElementById('log_arrival').value;
  const hoursStart = document.getElementById('log_hours_start').value ? parseFloat(document.getElementById('log_hours_start').value) : null;
  const hoursEnd = document.getElementById('log_hours_end').value ? parseFloat(document.getElementById('log_hours_end').value) : null;
  const distanceNm = document.getElementById('log_distance').value ? parseFloat(document.getElementById('log_distance').value) : null;
  const notes = document.getElementById('log_notes').value;

  const notesPayload = { raw: notes };
  if (hoursStart != null || hoursEnd != null) {
    notesPayload.engine_hours_start = hoursStart;
    notesPayload.engine_hours_end = hoursEnd;
  }
  if (distanceNm != null) notesPayload.distance_nm = distanceNm;

  const payload = {
    date,
    title: 'Trip',
    from_location: departure,
    to_location: arrival,
    hours: hoursEnd ?? hoursStart,
    notes: Object.keys(notesPayload).length > 1 || notesPayload.raw ? JSON.stringify(notesPayload) : null
  };

  if (editingId && String(editingId).includes('-')) {
    await updateLogEntry(editingId, payload);
  } else {
    await createLogEntry(currentBoatId, payload);
  }

  document.getElementById('log-form-card').remove();
  editingId = null;
  loadLogs();
}

export default {
  render,
  onMount
};
