/**
 * Links Page (boat-scoped when route is /boat/:id/links)
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { getLinks, deleteLink, isBoatArchived } from '../lib/dataService.js';
import { boatsStorage, linksStorage } from '../lib/storage.js';

let currentBoatId = null;
let isArchived = false;
let currentLinksList = [];

function render(params = {}) {
  currentBoatId = params.id || null;

  const wrapper = document.createElement('div');

  const yachtHeader = createYachtHeader('Web Links');
  wrapper.appendChild(yachtHeader);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-links';
  pageContent.appendChild(createBackButton());

  const container = document.createElement('div');
  container.className = 'container';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.id = 'links-add-btn';
  addBtn.innerHTML = `${renderIcon('plus')} Add Link`;
  addBtn.onclick = () => navigate(`/boat/${currentBoatId}/links/new`);

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
    <div class="card link-card" data-link-id="${link.id}" onclick="linksPageOpen('${link.id}')">
      <div class="card-header link-card-header">
        <div class="link-card-content">
          <h3 class="card-title">${link.name}</h3>
          <p class="text-muted">${link.url}</p>
        </div>
        <div class="link-card-actions">
          ${!isArchived ? `
            <a href="#/boat/${currentBoatId}/links/${link.id}" class="btn-link" onclick="event.preventDefault(); event.stopPropagation(); window.navigate('/boat/${currentBoatId}/links/${link.id}')">${renderIcon('edit')}</a>
            ${!String(link.id || '').startsWith('link_') ? `<button type="button" class="btn-link btn-danger" onclick="event.stopPropagation(); linksPageDelete('${link.id}')">${renderIcon('trash')}</button>` : ''}
          ` : ''}
        </div>
      </div>
    </div>
  `).join('');

  attachHandlers();
}

function attachHandlers() {
  window.navigate = navigate;
  window.linksPageOpen = (id) => {
    const link = currentLinksList.find((l) => l.id === id) || linksStorage.get(id);
    if (!link) return;

    let url = link.url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    window.open(url, '_blank');
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

export default {
  render,
  onMount
};
