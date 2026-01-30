/**
 * Boats List Page (Home)
 * Shows all boats as cards, each with name and photo
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { renderLogo } from '../components/logo.js';
import { boatsStorage } from '../lib/storage.js';
import {
  getBoats as getBoatsFromApi,
  createBoat as createBoatApi,
  updateBoat as updateBoatApi,
  deleteBoat as deleteBoatApi,
  archiveBoat as archiveBoatApi,
  reactivateBoat as reactivateBoatApi,
  uploadBoatPhoto,
  getBoatCounts,
  BOAT_LIMITS
} from '../lib/dataService.js';

let editingBoatId = null;

import { createYachtHeader } from '../components/header.js';

/** Compress image to a small data URL for local storage (avoids QuotaExceededError). */
function compressImageToDataUrl(file, maxPx = 280, quality = 0.55) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (w > maxPx || h > maxPx) {
        if (w > h) {
          h = Math.round((h / w) * maxPx);
          w = maxPx;
        } else {
          w = Math.round((w / h) * maxPx);
          h = maxPx;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}

function render() {
  const wrapper = document.createElement('div');
  
  // Yacht header with back button (browser history)
  const header = createYachtHeader('', true, () => window.history.back());
  wrapper.appendChild(header);
  
  // Page content
  const pageContent = document.createElement('div');
  pageContent.className = 'page-content';
  
  const container = document.createElement('div');
  container.className = 'container';

  const pageHeader = document.createElement('div');
  pageHeader.className = 'page-header';
  pageHeader.innerHTML = `
    <p class="text-muted">Your boats</p>
    <p class="boats-limit-hint text-muted">You can have up to ${BOAT_LIMITS.MAX_ACTIVE_BOATS} active and ${BOAT_LIMITS.MAX_ARCHIVED_BOATS} archived boats (${BOAT_LIMITS.MAX_TOTAL_BOATS} total).</p>
  `;

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.id = 'boats-add-btn';
  addBtn.innerHTML = `${renderIcon('plus')} Add Boat`;
  addBtn.onclick = () => showBoatForm();
  addBtn.style.marginBottom = 'var(--spacing-lg)';

  const grid = document.createElement('div');
  grid.className = 'dashboard-grid';
  grid.id = 'boats-grid';

  container.appendChild(pageHeader);
  container.appendChild(addBtn);
  container.appendChild(grid);
  
  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);

  return wrapper;
}

async function onMount() {
  await loadBoats();
}

