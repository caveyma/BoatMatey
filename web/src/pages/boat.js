/**
 * Boat Details Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { boatsStorage } from '../lib/storage.js';
import { getUploads, saveUpload, deleteUpload, openUpload, formatFileSize, getUpload, MAX_UPLOAD_SIZE_BYTES, MAX_UPLOADS_PER_ENTITY } from '../lib/uploads.js';
import { getBoat as getBoatFromApi, updateBoat as updateBoatApi, isBoatArchived } from '../lib/dataService.js';

let currentBoat = null;
let currentBoatId = null;
let fileInput = null;

function render(params = {}) {
  // Get boat ID from route params
  currentBoatId = params?.id || window.routeParams?.id;
  if (!currentBoatId) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapper;
  }

  currentBoat = boatsStorage.get(currentBoatId);
  
  const wrapper = document.createElement('div');
  
  const header = createYachtHeader('Boat Details');
  wrapper.appendChild(header);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-boat';
  pageContent.appendChild(createBackButton());

  const container = document.createElement('div');
  container.className = 'container';

  const form = document.createElement('form');
  form.className = 'form-container';
  form.innerHTML = `
    <div class="form-group">
      <label for="boat_name">Boat Name *</label>
      <input type="text" id="boat_name" name="boat_name" required value="${currentBoat?.boat_name || ''}">
    </div>

    <div class="form-group">
      <label for="boat_type">Boat Type</label>
      <select id="boat_type" name="boat_type">
        <option value="motor" ${(currentBoat?.boat_type || 'motor') === 'motor' ? 'selected' : ''}>Motor boat</option>
        <option value="sailing" ${currentBoat?.boat_type === 'sailing' ? 'selected' : ''}>Sailing boat</option>
      </select>
    </div>

    <div class="form-group">
      <label for="make_model">Make & Model</label>
      <input type="text" id="make_model" name="make_model" value="${currentBoat?.make_model || ''}">
    </div>

    <div class="form-group">
      <label for="year">Year</label>
      <input type="number" id="year" name="year" min="1900" max="2100" value="${currentBoat?.year || ''}">
    </div>

    <div class="form-group">
      <label for="hull_id">Hull ID / CIN</label>
      <input type="text" id="hull_id" name="hull_id" value="${currentBoat?.hull_id || ''}">
    </div>

    <div class="form-group">
      <label for="length">Length (m)</label>
      <input type="number" id="length" name="length" step="0.1" value="${currentBoat?.length || ''}">
    </div>

    <div class="form-group">
      <label for="beam">Beam (m)</label>
      <input type="number" id="beam" name="beam" step="0.1" value="${currentBoat?.beam || ''}">
    </div>

    <div class="form-group">
      <label for="draft">Draft (m)</label>
      <input type="number" id="draft" name="draft" step="0.1" value="${currentBoat?.draft || ''}">
    </div>

    <div class="card">
      <h3>Registration & Compliance</h3>
      <div class="form-group">
        <label for="home_port">Home Port</label>
        <input type="text" id="home_port" name="home_port" value="${(currentBoat?.home_port ?? '').replace(/"/g, '&quot;')}">
      </div>
      <div class="form-group">
        <label for="registration_number">Registration Number (Part 1 / Official No)</label>
        <input type="text" id="registration_number" name="registration_number" value="${(currentBoat?.registration_number ?? '').replace(/"/g, '&quot;')}">
      </div>
      <div class="form-group">
        <label for="ssr_number">SSR Number</label>
        <input type="text" id="ssr_number" name="ssr_number" value="${(currentBoat?.ssr_number ?? '').replace(/"/g, '&quot;')}">
      </div>
      <div class="form-group">
        <label for="vhf_callsign">VHF Callsign</label>
        <input type="text" id="vhf_callsign" name="vhf_callsign" value="${(currentBoat?.vhf_callsign ?? '').replace(/"/g, '&quot;')}">
      </div>
      <div class="form-group">
        <label for="vhf_mmsi">VHF MMSI</label>
        <input type="text" id="vhf_mmsi" name="vhf_mmsi" value="${(currentBoat?.vhf_mmsi ?? '').replace(/"/g, '&quot;')}">
      </div>
      <div class="form-group">
        <label for="last_survey_date">Last Survey Date</label>
        <input type="date" id="last_survey_date" name="last_survey_date" value="${currentBoat?.last_survey_date || ''}">
      </div>
      <div class="form-group">
        <label for="last_surveyor">Last Surveyor</label>
        <input type="text" id="last_surveyor" name="last_surveyor" value="${(currentBoat?.last_surveyor ?? '').replace(/"/g, '&quot;')}">
      </div>
      <div class="form-group">
        <label for="last_survey_notes">Last Survey Notes</label>
        <textarea id="last_survey_notes" name="last_survey_notes" rows="3">${(currentBoat?.last_survey_notes ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
      </div>
    </div>

    <div class="form-group">
      <label for="fuel_type">Fuel Type</label>
      <select id="fuel_type" name="fuel_type">
        <option value="">Select...</option>
        <option value="diesel" ${currentBoat?.fuel_type === 'diesel' ? 'selected' : ''}>Diesel</option>
        <option value="petrol" ${currentBoat?.fuel_type === 'petrol' ? 'selected' : ''}>Petrol</option>
        <option value="electric" ${currentBoat?.fuel_type === 'electric' ? 'selected' : ''}>Electric</option>
      </select>
    </div>

    <div class="form-group">
      <label class="checkbox-row">
        <input
          type="checkbox"
          id="watermaker_installed"
          name="watermaker_installed"
          ${currentBoat?.watermaker_installed ? 'checked' : ''}
        >
        <span>Watermaker installed</span>
      </label>
      <p class="text-muted" style="margin-top: 0.25rem; font-size: 0.875rem;">
        When enabled, a Watermaker Service card appears on your boat dashboard.
      </p>
    </div>

    <div class="form-group">
      <label for="home_marina">Home Marina</label>
      <input type="text" id="home_marina" name="home_marina" value="${currentBoat?.home_marina || ''}">
    </div>

    <div class="form-group">
      <label for="registration_no">Local Registration Number</label>
      <input type="text" id="registration_no" name="registration_no" value="${currentBoat?.registration_no || ''}">
    </div>

    <div class="form-group">
      <label for="insurance_provider">Insurance Provider</label>
      <input type="text" id="insurance_provider" name="insurance_provider" value="${currentBoat?.insurance_provider || ''}">
    </div>

    <div class="form-group">
      <label for="insurance_policy_no">Insurance Policy Number</label>
      <input type="text" id="insurance_policy_no" name="insurance_policy_no" value="${currentBoat?.insurance_policy_no || ''}">
    </div>

    <div class="form-group">
      <label for="purchase_date">Purchase Date</label>
      <input type="date" id="purchase_date" name="purchase_date" value="${currentBoat?.purchase_date || ''}">
    </div>

    <div class="card">
      <h3>Attachments</h3>
      <div class="attachment-list" id="attachments-list"></div>
      <input type="file" id="file-input" multiple accept=".pdf,.jpg,.jpeg,.png" style="display: none;">
      <button type="button" class="btn-secondary" id="add-attachment-btn">
        ${renderIcon('plus')} Add Attachment
      </button>
    </div>

    <div class="form-actions">
      <button type="button" class="btn-secondary" id="cancel-btn">Cancel</button>
      <button type="submit" class="btn-primary">Save</button>
    </div>
  `;

  container.appendChild(form);
  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);

  return wrapper;
}

async function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  if (boatId) {
    currentBoatId = boatId;
    try {
      const remoteBoat = await getBoatFromApi(boatId);
      if (remoteBoat) {
        const local = boatsStorage.get(boatId) || {};
        currentBoat = { ...local, ...remoteBoat };
        // Keep local values for detail fields when remote has none (e.g. sync failed or migration not run)
        const detailKeys = ['fuel_type', 'home_marina', 'registration_no', 'insurance_provider', 'insurance_policy_no', 'purchase_date'];
        detailKeys.forEach((k) => {
          const r = currentBoat[k];
          const l = local[k];
          if ((r == null || r === '') && (l != null && l !== '')) currentBoat[k] = l;
        });
        boatsStorage.save({ id: boatId, ...currentBoat });
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
        set('boat_name', currentBoat.boat_name);
        set('boat_type', currentBoat.boat_type);
        set('make_model', currentBoat.make_model);
        set('year', currentBoat.year);
        set('hull_id', currentBoat.hull_id);
        set('length', currentBoat.length);
        set('beam', currentBoat.beam);
        set('draft', currentBoat.draft);
        set('home_port', currentBoat.home_port);
        set('registration_number', currentBoat.registration_number);
        set('ssr_number', currentBoat.ssr_number);
        set('vhf_callsign', currentBoat.vhf_callsign);
        set('vhf_mmsi', currentBoat.vhf_mmsi);
        set('last_survey_date', currentBoat.last_survey_date);
        set('last_surveyor', currentBoat.last_surveyor);
        const notesEl = document.getElementById('last_survey_notes');
        if (notesEl) notesEl.value = currentBoat.last_survey_notes ?? '';
        set('fuel_type', currentBoat.fuel_type);
        set('home_marina', currentBoat.home_marina);
        set('registration_no', currentBoat.registration_no);
        set('insurance_provider', currentBoat.insurance_provider);
        set('insurance_policy_no', currentBoat.insurance_policy_no);
        set('purchase_date', currentBoat.purchase_date);
        const watermakerEl = document.getElementById('watermaker_installed');
        if (watermakerEl) watermakerEl.checked = !!currentBoat.watermaker_installed;
      } else {
        currentBoat = boatsStorage.get(boatId);
      }
    } catch (e) {
      console.error('Error loading boat from Supabase, falling back to local:', e);
      currentBoat = boatsStorage.get(boatId);
    }

    const archived = await isBoatArchived(boatId);
    const addAttachmentBtn = document.getElementById('add-attachment-btn');
    const saveBtn = document.querySelector('button[type="submit"]');
    const cancelBtn = document.getElementById('cancel-btn');
    const inputs = document.querySelectorAll('form input, form select');
    if (archived) {
      if (addAttachmentBtn) addAttachmentBtn.style.display = 'none';
      if (saveBtn) saveBtn.style.display = 'none';
      if (cancelBtn) cancelBtn.style.display = 'none';
      inputs.forEach((el) => { el.disabled = true; });
    }
  }
  fileInput = document.getElementById('file-input');
  const addBtn = document.getElementById('add-attachment-btn');
  const attachmentsList = document.getElementById('attachments-list');

  // Load attachments
  loadAttachments();

  // File input handler with size/count limits
  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const existing = getUploads('boat', currentBoatId, currentBoatId);
    const remainingSlots = MAX_UPLOADS_PER_ENTITY - existing.length;

    if (remainingSlots <= 0) {
      alert(`You can only upload up to ${MAX_UPLOADS_PER_ENTITY} files for Boat Details.`);
      fileInput.value = '';
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
      alert(`Some files were larger than 5 MB and were skipped.`);
    }

    if (!validFiles.length) {
      fileInput.value = '';
      return;
    }

    const filesToUpload = validFiles.slice(0, remainingSlots);
    if (validFiles.length > remainingSlots) {
      alert(`Only ${remainingSlots} more file(s) can be uploaded for Boat Details (max ${MAX_UPLOADS_PER_ENTITY}).`);
    }

    for (const file of filesToUpload) {
      await saveUpload(file, 'boat', currentBoatId, currentBoatId);
    }

    fileInput.value = '';
    loadAttachments();
    attachEventHandlers();
  });

  addBtn.addEventListener('click', () => {
    fileInput.click();
  });

  // Form submit handler
  const form = document.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveBoat();
  });

  // Cancel button
  const cancelBtn = document.getElementById('cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      window.history.back();
    });
  }

  attachEventHandlers();
}

function attachEventHandlers() {
  // Remove old handlers
  document.querySelectorAll('.open-attachment-btn').forEach(btn => {
    btn.replaceWith(btn.cloneNode(true));
  });
  document.querySelectorAll('.delete-attachment-btn').forEach(btn => {
    btn.replaceWith(btn.cloneNode(true));
  });

  // Add new handlers
  document.querySelectorAll('.open-attachment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.uploadId;
      const upload = getUpload(uploadId);
      if (upload) {
        openUpload(upload);
      }
    });
  });

  document.querySelectorAll('.delete-attachment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.uploadId;
      if (confirm('Delete this attachment?')) {
        deleteUpload(uploadId);
        loadAttachments();
        attachEventHandlers();
      }
    });
  });
}

function loadAttachments() {
  const attachmentsList = document.getElementById('attachments-list');
  if (!attachmentsList || !currentBoatId) return;

  const attachments = getUploads('boat', currentBoatId, currentBoatId);
  attachmentsList.innerHTML = '';

  if (attachments.length === 0) {
    attachmentsList.innerHTML = '<p class="text-muted">No attachments</p>';
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
        <button type="button" class="btn-link open-attachment-btn" data-upload-id="${upload.id}">
          Open
        </button>
        <button type="button" class="btn-link btn-danger delete-attachment-btn" data-upload-id="${upload.id}">
          ${renderIcon('trash')}
        </button>
      </div>
    `;
    attachmentsList.appendChild(item);
  });
}

async function saveBoat() {
  const form = document.querySelector('form');
  const formData = new FormData(form);
  
  const boat = {
    boat_name: formData.get('boat_name'),
    boat_type: formData.get('boat_type') || 'motor',
    make_model: formData.get('make_model'),
    year: formData.get('year') || null,
    hull_id: formData.get('hull_id'),
    length: formData.get('length') ? parseFloat(formData.get('length')) : null,
    beam: formData.get('beam') ? parseFloat(formData.get('beam')) : null,
    draft: formData.get('draft') ? parseFloat(formData.get('draft')) : null,
    fuel_type: formData.get('fuel_type'),
    watermaker_installed: formData.get('watermaker_installed') === 'on',
    home_marina: formData.get('home_marina'),
    registration_no: formData.get('registration_no'),
    registration_number: formData.get('registration_number') || null,
    ssr_number: formData.get('ssr_number') || null,
    vhf_callsign: formData.get('vhf_callsign') || null,
    vhf_mmsi: formData.get('vhf_mmsi') || null,
    last_survey_date: formData.get('last_survey_date') || null,
    last_surveyor: formData.get('last_surveyor') || null,
    last_survey_notes: formData.get('last_survey_notes') || null,
    home_port: formData.get('home_port') || null,
    insurance_provider: formData.get('insurance_provider'),
    insurance_policy_no: formData.get('insurance_policy_no'),
    purchase_date: formData.get('purchase_date') || null,
    updated_at: new Date().toISOString()
  };

  if (currentBoat) {
    boat.created_at = currentBoat.created_at;
  } else {
    boat.created_at = new Date().toISOString();
  }

  boatsStorage.save({ id: currentBoatId, ...boat });

  // Persist to Supabase when available; only show "saved" if sync succeeded
  try {
    const syncError = await updateBoatApi(currentBoatId, { ...boat, boat_type: boat.boat_type });
    if (syncError) {
      alert('Saved on this device, but could not sync to cloud. If Fuel type, Home marina, etc. stay blank after reopening, run the database migration that adds those columns to the boats table.');
    } else {
      alert('Boat details saved!');
    }
  } catch (e) {
    alert('Saved on this device. Cloud sync failed — check your connection.');
  }
  navigate(`/boat/${currentBoatId}`);
}


export default {
  render,
  onMount
};
