/**
 * Links Page
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader } from '../components/header.js';
import { linksStorage } from '../lib/storage.js';
import { Capacitor } from '@capacitor/core';

let editingId = null;

function render() {
  const wrapper = document.createElement('div');

  // Yacht header with back arrow using browser history
  const yachtHeader = createYachtHeader('Web Links', true, () => window.history.back());
  wrapper.appendChild(yachtHeader);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-links';

  const container = document.createElement('div');
  container.className = 'container';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
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

function onMount() {
  window.navigate = navigate;
  loadLinks();
}

function loadLinks() {
  const listContainer = document.getElementById('links-list');
  const links = linksStorage.getAll();

  if (links.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${renderIcon('link')}</div>
        <p>No web links added yet</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = links.map(link => `
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">${link.name}</h3>
          <p class="text-muted">${link.url}</p>
        </div>
        <div>
          <button class="btn-primary" onclick="linksPageOpen('${link.id}')">Open</button>
          <button class="btn-link" onclick="linksPageEdit('${link.id}')">${renderIcon('edit')}</button>
          ${!link.id.startsWith('link_') ? `<button class="btn-link btn-danger" onclick="linksPageDelete('${link.id}')">${renderIcon('trash')}</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  attachHandlers();
}

function attachHandlers() {
  window.linksPageOpen = (id) => {
    const link = linksStorage.get(id);
    if (!link) return;

    let url = link.url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    // Open in new window/tab
    // Future: Use @capacitor/browser plugin when installed for better native experience
    // if (Capacitor.isNativePlatform() && window.Capacitor?.Plugins?.Browser) {
    //   window.Capacitor.Plugins.Browser.open({ url });
    // } else {
    window.open(url, '_blank');
    // }
  };

  window.linksPageEdit = (id) => {
    editingId = id;
    showLinkForm();
  };

  window.linksPageDelete = (id) => {
    if (confirm('Delete this link?')) {
      linksStorage.delete(id);
      loadLinks();
    }
  };
}

function showLinkForm() {
  const link = editingId ? linksStorage.get(editingId) : null;

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
    document.getElementById('link-form-card').remove();
    editingId = null;
  };
}

function saveLink() {
  const link = {
    id: editingId,
    name: document.getElementById('link_name').value,
    url: document.getElementById('link_url').value
  };

  linksStorage.save(link);
  document.getElementById('link-form-card').remove();
  editingId = null;
  loadLinks();
}

export default {
  render,
  onMount
};
