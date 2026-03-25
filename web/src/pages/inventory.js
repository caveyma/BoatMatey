/**
 * Inventory Page
 * Onboard stock tracking with required level, in-stock level, low-stock and critical-spare alerts.
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { confirmAction } from '../components/confirmModal.js';
import { setSaveButtonLoading } from '../utils/saveButton.js';
import {
  isBoatArchived,
  getInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem
} from '../lib/dataService.js';
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
import { uploadsStorage } from '../lib/storage.js';
import { blockPremiumSaveIfNeeded } from '../lib/premiumSaveGate.js';
import { insertPremiumPreviewBanner } from '../components/premiumPreviewBanner.js';

const INVENTORY_CATEGORIES = [
  'Engine',
  'Electrical',
  'Plumbing',
  'Safety',
  'Tools',
  'Cleaning',
  'Galley',
  'Spares',
  'Deck Gear',
  'Misc'
];

const INVENTORY_UNITS = ['pcs', 'litres', 'bottles', 'tubes', 'rolls', 'packs'];

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'category', label: 'Category' },
  { value: 'location', label: 'Location' },
  { value: 'stock', label: 'Stock level' }
];

let currentBoatId = null;
let editingId = null;
let inventoryArchived = false;
let inventoryFileInput = null;
let currentItemIdForUpload = null;

function isLowStock(item) {
  const required = item.required_quantity != null ? Number(item.required_quantity) : 0;
  const stock = item.in_stock_level != null ? Number(item.in_stock_level) : 0;
  return stock <= required;
}

function isCriticalOutOfStock(item) {
  return !!item.critical_spare && (item.in_stock_level == null || Number(item.in_stock_level) === 0);
}

function render(params = {}) {
  currentBoatId = params?.id || window.routeParams?.id;
  const itemId = params?.itemId || window.routeParams?.itemId;
  const isEditPage = !!itemId;

  if (!currentBoatId) {
    const wrapperError = document.createElement('div');
    wrapperError.innerHTML =
      '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapperError;
  }

  const wrapper = document.createElement('div');
  const header = createYachtHeader(
    isEditPage ? (itemId === 'new' ? 'Add Inventory Item' : 'Edit Inventory Item') : 'Inventory'
  );
  wrapper.appendChild(header);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-inventory';
  pageContent.appendChild(createBackButton());

  const container = document.createElement('div');
  container.className = 'container';

  if (isEditPage) {
    container.id = 'inventory-list';
    pageContent.appendChild(container);
    wrapper.appendChild(pageContent);
    return wrapper;
  }

  const toolbar = document.createElement('div');
  toolbar.className = 'inventory-toolbar';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.id = 'inventory-add-btn';
  addBtn.innerHTML = `${renderIcon('plus')} Add Item`;
  addBtn.onclick = () => navigate(`/boat/${currentBoatId}/inventory/new`);

  const searchWrap = document.createElement('div');
  searchWrap.className = 'inventory-search-wrap';
  searchWrap.innerHTML = `
    <input type="search" id="inventory-search" class="form-control inventory-search" placeholder="Search items..." aria-label="Search inventory">
  `;

  const filtersWrap = document.createElement('div');
  filtersWrap.className = 'inventory-filters';
  filtersWrap.innerHTML = `
    <select id="inventory-filter-category" class="form-control" aria-label="Filter by category">
      <option value="">All categories</option>
      ${INVENTORY_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}
    </select>
    <select id="inventory-filter-stock" class="form-control" aria-label="Filter by stock">
      <option value="all">All items</option>
      <option value="low">Low stock only</option>
    </select>
    <select id="inventory-sort" class="form-control" aria-label="Sort by">
      ${SORT_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join('')}
    </select>
  `;

  toolbar.appendChild(addBtn);
  toolbar.appendChild(searchWrap);
  toolbar.appendChild(filtersWrap);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = 'inventory-file-input';
  fileInput.multiple = false;
  fileInput.accept = 'image/*,.jpg,.jpeg,.png';
  fileInput.style.display = 'none';

  const listContainer = document.createElement('div');
  listContainer.id = 'inventory-list';

  container.appendChild(toolbar);
  container.appendChild(fileInput);
  container.appendChild(listContainer);
  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);

  return wrapper;
}

async function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  const itemId = params?.itemId || window.routeParams?.itemId;

  if (boatId) currentBoatId = boatId;
  window.navigate = navigate;

  inventoryArchived = currentBoatId ? await isBoatArchived(currentBoatId) : false;

  if (itemId) {
    editingId = itemId === 'new' ? `inventory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : itemId;
    await showInventoryForm();
    insertPremiumPreviewBanner(document.querySelector('.page-content.card-color-inventory'), {
      headline: 'Preview: Inventory',
      detail:
        'Track spares and stores here. Tap Save when ready — Premium is required to keep inventory on your boat.'
    });
    return;
  }

  const addBtn = document.getElementById('inventory-add-btn');
  if (addBtn && inventoryArchived) addBtn.style.display = 'none';

  inventoryFileInput = document.getElementById('inventory-file-input');
  if (inventoryFileInput) {
    inventoryFileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file || !currentBoatId || !currentItemIdForUpload) return;
      const existing = getUploads('inventory', currentItemIdForUpload, currentBoatId);
      if (existing.length >= LIMITED_UPLOADS_PER_ENTITY) {
        showToast(`Max ${LIMITED_UPLOADS_PER_ENTITY} photo(s) per item.`, 'error');
        inventoryFileInput.value = '';
        return;
      }
      if (file.size > LIMITED_UPLOAD_SIZE_BYTES) {
        showToast('Photo must be under 2 MB.', 'error');
        inventoryFileInput.value = '';
        return;
      }
      await saveUpload(file, 'inventory', currentItemIdForUpload, currentBoatId);
      inventoryFileInput.value = '';
      if (editingId) {
        const list = document.getElementById('inventory-attachments-list');
        if (list) renderInventoryAttachments(list);
      } else loadInventory();
    });
  }

  const searchEl = document.getElementById('inventory-search');
  const filterCategory = document.getElementById('inventory-filter-category');
  const filterStock = document.getElementById('inventory-filter-stock');
  const sortEl = document.getElementById('inventory-sort');
  [searchEl, filterCategory, filterStock, sortEl].forEach((el) => {
    if (el) el.addEventListener('change', () => loadInventory());
  });
  if (searchEl) searchEl.addEventListener('input', () => loadInventory());

  insertPremiumPreviewBanner(document.querySelector('.page-content.card-color-inventory'), {
    headline: 'Preview: Inventory',
    detail:
      'Track spares and stores here. Tap Save when ready — Premium is required to keep inventory on your boat.'
  });

  loadInventory();
}

function applyFiltersAndSort(items, search, categoryFilter, lowStockOnly, sortBy) {
  let list = [...items];
  if (search) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (i) =>
        (i.name && i.name.toLowerCase().includes(q)) ||
        (i.part_number && i.part_number.toLowerCase().includes(q)) ||
        (i.location && i.location.toLowerCase().includes(q)) ||
        (i.category && i.category.toLowerCase().includes(q))
    );
  }
  if (categoryFilter) list = list.filter((i) => i.category === categoryFilter);
  if (lowStockOnly === 'low') list = list.filter(isLowStock);
  const order = sortBy || 'name';
  list.sort((a, b) => {
    if (order === 'name') return (a.name || '').localeCompare(b.name || '');
    if (order === 'category') return (a.category || '').localeCompare(b.category || '');
    if (order === 'location') return (a.location || '').localeCompare(b.location || '');
    if (order === 'stock') {
      const sa = a.in_stock_level != null ? Number(a.in_stock_level) : -1;
      const sb = b.in_stock_level != null ? Number(b.in_stock_level) : -1;
      return sa - sb;
    }
    return 0;
  });
  return list;
}

async function loadInventory() {
  const listContainer = document.getElementById('inventory-list');
  if (!listContainer) return;

  const items = currentBoatId ? await getInventory(currentBoatId) : [];
  const search = document.getElementById('inventory-search')?.value?.trim() || '';
  const categoryFilter = document.getElementById('inventory-filter-category')?.value || '';
  const lowStockOnly = document.getElementById('inventory-filter-stock')?.value || 'all';
  const sortBy = document.getElementById('inventory-sort')?.value || 'name';

  const filtered = applyFiltersAndSort(items, search, categoryFilter, lowStockOnly, sortBy);

  if (!filtered.length) {
    const emptyMessage =
      items.length === 0
        ? 'No inventory items yet. Add items to track onboard stock and get low-stock alerts.'
        : 'No items match your filters.';
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${renderIcon('inventory')}</div>
        <p>${emptyMessage}</p>
        ${items.length === 0 && !inventoryArchived ? `<div class="empty-state-actions"><button type="button" class="btn-primary" onclick="event.preventDefault(); window.navigate('/boat/${currentBoatId}/inventory/new')">${renderIcon('plus')} Add Item</button></div>` : ''}
      </div>
    `;
    return;
  }

  listContainer.innerHTML = filtered
    .map((item) => {
      const low = isLowStock(item);
      const critical = isCriticalOutOfStock(item);
      const stockClass = critical ? 'inventory-badge-critical' : low ? 'inventory-badge-low' : '';
      const stockLabel = critical ? 'Critical: out of stock' : low ? 'Low stock' : 'OK';
      const locationText = [item.location, item.position].filter(Boolean).join(' • ') || '—';
      const unit = item.unit || '';
      const req = item.required_quantity != null ? Number(item.required_quantity) : '';
      const stock = item.in_stock_level != null ? Number(item.in_stock_level) : '—';
      const stockDisplay = unit ? `${stock} ${unit}` : stock;

      return `
      <div class="card inventory-item-card ${low ? 'inventory-item-low' : ''} ${critical ? 'inventory-item-critical' : ''}" data-item-id="${item.id}">
        <div class="card-header">
          <div class="inventory-item-header-main">
            ${item.photo_url || getUploads('inventory', item.id, currentBoatId).length
              ? `<div class="inventory-item-thumb">${getItemThumb(item)}</div>`
              : ''}
            <div>
              <h3 class="card-title">${escapeHtml(item.name || 'Unnamed')}</h3>
              <p class="text-muted">${escapeHtml(item.category || '')} ${item.category && item.type ? '•' : ''} ${escapeHtml(item.type || '')}</p>
              <p class="inventory-item-location">${escapeHtml(locationText)}</p>
              <div class="inventory-item-stock-row">
                <span class="inventory-badge ${stockClass}">${stockLabel}</span>
                <span class="inventory-stock-numbers">Stock: ${stockDisplay}${req !== '' ? ` / Required: ${req}${unit ? ' ' + unit : ''}` : ''}</span>
              </div>
            </div>
          </div>
          <div class="inventory-item-actions">
            ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" class="btn-link" title="Open supplier link">${renderIcon('link')} Link</a>` : ''}
            ${!inventoryArchived ? `
            <a href="#/boat/${currentBoatId}/inventory/${item.id}" class="btn-link" onclick="event.preventDefault(); window.navigate('/boat/${currentBoatId}/inventory/${item.id}')">${renderIcon('edit')}</a>
            <button class="btn-link btn-danger" onclick="inventoryPageDelete('${item.id}')">${renderIcon('trash')}</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    })
    .join('');

  attachListHandlers();
}

function getItemThumb(item) {
  const uploads = getUploads('inventory', item.id, currentBoatId);
  const first = uploads[0];
  if (first?.storage_type === 'base64' && first?.data) {
    return `<img src="${first.data}" alt="" class="inventory-thumb-img">`;
  }
  if (item.photo_url) {
    return `<img src="${escapeHtml(item.photo_url)}" alt="" class="inventory-thumb-img">`;
  }
  return `<div class="inventory-thumb-placeholder">${renderIcon('file')}</div>`;
}

function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function attachListHandlers() {
  window.inventoryPageDelete = async (id) => {
    const ok = await confirmAction({
      title: 'Delete this inventory item?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      danger: true
    });
    if (!ok) return;
    await deleteInventoryItem(id);
    loadInventory();
    showToast('Item removed', 'info');
  };
}

async function showInventoryForm() {
  const items = currentBoatId ? await getInventory(currentBoatId) : [];
  const existing = editingId ? items.find((i) => i.id === editingId) : null;
  const isNew = !existing;

  const container = document.getElementById('inventory-list');
  if (!container) return;

  currentItemIdForUpload = existing?.id || editingId;

  const formHtml = `
    <div class="card" id="inventory-form-card">
      <h3>${isNew ? 'Add Inventory Item' : 'Edit Inventory Item'}</h3>
      <form id="inventory-form">
        <div class="form-section">
          <h4>Item details</h4>
          <div class="form-group">
            <label for="inv_name">Name *</label>
            <input type="text" id="inv_name" required value="${escapeHtml(existing?.name || '')}" placeholder="e.g. Engine oil 15W-40">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="inv_category">Category</label>
              <select id="inv_category">
                <option value="">Select...</option>
                ${INVENTORY_CATEGORIES.map((c) => `<option value="${c}" ${existing?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="inv_type">Type</label>
              <input type="text" id="inv_type" value="${escapeHtml(existing?.type || '')}" placeholder="e.g. Oil, Filter">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="inv_location">Location</label>
              <input type="text" id="inv_location" value="${escapeHtml(existing?.location || '')}" placeholder="e.g. Engine bay">
            </div>
            <div class="form-group">
              <label for="inv_position">Position</label>
              <input type="text" id="inv_position" value="${escapeHtml(existing?.position || '')}" placeholder="e.g. Starboard shelf">
            </div>
          </div>
        </div>

        <div class="form-section">
          <h4>Stock levels</h4>
          <div class="form-row">
            <div class="form-group">
              <label for="inv_required_quantity">Required quantity</label>
              <input type="number" id="inv_required_quantity" min="0" step="any" value="${existing?.required_quantity != null ? existing.required_quantity : ''}" placeholder="Min to carry">
            </div>
            <div class="form-group">
              <label for="inv_in_stock_level">In stock level</label>
              <input type="number" id="inv_in_stock_level" min="0" step="any" value="${existing?.in_stock_level != null ? existing.in_stock_level : ''}" placeholder="Current">
            </div>
            <div class="form-group">
              <label for="inv_unit">Unit</label>
              <select id="inv_unit">
                <option value="">—</option>
                ${INVENTORY_UNITS.map((u) => `<option value="${u}" ${existing?.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="checkbox-row">
              <input type="checkbox" id="inv_critical_spare" ${existing?.critical_spare ? 'checked' : ''}>
              <span>Critical spare (show stronger warning when out of stock)</span>
            </label>
          </div>
        </div>

        <div class="form-section">
          <h4>Reference</h4>
          <div class="form-row">
            <div class="form-group">
              <label for="inv_part_number">Part number</label>
              <input type="text" id="inv_part_number" value="${escapeHtml(existing?.part_number || '')}">
            </div>
            <div class="form-group">
              <label for="inv_supplier_brand">Supplier / Brand</label>
              <input type="text" id="inv_supplier_brand" value="${escapeHtml(existing?.supplier_brand || '')}">
            </div>
          </div>
          <div class="form-group">
            <label for="inv_url">URL</label>
            <input type="url" id="inv_url" value="${escapeHtml(existing?.url || '')}" placeholder="https://...">
          </div>
          <div class="form-group">
            <label for="inv_last_restocked_date">Last restocked date</label>
            <input type="date" id="inv_last_restocked_date" value="${existing?.last_restocked_date || ''}">
          </div>
        </div>

        <div class="form-section">
          <h4>Photo</h4>
          <div class="inventory-form-photo" id="inventory-form-photo">
            <div class="attachment-list" id="inventory-attachments-list"></div>
            ${!inventoryArchived ? `<button type="button" class="btn-link" id="inventory-add-photo-btn">${renderIcon('plus')} Add photo (max ${LIMITED_UPLOADS_PER_ENTITY})</button>` : ''}
          </div>
        </div>

        <div class="form-section">
          <div class="form-group">
            <label for="inv_notes">Notes</label>
            <textarea id="inv_notes" rows="3">${escapeHtml(existing?.notes || '')}</textarea>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="window.navigate('/boat/${currentBoatId}/inventory')">Cancel</button>
          <button type="submit" class="btn-primary" id="inventory-save-btn">${isNew ? 'Add item' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  `;

  container.innerHTML = formHtml;

  const attachmentsList = document.getElementById('inventory-attachments-list');
  const addPhotoBtn = document.getElementById('inventory-add-photo-btn');
  if (attachmentsList) renderInventoryAttachments(attachmentsList);
  if (addPhotoBtn) {
    addPhotoBtn.addEventListener('click', () => {
      if (inventoryFileInput) inventoryFileInput.click();
    });
  }

  document.getElementById('inventory-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('inventory-save-btn');
    if (blockPremiumSaveIfNeeded()) return;
    setSaveButtonLoading(btn, true);

    const payload = {
      name: document.getElementById('inv_name').value.trim(),
      category: document.getElementById('inv_category').value || null,
      type: document.getElementById('inv_type').value.trim() || null,
      location: document.getElementById('inv_location').value.trim() || null,
      position: document.getElementById('inv_position').value.trim() || null,
      required_quantity: document.getElementById('inv_required_quantity').value.trim() || null,
      in_stock_level: document.getElementById('inv_in_stock_level').value.trim() || null,
      unit: document.getElementById('inv_unit').value || null,
      critical_spare: document.getElementById('inv_critical_spare').checked,
      part_number: document.getElementById('inv_part_number').value.trim() || null,
      supplier_brand: document.getElementById('inv_supplier_brand').value.trim() || null,
      url: document.getElementById('inv_url').value.trim() || null,
      last_restocked_date: document.getElementById('inv_last_restocked_date').value || null,
      notes: document.getElementById('inv_notes').value.trim() || null
    };

    try {
      if (isNew) {
        const created = await createInventoryItem(currentBoatId, payload);
        if (created?.error) {
          showToast(created.error === 'not_found' ? 'Boat not found' : 'Could not add item', 'error');
        } else {
          const uploads = getUploads('inventory', editingId, currentBoatId);
          uploads.forEach((u) => uploadsStorage.save({ ...u, entity_id: created.id }, currentBoatId));
          showToast('Item added', 'success');
          navigate(`/boat/${currentBoatId}/inventory`);
        }
      } else {
        await updateInventoryItem(editingId, payload);
        showToast('Changes saved', 'success');
        navigate(`/boat/${currentBoatId}/inventory`);
      }
    } catch (err) {
      showToast(err?.message || 'Save failed', 'error');
    } finally {
      setSaveButtonLoading(btn, false);
    }
  });
}

function renderInventoryAttachments(container) {
  if (!container || !currentItemIdForUpload) return;
  const uploads = getUploads('inventory', currentItemIdForUpload, currentBoatId);
  container.innerHTML = '';
  if (uploads.length === 0) {
    container.innerHTML = '<p class="text-muted">No photo.</p>';
    return;
  }
  uploads.forEach((upload) => {
    const item = document.createElement('div');
    item.className = 'attachment-item';
    item.innerHTML = `
      <div class="attachment-info">
        ${upload.storage_type === 'base64' && upload.data ? `<img src="${upload.data}" alt="" class="inventory-form-thumb">` : `<div class="attachment-icon">${renderIcon('file')}</div>`}
        <div class="attachment-details">
          <div class="attachment-name">${escapeHtml(upload.filename)}</div>
          <div class="attachment-meta">${formatFileSize(upload.size)}</div>
        </div>
      </div>
      <div>
        <button type="button" class="btn-link inventory-open-attachment" data-upload-id="${upload.id}">Open</button>
        <button type="button" class="btn-link btn-danger inventory-delete-attachment" data-upload-id="${upload.id}">${renderIcon('trash')}</button>
      </div>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll('.inventory-open-attachment').forEach((btn) => {
    btn.addEventListener('click', () => {
      const upload = getUpload(btn.dataset.uploadId);
      if (upload) openUpload(upload);
    });
  });
  container.querySelectorAll('.inventory-delete-attachment').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmAction({ title: 'Remove this photo?', confirmLabel: 'Remove', cancelLabel: 'Cancel', danger: true });
      if (!ok) return;
      await deleteUpload(btn.dataset.uploadId);
      renderInventoryAttachments(container);
    });
  });
}

export default {
  render,
  onMount
};
