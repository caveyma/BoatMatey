/**
 * Links Page (boat-scoped when route is /boat/:id/links)
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader } from '../components/header.js';
import { getLinks, createLink, updateLink, deleteLink, isBoatArchived } from '../lib/dataService.js';
import { boatsStorage, linksStorage } from '../lib/storage.js';

let editingId = null;
let currentBoatId = null;
let isArchived = false;
let currentLinksList = [];

function render(params = {}) {
  currentBoatId = params.id || null;

  const wrapper = document.createElement('div');

  const yachtHeader = createYachtHeader('Web Links', true, () => window.history.back());
  wrapper.appendChild(yachtHeader);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-links';

  const container = document.createElement('div');
  container.className = 'container';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.id = 'links-add-btn';
  addBtn.innerHTML = `${renderIcon('plus')} Add Link`;
  addBtn.onclick = () => showLinkForm();

  const listContainer = document.createElement('div');
  listContainer.id = 'links-list';

  container.appendChild(addBtn);
  container.appendChild(listContainer);

  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);

  return wrapper;
}

async function onMount(params = {}) {
  window.navigate = navigate;
  currentBoatId = params.id || currentBoatId;

  const boat = currentBoatId ? boatsStorage.get(currentBoatId) : null;
  isArchived = boat ? (boat.status || 'active') === 'archived' : false;
  try {
    const archived = await isBoatArchived(currentBoatId);
    if (archived) isArchived = true;
  } catch (_) {}

  const addBtn = document.getElementById('links-add-btn');
  if (addBtn) addBtn.style.display = isArchived ? 'none' : '';

  await loadLinks();
}

async function loadLinks() {
  const listContainer = document.getElementById('links-list');
  if (!listContainer) return;

  let links = [];
  if (currentBoatId) {
    try {
      links = await getLinks(currentBoatId);
    } catch (e) {
      links = linksStorage.getAll(currentBoatId);
    }
  } else {
    links = linksStorage.getAll();
  }

  currentLinksList = links;

  if (links.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${renderIcon('link')}</div>
        <p>No web links added yet</p>
        ${isArchived ? '<p class="text-muted">Archived boats are view-only.</p>' : ''}
      </div>
    `;
    attachHandlers();
    return;
  }

  listContainer.innerHTML = links.map((link) => `
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">${link.name}</h3>
          <p class="text-muted">${link.url}</p>
        </div>
        <div>
          <button class="btn-primary" onclick="linksPageOpen('${link.id}')">Open</button>
          ${!isArchived ? `
            <button class="btn-link" onclick="linksPageEdit('${link.id}')">${renderIcon('edit')}</button>
            ${!String(link.id || '').startsWith('link_') ? `<button class="btn-link btn-danger" onclick="linksPageDelete('${link.id}')">${renderIcon('trash')}</button>` : ''}
          ` : ''}
        </div>
      </div>
    </div>
  `).join('');

  attachHandlers();
}

function attachHandlers() {
  window.linksPageOpen = (id) => {
    const link = currentLinksList.find((l) => l.id === id) || linksStorage.get(id);
    if (!link) return;

    let url = link.url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    window.open(url, '_blank');
  };

  window.linksPageEdit = (id) => {
    if (isArchived) return;
    editingId = id;
    showLinkForm();
  };

  window.linksPageDelete = async (id) => {
    if (isArchived) return;
    if (!confirm('Delete this link?')) return;
    if (currentBoatId) {
      await deleteLink(id);
    } else {
      linksStorage.delete(id);
    }
    loadLinks();
  };
}

function showLinkForm() {
  if (isArchived) return;

  const link = editingId ? (currentLinksList.find((l) => l.id === editingId) || linksStorage.get(editingId)) : null;

  const formHtml = `
    <div class="card" id="link-form-card">
      <h3>${editingId ? 'Edit Link' : 'Add Link'}</h3>
      <form id="link-form">
        <div class="form-group">
          <label for="link_name">Name *</label>
          <input type="text" id="link_name" required value="${link?.name || ''}">
        </div>
        <div class="form-group">
          <label for="link_url">URL *</label>
          <input type="url" id="link_url" required value="${link?.url || ''}" placeholder="https://example.com">
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="linksPageCancelForm()">Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  const listContainer = document.getElementById('links-list');
  listContainer.insertAdjacentHTML('afterbegin', formHtml);

  const form = document.getElementById('link-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveLink();
  });

  window.linksPageCancelForm = () => {
    const card = document.getElementById('link-form-card');
    if (card) card.remove();
    editingId = null;
  };
}

async function saveLink() {
  const name = document.getElementById('link_name').value;
  const url = document.getElementById('link_url').value;

  if (currentBoatId) {
    if (editingId) {
      await updateLink(editingId, currentBoatId, { name, url });
    } else {
      await createLink(currentBoatId, { name, url });
    }
  } else {
    const link = { id: editingId, name, url };
    linksStorage.save(link);
  }

  const card = document.getElementById('link-form-card');
  if (card) card.remove();
  editingId = null;
  loadLinks();
}

export default {
  render,
  onMount
};