async function loadBoats() {
  const grid = document.getElementById('boats-grid');
  let boats = [];

  try {
    boats = await getBoatsFromApi();
    // Keep local storage in sync with merged data (API + local photo) so boat dashboard shows photos
    boats.forEach((b) => boatsStorage.save(b));
  } catch (e) {
    console.error('Error loading boats from Supabase, falling back to local storage:', e);
    boats = boatsStorage.getAll();
  }

  grid.innerHTML = '';

  if (boats.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">${renderIcon('boat')}</div>
        <p>No boats added yet</p>
        <p class="text-muted">Add your first boat to get started</p>
      </div>
    `;
    updateAddBoatButton([]);
    attachHandlers();
    return;
  }

  boats.forEach(boat => {
    const isArchived = (boat.status || 'active') === 'archived';
    const card = document.createElement('div');
    card.className = 'boat-card' + (isArchived ? ' boat-card-archived' : '');

    const photoUrl = boat.photo_url || boat.photo_data || null;
    const photoHtml = photoUrl
      ? `<img src="${photoUrl}" alt="${boat.boat_name || 'Boat'}" class="boat-card-photo">`
      : `<div class="boat-card-photo-placeholder">${renderIcon('boat')}</div>`;

    const statusBadge = isArchived ? '<span class="boat-card-badge boat-card-badge-archived">Archived</span>' : '';
    const archiveOrActivate = isArchived
      ? `<button class="boat-card-action-btn" onclick="event.stopPropagation(); boatsPageActivate('${boat.id}')" title="Activate">${renderIcon('refresh')}</button>`
      : `<button class="boat-card-action-btn" onclick="event.stopPropagation(); boatsPageArchive('${boat.id}')" title="Archive">${renderIcon('archive')}</button>`;

    card.innerHTML = `
      ${photoHtml}
      <div class="boat-card-content">
        <div class="boat-card-title-row">
          <div class="boat-card-title">${boat.boat_name || 'Unnamed Boat'}</div>
          ${statusBadge}
        </div>
        <div class="boat-card-subtitle">${boat.make_model || 'No details'}</div>
      </div>
      <div class="boat-card-actions">
        ${!isArchived ? `<button class="boat-card-action-btn" onclick="event.stopPropagation(); boatsPageEdit('${boat.id}')" title="Edit">${renderIcon('edit')}</button>` : ''}
        ${archiveOrActivate}
        <button class="boat-card-action-btn danger" onclick="event.stopPropagation(); boatsPageDelete('${boat.id}')" title="Delete">${renderIcon('trash')}</button>
      </div>
    `;

    card.onclick = () => {
      navigate(`/boat/${boat.id}`);
    };

    grid.appendChild(card);

    // If image fails to load (e.g. data URL quota, CORS), show placeholder
    const img = card.querySelector('.boat-card-photo');
    if (img) {
      img.onerror = function () {
        const placeholder = document.createElement('div');
        placeholder.className = 'boat-card-photo-placeholder';
        placeholder.innerHTML = renderIcon('boat');
        this.replaceWith(placeholder);
      };
    }
  });

  updateAddBoatButton(boats);
  attachHandlers();
}

async function updateAddBoatButton(boatsList) {
  const addBtn = document.getElementById('boats-add-btn');
  if (!addBtn) return;
  const counts = Array.isArray(boatsList)
    ? {
        total: boatsList.length,
        active: boatsList.filter((b) => (b.status || 'active') === 'active').length,
        archived: boatsList.filter((b) => b.status === 'archived').length
      }
    : await getBoatCounts();
  const atTotalLimit = counts.total >= BOAT_LIMITS.MAX_TOTAL_BOATS;
  const atActiveLimit = counts.active >= BOAT_LIMITS.MAX_ACTIVE_BOATS;
  const cannotAdd = atTotalLimit || atActiveLimit;
  addBtn.disabled = cannotAdd;
  if (atActiveLimit && !atTotalLimit) {
    addBtn.title = `You have the maximum number of active boats (${BOAT_LIMITS.MAX_ACTIVE_BOATS}). Archive a boat to add another.`;
  } else if (atTotalLimit) {
    addBtn.title = `You have the maximum number of boats (${BOAT_LIMITS.MAX_TOTAL_BOATS}). Archive or delete a boat to add another.`;
  } else {
    addBtn.title = 'Add a new boat';
  }
}

function attachHandlers() {
  window.boatsPageEdit = (id) => {
    editingBoatId = id;
    showBoatForm();
  };

  window.boatsPageDelete = (id) => {
    if (confirm('Delete this boat? All associated data will be deleted.')) {
      deleteBoatApi(id).finally(() => {
        boatsStorage.delete(id);
        loadBoats();
      });
    }
  };

  window.boatsPageArchive = async (id) => {
    const message = `Archiving keeps all essential history such as logs, services, and boat details. Reference files like manuals, links, and equipment documents are removed to manage storage. Continue?`;
    if (!confirm(message)) return;
    const result = await archiveBoatApi(id);
    if (result && result.error) {
      if (result.error === 'archived_limit') {
        alert('You have the maximum number of archived boats. Delete an archived boat to archive another.');
      } else {
        alert(result.error);
      }
      return;
    }
    boatsStorage.save(boatsStorage.get(id) ? { ...boatsStorage.get(id), status: 'archived' } : { id, status: 'archived' });
    loadBoats();
  };

  window.boatsPageActivate = async (id) => {
    const result = await reactivateBoatApi(id);
    if (result && result.error) {
      if (result.error === 'active_limit') {
        alert(`You have the maximum number of active boats. Archive one to reactivate this boat.`);
      } else {
        alert(result.error);
      }
      return;
    }
    boatsStorage.save(boatsStorage.get(id) ? { ...boatsStorage.get(id), status: 'active' } : { id, status: 'active' });
    loadBoats();
  };
}

function showBoatForm() {
  const boat = editingBoatId ? boatsStorage.get(editingBoatId) : null;

  const formHtml = `
    <div class="card" id="boat-form-card" style="max-width: 600px; margin: 0 auto;">
      <h3>${editingBoatId ? 'Edit Boat' : 'Add Boat'}</h3>
      <form id="boat-form">
        <div class="form-group">
          <label for="boat_name">Boat Name *</label>
          <input type="text" id="boat_name" required value="${boat?.boat_name || ''}">
        </div>
        <div class="form-group">
          <label for="boat_make_model">Make & Model</label>
          <input type="text" id="boat_make_model" value="${boat?.make_model || ''}">
        </div>
        <div class="form-group">
          <label for="boat_photo">Boat Photo</label>
          <input type="file" id="boat_photo" accept="image/*">
          <div id="boat-photo-preview" style="margin-top: 0.5rem;">
            ${boat?.photo_data ? `<img src="${boat.photo_data}" alt="Preview" style="max-width: 200px; border-radius: var(--radius);">` : ''}
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="boatsPageCancelForm()">Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  const grid = document.getElementById('boats-grid');
  grid.insertAdjacentHTML('afterbegin', formHtml);

  const form = document.getElementById('boat-form');
  const photoInput = document.getElementById('boat_photo');
  const photoPreview = document.getElementById('boat-photo-preview');

  // Handle photo upload
  photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        photoPreview.innerHTML = `<img src="${event.target.result}" alt="Preview" style="max-width: 200px; border-radius: var(--radius);">`;
      };
      reader.readAsDataURL(file);
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveBoat();
  });

  window.boatsPageCancelForm = () => {
    document.getElementById('boat-form-card').remove();
    editingBoatId = null;
  };
}

