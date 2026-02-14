/**
 * Link Edit Page - full-page form for add/edit link.
 * Cancel or Save returns to the Links list for the boat.
 */

import { navigate } from '../router.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { setSaveButtonLoading } from '../utils/saveButton.js';
import { isBoatArchived, getLinks, createLink, updateLink } from '../lib/dataService.js';

function render(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  const linkId = params?.linkId || window.routeParams?.linkId;
  const isNew = !linkId || linkId === 'new';

  if (!boatId) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapper;
  }

  const wrapper = document.createElement('div');
  const header = createYachtHeader(isNew ? 'Add Link' : 'Edit Link');
  wrapper.appendChild(header);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-links';
  pageContent.appendChild(createBackButton());
  const container = document.createElement('div');
  container.className = 'container';

  container.innerHTML = `
    <div class="card" id="link-form-card">
      <h3>${isNew ? 'Add Link' : 'Edit Link'}</h3>
      <p class="text-muted">${isNew ? 'Add a web link for this boat.' : 'Update link details below.'}</p>
      <form id="link-form">
        <div class="form-group">
          <label for="link_name">Name *</label>
          <input type="text" id="link_name" required placeholder="e.g. Marina">
        </div>
        <div class="form-group">
          <label for="link_url">URL *</label>
          <input type="url" id="link_url" required placeholder="https://example.com">
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" id="link-cancel-btn">Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>
  `;

  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);
  return wrapper;
}

async function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  const linkId = params?.linkId || window.routeParams?.linkId;
  const isNew = !linkId || linkId === 'new';

  if (!boatId) return;

  const archived = await isBoatArchived(boatId);
  if (archived) {
    document.getElementById('link-form')?.querySelectorAll('input, button').forEach(el => { el.disabled = true; });
  }

  if (!isNew) {
    const links = await getLinks(boatId);
    const link = links.find((l) => l.id === linkId);
    if (link) {
      const nameEl = document.getElementById('link_name');
      const urlEl = document.getElementById('link_url');
      if (nameEl) nameEl.value = link.name || '';
      if (urlEl) urlEl.value = link.url || '';
    }
  }

  document.getElementById('link-cancel-btn')?.addEventListener('click', () => {
    navigate(`/boat/${boatId}/links`);
  });

  document.getElementById('link-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (archived) return;
    const form = e.target;
    setSaveButtonLoading(form, true);
    const name = document.getElementById('link_name').value.trim();
    const url = document.getElementById('link_url').value.trim();
    if (!name || !url) {
      setSaveButtonLoading(form, false);
      return;
    }
    try {
    if (isNew) {
      await createLink(boatId, { name, url });
    } else {
      await updateLink(linkId, boatId, { name, url });
    }
    navigate(`/boat/${boatId}/links`);
    } finally {
      setSaveButtonLoading(form, false);
    }
  });
}

export default {
  render,
  onMount
};
