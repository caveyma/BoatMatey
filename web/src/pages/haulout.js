/**
 * Haul-Out Maintenance Page
 *
 * Mirrors the Service History page patterns but focused on lift-out maintenance,
 * including antifoul, anodes, running gear, seacocks, hull checks, costs, and notes.
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { isBoatArchived, getHaulouts, createHaulout, updateHaulout, deleteHaulout } from '../lib/dataService.js';
import {
  getUploads,
  saveUpload,
  deleteUpload,
  openUpload,
  formatFileSize,
  getUpload,
  LIMITED_UPLOAD_SIZE_BYTES,
  LIMITED_UPLOADS_PER_ENTITY
} from '../lib/uploads.js';

let editingId = null;
let currentBoatId = null;
let hauloutFileInput = null;
let currentHauloutIdForUpload = null;
let hauloutArchived = false;

function render(params = {}) {
  // Get boat ID and optional entryId from route params
  currentBoatId = params?.id || window.routeParams?.id;
  const entryId = params?.entryId || window.routeParams?.entryId;
  const isEditPage = !!entryId;

  if (!currentBoatId) {
    const wrapperError = document.createElement('div');
    wrapperError.innerHTML =
      '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapperError;
  }

  const wrapper = document.createElement('div');

  const yachtHeader = createYachtHeader(
    isEditPage ? (entryId === 'new' ? 'Add Haul-Out' : 'Edit Haul-Out') : 'Haul-Out Maintenance'
  );
  wrapper.appendChild(yachtHeader);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-haulout';
  pageContent.appendChild(createBackButton());

  const container = document.createElement('div');
  container.className = 'container';

  if (isEditPage) {
    container.id = 'haulout-list';
    pageContent.appendChild(container);
    wrapper.appendChild(pageContent);
    return wrapper;
  }

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.id = 'haulout-add-btn';
  addBtn.innerHTML = `${renderIcon('plus')} Add Haul-Out Record`;
  addBtn.onclick = () => navigate(`/boat/${currentBoatId}/haulout/new`);

  const listContainer = document.createElement('div');
  listContainer.id = 'haulout-list';

  // Single hidden file input reused for per-entry attachments
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = 'haulout-file-input';
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
  const entryId = params?.entryId || window.routeParams?.entryId;
  if (boatId) {
    currentBoatId = boatId;
  }

  window.navigate = navigate;

  hauloutArchived = currentBoatId ? await isBoatArchived(currentBoatId) : false;

  if (entryId) {
    editingId = entryId === 'new' ? `haulout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : entryId;
    await showHauloutForm();
    return;
  }

  const addBtn = document.getElementById('haulout-add-btn');
  if (addBtn && hauloutArchived) addBtn.style.display = 'none';

  hauloutFileInput = document.getElementById('haulout-file-input');

  if (hauloutFileInput) {
    hauloutFileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length || !currentBoatId || !currentHauloutIdForUpload) return;

      const existing = getUploads('haulout', currentHauloutIdForUpload, currentBoatId);
      const remainingSlots = LIMITED_UPLOADS_PER_ENTITY - existing.length;

      if (remainingSlots <= 0) {
        alert(`You can only upload up to ${LIMITED_UPLOADS_PER_ENTITY} files for this haul-out.`);
        hauloutFileInput.value = '';
        return;
      }

      const validFiles = [];
      let oversizedCount = 0;

      files.forEach((file) => {
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
        hauloutFileInput.value = '';
        return;
      }

      const filesToUpload = validFiles.slice(0, remainingSlots);
      if (validFiles.length > remainingSlots) {
        alert(
          `Only ${remainingSlots} more file(s) can be uploaded for this haul-out (max ${LIMITED_UPLOADS_PER_ENTITY}).`
        );
      }

      for (const file of filesToUpload) {
        await saveUpload(file, 'haulout', currentHauloutIdForUpload, currentBoatId);
      }

      hauloutFileInput.value = '';
      loadHaulouts();
    });
  }

  loadHaulouts();
}

async function loadHaulouts() {
  const listContainer = document.getElementById('haulout-list');
  const haulouts = currentBoatId ? await getHaulouts(currentBoatId) : [];

  if (!haulouts || haulouts.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${renderIcon('wrench')}</div>
        <p>No haul-out records yet</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = haulouts
    .map((entry) => {
      const hauloutDate = entry.haulout_date ? new Date(entry.haulout_date).toLocaleDateString() : 'N/A';
      const launchDate = entry.launch_date ? new Date(entry.launch_date).toLocaleDateString() : 'N/A';
      const yard = entry.yard_marina || 'N/A';
      const reason = entry.reason_for_liftout || 'N/A';

      return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">${hauloutDate}</h3>
            <p class="text-muted">${yard} • ${reason}</p>
          </div>
          <div>
            ${!hauloutArchived ? `<a href="#/boat/${currentBoatId}/haulout/${entry.id}" class="btn-link" onclick="event.preventDefault(); window.navigate('/boat/${currentBoatId}/haulout/${entry.id}')">${renderIcon('edit')}</a>
            <button class="btn-link btn-danger" onclick="hauloutPageDelete('${entry.id}')">${renderIcon('trash')}</button>` : ''}
          </div>
        </div>
        <div>
          <p><strong>Launch date:</strong> ${launchDate}</p>
          ${
            entry.antifoul_brand || entry.antifoul_product_name
              ? `<p><strong>Antifoul:</strong> ${[
                  entry.antifoul_brand,
                  entry.antifoul_product_name,
                  entry.antifoul_type,
                  entry.antifoul_colour
                ]
                  .filter(Boolean)
                  .join(' • ')}</p>`
              : ''
          }
          ${
            entry.total_cost
              ? `<p><strong>Total cost:</strong> ${entry.total_cost}</p>`
              : ''
          }
          ${entry.general_notes ? `<p><strong>Notes:</strong> ${entry.general_notes}</p>` : ''}
          <div class="haulout-attachments" data-haulout-id="${entry.id}">
            <h4 style="margin-top: 0.75rem; margin-bottom: 0.25rem;">Photos & Documents</h4>
            <div class="attachment-list" id="haulout-attachments-list-${entry.id}"></div>
            <button type="button" class="btn-link" onclick="hauloutPageAddAttachment('${entry.id}')">
              ${renderIcon('plus')} Add Attachment (max ${LIMITED_UPLOADS_PER_ENTITY}, 2 MB each)
            </button>
          </div>
        </div>
      </div>
    `;
    })
    .join('');

  attachListHandlers();
  loadHauloutAttachments(haulouts);
}

function attachListHandlers() {
  window.hauloutPageDelete = async (id) => {
    if (confirm('Delete this haul-out record?')) {
      await deleteHaulout(id);
      loadHaulouts();
    }
  };

  window.hauloutPageAddAttachment = (hauloutId) => {
    currentHauloutIdForUpload = hauloutId;
    if (hauloutFileInput) {
      hauloutFileInput.click();
    }
  };
}

function loadHauloutAttachments(entries) {
  if (!currentBoatId) return;

  entries.forEach((entry) => {
    const attachmentsList = document.getElementById(`haulout-attachments-list-${entry.id}`);
    if (!attachmentsList) return;

    const attachments = getUploads('haulout', entry.id, currentBoatId);
    attachmentsList.innerHTML = '';

    if (attachments.length === 0) {
      attachmentsList.innerHTML = `<p class="text-muted">No attachments.</p>`;
      return;
    }

    attachments.forEach((upload) => {
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
          <button type="button" class="btn-link haulout-open-attachment-btn" data-upload-id="${upload.id}">
            Open
          </button>
          <button type="button" class="btn-link btn-danger haulout-delete-attachment-btn" data-upload-id="${upload.id}">
            ${renderIcon('trash')}
          </button>
        </div>
      `;
      attachmentsList.appendChild(item);
    });
  });

  attachHauloutAttachmentHandlers();
}

function attachHauloutAttachmentHandlers() {
  document.querySelectorAll('.haulout-open-attachment-btn').forEach((btn) => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });
  document.querySelectorAll('.haulout-delete-attachment-btn').forEach((btn) => {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
  });

  document.querySelectorAll('.haulout-open-attachment-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.uploadId;
      const upload = getUpload(uploadId);
      if (upload) {
        openUpload(upload);
      }
    });
  });

  document.querySelectorAll('.haulout-delete-attachment-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const uploadId = btn.dataset.uploadId;
      if (confirm('Delete this attachment?')) {
        deleteUpload(uploadId);
        loadHaulouts();
      }
    });
  });
}

async function showHauloutForm() {
  const haulouts = currentBoatId ? await getHaulouts(currentBoatId) : [];
  const existingEntry = editingId ? haulouts.find((e) => e.id === editingId) : null;
  if (!editingId) {
    editingId = `haulout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  const entry = existingEntry;

  const reasons = ['Annual maintenance', 'Antifoul', 'Repairs', 'Survey prep', 'Insurance', 'Other'];
  const antifoulTypes = ['Hard', 'Self-polishing', 'Hybrid'];
  const appliedByOptions = ['DIY', 'Yard'];
  const anodeMaterials = ['Zinc', 'Aluminium', 'Magnesium'];
  const oldAnodeConditions = ['Good', 'Worn', 'Gone'];
  const propsConditions = ['Good', 'Fair', 'Poor'];
  const propsServicedOptions = ['Polished', 'Balanced', 'Repaired'];
  const shaftConditions = ['Good', 'Issues noted'];
  const cutlessOptions = ['OK', 'Replaced'];
  const rudderOptions = ['OK', 'Issues noted'];
  const seacocksInspectedOptions = ['All', 'Some', 'None'];
  const seacockMaterials = ['Bronze', 'Composite', 'Brass'];
  const hullConditions = ['Good', 'Blistering', 'Damage noted'];
  const osmosisOptions = ['Not checked', 'No signs', 'Signs present'];
  const keelTabsOptions = ['OK', 'Notes'];

  const selectedPropsServiced = entry?.props_serviced || [];

  const formHtml = `
    <div class="card" id="haulout-form-card">
      <h3>${existingEntry ? 'Edit Haul-Out Record' : 'Add Haul-Out Record'}</h3>
      <form id="haulout-form">
        <div class="form-section">
          <h4>Core Details</h4>
          <div class="form-group">
            <label for="haulout_date">Haul-out date *</label>
            <input type="date" id="haulout_date" required value="${
              entry?.haulout_date || new Date().toISOString().split('T')[0]
            }">
          </div>
          <div class="form-group">
            <label for="launch_date">Launch date</label>
            <input type="date" id="launch_date" value="${entry?.launch_date || ''}">
          </div>
          <div class="form-group">
            <label for="yard_marina">Yard / Marina</label>
            <input type="text" id="yard_marina" value="${entry?.yard_marina || ''}">
          </div>
          <div class="form-group">
            <label for="reason_for_liftout">Reason for lift-out</label>
            <select id="reason_for_liftout">
              <option value="">Select...</option>
              ${reasons
                .map(
                  (r) =>
                    `<option value="${r}" ${entry?.reason_for_liftout === r ? 'selected' : ''}>${r}</option>`
                )
                .join('')}
            </select>
          </div>
        </div>

        <div class="form-section">
          <h4>Antifoul</h4>
          <div class="form-group">
            <label for="antifoul_brand">Antifoul brand</label>
            <input type="text" id="antifoul_brand" value="${entry?.antifoul_brand || ''}">
          </div>
          <div class="form-group">
            <label for="antifoul_product_name">Product name</label>
            <input type="text" id="antifoul_product_name" value="${entry?.antifoul_product_name || ''}">
          </div>
          <div class="form-group">
            <label for="antifoul_type">Type</label>
            <select id="antifoul_type">
              <option value="">Select...</option>
              ${antifoulTypes
                .map(
                  (t) => `<option value="${t}" ${entry?.antifoul_type === t ? 'selected' : ''}>${t}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="antifoul_colour">Colour</label>
            <input type="text" id="antifoul_colour" value="${entry?.antifoul_colour || ''}">
          </div>
          <div class="form-group">
            <label for="antifoul_coats">Number of coats</label>
            <input type="number" id="antifoul_coats" min="0" step="1" value="${
              typeof entry?.antifoul_coats === 'number' ? entry.antifoul_coats : ''
            }">
          </div>
          <div class="form-group">
            <label class="checkbox-row">
              <input type="checkbox" id="antifoul_last_stripped_blasted" ${
                entry?.antifoul_last_stripped_blasted ? 'checked' : ''
              }>
              <span>Last stripped or blasted</span>
            </label>
          </div>
          <div class="form-group">
            <label for="antifoul_applied_by">Applied by</label>
            <select id="antifoul_applied_by">
              <option value="">Select...</option>
              ${appliedByOptions
                .map(
                  (opt) =>
                    `<option value="${opt}" ${entry?.antifoul_applied_by === opt ? 'selected' : ''}>${opt}</option>`
                )
                .join('')}
            </select>
          </div>
        </div>

        <div class="form-section">
          <h4>Anodes</h4>
          <div class="form-group">
            <label for="anode_material">Anode material</label>
            <select id="anode_material">
              <option value="">Select...</option>
              ${anodeMaterials
                .map(
                  (m) => `<option value="${m}" ${entry?.anode_material === m ? 'selected' : ''}>${m}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="checkbox-row">
              <input type="checkbox" id="anodes_replaced" ${entry?.anodes_replaced ? 'checked' : ''}>
              <span>Anodes replaced</span>
            </label>
          </div>
          <div class="form-group">
            <label for="anode_locations">Locations</label>
            <input
              type="text"
              id="anode_locations"
              placeholder="e.g. shafts, props, trim tabs, hull, thrusters"
              value="${entry?.anode_locations || ''}"
            >
          </div>
          <div class="form-group">
            <label for="old_anode_condition">Old anode condition</label>
            <select id="old_anode_condition">
              <option value="">Select...</option>
              ${oldAnodeConditions
                .map(
                  (c) =>
                    `<option value="${c}" ${entry?.old_anode_condition === c ? 'selected' : ''}>${c}</option>`
                )
                .join('')}
            </select>
          </div>
        </div>

        <div class="form-section">
          <h4>Props, Shafts & Running Gear</h4>
          <div class="form-group">
            <label for="props_condition">Props condition</label>
            <select id="props_condition">
              <option value="">Select...</option>
              ${propsConditions
                .map(
                  (c) =>
                    `<option value="${c}" ${entry?.props_condition === c ? 'selected' : ''}>${c}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Props serviced</label>
            <div class="checkbox-group">
              ${propsServicedOptions
                .map(
                  (opt) => `
                    <label class="checkbox-row">
                      <input type="checkbox" class="props_serviced_option" value="${opt}" ${
                        selectedPropsServiced.includes(opt) ? 'checked' : ''
                      }>
                      <span>${opt}</span>
                    </label>
                  `
                )
                .join('')}
            </div>
          </div>
          <div class="form-group">
            <label for="shaft_condition">Shaft condition</label>
            <select id="shaft_condition">
              <option value="">Select...</option>
              ${shaftConditions
                .map(
                  (c) =>
                    `<option value="${c}" ${entry?.shaft_condition === c ? 'selected' : ''}>${c}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="form-group" id="shaft_issues_group" style="display: ${
            entry?.shaft_condition === 'Issues noted' ? 'block' : 'none'
          };">
            <label for="shaft_issues">Shaft issues / notes</label>
            <textarea id="shaft_issues" rows="3">${entry?.shaft_issues || ''}</textarea>
          </div>
          <div class="form-group">
            <label for="cutless_bearings_checked">Cutless bearings checked</label>
            <select id="cutless_bearings_checked">
              <option value="">Select...</option>
              ${cutlessOptions
                .map(
                  (c) =>
                    `<option value="${c}" ${
                      entry?.cutless_bearings_checked === c ? 'selected' : ''
                    }>${c}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="rudder_steering_checked">Rudder / steering gear checked</label>
            <select id="rudder_steering_checked">
              <option value="">Select...</option>
              ${rudderOptions
                .map(
                  (c) =>
                    `<option value="${c}" ${
                      entry?.rudder_steering_checked === c ? 'selected' : ''
                    }>${c}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="form-group" id="rudder_steering_issues_group" style="display: ${
            entry?.rudder_steering_checked === 'Issues noted' ? 'block' : 'none'
          };">
            <label for="rudder_steering_issues">Rudder / steering issues</label>
            <textarea id="rudder_steering_issues" rows="3">${entry?.rudder_steering_issues || ''}</textarea>
          </div>
        </div>

        <div class="form-section">
          <h4>Through-Hull & Seacocks</h4>
          <div class="form-group">
            <label for="seacocks_inspected">Seacocks inspected</label>
            <select id="seacocks_inspected">
              <option value="">Select...</option>
              ${seacocksInspectedOptions
                .map(
                  (c) =>
                    `<option value="${c}" ${
                      entry?.seacocks_inspected === c ? 'selected' : ''
                    }>${c}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="checkbox-row">
              <input type="checkbox" id="seacocks_replaced" ${entry?.seacocks_replaced ? 'checked' : ''}>
              <span>Seacocks replaced</span>
            </label>
          </div>
          <div class="form-group">
            <label for="seacock_material">Seacock material</label>
            <select id="seacock_material">
              <option value="">Select...</option>
              ${seacockMaterials
                .map(
                  (m) =>
                    `<option value="${m}" ${entry?.seacock_material === m ? 'selected' : ''}>${m}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="seacocks_issues">Issues noted</label>
            <textarea id="seacocks_issues" rows="3">${entry?.seacocks_issues || ''}</textarea>
          </div>
        </div>

        <div class="form-section">
          <h4>Hull & Structure Checks</h4>
          <div class="form-group">
            <label for="hull_condition">Hull condition</label>
            <select id="hull_condition">
              <option value="">Select...</option>
              ${hullConditions
                .map(
                  (c) =>
                    `<option value="${c}" ${entry?.hull_condition === c ? 'selected' : ''}>${c}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="form-group" id="hull_issues_group" style="display: ${
            entry && (entry.hull_condition === 'Blistering' || entry.hull_condition === 'Damage noted')
              ? 'block'
              : 'none'
          };">
            <label for="hull_issues">Hull issues / damage notes</label>
            <textarea id="hull_issues" rows="3">${entry?.hull_issues || ''}</textarea>
          </div>
          <div class="form-group">
            <label for="osmosis_check">Osmosis check</label>
            <select id="osmosis_check">
              <option value="">Select...</option>
              ${osmosisOptions
                .map(
                  (c) =>
                    `<option value="${c}" ${entry?.osmosis_check === c ? 'selected' : ''}>${c}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="form-group" id="osmosis_notes_group" style="display: ${
            entry?.osmosis_check === 'Signs present' ? 'block' : 'none'
          };">
            <label for="osmosis_notes">Osmosis notes (signs present)</label>
            <textarea id="osmosis_notes" rows="3">${entry?.osmosis_notes || ''}</textarea>
          </div>
          <div class="form-group">
            <label for="keel_skeg_trim_tabs_checked">Keel / skeg / trim tabs checked</label>
            <select id="keel_skeg_trim_tabs_checked">
              <option value="">Select...</option>
              ${keelTabsOptions
                .map(
                  (c) =>
                    `<option value="${c}" ${
                      entry?.keel_skeg_trim_tabs_checked === c ? 'selected' : ''
                    }>${c}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="form-group" id="keel_skeg_trim_tabs_notes_group" style="display: ${
            entry?.keel_skeg_trim_tabs_checked === 'Notes' ? 'block' : 'none'
          };">
            <label for="keel_skeg_trim_tabs_notes">Keel / skeg / trim tabs notes</label>
            <textarea id="keel_skeg_trim_tabs_notes" rows="3">${entry?.keel_skeg_trim_tabs_notes || ''}</textarea>
          </div>
        </div>

        <div class="form-section">
          <h4>Costs & Supplier</h4>
          <div class="form-group">
            <label for="yard_contractor_name">Yard / contractor name</label>
            <input type="text" id="yard_contractor_name" value="${entry?.yard_contractor_name || ''}">
          </div>
          <div class="form-group">
            <label for="total_cost">Total cost</label>
            <input type="number" id="total_cost" step="0.01" min="0" placeholder="0.00" value="${
              typeof entry?.total_cost === 'number' ? entry.total_cost : ''
            }">
          </div>
          <p class="text-muted">
            Invoice and supporting documents can be uploaded below using the attachments area.
          </p>
        </div>

        <div class="form-section">
          <h4>Next Haul-Out Reminder</h4>
          <p class="text-muted">
            Optionally set a suggested date for the next haul-out. This will appear on the
            Calendar on the home page for reminders and appointments.
          </p>
          <div class="form-group">
            <label for="next_haulout_due">Next haul-out due</label>
            <input type="date" id="next_haulout_due" value="${entry?.next_haulout_due || ''}">
          </div>
          <div class="form-group">
            <label for="next_haulout_reminder">Reminder</label>
            <select id="next_haulout_reminder">
              <option value="0" ${(entry?.next_haulout_reminder_minutes ?? 1440) === 0 ? 'selected' : ''}>None</option>
              <option value="5" ${entry?.next_haulout_reminder_minutes === 5 ? 'selected' : ''}>5 minutes before</option>
              <option value="15" ${entry?.next_haulout_reminder_minutes === 15 ? 'selected' : ''}>15 minutes before</option>
              <option value="30" ${entry?.next_haulout_reminder_minutes === 30 ? 'selected' : ''}>30 minutes before</option>
              <option value="60" ${entry?.next_haulout_reminder_minutes === 60 ? 'selected' : ''}>1 hour before</option>
              <option value="120" ${entry?.next_haulout_reminder_minutes === 120 ? 'selected' : ''}>2 hours before</option>
              <option value="1440" ${(entry?.next_haulout_reminder_minutes ?? 1440) === 1440 ? 'selected' : ''}>1 day before</option>
              <option value="2880" ${entry?.next_haulout_reminder_minutes === 2880 ? 'selected' : ''}>2 days before</option>
              <option value="10080" ${entry?.next_haulout_reminder_minutes === 10080 ? 'selected' : ''}>1 week before</option>
            </select>
          </div>
        </div>

        <div class="card" id="haulout-attachments-card" style="margin-top: 1rem;">
          <h4>Photos & Documents</h4>
          <p class="text-muted">
            Upload before/after photos, invoices, and additional documents (PDF/images).
            You can attach up to ${LIMITED_UPLOADS_PER_ENTITY} files per haul-out (max 2 MB each).
          </p>
          <div class="attachment-list" id="haulout-attachments-list-form"></div>
          <input type="file" id="haulout-file-input-form" multiple accept=".pdf,.jpg,.jpeg,.png" style="display: none;">
          <button type="button" class="btn-secondary" id="haulout-add-file-btn" style="margin-top: 0.5rem;">
            ${renderIcon('plus')} Add File
          </button>
        </div>

        <div class="form-section">
          <h4>Notes</h4>
          <div class="form-group">
            <label for="general_notes">General notes</label>
            <textarea id="general_notes" rows="4">${entry?.general_notes || ''}</textarea>
          </div>
          <div class="form-group">
            <label for="recommendations_next_haulout">Recommendations for next haul-out</label>
            <textarea id="recommendations_next_haulout" rows="4">${entry?.recommendations_next_haulout || ''}</textarea>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="hauloutPageCancelForm()">Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  const listContainer = document.getElementById('haulout-list');
  listContainer.insertAdjacentHTML('afterbegin', formHtml);

  const form = document.getElementById('haulout-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveHaulout();
  });

  // Toggle conditional issue/notes fields based on dropdown selections
  initHauloutIssueToggles();

  // Attach per-entry attachments handlers for this entry
  initHauloutFormAttachments(editingId);

  window.hauloutPageCancelForm = () => {
    const card = document.getElementById('haulout-form-card');
    if (card) card.remove();
    editingId = null;
    const hash = window.location.hash || '';
    if (hash.includes('/haulout/') && !hash.endsWith('/haulout')) {
      navigate(`/boat/${currentBoatId}/haulout`);
    }
  };
}

function initHauloutFormAttachments(hauloutId) {
  const fileInput = document.getElementById('haulout-file-input-form');
  const addFileBtn = document.getElementById('haulout-add-file-btn');

  if (addFileBtn && fileInput) {
    addFileBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length || !currentBoatId) return;

      const existing = getUploads('haulout', hauloutId, currentBoatId);
      const remainingSlots = LIMITED_UPLOADS_PER_ENTITY - existing.length;

      if (remainingSlots <= 0) {
        alert(`You can only upload up to ${LIMITED_UPLOADS_PER_ENTITY} files for this haul-out.`);
        fileInput.value = '';
        return;
      }

      const validFiles = [];
      let oversizedCount = 0;

      files.forEach((file) => {
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
        alert(
          `Only ${remainingSlots} more file(s) can be uploaded for this haul-out (max ${LIMITED_UPLOADS_PER_ENTITY}).`
        );
      }

      for (const file of filesToUpload) {
        await saveUpload(file, 'haulout', hauloutId, currentBoatId);
      }

      fileInput.value = '';
      loadHauloutFormAttachments(hauloutId);
    });
  }

  loadHauloutFormAttachments(hauloutId);
}

function loadHauloutFormAttachments(hauloutId) {
  const attachmentsList = document.getElementById('haulout-attachments-list-form');
  if (!attachmentsList || !currentBoatId) return;

  const attachments = getUploads('haulout', hauloutId, currentBoatId);
  attachmentsList.innerHTML = '';

  if (attachments.length === 0) {
    attachmentsList.innerHTML = `<p class="text-muted">No files added yet.</p>`;
    return;
  }

  attachments.forEach((upload) => {
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
        <button type="button" class="btn-link haulout-open-attachment-btn" data-upload-id="${upload.id}">
          Open
        </button>
        <button type="button" class="btn-link btn-danger haulout-delete-attachment-btn" data-upload-id="${upload.id}">
          ${renderIcon('trash')}
        </button>
      </div>
    `;
    attachmentsList.appendChild(item);
  });

  attachHauloutAttachmentHandlers();
}

function collectPropsServiced() {
  const checkboxes = Array.from(document.querySelectorAll('.props_serviced_option'));
  return checkboxes.filter((cb) => cb.checked).map((cb) => cb.value);
}

function initHauloutIssueToggles() {
  const shaftSelect = document.getElementById('shaft_condition');
  const shaftGroup = document.getElementById('shaft_issues_group');
  const rudderSelect = document.getElementById('rudder_steering_checked');
  const rudderGroup = document.getElementById('rudder_steering_issues_group');
  const hullSelect = document.getElementById('hull_condition');
  const hullGroup = document.getElementById('hull_issues_group');
  const osmosisSelect = document.getElementById('osmosis_check');
  const osmosisGroup = document.getElementById('osmosis_notes_group');
  const keelSelect = document.getElementById('keel_skeg_trim_tabs_checked');
  const keelGroup = document.getElementById('keel_skeg_trim_tabs_notes_group');

  if (shaftSelect && shaftGroup) {
    const update = () => {
      shaftGroup.style.display = shaftSelect.value === 'Issues noted' ? 'block' : 'none';
    };
    shaftSelect.addEventListener('change', update);
    update();
  }

  if (rudderSelect && rudderGroup) {
    const update = () => {
      rudderGroup.style.display = rudderSelect.value === 'Issues noted' ? 'block' : 'none';
    };
    rudderSelect.addEventListener('change', update);
    update();
  }

  if (hullSelect && hullGroup) {
    const update = () => {
      hullGroup.style.display =
        hullSelect.value === 'Blistering' || hullSelect.value === 'Damage noted' ? 'block' : 'none';
    };
    hullSelect.addEventListener('change', update);
    update();
  }

  if (osmosisSelect && osmosisGroup) {
    const update = () => {
      osmosisGroup.style.display = osmosisSelect.value === 'Signs present' ? 'block' : 'none';
    };
    osmosisSelect.addEventListener('change', update);
    update();
  }

  if (keelSelect && keelGroup) {
    const update = () => {
      keelGroup.style.display = keelSelect.value === 'Notes' ? 'block' : 'none';
    };
    keelSelect.addEventListener('change', update);
    update();
  }
}

async function saveHaulout() {
  const hauloutDate = document.getElementById('haulout_date').value;
  if (!hauloutDate) {
    alert('Haul-out date is required.');
    return;
  }

  const entry = {
    id: editingId,
    haulout_date: hauloutDate,
    launch_date: document.getElementById('launch_date').value || null,
    yard_marina: document.getElementById('yard_marina').value || '',
    reason_for_liftout: document.getElementById('reason_for_liftout').value || '',

    antifoul_brand: document.getElementById('antifoul_brand').value || '',
    antifoul_product_name: document.getElementById('antifoul_product_name').value || '',
    antifoul_type: document.getElementById('antifoul_type').value || '',
    antifoul_colour: document.getElementById('antifoul_colour').value || '',
    antifoul_coats: document.getElementById('antifoul_coats').value
      ? parseInt(document.getElementById('antifoul_coats').value, 10)
      : null,
    antifoul_last_stripped_blasted: document.getElementById('antifoul_last_stripped_blasted').checked,
    antifoul_applied_by: document.getElementById('antifoul_applied_by').value || '',

    anode_material: document.getElementById('anode_material').value || '',
    anodes_replaced: document.getElementById('anodes_replaced').checked,
    anode_locations: document.getElementById('anode_locations').value || '',
    old_anode_condition: document.getElementById('old_anode_condition').value || '',

    props_condition: document.getElementById('props_condition').value || '',
    props_serviced: collectPropsServiced(),
    shaft_condition: document.getElementById('shaft_condition').value || '',
    shaft_issues: document.getElementById('shaft_issues')?.value || '',
    cutless_bearings_checked: document.getElementById('cutless_bearings_checked').value || '',
    rudder_steering_checked: document.getElementById('rudder_steering_checked').value || '',
    rudder_steering_issues: document.getElementById('rudder_steering_issues')?.value || '',

    seacocks_inspected: document.getElementById('seacocks_inspected').value || '',
    seacocks_replaced: document.getElementById('seacocks_replaced').checked,
    seacock_material: document.getElementById('seacock_material').value || '',
    seacocks_issues: document.getElementById('seacocks_issues').value || '',

    hull_condition: document.getElementById('hull_condition').value || '',
    osmosis_check: document.getElementById('osmosis_check').value || '',
    hull_issues: document.getElementById('hull_issues')?.value || '',
    osmosis_notes: document.getElementById('osmosis_notes')?.value || '',
    keel_skeg_trim_tabs_checked: document.getElementById('keel_skeg_trim_tabs_checked').value || '',
    keel_skeg_trim_tabs_notes: document.getElementById('keel_skeg_trim_tabs_notes')?.value || '',

    yard_contractor_name: document.getElementById('yard_contractor_name').value || '',
    total_cost: document.getElementById('total_cost').value
      ? parseFloat(document.getElementById('total_cost').value)
      : null,

    general_notes: document.getElementById('general_notes').value || '',
    recommendations_next_haulout: document.getElementById('recommendations_next_haulout').value || '',
    next_haulout_due: document.getElementById('next_haulout_due').value || null,
    next_haulout_reminder_minutes: parseInt(document.getElementById('next_haulout_reminder')?.value || '1440', 10) || null
  };

  if (editingId && String(editingId).includes('-')) {
    await updateHaulout(editingId, entry);
  } else {
    const created = await createHaulout(currentBoatId, entry);
    if (created?.id) editingId = created.id;
  }
  const card = document.getElementById('haulout-form-card');
  if (card) card.remove();
  editingId = null;
  const hash = window.location.hash || '';
  if (hash.includes('/haulout/') && !hash.endsWith('/haulout')) {
    navigate(`/boat/${currentBoatId}/haulout`);
  } else {
    loadHaulouts();
  }
}

export default {
  render,
  onMount
};

