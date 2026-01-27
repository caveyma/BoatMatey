/**
 * Boats List Page (Home)
 * Shows all boats as cards, each with name and photo
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { renderLogo } from '../components/logo.js';
import { boatsStorage } from '../lib/storage.js';
import { checkLimit } from '../lib/subscription.js';

let editingBoatId = null;

import { createYachtHeader } from '../components/header.js';

function render() {
  const wrapper = document.createElement('div');
  
  // Yacht header
  const header = createYachtHeader('BoatMatey');
  wrapper.appendChild(header);
  
  // Page content
  const pageContent = document.createElement('div');
  pageContent.className = 'page-content';
  
  const container = document.createElement('div');
  container.className = 'container';

  const pageHeader = document.createElement('div');
  pageHeader.className = 'page-header';
  pageHeader.innerHTML = `<p class="text-muted">Your boats</p>`;

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
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

function onMount() {
  loadBoats();
}

function loadBoats() {
  const grid = document.getElementById('boats-grid');
  const boats = boatsStorage.getAll();

  grid.innerHTML = '';

  if (boats.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">${renderIcon('boat')}</div>
        <p>No boats added yet</p>
        <p class="text-muted">Add your first boat to get started</p>
      </div>
    `;
    return;
  }

  boats.forEach(boat => {
    const card = document.createElement('div');
    card.className = 'boat-card';
    
    // Boat photo or placeholder
    const photoUrl = boat.photo_url || boat.photo_data || null;
    const photoHtml = photoUrl 
      ? `<img src="${photoUrl}" alt="${boat.boat_name || 'Boat'}" class="boat-card-photo">`
      : `<div class="boat-card-photo-placeholder">${renderIcon('boat')}</div>`;

    card.innerHTML = `
      ${photoHtml}
      <div class="boat-card-content">
        <div class="boat-card-title">${boat.boat_name || 'Unnamed Boat'}</div>
        <div class="boat-card-subtitle">${boat.make_model || 'No details'}</div>
      </div>
      <div class="boat-card-actions">
        <button class="boat-card-action-btn" onclick="event.stopPropagation(); boatsPageEdit('${boat.id}')" title="Edit">${renderIcon('edit')}</button>
        <button class="boat-card-action-btn danger" onclick="event.stopPropagation(); boatsPageDelete('${boat.id}')" title="Delete">${renderIcon('trash')}</button>
      </div>
    `;

    card.onclick = () => {
      navigate(`/boat/${boat.id}`);
    };

    grid.appendChild(card);
  });

  attachHandlers();
}

function attachHandlers() {
  window.boatsPageEdit = (id) => {
    editingBoatId = id;
    showBoatForm();
  };

  window.boatsPageDelete = (id) => {
    if (confirm('Delete this boat? All associated data will be deleted.')) {
      boatsStorage.delete(id);
      loadBoats();
    }
  };
}

function showBoatForm() {
  const boat = editingBoatId ? boatsStorage.get(editingBoatId) : null;
  const limit = checkLimit('BOATS', boatsStorage.getAll().length);
  
  if (!limit.allowed && !editingBoatId) {
    alert(`Free plan limit: ${limit.limit} boat(s). Upgrade to add more.`);
    return;
  }

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

function saveBoat() {
  const boat = {
    id: editingBoatId,
    boat_name: document.getElementById('boat_name').value,
    make_model: document.getElementById('boat_make_model').value
  };

  // Handle photo
  const photoInput = document.getElementById('boat_photo');
  if (photoInput.files[0]) {
    const reader = new FileReader();
    reader.onload = (event) => {
      boat.photo_data = event.target.result;
      boat.photo_url = null; // Will be set if using external storage later
      boatsStorage.save(boat);
      document.getElementById('boat-form-card').remove();
      editingBoatId = null;
      loadBoats();
    };
    reader.readAsDataURL(photoInput.files[0]);
  } else {
    // Keep existing photo if editing
    if (editingBoatId) {
      const existing = boatsStorage.get(editingBoatId);
      if (existing?.photo_data) {
        boat.photo_data = existing.photo_data;
      }
    }
    boatsStorage.save(boat);
    document.getElementById('boat-form-card').remove();
    editingBoatId = null;
    loadBoats();
  }
}

export default {
  render,
  onMount
};