async function saveBoat() {
  const boat = {
    id: editingBoatId,
    boat_name: document.getElementById('boat_name').value,
    make_model: document.getElementById('boat_make_model').value
  };

  const photoInput = document.getElementById('boat_photo');
  const photoFile = photoInput?.files?.[0];

  if (photoFile) {
    // Prefer Supabase upload (stores URL only, avoids localStorage quota). Fallback: small compressed thumbnail for local-only.
    const boatIdForUpload = editingBoatId;
    const photoUrl = boatIdForUpload ? await uploadBoatPhoto(boatIdForUpload, photoFile) : null;

    if (photoUrl) {
      boat.photo_url = photoUrl;
      boat.photo_data = undefined; // Never store large base64 in localStorage
    } else {
      try {
        boat.photo_data = await compressImageToDataUrl(photoFile);
        boat.photo_url = null;
      } catch (e) {
        console.warn('Could not compress photo, saving without image:', e);
      }
    }
  } else if (editingBoatId) {
    const existing = boatsStorage.get(editingBoatId);
    if (existing?.photo_url) boat.photo_url = existing.photo_url;
    if (existing?.photo_data) boat.photo_data = existing.photo_data;
  }

  if (editingBoatId) {
    boatsStorage.save(boat);
    await updateBoatApi(editingBoatId, {
      boat_name: boat.boat_name,
      make_model: boat.make_model,
      photo_url: boat.photo_url
    });
    document.getElementById('boat-form-card').remove();
    editingBoatId = null;
    loadBoats();
    return;
  }

  // New boat
  const result = await createBoatApi({ boat_name: boat.boat_name, make_model: boat.make_model });
  if (result && result.error === 'active_limit') {
    alert(`You have the maximum number of active boats (${BOAT_LIMITS.MAX_ACTIVE_BOATS}). Archive a boat to add another.`);
    return;
  }
  if (result && result.error === 'total_limit') {
    alert(`You have the maximum number of boats (${BOAT_LIMITS.MAX_TOTAL_BOATS}). Archive or delete a boat to add another.`);
    return;
  }
  const dbBoat = result && result.id ? result : null;

  if (dbBoat?.id && photoFile) {
    const urlAfterCreate = await uploadBoatPhoto(dbBoat.id, photoFile);
    if (urlAfterCreate) {
      boat.photo_url = urlAfterCreate;
      boat.photo_data = undefined;
      await updateBoatApi(dbBoat.id, { photo_url: urlAfterCreate });
    }
  }

  if (dbBoat?.id) {
    boatsStorage.delete(boat.id);
    boatsStorage.save({ ...boat, id: dbBoat.id, status: 'active' });
  } else {
    boatsStorage.save(boat);
  }

  document.getElementById('boat-form-card').remove();
  editingBoatId = null;
  loadBoats();
}

export default {
  render,
  onMount
};
